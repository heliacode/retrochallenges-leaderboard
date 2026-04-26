import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  challengeHref,
  formatFrames,
  getUserProfile,
  type UserProfile,
  type UserProfileChallenge,
} from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: PageProps) {
  const { userId: userIdParam } = await params;
  const userId = decodeURIComponent(userIdParam);

  const profile = await getUserProfile(userId);
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <Hero profile={profile} />
      {profile.challenges.length === 0 ? (
        <p className="text-slate-400">
          No runs yet — once {profile.name} finishes a challenge, it'll appear here.
        </p>
      ) : (
        <ChallengeTable rows={profile.challenges} />
      )}
    </div>
  );
}

function Hero({ profile }: { profile: UserProfile }) {
  return (
    <section className="flex items-center gap-4">
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
        <nav className="text-sm text-slate-500 mb-1">
          <Link href="/" className="hover:text-slate-300">Leaderboards</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Players</span>
        </nav>
        <h1 className="font-display text-3xl font-bold text-white truncate">{profile.name}</h1>
        <div className="text-sm text-slate-400 mt-1">
          <span className="font-medium text-slate-200">{profile.totalRuns}</span>
          <span> total run{profile.totalRuns === 1 ? '' : 's'}</span>
          <span className="mx-2">&middot;</span>
          <span>joined {new Date(profile.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </section>
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
  // Lean into 1/2/3 with medal-ish colors; everything else is muted.
  const cls =
    rank === 1 ? 'text-amber-300 font-semibold' :
    rank === 2 ? 'text-slate-300 font-medium' :
    rank === 3 ? 'text-orange-300 font-medium' :
    'text-slate-400';
  return <span className={cls}>#{rank}</span>;
}
