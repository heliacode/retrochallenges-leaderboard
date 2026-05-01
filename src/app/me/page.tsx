import Image from 'next/image';
import Link from 'next/link';
import { auth, signIn, signOut } from '@/auth';
import { EditProfilePanel } from '@/components/EditProfilePanel';
import {
  challengeHref,
  formatFrames,
  getUserProfile,
  type UserProfile,
  type UserProfileChallenge,
} from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

// Authenticated dashboard. Mirrors /u/[userId] (the public profile shape)
// but for the signed-in user, with a Sign Out button. If not signed in,
// kick into NextAuth's Google flow with /me as the post-auth target so
// the user lands here once they're authenticated.
export default async function MyDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <SignedOut />;
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    // Session exists but user record is gone (e.g., admin-deleted between
    // sign-in and now). Treat as signed-out rather than crashing.
    return <SignedOut />;
  }

  return (
    <div className="space-y-8">
      <Hero profile={profile} />
      <EditProfilePanel
        currentName={profile.name}
        currentAvatarUrl={profile.pictureUrl}
      />
      {profile.challenges.length === 0 ? (
        <EmptyState />
      ) : (
        <ChallengeTable rows={profile.challenges} />
      )}
    </div>
  );
}

function SignedOut() {
  return (
    <section className="text-center py-12">
      <h1 className="font-display text-2xl font-bold text-white mb-2">Sign in to see your dashboard</h1>
      <p className="text-slate-400 mb-6">Your runs from the desktop app live here once you sign in.</p>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/me' });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-colors"
        >
          Sign in with Google
        </button>
      </form>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
      <p className="text-slate-300 font-medium">No runs yet.</p>
      <p className="text-sm text-slate-500 mt-1">
        Open the FlawlessNES desktop app and beat a challenge — it lands here as soon as the
        win predicate fires.
      </p>
    </section>
  );
}

function Hero({ profile }: { profile: UserProfile }) {
  return (
    <section className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4 min-w-0">
        {profile.pictureUrl ? (
          <Image
            src={profile.pictureUrl}
            alt=""
            width={80}
            height={80}
            className="rounded-full border border-slate-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-slate-700" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-white truncate">{profile.name}</h1>
          <div className="text-sm text-slate-400 mt-1">
            <span className="font-medium text-slate-200">{profile.totalRuns}</span>
            <span> total run{profile.totalRuns === 1 ? '' : 's'}</span>
            <span className="mx-2">&middot;</span>
            <span>joined {new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <SignOutForm />
    </section>
  );
}

function SignOutForm() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:border-indigo-500 hover:bg-slate-800"
      >
        Sign out
      </button>
    </form>
  );
}

function ChallengeTable({ rows }: { rows: UserProfileChallenge[] }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-white mb-3">Best on each challenge</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
              <th className="py-2 pr-2">Game</th>
              <th className="py-2 pr-2">Challenge</th>
              <th className="py-2 pr-2 text-right">Score</th>
              <th className="py-2 pr-2 text-right">Time</th>
              <th className="py-2 pr-2 text-right">Rank</th>
              <th className="py-2 pr-2 text-right hidden sm:table-cell">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.game}::${r.challengeName}`} className="border-b border-slate-800">
                <td className="py-2 pr-2 text-slate-200">{r.game}</td>
                <td className="py-2 pr-2">
                  <Link
                    href={challengeHref(r.game, r.challengeName)}
                    className="text-indigo-300 hover:text-indigo-200"
                  >
                    {r.challengeName}
                  </Link>
                </td>
                <td className="py-2 pr-2 text-right font-mono text-slate-200 tabular-nums">
                  {r.bestRun.score != null ? r.bestRun.score.toLocaleString() : '—'}
                </td>
                <td className="py-2 pr-2 text-right font-mono text-slate-200 tabular-nums">
                  {formatFrames(r.bestRun.completionTimeFrames)}
                </td>
                <td className="py-2 pr-2 text-right font-mono">
                  {r.rank ? <RankBadge rank={r.rank} /> : <span className="text-slate-500">—</span>}
                </td>
                <td className="py-2 pr-2 text-right text-slate-500 hidden sm:table-cell">
                  {r.attempts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? 'text-amber-300 font-semibold' :
    rank === 2 ? 'text-slate-300 font-medium' :
    rank === 3 ? 'text-orange-300 font-medium' :
    'text-slate-400';
  return <span className={cls}>#{rank}</span>;
}
