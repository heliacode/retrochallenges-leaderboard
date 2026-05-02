import Link from 'next/link';
import { listAdminUsers } from '@/lib/admin';
import { userProfileHref } from '@/lib/leaderboard';
import {
  banUserAction,
  unbanUserAction,
  grantAdminAction,
  revokeAdminAction,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400 mt-1">
            Newest first. Ban hides their runs from public leaderboards (the rows
            stay in the DB so you can unban without data loss).
          </p>
        </div>
        <span className="text-xs text-slate-500">{users.length} total</span>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-700">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 hidden sm:table-cell">Email</th>
              <th className="px-3 py-2 hidden md:table-cell">Joined</th>
              <th className="px-3 py-2 hidden md:table-cell">Last run</th>
              <th className="px-3 py-2 text-right">Runs</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.bannedAt ? 'border-t border-slate-800 opacity-60' : 'border-t border-slate-800'}>
                <td className="px-3 py-2">
                  <Link href={userProfileHref(u.id)} className="text-slate-200 hover:text-indigo-300">
                    {u.name}
                  </Link>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="ml-2 text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    drill →
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 hidden sm:table-cell font-mono">
                  {u.email}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">
                  {u.lastRunAt ? new Date(u.lastRunAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-300 tabular-nums">
                  {u.totalRuns}
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.bannedAt
                    ? <span className="text-red-400">banned</span>
                    : <span className="text-emerald-300">active</span>}
                  {u.isAdmin && <span className="ml-2 text-indigo-300">★ admin</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {u.isAdmin ? (
                    <form
                      action={async () => { 'use server'; await revokeAdminAction(u.id); }}
                      className="inline mr-1"
                    >
                      <ActionButton type="submit" variant="warn">Revoke admin</ActionButton>
                    </form>
                  ) : (
                    <form
                      action={async () => { 'use server'; await grantAdminAction(u.id); }}
                      className="inline mr-1"
                    >
                      <ActionButton type="submit" variant="ok">Make admin</ActionButton>
                    </form>
                  )}
                  {u.bannedAt ? (
                    <form
                      action={async () => { 'use server'; await unbanUserAction(u.id); }}
                      className="inline"
                    >
                      <ActionButton type="submit" variant="ok">Unban</ActionButton>
                    </form>
                  ) : (
                    <form
                      action={async () => { 'use server'; await banUserAction(u.id); }}
                      className="inline"
                    >
                      <ActionButton type="submit" variant="danger">Ban</ActionButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
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
