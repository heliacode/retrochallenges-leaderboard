import Image from 'next/image';
import Link from 'next/link';
import {
  challengeHref,
  formatFrames,
  formatRelative,
  gameHref,
  getOverallStats,
  getRecentRuns,
  listGames,
  userProfileHref,
  type GameSummary,
  type RecentRunEntry,
} from '@/lib/leaderboard';

// Skip build-time pre-render — we don't have a DB at build time on Railway.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [stats, games, recent] = await Promise.all([
    getOverallStats(),
    listGames(),
    getRecentRuns(8),
  ]);

  return (
    <div className="space-y-10">
      <Hero stats={stats} />

      {games.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-400">
            No runs submitted yet. Be the first — open the FlawlessNes app and beat a challenge.
          </p>
        </section>
      ) : (
        <>
          <GamesSection games={games} />
          {recent.length > 0 && <RecentActivity runs={recent} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Hero({ stats }: { stats: { totalRuns: number; totalPlayers: number; totalChallenges: number } }) {
  return (
    <section>
      <h1 className="font-display text-3xl font-bold text-white mb-2">Leaderboards</h1>
      <p className="text-slate-400 mb-5">
        Community-submitted runs from the FlawlessNes desktop app. Every row is a verified
        in-emulator completion — scores land here the moment the challenge pings complete.
      </p>
      <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="runs"       value={stats.totalRuns} />
        <Stat label="players"    value={stats.totalPlayers} />
        <Stat label="challenges" value={stats.totalChallenges} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="font-display text-2xl font-semibold text-white tabular-nums">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function GamesSection({ games }: { games: GameSummary[] }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-white mb-3">Games</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <li key={g.game}>
            <GameTile game={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GameTile({ game }: { game: GameSummary }) {
  return (
    <Link
      href={gameHref(game.game)}
      className="group block rounded-lg border border-slate-700 bg-slate-900 p-5 transition-colors hover:border-indigo-500 hover:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-white truncate">{game.game}</h3>
        <span
          className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300"
          aria-hidden="true"
        >
          Browse &rarr;
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <TileStat label="challenges" value={game.totalChallenges} />
        <TileStat label="runs"       value={game.totalRuns} />
        <TileStat label="players"    value={game.totalPlayers} />
      </dl>
    </Link>
  );
}

function TileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-925 px-2 py-1.5">
      <dd className="font-mono text-base font-semibold text-slate-100 tabular-nums">
        {value.toLocaleString()}
      </dd>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
    </div>
  );
}

function formatTopMetric(score: number | null, frames: number | null): string {
  // Prefer score (with time as parenthetical) when both are present, since
  // score-target challenges share a score across many runs and time is
  // the meaningful tiebreaker. Time-only challenges show the time alone.
  if (score != null && frames != null) return `${score.toLocaleString()} · ${formatFrames(frames)}`;
  if (score != null)                   return score.toLocaleString();
  if (frames != null)                  return formatFrames(frames);
  return '—';
}

function RecentActivity({ runs }: { runs: RecentRunEntry[] }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-white mb-3">Recent activity</h2>
      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900">
        {runs.map((r) => (
          <li key={r.runId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            {r.userPictureUrl ? (
              <Image
                src={r.userPictureUrl}
                alt=""
                width={28}
                height={28}
                className="rounded-full shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 truncate">
                <Link
                  href={userProfileHref(r.userId)}
                  className="font-medium hover:text-indigo-300"
                >
                  {r.userName}
                </Link>
                <span className="text-slate-500"> finished </span>
                <Link
                  href={challengeHref(r.game, r.challengeName)}
                  className="text-indigo-300 hover:text-indigo-200"
                >
                  {r.challengeName}
                </Link>
                <span className="text-slate-500"> in </span>
                <Link href={gameHref(r.game)} className="text-slate-100 hover:text-indigo-300">
                  {r.game}
                </Link>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatTopMetric(r.score, r.completionTimeFrames)}
                <span className="mx-2">&middot;</span>
                <time dateTime={new Date(r.serverReceivedAt).toISOString()}>
                  {formatRelative(new Date(r.serverReceivedAt))}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
