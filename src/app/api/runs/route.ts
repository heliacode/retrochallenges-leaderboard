import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifySubmissionSecret } from '@/lib/auth';
import { isBetterRun, getChallengeLeaderboard, challengeHref } from '@/lib/leaderboard';
import { notifyDiscordTopPlacement } from '@/lib/discord';

// Runtime schema for the submission payload. Matches the shape written
// by RC.report_completion + the caller-supplied user identity pulled
// from the desktop app's state.userInfo.
const SubmissionSchema = z.object({
  user: z.object({
    // Google OAuth `sub` / `id`. Opaque but stable; our primary key.
    googleSub: z.string().min(1).max(128),
    email: z.string().email().max(320),
    name: z.string().min(1).max(120),
    pictureUrl: z.string().url().max(2048).nullish(),
  }),
  game: z.string().min(1).max(120),
  challengeName: z.string().min(1).max(200),
  score: z.number().int().min(0).max(2_000_000_000).nullish(),
  completionTimeFrames: z.number().int().min(0).max(2_000_000_000).nullish(),
  clientReportedAt: z.string().datetime().nullish(),
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // 1. Auth: shared-secret header. Leaky (lives in the Electron binary)
  //    but stops casual curl abuse. Moderation is the real trust backstop.
  if (!verifySubmissionSecret(req.headers.get('x-rc-submission-secret'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Parse + validate.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = SubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const s = parsed.data;

  // At least one metric is required; a completion with neither score nor
  // time is almost certainly a bug in the challenge script, not a real run.
  if (s.score == null && s.completionTimeFrames == null) {
    return NextResponse.json(
      { error: 'no_metric', detail: 'score or completionTimeFrames required' },
      { status: 400 },
    );
  }

  // 3. Upsert user, insert run. Runs into the same User row on every
  //    submission from the same Google identity, keeping profile data fresh.
  try {
    const user = await prisma.user.upsert({
      where: { googleSub: s.user.googleSub },
      create: {
        googleSub: s.user.googleSub,
        email: s.user.email,
        name: s.user.name,
        pictureUrl: s.user.pictureUrl ?? null,
      },
      update: {
        email: s.user.email,
        name: s.user.name,
        pictureUrl: s.user.pictureUrl ?? null,
      },
    });

    // Look up the user's previous best on this challenge BEFORE the
    // insert so the new run isn't compared against itself. Same sort
    // order the public leaderboard uses.
    const priorBestRow = await prisma.run.findFirst({
      where: {
        userId: user.id,
        game: s.game,
        challengeName: s.challengeName,
        hiddenAt: null,
      },
      orderBy: [
        { score: { sort: 'desc', nulls: 'last' } },
        { completionTimeFrames: { sort: 'asc', nulls: 'last' } },
      ],
      select: { score: true, completionTimeFrames: true },
    });

    const run = await prisma.run.create({
      data: {
        userId: user.id,
        game: s.game,
        challengeName: s.challengeName,
        score: s.score ?? null,
        completionTimeFrames: s.completionTimeFrames ?? null,
        clientReportedAt: s.clientReportedAt ? new Date(s.clientReportedAt) : null,
        rawPayload: raw as object,
      },
    });

    // First-ever run for this (user, challenge) is always a personal best.
    const personalBest = !priorBestRow || isBetterRun(
      { score: run.score, completionTimeFrames: run.completionTimeFrames },
      priorBestRow,
    );

    // If the new run lands in the top 3 for the challenge, fire a
    // Discord webhook (fire-and-forget; won't delay the API response,
    // never blocks the success path).
    void (async () => {
      try {
        const top3 = await getChallengeLeaderboard(s.game, s.challengeName, 3);
        const idx = top3.findIndex((entry) => entry.runId === run.id);
        if (idx === -1) return;  // not top 3, nothing to celebrate
        const origin = req.nextUrl.origin;
        await notifyDiscordTopPlacement({
          rank: idx + 1,
          playerName: user.name,
          playerAvatarUrl: user.pictureUrl,
          game: s.game,
          challengeName: s.challengeName,
          score: run.score,
          completionTimeFrames: run.completionTimeFrames,
          publicHref: `${origin}${challengeHref(s.game, s.challengeName)}`,
        });
      } catch (err) {
        console.error('top-placement notification failed:', err);
      }
    })();

    return NextResponse.json(
      {
        ok: true,
        runId: run.id,
        personalBest,
        previousBest: priorBestRow,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Failed to record run:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
