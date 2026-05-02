import { prisma } from './db';
import { getGamesManifest } from './challenges-manifest';

// Resolve a user's effective avatar URL: if they uploaded a custom one
// it lives at /api/users/<id>/avatar, otherwise we fall back to whatever
// Google OAuth gave us at sign-in time. Centralized so every leaderboard /
// profile / activity response uses the same logic.
export function effectivePictureUrl(user: {
  id: string;
  pictureUrl: string | null;
  hasCustomAvatar?: boolean | null;
}): string | null {
  if (user.hasCustomAvatar) return `/api/users/${user.id}/avatar`;
  return user.pictureUrl;
}

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

// View modes for the per-challenge leaderboard:
//   'best'    — one row per player, showing their best run (default)
//   'all'     — every run, including multiple by the same player
export type LeaderboardView = 'best' | 'all';

const VIEW_KEYS: readonly LeaderboardView[] = ['best', 'all'];
export function parseLeaderboardView(value: string | undefined | null): LeaderboardView {
  return VIEW_KEYS.includes(value as LeaderboardView) ? (value as LeaderboardView) : 'best';
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
//   1. completionTimeFrames ASC (nulls last) — fastest wins, primary axis
//   2. score DESC (nulls last)               — higher score breaks ties
//   3. serverReceivedAt ASC                  — whoever posted first breaks
//                                              the final tie
//
// view='best' (default) collapses to one row per user (their best run).
// view='all' shows every run including duplicates from the same user.
export async function getChallengeLeaderboard(
  game: string,
  challengeName: string,
  limit = 50,
  window: LeaderboardWindow = 'all',
  view: LeaderboardView = 'best',
): Promise<LeaderboardEntry[]> {
  const since = windowSince(window);
  const baseWhere = {
    game,
    challengeName,
    hiddenAt: null,
    user: { bannedAt: null },
    ...(since ? { serverReceivedAt: { gte: since } } : {}),
  };
  const baseSelect = {
    id: true,
    score: true,
    completionTimeFrames: true,
    serverReceivedAt: true,
    user: {
      select: { id: true, name: true, pictureUrl: true, hasCustomAvatar: true },
    },
  } as const;

  type RawRow = {
    id: string;
    score: number | null;
    completionTimeFrames: number | null;
    serverReceivedAt: Date;
    user: { id: string; name: string; pictureUrl: string | null; hasCustomAvatar: boolean };
  };

  let rows: RawRow[];

  if (view === 'best') {
    // DISTINCT ON userId — Prisma requires the distinct field to lead the
    // orderBy, so we order by userId first to satisfy Postgres, then by
    // the leaderboard sort to pick each user's best row. Result is
    // ordered by userId; we re-sort into leaderboard order in JS and
    // slice to the limit.
    const dedup = await prisma.run.findMany({
      where: baseWhere,
      distinct: ['userId'],
      orderBy: [
        { userId: 'asc' },
        { completionTimeFrames: { sort: 'asc', nulls: 'last' } },
        { score: { sort: 'desc', nulls: 'last' } },
      ],
      select: baseSelect,
    });
    dedup.sort((a, b) => {
      const at = a.completionTimeFrames ?? Infinity;
      const bt = b.completionTimeFrames ?? Infinity;
      if (at !== bt) return at - bt;
      const as = a.score ?? -Infinity;
      const bs = b.score ?? -Infinity;
      if (as !== bs) return bs - as;
      return a.serverReceivedAt.getTime() - b.serverReceivedAt.getTime();
    });
    rows = dedup.slice(0, limit);
  } else {
    rows = await prisma.run.findMany({
      where: baseWhere,
      orderBy: [
        { completionTimeFrames: { sort: 'asc', nulls: 'last' } },
        { score: { sort: 'desc', nulls: 'last' } },
        { serverReceivedAt: 'asc' },
      ],
      take: limit,
      select: baseSelect,
    });
  }

  return rows.map((r, idx) => ({
    runId: r.id,
    rank: idx + 1,
    userId: r.user.id,
    userName: r.user.name,
    userPictureUrl: effectivePictureUrl(r.user),
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
  playerCount: number;
  topRun: LeaderboardEntry | null;
}

// `game` (optional) scopes the result to a single game's challenges, used
// by /g/[game] to render the game-detail page. Unscoped, this powers the
// home page's cross-game catalog.
export async function listChallengeSummaries(game?: string): Promise<ChallengeSummary[]> {
  const groups = await prisma.run.groupBy({
    by: ['game', 'challengeName'],
    where: {
      hiddenAt: null,
      user: { bannedAt: null },
      ...(game ? { game } : {}),
    },
    _count: { _all: true },
    orderBy: [{ game: 'asc' }, { challengeName: 'asc' }],
  });
  // N+1 with N small (two queries per challenge — rank-1 row + distinct-
  // userId count for the "X players" stat). Fine at our scale (single-
  // digit challenges); revisit with a single window-function query if the
  // catalog grows beyond ~50.
  return Promise.all(
    groups.map(async (g) => {
      const [top, playerGroups] = await Promise.all([
        getChallengeLeaderboard(g.game, g.challengeName, 1),
        prisma.run.groupBy({
          by: ['userId'],
          where: {
            game: g.game,
            challengeName: g.challengeName,
            hiddenAt: null,
            user: { bannedAt: null },
          },
        }),
      ]);
      return {
        game: g.game,
        challengeName: g.challengeName,
        runCount: g._count._all,
        playerCount: playerGroups.length,
        topRun: top[0] ?? null,
      };
    }),
  );
}

// One row per game that has at least one visible run. Powers the game-tile
// grid on the home page — each tile links to /g/[game] and shows the per-
// game stat strip (challenges / runs / players).
//
// Implementation: one groupBy('game') for the run counts, then per-game
// secondary groupBy queries to count distinct challenges and distinct
// players. N+1 with N = number of games (single-digit at our scale, low
// double-digit in the foreseeable future) — revisit with a single SQL
// window-function query if the catalog ever grows beyond ~50 games.
export interface GameSummary {
  game: string;
  totalChallenges: number;
  totalRuns: number;
  totalPlayers: number;
  // Pulled from the assets-repo manifest (boxArtUrl per game). Optional
  // because not every game ships a box-art URL — game tile renders a
  // text-only fallback when missing.
  boxArtUrl?: string;
}

export async function listGames(): Promise<GameSummary[]> {
  const [games, manifest] = await Promise.all([
    prisma.run.groupBy({
      by: ['game'],
      where: { hiddenAt: null, user: { bannedAt: null } },
      _count: { _all: true },
      orderBy: { game: 'asc' },
    }),
    getGamesManifest(),
  ]);
  return Promise.all(
    games.map(async (g) => {
      const [challengeRows, playerRows] = await Promise.all([
        prisma.run.groupBy({
          by: ['challengeName'],
          where: { game: g.game, hiddenAt: null, user: { bannedAt: null } },
        }),
        prisma.run.groupBy({
          by: ['userId'],
          where: { game: g.game, hiddenAt: null, user: { bannedAt: null } },
        }),
      ]);
      return {
        game: g.game,
        boxArtUrl: manifest.get(g.game)?.boxArtUrl,
        totalChallenges: challengeRows.length,
        totalRuns: g._count._all,
        totalPlayers: playerRows.length,
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
// `firstEverCompletion`, `personalBest`, and `attemptStreak` are storyline
// flags the renderer turns into emoji annotations so the feed reads as
// little narratives rather than an opaque list of times.
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
  // True when this run is the first time anyone ever cleared this challenge.
  firstEverCompletion: boolean;
  // True when this run is strictly better than every prior run by the same
  // user on the same challenge (under the time-first / score-tiebreak rule).
  personalBest: boolean;
  // Count of THIS user's runs on THIS challenge in the last 60 minutes,
  // including this row itself. ≥3 reads as "they're hammering at it".
  attemptStreak: number;
}

const STREAK_WINDOW_MS = 60 * 60 * 1000;  // 1 hour

export async function getRecentRuns(limit = 10): Promise<RecentRunEntry[]> {
  const rows = await prisma.run.findMany({
    where: { hiddenAt: null, user: { bannedAt: null } },
    orderBy: { serverReceivedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      game: true,
      challengeName: true,
      score: true,
      completionTimeFrames: true,
      serverReceivedAt: true,
      user: { select: { id: true, name: true, pictureUrl: true, hasCustomAvatar: true } },
    },
  });

  // Per-row enrichment: three independent queries fanned out in parallel
  // for each of the (small) recent set. N+1 with N ≤ ~20 — fine at our
  // scale; revisit with a window-function aggregation when this hits the
  // hundreds-of-runs-per-page tier.
  return Promise.all(
    rows.map(async (r): Promise<RecentRunEntry> => {
      const streakSince = new Date(r.serverReceivedAt.getTime() - STREAK_WINDOW_MS);

      const [firstEver, priorBetter, streakCount] = await Promise.all([
        // Was this the first-ever submission on this (game, challenge)?
        prisma.run.findFirst({
          where: {
            game: r.game,
            challengeName: r.challengeName,
            hiddenAt: null,
            user: { bannedAt: null },
            serverReceivedAt: { lt: r.serverReceivedAt },
          },
          select: { id: true },
        }),
        // Did this user have a strictly-better run on this challenge BEFORE
        // this one? Time-first comparison; null ranks worse than any number.
        prisma.run.findFirst({
          where: {
            userId: r.userId,
            game: r.game,
            challengeName: r.challengeName,
            hiddenAt: null,
            serverReceivedAt: { lt: r.serverReceivedAt },
          },
          orderBy: [
            { completionTimeFrames: { sort: 'asc', nulls: 'last' } },
            { score: { sort: 'desc', nulls: 'last' } },
          ],
          select: { score: true, completionTimeFrames: true },
        }),
        // How many runs has this user had on this challenge within the last
        // hour, including this one?
        prisma.run.count({
          where: {
            userId: r.userId,
            game: r.game,
            challengeName: r.challengeName,
            hiddenAt: null,
            serverReceivedAt: { gte: streakSince, lte: r.serverReceivedAt },
          },
        }),
      ]);

      const personalBest = !priorBetter || isBetterRun(
        { score: r.score, completionTimeFrames: r.completionTimeFrames },
        priorBetter,
      );

      return {
        runId: r.id,
        game: r.game,
        challengeName: r.challengeName,
        score: r.score,
        completionTimeFrames: r.completionTimeFrames,
        serverReceivedAt: r.serverReceivedAt,
        userId: r.user.id,
        userName: r.user.name,
        userPictureUrl: effectivePictureUrl(r.user),
        firstEverCompletion: !firstEver,
        personalBest,
        attemptStreak: streakCount,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// User profile data
// ---------------------------------------------------------------------------
export interface UserProfile {
  userId: string;
  name: string;
  pictureUrl: string | null;
  createdAt: Date;
  totalRuns: number;
  challenges: UserProfileChallenge[];
}

// One row per (game, challengeName) the user has runs on.
export interface UserProfileChallenge {
  game: string;
  challengeName: string;
  attempts: number;
  bestRun: {
    runId: string;
    score: number | null;
    completionTimeFrames: number | null;
    serverReceivedAt: Date;
  };
  rank: number | null;   // null if we couldn't determine; otherwise 1-based
}

// Build a UserProfile for /u/<userId>. Rank is computed by counting how many
// users have a strictly-better best on the same challenge — cheap at our
// scale (single-digit challenges, low triple-digit users), revisit if either
// climbs by an order of magnitude.
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      pictureUrl: true,
      hasCustomAvatar: true,
      createdAt: true,
      bannedAt: true,
    },
  });
  if (!user || user.bannedAt) return null;

  const userRuns = await prisma.run.findMany({
    where: { userId, hiddenAt: null },
    orderBy: [
      { completionTimeFrames: { sort: 'asc', nulls: 'last' } },
      { score: { sort: 'desc', nulls: 'last' } },
    ],
    select: {
      id: true,
      game: true,
      challengeName: true,
      score: true,
      completionTimeFrames: true,
      serverReceivedAt: true,
    },
  });

  // Collapse to one row per (game, challengeName) — the first occurrence
  // is already the user's best because the orderBy mirrors the leaderboard
  // sort. Count attempts per challenge for the secondary stat.
  const byChallenge = new Map<string, { best: typeof userRuns[number]; attempts: number }>();
  for (const r of userRuns) {
    const key = `${r.game}::${r.challengeName}`;
    const existing = byChallenge.get(key);
    if (!existing) {
      byChallenge.set(key, { best: r, attempts: 1 });
    } else {
      existing.attempts += 1;
    }
  }

  const challenges: UserProfileChallenge[] = await Promise.all(
    Array.from(byChallenge.values()).map(async ({ best, attempts }) => {
      const top = await getChallengeLeaderboard(best.game, best.challengeName, 100);
      const idx = top.findIndex((entry) => entry.userId === userId);
      return {
        game: best.game,
        challengeName: best.challengeName,
        attempts,
        bestRun: {
          runId: best.id,
          score: best.score,
          completionTimeFrames: best.completionTimeFrames,
          serverReceivedAt: best.serverReceivedAt,
        },
        rank: idx >= 0 ? idx + 1 : null,
      };
    }),
  );

  challenges.sort((a, b) => {
    if (a.game !== b.game) return a.game.localeCompare(b.game);
    return a.challengeName.localeCompare(b.challengeName);
  });

  return {
    userId: user.id,
    name: user.name,
    pictureUrl: effectivePictureUrl(user),
    createdAt: user.createdAt,
    totalRuns: userRuns.length,
    challenges,
  };
}

export function userProfileHref(userId: string): string {
  return `/u/${encodeURIComponent(userId)}`;
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
  // Time-first ranking: every shipping challenge is a speedrun (the
  // win predicate is a state — boss dead, score reached, etc. — and
  // the leaderboard cares about how fast you got there). Score is
  // only used as a tie-break so score-only legacy challenges still
  // sort sanely.
  const at = a.completionTimeFrames ?? Infinity;
  const bt = b.completionTimeFrames ?? Infinity;
  if (at !== bt) return at < bt;
  const as = a.score ?? -Infinity;
  const bs = b.score ?? -Infinity;
  return as > bs;
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
// site never disagree. Both helpers emit URLs under /leaderboards/ —
// individual pages live there so the catalog hierarchy is consistent.
export function challengeHref(game: string, challengeName: string): string {
  return `/leaderboards/c/${encodeURIComponent(game)}/${encodeURIComponent(challengeName)}`;
}

export function gameHref(game: string): string {
  return `/leaderboards/g/${encodeURIComponent(game)}`;
}
