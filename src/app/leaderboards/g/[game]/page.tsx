import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  challengeHref,
  formatFrames,
  listChallengeSummaries,
  type ChallengeSummary,
} from '@/lib/leaderboard';
import {
  CATEGORY_ORDER,
  categoryLabel,
  getChallengesManifest,
  manifestKey,
} from '@/lib/challenges-manifest';

// Skip build-time pre-render — we don't have a DB at build time on Railway.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ game: string }>;
}

// Local rendering type — ChallengeSummary plus the category we looked up
// from the assets-repo manifest. Category may be undefined (manifest fetch
// failed, or the assets repo hasn't shipped a category for this entry yet),
// in which case the row falls into the "Other" group.
type AnnotatedSummary = ChallengeSummary & { category?: string };

export default async function GameDetailPage({ params }: PageProps) {
  const { game: gameParam } = await params;
  const game = decodeURIComponent(gameParam);

  const [summaries, manifest] = await Promise.all([
    listChallengeSummaries(game),
    getChallengesManifest(),
  ]);
  if (summaries.length === 0) notFound();

  const annotated: AnnotatedSummary[] = summaries.map((s) => ({
    ...s,
    category: manifest.get(manifestKey(s.game, s.challengeName))?.category,
  }));

  const groups = groupByCategory(annotated);
  const totalRuns = summaries.reduce((sum, s) => sum + s.runCount, 0);

  return (
    <div>
      <Breadcrumb game={game} />

      <h1 className="font-display text-2xl font-bold text-white mt-2">{game}</h1>
      <p className="text-sm text-slate-400 mb-6">
        {summaries.length} challenge{summaries.length === 1 ? '' : 's'} · {totalRuns} run{totalRuns === 1 ? '' : 's'}
      </p>

      <div className="space-y-8">
        {groups.map(({ category, items }) => (
          <CategorySection key={category} category={category} items={items} />
        ))}
      </div>
    </div>
  );
}

// Bucket annotated summaries by category and emit groups in a stable order
// (CATEGORY_ORDER, then anything unknown, then 'other' last). Groups with
// zero items are dropped so we don't render empty headers.
function groupByCategory(
  rows: AnnotatedSummary[],
): { category: string; items: AnnotatedSummary[] }[] {
  const buckets = new Map<string, AnnotatedSummary[]>();
  for (const r of rows) {
    const key = r.category ?? 'other';
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  }
  const ordered: string[] = [];
  for (const k of CATEGORY_ORDER) if (buckets.has(k)) ordered.push(k);
  // Any unknown categories from upstream (e.g. assets repo adds 'gauntlet'
  // before we update the leaderboard's CATEGORY_ORDER) get rendered between
  // known categories and the 'other' bucket, sorted alphabetically.
  const unknowns = Array.from(buckets.keys())
    .filter((k) => k !== 'other' && !CATEGORY_ORDER.includes(k))
    .sort();
  ordered.push(...unknowns);
  if (buckets.has('other')) ordered.push('other');
  return ordered.map((category) => ({ category, items: buckets.get(category)! }));
}

function CategorySection({
  category,
  items,
}: {
  category: string;
  items: AnnotatedSummary[];
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-baseline gap-2">
        {categoryLabel(category)}
        <span className="text-xs font-normal text-slate-500">
          {items.length} challenge{items.length === 1 ? '' : 's'}
        </span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <li key={`${c.game}::${c.challengeName}`}>
            <ChallengeCard summary={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Breadcrumb({ game }: { game: string }) {
  return (
    <nav className="text-sm text-slate-500">
      <Link href="/leaderboards" className="hover:text-slate-300">Leaderboards</Link>
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
            {summary.playerCount} player{summary.playerCount === 1 ? '' : 's'}
            <span className="mx-1.5">&middot;</span>
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
