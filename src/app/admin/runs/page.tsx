import Link from 'next/link';
import {
  challengeHref,
  formatFrames,
  userProfileHref,
} from '@/lib/leaderboard';
import { listAdminRuns } from '@/lib/admin';
import {
  hideRunAction,
  unhideRunAction,
  deleteRunAction,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    hidden?: string;
    game?: string;
    userId?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function AdminRunsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const hidden: 'all' | 'visible' | 'hidden' =
    sp.hidden === 'visible' ? 'visible' :
    sp.hidden === 'hidden'  ? 'hidden'  : 'all';
  const game   = sp.game?.trim() || undefined;
  const userId = sp.userId?.trim() || undefined;
  const page   = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);

  const rows = await listAdminRuns({
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
    game,
    userId,
    hidden,
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Runs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Most recent first. Hide removes from public leaderboards (soft); restore brings back; delete is permanent.
        </p>
      </header>

      <Filters hidden={hidden} game={game} userId={userId} />

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Game / Challenge</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">Time</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.hiddenAt ? 'border-t border-slate-800 opacity-60' : 'border-t border-slate-800'}>
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
                  {r.user.bannedAt && (
                    <span className="ml-2 text-xs text-red-400">banned</span>
                  )}
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
                <td className="px-3 py-2 text-right font-mono text-slate-300">
                  {formatFrames(r.completionTimeFrames)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.hiddenAt
                    ? <span className="text-amber-300">hidden{r.hiddenReason ? `: ${r.hiddenReason}` : ''}</span>
                    : <span className="text-emerald-300">live</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.hiddenAt ? (
                    <form
                      action={async () => { 'use server'; await unhideRunAction(r.id); }}
                      className="inline"
                    >
                      <ActionButton type="submit" variant="ok">Restore</ActionButton>
                    </form>
                  ) : (
                    <form
                      action={async (data) => {
                        'use server';
                        await hideRunAction(r.id, (data.get('reason') as string) || null);
                      }}
                      className="inline"
                    >
                      <input type="hidden" name="reason" value="" />
                      <ActionButton type="submit" variant="warn">Hide</ActionButton>
                    </form>
                  )}
                  <form
                    action={async () => { 'use server'; await deleteRunAction(r.id); }}
                    className="inline ml-1"
                  >
                    <ActionButton type="submit" variant="danger">Delete</ActionButton>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No runs match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={rows.length === PAGE_SIZE} hidden={hidden} game={game} userId={userId} />
    </div>
  );
}

function Filters({ hidden, game, userId }: { hidden: string; game?: string; userId?: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2 text-xs">
      <select
        name="hidden"
        defaultValue={hidden}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
      >
        <option value="all">all runs</option>
        <option value="visible">visible only</option>
        <option value="hidden">hidden only</option>
      </select>
      <input
        type="text"
        name="game"
        placeholder="game name"
        defaultValue={game ?? ''}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
      />
      <input
        type="text"
        name="userId"
        placeholder="user id"
        defaultValue={userId ?? ''}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 w-72"
      />
      <button
        type="submit"
        className="rounded-md bg-indigo-500 px-3 py-1 text-white font-medium hover:bg-indigo-600"
      >
        Filter
      </button>
    </form>
  );
}

function Pagination({ page, hasMore, hidden, game, userId }: { page: number; hasMore: boolean; hidden: string; game?: string; userId?: string }) {
  const params = (n: number) => {
    const sp = new URLSearchParams();
    if (hidden !== 'all') sp.set('hidden', hidden);
    if (game)   sp.set('game', game);
    if (userId) sp.set('userId', userId);
    if (n > 0)  sp.set('page', String(n));
    return sp.toString() ? `?${sp.toString()}` : '';
  };
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>Page {page + 1}</span>
      <div className="space-x-2">
        {page > 0 && (
          <Link href={`/admin/runs${params(page - 1)}`} className="hover:text-slate-200">← Prev</Link>
        )}
        {hasMore && (
          <Link href={`/admin/runs${params(page + 1)}`} className="hover:text-slate-200">Next →</Link>
        )}
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
