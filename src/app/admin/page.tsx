import Link from 'next/link';
import {
  getAdminKpis,
  getActivityHeatmap,
  getSubmissionsByDay,
  getSubmissionsByHour,
  getTopChallenges,
  getTopPlayers,
} from '@/lib/admin';
import { challengeHref, userProfileHref } from '@/lib/leaderboard';
import {
  ActivityHeatmap,
  RankBar,
  SubmissionsLine,
} from '@/components/admin/AdminCharts';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [kpis, byHour, byDay, topChallenges, topPlayers, heatmap] = await Promise.all([
    getAdminKpis(),
    getSubmissionsByHour(24),
    getSubmissionsByDay(30),
    getTopChallenges(10),
    getTopPlayers(10),
    getActivityHeatmap(12),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          Live snapshot of activity, popular challenges, and the players driving them.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="users"        value={kpis.totalUsers}     sub={kpis.bannedUsers > 0 ? `${kpis.bannedUsers} banned` : undefined} />
        <Kpi label="runs"         value={kpis.totalRuns}      sub={kpis.hiddenRuns > 0 ? `${kpis.hiddenRuns} hidden` : undefined} />
        <Kpi label="last 24h"     value={kpis.runsLast24h}    sub={`${kpis.runsLast7d} in last 7d`} />
        <Kpi label="new players"  value={kpis.newUsersLast7d} sub="last 7 days" />
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-white mb-2">Submissions — last 24 hours</h2>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <SubmissionsLine data={byHour} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-white mb-2">Submissions — last 30 days</h2>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <SubmissionsLine data={byDay} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-white mb-2">Activity heatmap (last 12 weeks)</h2>
        <p className="text-xs text-slate-500 mb-2">
          Day-of-week × hour of submission. Bigger / brighter dot = more runs in that slot.
        </p>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <ActivityHeatmap data={heatmap} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-white mb-2">Top 10 challenges by runs</h2>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <RankBar
              data={topChallenges.map((c) => ({
                label: truncate(c.challengeName, 22),
                value: c.runs,
              }))}
            />
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {topChallenges.map((c) => (
                <li key={`${c.game}::${c.challengeName}`} className="flex items-center justify-between gap-2">
                  <Link
                    href={challengeHref(c.game, c.challengeName)}
                    className="truncate hover:text-indigo-300"
                  >
                    {c.game} — {c.challengeName}
                  </Link>
                  <span className="shrink-0 tabular-nums">
                    {c.runs} runs · {c.players} players
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-white mb-2">Top 10 players by runs</h2>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <RankBar
              data={topPlayers.map((p) => ({
                label: truncate(p.bannedAt ? `${p.name} (banned)` : p.name, 22),
                value: p.runs,
              }))}
            />
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {topPlayers.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-2">
                  <Link href={userProfileHref(p.userId)} className="truncate hover:text-indigo-300">
                    {p.name}
                    {p.bannedAt && (
                      <span className="ml-2 text-red-400">(banned)</span>
                    )}
                  </Link>
                  <span className="shrink-0 tabular-nums">
                    {p.runs} runs · {p.challenges} challenges
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
      <div className="font-display text-3xl font-bold text-white tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="text-xs uppercase text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
