import Link from 'next/link';
import { listAdminChallengeStats } from '@/lib/admin';
import { challengeHref, formatFrames } from '@/lib/leaderboard';
import { ResetChallengeButton } from '@/components/admin/ResetChallengeButton';

export const dynamic = 'force-dynamic';

export default async function AdminChallengesPage() {
  const stats = await listAdminChallengeStats();
  const now = Date.now();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Challenges</h1>
        <p className="text-sm text-slate-400 mt-1">
          Stats for every challenge that has at least one run. Challenge
          definitions live in the assets repo — edit there. The Reset
          column wipes every run for a challenge (irreversible) — use
          when the win predicate changes and old times are no longer
          comparable.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th className="px-3 py-2">Game / Challenge</th>
              <th className="px-3 py-2 text-right">Runs</th>
              <th className="px-3 py-2 text-right">Players</th>
              <th className="px-3 py-2 text-right">Fastest</th>
              <th className="px-3 py-2">Held by</th>
              <th className="px-3 py-2 text-right">Last run</th>
              <th className="px-3 py-2 text-right">Reset</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const daysSince = s.lastRunAt
                ? Math.floor((now - new Date(s.lastRunAt).getTime()) / (24 * 3600 * 1000))
                : null;
              const stale = daysSince !== null && daysSince >= 30;
              return (
                <tr key={`${s.game}::${s.challengeName}`} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    <Link
                      href={challengeHref(s.game, s.challengeName)}
                      className="text-slate-200 hover:text-indigo-300"
                    >
                      <span className="text-slate-500">{s.game}</span>
                      <span className="mx-1.5 text-slate-700">/</span>
                      {s.challengeName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300 tabular-nums">
                    {s.runs}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300 tabular-nums">
                    {s.players}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300">
                    {formatFrames(s.fastestFrames)}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {s.fastestPlayer ?? '—'}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs whitespace-nowrap ${stale ? 'text-amber-400' : 'text-slate-500'}`}>
                    {s.lastRunAt
                      ? `${new Date(s.lastRunAt).toLocaleDateString()}${daysSince ? ` (${daysSince}d ago)` : ''}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <ResetChallengeButton
                      game={s.game}
                      challengeName={s.challengeName}
                      runCount={s.runs}
                    />
                  </td>
                </tr>
              );
            })}
            {stats.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No challenges have runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Yellow "last run" highlights challenges with no submissions in 30+ days — possibly broken or forgotten.
      </p>
    </div>
  );
}
