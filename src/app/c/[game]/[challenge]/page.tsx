import Image from 'next/image';
import Link from 'next/link';
import {
  getChallengeLeaderboard,
  formatFrames,
  parseLeaderboardWindow,
  type LeaderboardWindow,
} from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ game: string; challenge: string }>;
  searchParams: Promise<{ window?: string }>;
}

export default async function ChallengeLeaderboardPage({ params, searchParams }: PageProps) {
  const { game: gameParam, challenge: challengeParam } = await params;
  const sp = await searchParams;
  const game = decodeURIComponent(gameParam);
  const challengeName = decodeURIComponent(challengeParam);
  const activeWindow = parseLeaderboardWindow(sp.window);

  const entries = await getChallengeLeaderboard(game, challengeName, 50, activeWindow);

  return (
    <div>
      <Breadcrumb game={game} challengeName={challengeName} />

      <h1 className="font-display text-2xl font-bold text-white mt-2">{challengeName}</h1>
      <p className="text-sm text-slate-400 mb-6">{game}</p>

      <WindowTabs game={game} challengeName={challengeName} active={activeWindow} />

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
                <th className="py-2 pr-2 text-right hidden sm:table-cell">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.runId} className="border-b border-slate-800">
                  <td className="py-2 pr-2 text-slate-500 font-mono">{e.rank}</td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
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
                      <span className="text-slate-200">{e.userName}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-200">
                    {e.score != null ? e.score.toLocaleString() : '—'}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-200">
                    {formatFrames(e.completionTimeFrames)}
                  </td>
                  <td className="py-2 pr-2 text-right text-xs text-slate-500 hidden sm:table-cell">
                    {new Date(e.serverReceivedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
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
      <Link href="/" className="hover:text-slate-300">Leaderboards</Link>
      <span className="mx-2">/</span>
      <span className="text-slate-400">{game}</span>
      <span className="mx-2">/</span>
      <span className="text-slate-300">{challengeName}</span>
    </nav>
  );
}

function WindowTabs({
  game,
  challengeName,
  active,
}: {
  game: string;
  challengeName: string;
  active: LeaderboardWindow;
}) {
  const tabs: { key: LeaderboardWindow; label: string }[] = [
    { key: 'daily',  label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'all',    label: 'All Time' },
  ];
  const base = `/c/${encodeURIComponent(game)}/${encodeURIComponent(challengeName)}`;
  return (
    <nav className="mb-6 inline-flex gap-1 rounded-md border border-slate-700 bg-slate-900 p-1" aria-label="Leaderboard time window">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const href = t.key === 'all' ? base : `${base}?window=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
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
