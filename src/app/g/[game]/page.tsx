import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  challengeHref,
  formatFrames,
  listChallengeSummaries,
  type ChallengeSummary,
} from '@/lib/leaderboard';

// Skip build-time pre-render — we don't have a DB at build time on Railway.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ game: string }>;
}

export default async function GameDetailPage({ params }: PageProps) {
  const { game: gameParam } = await params;
  const game = decodeURIComponent(gameParam);

  const summaries = await listChallengeSummaries(game);
  if (summaries.length === 0) notFound();

  const totalRuns = summaries.reduce((sum, s) => sum + s.runCount, 0);

  return (
    <div>
      <Breadcrumb game={game} />

      <h1 className="font-display text-2xl font-bold text-white mt-2">{game}</h1>
      <p className="text-sm text-slate-400 mb-6">
        {summaries.length} challenge{summaries.length === 1 ? '' : 's'} · {totalRuns} run{totalRuns === 1 ? '' : 's'}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {summaries.map((c) => (
          <li key={`${c.game}::${c.challengeName}`}>
            <ChallengeCard summary={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Breadcrumb({ game }: { game: string }) {
  return (
    <nav className="text-sm text-slate-500">
      <Link href="\" className="hover:text-slate-300">Leaderboards</Link>
      <span className="mx-2">/</span>
      <span className="text-slate-300">{game}</span>
    </nav>
  );
}

function ChallengeCard({ summary }: { summary: ChallengeSummary }) {
  const top = summary.topRun;
  return (
    <Link
      href={challengeHref(summary.game, summary.challengeName)}
      className="group block rounded-lg border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-indigo-500 hover:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-100 truncate">{summary.challengeName}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {summary.runCount} run{summary.runCount === 1 ? '' : 's'}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300"
          aria-hidden="true"
        >
          View &rarr;
        </span>
      </div>

      {top && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-925 px-2.5 py-2 text-sm">
          <span className="font-mono text-amber-300" aria-label="Rank 1">#1</span>
          {top.userPictureUrl ? (
            <Image
              src={top.userPictureUrl}
              alt=""
              width={20}
              height={20}
              className="rounded-full"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-slate-700" aria-hidden="true" />
          )}
          <span className="text-slate-200 truncate flex-1">{top.userName}</span>
          <span className="font-mono text-slate-300 tabular-nums">
            {formatTopMetric(top.score, top.completionTimeFrames)}
          </span>
        </div>
      )}
    </Link>
  );
}

function formatTopMetric(score: number | null, frames: number | null): string {
  if (score != null && frames != null) return `${score.toLocaleString()} · ${formatFrames(frames)}`;
  if (score != null)                   return score.toLocaleString();
  if (frames != null)                  return formatFrames(frames);
  return '—';
}
