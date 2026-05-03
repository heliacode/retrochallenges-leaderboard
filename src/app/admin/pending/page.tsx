import Link from 'next/link';
import {
  challengeHref,
  formatFrames,
  userProfileHref,
} from '@/lib/leaderboard';
import { listPendingRuns } from '@/lib/admin';
import { approveRunAction, rejectRunAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

// Anti-cheat review queue. Runs land here when they came in below the
// challenge's flagBelowFrames threshold (suspiciously fast but not
// physically impossible). Approve clears the flag and they go live;
// reject hides them with a reason and they leave the queue.
export default async function AdminPendingPage() {
  const rows = await listPendingRuns();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Pending review</h1>
        <p className="text-sm text-slate-400 mt-1">
          Runs flagged by the anti-cheat threshold. Approve to publish, or
          reject to hide them. Runs are <span className="text-amber-300">not visible</span> on
          public leaderboards while they sit here.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Game / Challenge</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">Time</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(r.serverReceivedAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={userProfileHref(r.user.id)}
                    className="text-slate-200 hover:text-indigo-300"
                  >
                    {r.user.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={challengeHref(r.game, r.challengeName)}
                    className="text-slate-200 hover:text-indigo-300"
                  >
                    {r.game} — {r.challengeName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-300">
                  {r.score != null ? r.score.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-amber-300" title="below flagBelowFrames threshold">
                  {formatFrames(r.completionTimeFrames)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <form
                    action={async () => { 'use server'; await approveRunAction(r.id); }}
                    className="inline mr-1"
                  >
                    <ActionButton type="submit" variant="ok">Approve</ActionButton>
                  </form>
                  <form
                    action={async (data) => {
                      'use server';
                      await rejectRunAction(r.id, (data.get('reason') as string) || null);
                    }}
                    className="inline"
                  >
                    <input type="hidden" name="reason" value="suspicious time" />
                    <ActionButton type="submit" variant="danger">Reject</ActionButton>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Queue is empty — no runs awaiting review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButton({ type, variant, children }: {
  type?: 'button' | 'submit';
  variant: 'ok' | 'warn' | 'danger';
  children: React.ReactNode;
}) {
  const base = 'rounded-md px-2 py-1 text-xs font-medium';
  const palette =
    variant === 'ok'     ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' :
    variant === 'warn'   ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'       :
                           'bg-red-500/20 text-red-300 hover:bg-red-500/30';
  return <button type={type ?? 'button'} className={`${base} ${palette}`}>{children}</button>;
}
