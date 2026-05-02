import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { challengeHref, formatFrames, userProfileHref } from '@/lib/leaderboard';
import { listAdminRuns } from '@/lib/admin';
import {
  banUserAction,
  unbanUserAction,
  hideRunAction,
  unhideRunAction,
  deleteRunAction,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminUserDrillPage({ params }: PageProps) {
  const { userId } = await params;
  const [user, runs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, googleSub: true,
        createdAt: true, bannedAt: true, hasCustomAvatar: true,
        _count: { select: { runs: true } },
      },
    }),
    listAdminRuns({ userId, take: 100, hidden: 'all' }),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {user.email} · joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right space-x-2">
          <Link href={userProfileHref(user.id)} className="text-xs text-slate-400 hover:text-slate-200">
            Public profile →
          </Link>
          {user.bannedAt ? (
            <form
              action={async () => { 'use server'; await unbanUserAction(user.id); }}
              className="inline"
            >
              <button type="submit" className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30">
                Unban user
              </button>
            </form>
          ) : (
            <form
              action={async () => { 'use server'; await banUserAction(user.id); }}
              className="inline"
            >
              <button type="submit" className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30">
                Ban user
              </button>
            </form>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <KV label="user.id">       {user.id}                            </KV>
        <KV label="googleSub">     {user.googleSub}                     </KV>
        <KV label="custom avatar"> {user.hasCustomAvatar ? 'yes' : 'no'} </KV>
        <KV label="state">         {user.bannedAt ? 'banned' : 'active'} </KV>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-white mb-2">
          Runs ({user._count.runs})
        </h2>
        <p className="text-xs text-slate-500 mb-2">Showing the most-recent 100.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-700">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Game / Challenge</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">Time</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={r.hiddenAt ? 'border-t border-slate-800 opacity-60' : 'border-t border-slate-800'}>
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.serverReceivedAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
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
                      ? <span className="text-amber-300">hidden</span>
                      : <span className="text-emerald-300">live</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {r.hiddenAt ? (
                      <form action={async () => { 'use server'; await unhideRunAction(r.id); }} className="inline">
                        <button type="submit" className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30">Restore</button>
                      </form>
                    ) : (
                      <form action={async () => { 'use server'; await hideRunAction(r.id, null); }} className="inline">
                        <button type="submit" className="rounded-md bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/30">Hide</button>
                      </form>
                    )}
                    <form action={async () => { 'use server'; await deleteRunAction(r.id); }} className="inline ml-1">
                      <button type="submit" className="rounded-md bg-red-500/20 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    This user has no runs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="font-mono text-xs text-slate-300 mt-0.5 truncate" title={String(children)}>
        {children}
      </div>
    </div>
  );
}
