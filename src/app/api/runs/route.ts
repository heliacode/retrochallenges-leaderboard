import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifySubmissionSecret } from '@/lib/auth';
import { isBetterRun, getChallengeLeaderboard, challengeHref } from '@/lib/leaderboard';
import { notifyDiscordTopPlacement } from '@/lib/discord';
import { getChallengeAntiCheatThresholds } from '@/lib/challenges-manifest';
import { rateLimit } from '@/lib/rate-limit';

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

// Per-IP rate limit for the submit endpoint. The shared submission
// secret lives in the Electron binary — anyone who installs the app can
// extract it and start submitting. The most likely abuse is a spam
// flood (curl loop with random googleSubs creating fake user records).
// 10/min/IP is way above any legit player's submission rate (challenges
// take 30s+) but caps a flood at ~600/hour/IP — small enough that the
// /admin/pending queue can keep up with manual cleanup.
const RUNS_RATE_MAX        = 10;
const RUNS_RATE_WINDOW_MS  = 60_000;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

export async function POST(req: NextRequest) {
  // 1. Auth: shared-secret header. Leaky (lives in the Electron binary)
  //    but stops casual curl abuse. Moderation is the real trust backstop.
  if (!verifySubmissionSecret(req.headers.get('x-rc-submission-secret'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 1b. Rate limit per source IP. Authenticated callers still get
  //     limited so a leaked secret can't fuel an unlimited flood.
  const ip    = clientIp(req);
  const limit = rateLimit(`runs:${ip}`, RUNS_RATE_MAX, RUNS_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', detail: 'Too many submissions; try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil(limit.resetMs / 1000)),
          'X-RateLimit-Limit':     String(RUNS_RATE_MAX),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
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

  // 2b. Anti-cheat screening. Per-challenge thresholds in the manifest:
  //     - completionTimeFrames < minPlausibleFrames → REJECT (currently disabled — see below)
  //     - completionTimeFrames < flagBelowFrames    → insert with pendingReview=true
  //     A challenge with no thresholds skips screening (fail-open).
  //
  // The minPlausibleFrames REJECTION is temporarily disabled: the early
  // thresholds turned out too aggressive for legitimate fast runs, and
  // a hard 400 is a worse player experience than a soft "queued for
  // review" while we tune them. Soft flagging is enough — admins can
  // catch impossible submissions in /admin/pending and reject them
  // manually. Re-enable when thresholds are calibrated against real
  // player data.
  let pendingReview = false;
  if (s.completionTimeFrames != null) {
    const thresholds = await getChallengeAntiCheatThresholds(s.game, s.challengeName);
    if (thresholds.flagBelowFrames != null && s.completionTimeFrames < thresholds.flagBelowFrames) {
      pendingReview = true;
    }
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
    // order the public leaderboard uses. Pending runs aren't counted —
    // a flagged time shouldn't masquerade as the user's PB until cleared.
    const priorBestRow = await prisma.run.findFirst({
      where: {
        userId: user.id,
        game: s.game,
        challengeName: s.challengeName,
        hiddenAt: null,
        pendingReview: false,
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
        pendingReview,
        rawPayload: raw as object,
      },
    });

    // PB + Discord notification only fire if the run isn't pending review.
    // A flagged run shouldn't claim a podium spot or trigger a celebration
    // until an admin clears it.
    const personalBest =
      !pendingReview &&
      (!priorBestRow ||
        isBetterRun(
          { score: run.score, completionTimeFrames: run.completionTimeFrames },
          priorBestRow,
        ));

    if (!pendingReview) {
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
    }

    return NextResponse.json(
      {
        ok: true,
        runId: run.id,
        personalBest,
        previousBest: priorBestRow,
        pendingReview,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Failed to record run:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
