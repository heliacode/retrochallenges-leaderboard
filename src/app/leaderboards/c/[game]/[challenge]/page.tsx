import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  gameHref,
  getChallengeLeaderboard,
  formatFrames,
  parseLeaderboardWindow,
  parseLeaderboardView,
  userProfileHref,
  type LeaderboardWindow,
  type LeaderboardView,
} from '@/lib/leaderboard';
import { getChallengesManifest, manifestKey } from '@/lib/challenges-manifest';
import { gradeForRun } from '@/lib/grading';
import { GradeChip } from '@/components/GradeChip';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ game: string; challenge: string }>;
  searchParams: Promise<{ window?: string; view?: string }>;
}

export default async function ChallengeLeaderboardPage({ params, searchParams }: PageProps) {
  const { game: gameParam, challenge: challengeParam } = await params;
  const sp = await searchParams;
  const game = decodeURIComponent(gameParam);
  const challengeName = decodeURIComponent(challengeParam);
  const activeWindow = parseLeaderboardWindow(sp.window);
  const activeView = parseLeaderboardView(sp.view);

  // Three parallel reads: the leaderboard rows, the signed-in user (so we
  // can highlight "you"), and the chronologically-first completer of this
  // challenge (so they get a 🥇 trophy regardless of current rank — risk-
  // taker recognition that persists even if they later get out-run).
  const [entries, session, firstEverCompleter, manifest] = await Promise.all([
    getChallengeLeaderboard(game, challengeName, 50, activeWindow, activeView),
    auth(),
    prisma.run.findFirst({
      where: {
        game,
        challengeName,
        hiddenAt: null,
        pendingReview: false,
        user: { bannedAt: null },
      },
      orderBy: { serverReceivedAt: 'asc' },
      select: { userId: true },
    }),
    getChallengesManifest(),
  ]);
  // Grade thresholds for THIS challenge (looked up once, reused per row).
  const gradeThresholds = manifest.get(manifestKey(game, challengeName))?.gradeThresholds;
  const meId = session?.user?.id ?? null;
  const firstEverUserId = firstEverCompleter?.userId ?? null;

  return (
    <div>
      <Breadcrumb game={game} challengeName={challengeName} />

      <h1 className="font-display text-2xl font-bold text-white mt-2">{challengeName}</h1>
      <p className="text-sm text-slate-400 mb-6">{game}</p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <WindowTabs game={game} challengeName={challengeName} activeWindow={activeWindow} activeView={activeView} />
        <ViewToggle game={game} challengeName={challengeName} activeWindow={activeWindow} activeView={activeView} />
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-400 mt-8">
          {activeWindow === 'all'
            ? 'No runs for this challenge yet. Be the first.'
            : `No runs in the ${activeWindow === 'daily' ? 'last 24 hours' : 'last 7 days'} — try the All Time tab.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
                <th className="py-2 pr-2 w-12">#</th>
                <th className="py-2 pr-2">Player</th>
                <th className="py-2 pr-2 text-right">Score</th>
                <th className="py-2 pr-2 text-right">Time</th>
                <th className="py-2 pr-2 text-right">Grade</th>
                <th className="py-2 pr-2 text-right hidden sm:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isMe          = meId !== null && e.userId === meId;
                const isFirstEver   = firstEverUserId !== null && e.userId === firstEverUserId;
                // Highlight class: subtle indigo wash on the row background
                // + a left accent border. Falls back to the standard divider
                // when this isn't the signed-in user's row.
                const rowClass = isMe
                  ? 'border-b border-slate-800 bg-indigo-500/10 ring-inset ring-1 ring-indigo-500/30'
                  : 'border-b border-slate-800';
                return (
                  <tr key={e.runId} className={rowClass}>
                    <td className="py-2 pr-2 text-slate-500 font-mono">{e.rank}</td>
                    <td className="py-2 pr-2">
                      <Link
                        href={userProfileHref(e.userId)}
                        className="flex items-center gap-2 group"
                      >
                        {e.userPictureUrl ? (
                          <Image
                            src={e.userPictureUrl}
                            alt=""
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700" aria-hidden="true" />
                        )}
                        <span className={isMe ? 'text-indigo-200 font-semibold group-hover:text-indigo-100' : 'text-slate-200 group-hover:text-indigo-300'}>
                          {e.userName}
                        </span>
                        {isMe && (
                          <span className="text-xs font-medium text-indigo-300/80" aria-label="this is you">
                            (you)
                          </span>
                        )}
                        {isFirstEver && (
                          <span
                            className="text-amber-300"
                            title="First-ever completion of this challenge"
                            aria-label="first-ever completion"
                          >
                            🥇
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-200">
                      {e.score != null ? e.score.toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-200">
                      {formatFrames(e.completionTimeFrames)}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <GradeChip grade={gradeForRun(gradeThresholds, e.completionTimeFrames)} size="md" />
                    </td>
                    <td className="py-2 pr-2 text-right text-xs text-slate-500 hidden sm:table-cell">
                      {new Date(e.serverReceivedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Breadcrumb({ game, challengeName }: { game: string; challengeName: string }) {
  return (
    <nav className="text-sm text-slate-500">
      <Link href="/leaderboards" className="hover:text-slate-300">Leaderboards</Link>
      <span className="mx-2">/</span>
      <Link href={gameHref(game)} className="text-slate-400 hover:text-slate-200">{game}</Link>
      <span className="mx-2">/</span>
      <span className="text-slate-300">{challengeName}</span>
    </nav>
  );
}

// Build a /c/<game>/<challenge>?... URL preserving the non-default of
// either selector — drops keys when they're at their default to keep
// shared URLs short.
function buildHref(
  game: string,
  challengeName: string,
  window: LeaderboardWindow,
  view: LeaderboardView,
): string {
  const base = `/c/${encodeURIComponent(game)}/${encodeURIComponent(challengeName)}`;
  const params: string[] = [];
  if (window !== 'all') params.push(`window=${window}`);
  if (view !== 'best') params.push(`view=${view}`);
  return params.length === 0 ? base : `${base}?${params.join('&')}`;
}

function WindowTabs({
  game,
  challengeName,
  activeWindow,
  activeView,
}: {
  game: string;
  challengeName: string;
  activeWindow: LeaderboardWindow;
  activeView: LeaderboardView;
}) {
  const tabs: { key: LeaderboardWindow; label: string }[] = [
    { key: 'daily',  label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'all',    label: 'All Time' },
  ];
  return (
    <nav className="inline-flex gap-1 rounded-md border border-slate-700 bg-slate-900 p-1" aria-label="Leaderboard time window">
      {tabs.map((t) => {
        const isActive = t.key === activeWindow;
        return (
          <Link
            key={t.key}
            href={buildHref(game, challengeName, t.key, activeView)}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'px-3 py-1 rounded text-sm font-medium bg-indigo-500 text-white'
                : 'px-3 py-1 rounded text-sm font-medium text-slate-300 hover:bg-slate-800'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Toggle between "best per user" (one row each) and "all attempts"
// (every run, with possible duplicates from the same player).
function ViewToggle({
  game,
  challengeName,
  activeWindow,
  activeView,
}: {
  game: string;
  challengeName: string;
  activeWindow: LeaderboardWindow;
  activeView: LeaderboardView;
}) {
  const tabs: { key: LeaderboardView; label: string }[] = [
    { key: 'best', label: 'Best per player' },
    { key: 'all',  label: 'All attempts' },
  ];
  return (
    <nav className="inline-flex gap-1 rounded-md border border-slate-700 bg-slate-900 p-1" aria-label="Leaderboard row mode">
      {tabs.map((t) => {
        const isActive = t.key === activeView;
        return (
          <Link
            key={t.key}
            href={buildHref(game, challengeName, activeWindow, t.key)}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'px-3 py-1 rounded text-sm font-medium bg-indigo-500 text-white'
                : 'px-3 py-1 rounded text-sm font-medium text-slate-300 hover:bg-slate-800'
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
