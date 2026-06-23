import Image from 'next/image';
import Link from 'next/link';
import {
  challengeHref,
  formatFrames,
  formatRelative,
  gameHref,
  getOverallStats,
  getRecentRuns,
  listFlawlessSummaries,
  listGames,
  userProfileHref,
  type ChallengeSummary,
  type GameSummary,
  type RecentRunEntry,
} from '@/lib/leaderboard';
import { flawlessRankForScore, flawlessRankChipClass } from '@/lib/grading';
import { AutoRefresh } from '@/components/AutoRefresh';

// Hero + game-tile grid + recent-activity feed. Rendered by both the
// /leaderboards route and the host-aware / route (when served from
// the legacy leaderboards.retrochallenges.com hostname) so users hit
// the same UI either way during the flawlessnes.com transition.
//
// Games come first (catalog is the action surface — visitors are here
// to pick something to play), recent activity is the addictive scroll
// underneath. AutoRefresh re-pulls every 30s either way.
export async function CatalogView() {
  const [stats, games, flawless, recent] = await Promise.all([
    getOverallStats(),
    listGames(),
    listFlawlessSummaries(),
    getRecentRuns(20),
  ]);

  return (
    <div className="space-y-10">
      <AutoRefresh intervalMs={30000} />
      <Hero stats={stats} />

      {flawless.length > 0 && <FlawlessSection items={flawless} />}

      {games.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-400">
            No runs submitted yet. Be the first — open the FlawlessNES app and beat a challenge.
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
// FlawlessNES — its own top-level section. These challenges are no-hit runs
// ranked by fewest hits (Flawless → D), distinct from the time-ranked
// RetroChallenges below.
// ---------------------------------------------------------------------------
function FlawlessSection({ items }: { items: ChallengeSummary[] }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="font-display text-xl font-semibold text-amber-200">FlawlessNES</h2>
        <span className="text-xs font-normal text-slate-500">
          no-damage runs · ranked by fewest hits
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={`${c.game}::${c.challengeName}`}>
            <FlawlessCard summary={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FlawlessCard({ summary }: { summary: ChallengeSummary }) {
  const top = summary.topRun;
  const rank = top ? flawlessRankForScore(top.score) : null;
  return (
    <Link
      href={challengeHref(summary.game, summary.challengeName)}
      className="group block rounded-lg border border-amber-500/20 bg-slate-900 p-4 transition-colors hover:border-amber-400/60 hover:bg-slate-800"
    >
      <div className="min-w-0">
        <div className="font-medium text-slate-100 truncate">{summary.challengeName}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {summary.game}
          <span className="mx-1.5">&middot;</span>
          {summary.playerCount} player{summary.playerCount === 1 ? '' : 's'}
        </div>
      </div>
      {top ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-925 px-2.5 py-2 text-sm">
          <span className="font-mono text-amber-300" aria-label="Rank 1">#1</span>
          <span className="text-slate-200 truncate flex-1">{top.userName}</span>
          <span
            className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider ${flawlessRankChipClass(rank)}`}
          >
            {rank ?? '—'}
          </span>
        </div>
      ) : (
        <div className="mt-3 flex h-9 items-center justify-center gap-2 rounded-md border border-dashed border-slate-700 px-2.5 text-xs text-slate-500">
          Be the first to go flawless
        </div>
      )}
    </Link>
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
        Community-submitted runs from the FlawlessNES desktop app. Every row is a verified
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
      className="group flex gap-3 rounded-lg border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-indigo-500 hover:bg-slate-800"
    >
      {/* Box art on the left — fixed 48×64 (3:4 NES box ratio). The
          fixed slot keeps the tile size identical whether or not the
          game ships a boxArtUrl; missing art renders the placeholder. */}
      {game.boxArtUrl ? (
        <Image
          src={game.boxArtUrl}
          alt=""
          width={48}
          height={64}
          unoptimized
          className="shrink-0 self-center h-16 w-12 rounded border border-slate-700 object-cover"
        />
      ) : (
        <div
          className="shrink-0 self-center h-16 w-12 rounded border border-slate-700 bg-slate-800"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-semibold text-white truncate">{game.game}</h3>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <TileStat label="challenges" value={game.totalChallenges} />
          <TileStat label="runs"       value={game.totalRuns} />
          <TileStat label="players"    value={game.totalPlayers} />
        </dl>
      </div>
    </Link>
  );
}

function TileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-925 px-2 py-1.5">
      <dd className="font-mono text-base font-semibold text-slate-100 tabular-nums">
        {value.toLocaleString()}
      </dd>
      <dt className="text-[9px] uppercase text-slate-500 truncate">{label}</dt>
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
                <ActivityAnnotations run={r} />
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

// Tiny inline annotations rendered after the run sentence. Quiet most of
// the time; lights up when something narratively interesting happened.
// Order: most prestigious first (first-ever), then PB, then "they're
// grinding" — keeps the eye-grabbing badges to the left.
function ActivityAnnotations({ run }: { run: RecentRunEntry }) {
  return (
    <>
      {run.firstEverCompletion && (
        <span
          title="First-ever completion of this challenge"
          className="ml-1.5 text-amber-300"
          aria-label="first-ever completion"
        >
          🥇
        </span>
      )}
      {run.personalBest && !run.firstEverCompletion && (
        <span
          title="Personal best on this challenge"
          className="ml-1.5 text-emerald-300"
          aria-label="personal best"
        >
          🏆
        </span>
      )}
      {run.attemptStreak >= 3 && (
        <span
          title={`${run.userName}'s ${ordinal(run.attemptStreak)} attempt on this challenge in the last hour`}
          className="ml-1.5 text-xs font-medium text-orange-300 bg-orange-500/10 rounded px-1.5 py-0.5 align-middle"
        >
          🔁 {run.attemptStreak}× in 1h
        </span>
      )}
    </>
  );
}

function ordinal(n: number): string {
  const last = n % 10;
  const teen = Math.floor(n / 10) % 10 === 1;
  if (teen)            return `${n}th`;
  if (last === 1)      return `${n}st`;
  if (last === 2)      return `${n}nd`;
  if (last === 3)      return `${n}rd`;
  return `${n}th`;
}
