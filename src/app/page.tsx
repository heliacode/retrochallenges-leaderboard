import Link from 'next/link';
import { listChallengesWithRuns, challengeHref } from '@/lib/leaderboard';

// Skip build-time pre-render (we don't have a DB at build time on Railway
// either). Render per request; Postgres top-N queries are microseconds.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const challenges = await listChallengesWithRuns();

  const byGame = new Map<string, typeof challenges>();
  for (const c of challenges) {
    if (!byGame.has(c.game)) byGame.set(c.game, []);
    byGame.get(c.game)!.push(c);
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold text-white mb-2">Leaderboards</h1>
        <p className="text-slate-400">
          Community-submitted runs from the RetroChallenges desktop app. Every row is a verified
          in-emulator completion; scores land here the moment the challenge pings complete.
        </p>
      </section>

      {challenges.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-400">
            No runs submitted yet. Be the first — download the RetroChallenges app and beat a
            challenge.
          </p>
        </section>
      ) : (
        Array.from(byGame.entries()).map(([game, gameChallenges]) => (
          <section key={game}>
            <h2 className="font-display text-xl font-semibold text-white mb-3">{game}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {gameChallenges.map((c) => (
                <li key={`${c.game}::${c.challengeName}`}>
                  <Link
                    href={challengeHref(c.game, c.challengeName)}
                    className="block rounded-md border border-slate-700 bg-slate-900 px-4 py-3 hover:border-indigo-500 hover:bg-slate-800 transition-colors"
                  >
                    <div className="font-medium text-slate-100">{c.challengeName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.runCount} run{c.runCount === 1 ? '' : 's'}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
