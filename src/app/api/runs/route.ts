import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifySubmissionSecret } from '@/lib/auth';

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

    return NextResponse.json({ ok: true, runId: run.id }, { status: 201 });
  } catch (err) {
    console.error('Failed to record run:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
