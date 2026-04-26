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

// Same shape as listChallengesWithRuns plus the rank-1 row inline, so the
// home page can preview each challenge's leader without a click.
export interface ChallengeSummary {
  game: string;
  challengeName: string;
  runCount: number;
  topRun: LeaderboardEntry | null;
}

export async function listChallengeSummaries(): Promise<ChallengeSummary[]> {
  const groups = await prisma.run.groupBy({
    by: ['game', 'challengeName'],
    where: { hiddenAt: null, user: { bannedAt: null } },
    _count: { _all: true },
    orderBy: [{ game: 'asc' }, { challengeName: 'asc' }],
  });
  // N+1 with N small (one query per challenge for its rank-1 row). Fine
  // at our scale (single-digit challenges); revisit with a single window
  // function query if the catalog grows beyond ~50.
  return Promise.all(
    groups.map(async (g) => {
      const top = await getChallengeLeaderboard(g.game, g.challengeName, 1);
      return {
        game: g.game,
        challengeName: g.challengeName,
        runCount: g._count._all,
        topRun: top[0] ?? null,
      };
    }),
  );
}

// Top-of-page totals for the home page.
export async function getOverallStats(): Promise<{
  totalRuns: number;
  totalPlayers: number;
  totalChallenges: number;
}> {
  const [totalRuns, totalPlayers, challengeGroups] = await Promise.all([
    prisma.run.count({ where: { hiddenAt: null, user: { bannedAt: null } } }),
    prisma.user.count({ where: { bannedAt: null, runs: { some: { hiddenAt: null } } } }),
    prisma.run.groupBy({
      by: ['game', 'challengeName'],
      where: { hiddenAt: null, user: { bannedAt: null } },
    }),
  ]);
  return { totalRuns, totalPlayers, totalChallenges: challengeGroups.length };
}

// Most recent submissions across all challenges, for the activity feed.
export interface RecentRunEntry {
  runId: string;
  game: string;
  challengeName: string;
  score: number | null;
  completionTimeFrames: number | null;
  serverReceivedAt: Date;
  userId: string;
  userName: string;
  userPictureUrl: string | null;
}

export async function getRecentRuns(limit = 10): Promise<RecentRunEntry[]> {
  const rows = await prisma.run.findMany({
    where: { hiddenAt: null, user: { bannedAt: null } },
    orderBy: { serverReceivedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      game: true,
      challengeName: true,
      score: true,
      completionTimeFrames: true,
      serverReceivedAt: true,
      user: { select: { id: true, name: true, pictureUrl: true } },
    },
  });
  return rows.map((r) => ({
    runId: r.id,
    game: r.game,
    challengeName: r.challengeName,
    score: r.score,
    completionTimeFrames: r.completionTimeFrames,
    serverReceivedAt: r.serverReceivedAt,
    userId: r.user.id,
    userName: r.user.name,
    userPictureUrl: r.user.pictureUrl,
  }));
}

// Compare two run metric pairs using the same rule the leaderboard uses
// for sorting: higher score wins; on a score tie (or both score-less),
// lower completionTimeFrames wins. Returns true when `a` is strictly
// better than `b`. Exposed so it's testable.
export interface RunMetric {
  score: number | null;
  completionTimeFrames: number | null;
}
export function isBetterRun(a: RunMetric, b: RunMetric): boolean {
  const as = a.score ?? -Infinity;
  const bs = b.score ?? -Infinity;
  if (as !== bs) return as > bs;
  const at = a.completionTimeFrames ?? Infinity;
  const bt = b.completionTimeFrames ?? Infinity;
  return at < bt;
}

// Rough relative-time string ("12m ago") for activity feed entries.
// We avoid pulling in a date lib for one helper.
export function formatRelative(date: Date, now: Date = new Date()): string {
  const ms = now.getTime() - date.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 5)        return 'just now';
  if (s < 60)       return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)       return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)       return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)       return `${d}d ago`;
  return date.toLocaleDateString();
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
