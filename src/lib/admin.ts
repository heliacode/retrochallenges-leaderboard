// Server-side data layer for the /admin section. Only imported from
// admin pages and admin server actions — every function here assumes
// requireAdmin() has already gated the caller. None of these queries
// filter by hiddenAt / bannedAt because admins want to see everything.

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Dashboard KPIs
// ---------------------------------------------------------------------------
export interface AdminKpis {
  totalUsers: number;
  bannedUsers: number;
  totalRuns: number;
  hiddenRuns: number;
  pendingRuns: number;
  runsLast24h: number;
  runsLast7d: number;
  newUsersLast7d: number;
}

export async function getAdminKpis(): Promise<AdminKpis> {
  const now = new Date();
  const dayAgo  = new Date(now.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    totalUsers, bannedUsers,
    totalRuns,  hiddenRuns, pendingRuns,
    runsLast24h, runsLast7d, newUsersLast7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.run.count(),
    prisma.run.count({ where: { hiddenAt: { not: null } } }),
    prisma.run.count({ where: { pendingReview: true, hiddenAt: null } }),
    prisma.run.count({ where: { serverReceivedAt: { gte: dayAgo } } }),
    prisma.run.count({ where: { serverReceivedAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  return {
    totalUsers, bannedUsers, totalRuns, hiddenRuns, pendingRuns,
    runsLast24h, runsLast7d, newUsersLast7d,
  };
}

// ---------------------------------------------------------------------------
// Submissions over time
// ---------------------------------------------------------------------------
// Two views: per-hour for the last 24h (granular live activity) and
// per-day for the last 30d (trend). Both bucketed in JS rather than via
// SQL date_trunc so we don't depend on Prisma raw queries / Postgres
// timezones — fine for the volumes we're at.

export interface TimeBucket { label: string; t: Date; count: number; }

export async function getSubmissionsByHour(hours = 24): Promise<TimeBucket[]> {
  const now = new Date();
  const start = new Date(now.getTime() - hours * 3600 * 1000);
  const rows = await prisma.run.findMany({
    where: { serverReceivedAt: { gte: start } },
    select: { serverReceivedAt: true },
    orderBy: { serverReceivedAt: 'asc' },
  });
  // Bucket each row into a per-hour slot keyed off the bucket-start ms.
  const buckets = new Map<number, number>();
  // Pre-seed every hour bucket so quiet hours render as a 0-bar instead
  // of a gap in the chart.
  for (let i = 0; i < hours; i++) {
    const t = new Date(now.getTime() - (hours - 1 - i) * 3600 * 1000);
    t.setMinutes(0, 0, 0);
    buckets.set(t.getTime(), 0);
  }
  for (const r of rows) {
    const t = new Date(r.serverReceivedAt);
    t.setMinutes(0, 0, 0);
    const k = t.getTime();
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([k, count]) => {
    const t = new Date(k);
    const label = t.toLocaleTimeString(undefined, { hour: 'numeric' });
    return { label, t, count };
  }).sort((a, b) => a.t.getTime() - b.t.getTime());
}

export async function getSubmissionsByDay(days = 30): Promise<TimeBucket[]> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const rows = await prisma.run.findMany({
    where: { serverReceivedAt: { gte: start } },
    select: { serverReceivedAt: true },
  });
  const buckets = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const t = new Date(now.getTime() - (days - 1 - i) * 24 * 3600 * 1000);
    t.setHours(0, 0, 0, 0);
    buckets.set(t.getTime(), 0);
  }
  for (const r of rows) {
    const t = new Date(r.serverReceivedAt);
    t.setHours(0, 0, 0, 0);
    const k = t.getTime();
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([k, count]) => {
    const t = new Date(k);
    const label = t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { label, t, count };
  }).sort((a, b) => a.t.getTime() - b.t.getTime());
}

// ---------------------------------------------------------------------------
// Top-N rankings
// ---------------------------------------------------------------------------
export interface ChallengeRank {
  game: string;
  challengeName: string;
  runs: number;
  players: number;
}

export async function getTopChallenges(limit = 10): Promise<ChallengeRank[]> {
  const groups = await prisma.run.groupBy({
    by: ['game', 'challengeName'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });
  // Distinct-player count per (game, challenge). N+1 with N = limit; fine.
  return Promise.all(
    groups.map(async (g) => {
      const players = await prisma.run.groupBy({
        by: ['userId'],
        where: { game: g.game, challengeName: g.challengeName },
      });
      return {
        game: g.game,
        challengeName: g.challengeName,
        runs: g._count._all,
        players: players.length,
      };
    }),
  );
}

export interface PlayerRank {
  userId: string;
  name: string;
  runs: number;
  challenges: number;
  bannedAt: Date | null;
}

export async function getTopPlayers(limit = 10): Promise<PlayerRank[]> {
  const groups = await prisma.run.groupBy({
    by: ['userId'],
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: limit,
  });
  return Promise.all(
    groups.map(async (g) => {
      const [user, challengeGroups] = await Promise.all([
        prisma.user.findUnique({
          where: { id: g.userId },
          select: { name: true, bannedAt: true },
        }),
        prisma.run.groupBy({
          by: ['game', 'challengeName'],
          where: { userId: g.userId },
        }),
      ]);
      return {
        userId: g.userId,
        name: user?.name ?? '(deleted user)',
        runs: g._count._all,
        challenges: challengeGroups.length,
        bannedAt: user?.bannedAt ?? null,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Day-of-week × hour activity heatmap
// ---------------------------------------------------------------------------
// 7 rows (Sun..Sat) × 24 cols (0..23). Returns flat list of { day, hour,
// count } for easy <Recharts ScatterChart> rendering — Recharts doesn't
// have a true heatmap component but ScatterChart with sized dots reads
// the same way at this density.
export interface HeatmapCell { day: number; dayLabel: string; hour: number; count: number; }

export async function getActivityHeatmap(weeks = 12): Promise<HeatmapCell[]> {
  const start = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000);
  const rows = await prisma.run.findMany({
    where: { serverReceivedAt: { gte: start } },
    select: { serverReceivedAt: true },
  });
  const counts = new Map<string, number>();   // key = `${day}:${hour}`
  for (const r of rows) {
    const t = new Date(r.serverReceivedAt);
    const key = `${t.getDay()}:${t.getHours()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      out.push({
        day,
        dayLabel: dayLabels[day],
        hour,
        count: counts.get(`${day}:${hour}`) ?? 0,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recent runs (admin view — includes hidden + banned-user runs)
// ---------------------------------------------------------------------------
export interface AdminRunRow {
  id: string;
  game: string;
  challengeName: string;
  score: number | null;
  completionTimeFrames: number | null;
  serverReceivedAt: Date;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  user: { id: string; name: string; bannedAt: Date | null };
}

export async function listAdminRuns(opts: {
  take?: number;
  skip?: number;
  game?: string;
  userId?: string;
  hidden?: 'all' | 'visible' | 'hidden';
} = {}): Promise<AdminRunRow[]> {
  const take = Math.min(opts.take ?? 50, 200);
  const skip = opts.skip ?? 0;
  const where: Record<string, unknown> = {};
  if (opts.game)   where.game = opts.game;
  if (opts.userId) where.userId = opts.userId;
  if (opts.hidden === 'visible') where.hiddenAt = null;
  if (opts.hidden === 'hidden')  where.hiddenAt = { not: null };

  const rows = await prisma.run.findMany({
    where,
    orderBy: { serverReceivedAt: 'desc' },
    take,
    skip,
    select: {
      id: true,
      game: true,
      challengeName: true,
      score: true,
      completionTimeFrames: true,
      serverReceivedAt: true,
      hiddenAt: true,
      hiddenReason: true,
      user: { select: { id: true, name: true, bannedAt: true } },
    },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// User list (admin view)
// ---------------------------------------------------------------------------
export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  bannedAt: Date | null;
  isAdmin: boolean;
  totalRuns: number;
  lastRunAt: Date | null;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      bannedAt: true,
      isAdmin: true,
      runs: {
        select: { serverReceivedAt: true },
        orderBy: { serverReceivedAt: 'desc' },
        take: 1,
      },
      _count: { select: { runs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    bannedAt: u.bannedAt,
    isAdmin: u.isAdmin,
    totalRuns: u._count.runs,
    lastRunAt: u.runs[0]?.serverReceivedAt ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export interface AuditRow {
  id: string;
  createdAt: Date;
  actorUserId: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
}

export async function listAuditLog(opts: {
  take?: number;
  skip?: number;
  actorUserId?: string;
  action?: string;
} = {}): Promise<AuditRow[]> {
  const take = Math.min(opts.take ?? 100, 500);
  const skip = opts.skip ?? 0;
  const where: Record<string, unknown> = {};
  if (opts.actorUserId) where.actorUserId = opts.actorUserId;
  if (opts.action)      where.action      = opts.action;

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    skip,
    include: {
      actor: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actorUserId: r.actorUserId,
    actorName: r.actor?.name ?? '(deleted user)',
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata,
  }));
}

// ---------------------------------------------------------------------------
// Pending review queue. Runs that came in below the manifest's
// flagBelowFrames threshold and haven't yet been approved or rejected
// by an admin. The queue lives at /admin/pending; cleared rows leave
// it via approveRunAction / rejectRunAction.
// ---------------------------------------------------------------------------
export interface PendingRunRow {
  id: string;
  game: string;
  challengeName: string;
  score: number | null;
  completionTimeFrames: number | null;
  serverReceivedAt: Date;
  user: { id: string; name: string };
}

export async function listPendingRuns(): Promise<PendingRunRow[]> {
  const rows = await prisma.run.findMany({
    where: { pendingReview: true, hiddenAt: null },
    orderBy: { serverReceivedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      game: true,
      challengeName: true,
      score: true,
      completionTimeFrames: true,
      serverReceivedAt: true,
      user: { select: { id: true, name: true } },
    },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Site setting (singleton)
// ---------------------------------------------------------------------------
export interface SiteBanner {
  text: string | null;
  level: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export async function getSiteBanner(): Promise<SiteBanner> {
  // Called from the root layout, which Next sometimes pre-renders for
  // static pages (e.g. /_not-found). Build environments may not have
  // DATABASE_URL set; rather than crashing the prerender, we degrade
  // to "no banner" and the layout renders normally without the bar.
  try {
    const row = await prisma.siteSetting.findUnique({ where: { id: 1 } });
    return {
      text:      row?.bannerText      ?? null,
      level:     row?.bannerLevel     ?? null,
      updatedAt: row?.bannerUpdatedAt ?? null,
      updatedBy: row?.bannerUpdatedBy ?? null,
    };
  } catch {
    return { text: null, level: null, updatedAt: null, updatedBy: null };
  }
}

// ---------------------------------------------------------------------------
// Per-challenge stats (admin view of every challenge that has at least
// one run, plus a "days since last run" indicator for spotting stale).
// ---------------------------------------------------------------------------
export interface AdminChallengeStat {
  game: string;
  challengeName: string;
  runs: number;
  players: number;
  fastestFrames: number | null;
  fastestPlayer: string | null;
  lastRunAt: Date | null;
}

export async function listAdminChallengeStats(): Promise<AdminChallengeStat[]> {
  const groups = await prisma.run.groupBy({
    by: ['game', 'challengeName'],
    _count: { _all: true },
    orderBy: [{ game: 'asc' }, { challengeName: 'asc' }],
  });

  return Promise.all(
    groups.map(async (g) => {
      const [players, fastest, latest] = await Promise.all([
        prisma.run.groupBy({
          by: ['userId'],
          where: { game: g.game, challengeName: g.challengeName },
        }),
        prisma.run.findFirst({
          where: {
            game: g.game,
            challengeName: g.challengeName,
            hiddenAt: null,
            pendingReview: false,
            user: { bannedAt: null },
            completionTimeFrames: { not: null },
          },
          orderBy: { completionTimeFrames: 'asc' },
          select: {
            completionTimeFrames: true,
            user: { select: { name: true } },
          },
        }),
        prisma.run.findFirst({
          where: { game: g.game, challengeName: g.challengeName },
          orderBy: { serverReceivedAt: 'desc' },
          select: { serverReceivedAt: true },
        }),
      ]);
      return {
        game: g.game,
        challengeName: g.challengeName,
        runs: g._count._all,
        players: players.length,
        fastestFrames: fastest?.completionTimeFrames ?? null,
        fastestPlayer: fastest?.user.name ?? null,
        lastRunAt: latest?.serverReceivedAt ?? null,
      };
    }),
  );
}
