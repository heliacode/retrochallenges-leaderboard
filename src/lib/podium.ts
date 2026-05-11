// "Best Player" podium aggregation.
//
// For each time window (daily / weekly / all-time), we score every user
// by:
//   1. Pull every visible (un-hidden, non-pending, non-banned) run in
//      the window.
//   2. For each (user, game, challenge), keep the BEST run — i.e. the
//      highest grade earned across their runs on that one challenge.
//   3. Convert each best-grade to grade points (SSS=100 → B=10) and
//      sum the user's totals.
//   4. Return the user with the highest sum.
//
// The whole computation runs in-memory after one query per window —
// fine while the run table is small. If/when that table grows we'll
// move the aggregation into SQL.

import { prisma } from '@/lib/db';
import { gradeForRun, type Grade } from '@/lib/grading';
import { getChallengesManifest, manifestKey } from '@/lib/challenges-manifest';

export type PodiumWindow = 'daily' | 'weekly' | 'all';

// Mirrors challenges.json -> metadata.gradePoints. The manifest loader
// doesn't parse this block today (the grading helper is the only
// consumer and it cares about thresholds, not points), so we duplicate
// the constants here. Diverging from the manifest is a bug; if the
// catalog ever ships a per-challenge override we'll lift this into
// challenges-manifest.ts.
const GRADE_POINTS: Record<Grade, number> = {
  SSS: 100,
  SS:  75,
  S:   50,
  A:   25,
  B:   10,
};

export interface PodiumEntry {
  userId: string;
  userName: string;
  userPictureUrl: string | null;
  totalPoints: number;
  challengesGraded: number;
}

const WINDOW_MS: Record<PodiumWindow, number | null> = {
  daily:  24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  all:    null,
};

export async function getTopPlayer(window: PodiumWindow): Promise<PodiumEntry | null> {
  const ms = WINDOW_MS[window];
  const since = ms != null ? new Date(Date.now() - ms) : undefined;

  const runs = await prisma.run.findMany({
    where: {
      hiddenAt: null,
      pendingReview: false,
      user: { bannedAt: null },
      ...(since ? { serverReceivedAt: { gte: since } } : {}),
    },
    select: {
      userId: true,
      game: true,
      challengeName: true,
      completionTimeFrames: true,
      user: {
        select: { id: true, name: true, pictureUrl: true },
      },
    },
  });

  if (runs.length === 0) return null;

  const manifest = await getChallengesManifest();

  // Track best grade per (user, challenge). A user's many runs on the
  // same challenge collapse to one entry — the highest-rank grade.
  interface BestPerChallenge {
    userId: string;
    userName: string;
    userPictureUrl: string | null;
    points: number;
  }
  const bestByPair = new Map<string, BestPerChallenge>();

  for (const run of runs) {
    const meta = manifest.get(manifestKey(run.game, run.challengeName));
    const grade = gradeForRun(meta?.gradeThresholds, run.completionTimeFrames);
    if (!grade) continue;
    const points = GRADE_POINTS[grade];
    const pairKey = `${run.userId}::${run.game}::${run.challengeName}`;
    const prev = bestByPair.get(pairKey);
    if (!prev || points > prev.points) {
      bestByPair.set(pairKey, {
        userId: run.userId,
        userName: run.user.name,
        userPictureUrl: run.user.pictureUrl,
        points,
      });
    }
  }

  // Sum points per user.
  interface UserTotal {
    userName: string;
    userPictureUrl: string | null;
    totalPoints: number;
    challengesGraded: number;
  }
  const totals = new Map<string, UserTotal>();
  for (const v of bestByPair.values()) {
    const prev = totals.get(v.userId);
    if (prev) {
      prev.totalPoints      += v.points;
      prev.challengesGraded += 1;
    } else {
      totals.set(v.userId, {
        userName: v.userName,
        userPictureUrl: v.userPictureUrl,
        totalPoints: v.points,
        challengesGraded: 1,
      });
    }
  }

  let top: PodiumEntry | null = null;
  for (const [userId, t] of totals.entries()) {
    if (!top || t.totalPoints > top.totalPoints) {
      top = {
        userId,
        userName: t.userName,
        userPictureUrl: t.userPictureUrl,
        totalPoints: t.totalPoints,
        challengesGraded: t.challengesGraded,
      };
    }
  }
  return top;
}
