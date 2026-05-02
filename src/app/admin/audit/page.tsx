import Link from 'next/link';
import { listAuditLog } from '@/lib/admin';
import { userProfileHref, challengeHref } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ actor?: string; action?: string; page?: string }>;
}

const PAGE_SIZE = 100;

const ACTIONS = [
  'hide_run', 'unhide_run', 'delete_run',
  'ban_user', 'unban_user',
  'grant_admin', 'revoke_admin',
  'set_banner', 'clear_banner',
] as const;

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const actorUserId = sp.actor?.trim() || undefined;
  const action      = sp.action?.trim() || undefined;
  const page        = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);

  const rows = await listAuditLog({
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
    actorUserId,
    action,
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-white">Audit log</h1>
        <p className="text-sm text-slate-400 mt-1">
          Every admin mutation is recorded here. Newest first. Filter by actor or
          action; metadata column is the JSON the action stored.
        </p>
      </header>

      <form className="flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          name="actor"
          placeholder="actor user id"
          defaultValue={actorUserId ?? ''}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 w-64"
        />
        <select
          name="action"
          defaultValue={action ?? ''}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
        >
          <option value="">all actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button
          type="submit"
          className="rounded-md bg-indigo-500 px-3 py-1 text-white font-medium hover:bg-indigo-600"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={userProfileHref(r.actorUserId)}
                    className="text-slate-200 hover:text-indigo-300"
                  >
                    {r.actorName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <ActionBadge action={r.action} />
                </td>
                <td className="px-3 py-2 text-xs">
                  <TargetCell type={r.targetType} id={r.targetId} metadata={r.metadata} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 font-mono max-w-md truncate" title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                  {r.metadata ? JSON.stringify(r.metadata) : <span className="text-slate-700">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No audit entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasMore={rows.length === PAGE_SIZE} actor={actorUserId} action={action} />
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const palette =
    action.startsWith('grant_') || action.startsWith('unhide') || action.startsWith('unban') ? 'bg-emerald-500/20 text-emerald-300' :
    action.startsWith('delete') || action.startsWith('ban_')   || action.startsWith('revoke') ? 'bg-red-500/20 text-red-300'         :
    action.startsWith('hide')   || action.startsWith('clear_') ? 'bg-amber-500/20 text-amber-300'                                    :
                                                                  'bg-indigo-500/20 text-indigo-300';
  return <span className={`rounded-md px-1.5 py-0.5 font-mono text-xs ${palette}`}>{action}</span>;
}

function TargetCell({ type, id, metadata }: { type: string | null; id: string | null; metadata: unknown }) {
  if (!type) return <span className="text-slate-700">—</span>;
  if (type === 'user' && id) {
    return (
      <Link href={`/admin/users/${id}`} className="text-indigo-300 hover:text-indigo-200">
        user · <span className="font-mono">{id.slice(0, 8)}…</span>
      </Link>
    );
  }
  if (type === 'run' && id) {
    // After delete the Run is gone; metadata snapshot has game / challenge.
    const meta = metadata as { game?: string; challengeName?: string } | null;
    if (meta?.game && meta?.challengeName) {
      return (
        <Link href={challengeHref(meta.game, meta.challengeName)} className="text-indigo-300 hover:text-indigo-200">
          run · {meta.game} — {meta.challengeName}
        </Link>
      );
    }
    return <span className="font-mono text-slate-400">run · {id.slice(0, 8)}…</span>;
  }
  return <span className="font-mono text-slate-400">{type}{id ? ` · ${id.slice(0, 16)}` : ''}</span>;
}

function Pagination({ page, hasMore, actor, action }: { page: number; hasMore: boolean; actor?: string; action?: string }) {
  const params = (n: number) => {
    const sp = new URLSearchParams();
    if (actor)  sp.set('actor', actor);
    if (action) sp.set('action', action);
    if (n > 0)  sp.set('page', String(n));
    return sp.toString() ? `?${sp.toString()}` : '';
  };
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>Page {page + 1}</span>
      <div className="space-x-2">
        {page > 0 && <Link href={`/admin/audit${params(page - 1)}`} className="hover:text-slate-200">← Prev</Link>}
        {hasMore && <Link href={`/admin/audit${params(page + 1)}`} className="hover:text-slate-200">Next →</Link>}
      </div>
    </div>
  );
}
