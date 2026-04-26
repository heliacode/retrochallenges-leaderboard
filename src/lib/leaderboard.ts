import { prisma } from './db';

export interface LeaderboardEntry {
  runId: string;
  rank: number;
  userId: string;
  userName: string;
  userPictureUrl: string | null;
  score: number | null;
  completionTimeFrames: number | null;
  serverReceivedAt: Date;
}

// Time-window keys for the daily / weekly / all-time leaderboard tabs.
export type LeaderboardWindow = 'daily' | 'weekly' | 'all';

const WINDOW_KEYS: readonly LeaderboardWindow[] = ['daily', 'weekly', 'all'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Validate an arbitrary string (e.g. from a URL query param) into a
// LeaderboardWindow, defaulting to 'all' if it isn't one of the known keys.
export function parseLeaderboardWindow(value: string | undefined | null): LeaderboardWindow {
  return WINDOW_KEYS.includes(value as LeaderboardWindow) ? (value as LeaderboardWindow) : 'all';
}

// Cutoff date for the supplied window. 'all' returns null (no cutoff).
// Exposed so tests / debugging can reason about it.
export function windowSince(window: LeaderboardWindow, now: Date = new Date()): Date | null {
  if (window === 'daily') return new Date(now.getTime() - 1 * DAY_MS);
  if (window === 'weekly') return new Date(now.getTime() - 7 * DAY_MS);
  return null;
}

// Top N rows for a (game, challenge) tuple within an optional time window.
// Ordering:
//   1. score DESC (nulls last)   — higher score wins
//   2. completionTimeFrames ASC  — faster wins ties (and is the primary
//                                  axis for challenges that have no score)
//   3. serverReceivedAt ASC      — whoever posted first breaks the final tie
export async function getChallengeLeaderboard(
  game: string,
  challengeName: string,
  limit = 50,
  window: LeaderboardWindow = 'all',
): Promise<LeaderboardEntry[]> {
  const since = windowSince(window);
  const rows = await prisma.run.findMany({
    where: {
      game,
      challengeName,
      hiddenAt: null,
      user: { bannedAt: null },
      ...(since ? { serverReceivedAt: { gte: since } } : {}),
    },
    orderBy: [
      { score: { sort: 'desc', nulls: 'last' } },
      { completionTimeFrames: { sort: 'asc', nulls: 'last' } },
      { serverReceivedAt: 'asc' },
    ],
    take: limit,
    select: {
      id: true,
      score: true,
      completionTimeFrames: true,
      serverReceivedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          pictureUrl: true,
        },
      },
    },
  });

  return rows.map((r, idx) => ({
    runId: r.id,
    rank: idx + 1,
    userId: r.user.id,
    userName: r.user.name,
    userPictureUrl: r.user.pictureUrl,
    score: r.score,
    completionTimeFrames: r.completionTimeFrames,
    serverReceivedAt: r.serverReceivedAt,
  }));
}

// Distinct (game, challengeName) pairs with visible runs, for the home page.
export async function listChallengesWithRuns() {
  const rows = await prisma.run.groupBy({
    by: ['game', 'challengeName'],
    where: {
      hiddenAt: null,
      user: { bannedAt: null },
    },
    _count: { _all: true },
    orderBy: [{ game: 'asc' }, { challengeName: 'asc' }],
  });
  return rows.map((r) => ({
    game: r.game,
    challengeName: r.challengeName,
    runCount: r._count._all,
  }));
}

// mm:ss.mmm from a frame count, assuming 60 fps (NES). Mirrors the
// formatter the desktop-app completion card uses so the same run reads
// the same everywhere.
export function formatFrames(frames: number | null): string {
  if (frames == null) return '—';
  const totalMs = Math.round((frames / 60) * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Percent-encoded segments for URL building. We keep game / challenge names
// as the raw identifiers rather than inventing slugs so the desktop app and
// site never disagree.
export function challengeHref(game: string, challengeName: string): string {
  return `/c/${encodeURIComponent(game)}/${encodeURIComponent(challengeName)}`;
}
