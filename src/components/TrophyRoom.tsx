import Link from 'next/link';
import { GradeChip } from './GradeChip';
import { GRADE_ORDER, type Grade, type TrophyStats } from '@/lib/grading';
import { challengeHref } from '@/lib/leaderboard';
import type { TrophyCatalogEntry } from '@/lib/leaderboard';

// Player's grade-tally surface. Three layers:
//
//   1. Top progress bars — SSS%, SS+%, attempted%. Single eyeball
//      sweep tells you how complete the player's wall is.
//   2. Tally row — per-grade counts using the same chips that appear
//      on leaderboard rows, so the visual vocabulary is consistent.
//   3. Per-challenge breakdown — every challenge in the manifest
//      with the player's best grade or "—" for unattempted. Drives
//      the "fill in the gaps" hook.
//
// Pure presentational — caller already computed the stats + catalog
// in lib/leaderboard.ts:getUserProfile.

export function TrophyRoom({
  trophies,
  catalog,
}: {
  trophies: TrophyStats;
  catalog: TrophyCatalogEntry[];
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 space-y-5">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold text-white">Trophies</h2>
        <span className="text-xs text-slate-500">
          best grade per challenge across the catalog
        </span>
      </header>

      <ProgressRow label="SSS rate"          pct={trophies.sssPct}        accent="bg-amber-400"  num={trophies.tally.SSS}                       denom={trophies.totalChallenges} />
      <ProgressRow label="SS or better"      pct={trophies.ssOrBetterPct} accent="bg-slate-200"  num={trophies.tally.SSS + trophies.tally.SS}   denom={trophies.totalChallenges} />
      <ProgressRow label="Attempted"         pct={trophies.attemptedPct}  accent="bg-emerald-500" num={trophies.attemptedChallenges}             denom={trophies.totalChallenges} />

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {GRADE_ORDER.map((g) => (
          <div key={g} className="flex items-center gap-1.5">
            <GradeChip grade={g as Grade} size="md" />
            <span className="text-sm text-slate-300 tabular-nums">×{trophies.tally[g]}</span>
          </div>
        ))}
      </div>

      <CatalogList catalog={catalog} />
    </section>
  );
}

function ProgressRow({
  label,
  pct,
  accent,
  num,
  denom,
}: {
  label: string;
  pct: number;
  accent: string;
  num: number;
  denom: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-500 tabular-nums">
          <span className="text-slate-200 font-medium">{num}</span>
          <span> / {denom}</span>
          <span className="ml-2 text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`${accent} h-full transition-[width] duration-500`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function CatalogList({ catalog }: { catalog: TrophyCatalogEntry[] }) {
  // Group by game so the per-challenge list reads as a checklist
  // organized by section header, not a flat soup.
  const byGame = new Map<string, TrophyCatalogEntry[]>();
  for (const c of catalog) {
    const list = byGame.get(c.game) ?? [];
    list.push(c);
    byGame.set(c.game, list);
  }
  return (
    <details className="rounded-md border border-slate-800 bg-slate-950/40">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-slate-300 hover:text-white">
        Per-challenge breakdown — {catalog.length} total
      </summary>
      <div className="p-3 space-y-4">
        {Array.from(byGame.entries()).map(([game, items]) => (
          <div key={game}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{game}</h3>
            <ul className="space-y-1">
              {items.map((c) => (
                <li key={`${c.game}::${c.challengeName}`} className="flex items-center gap-2 text-sm">
                  <GradeChip grade={c.bestGrade} />
                  <Link
                    href={challengeHref(c.game, c.challengeName)}
                    className={c.attempted ? 'text-slate-200 hover:text-indigo-300 truncate' : 'text-slate-500 hover:text-slate-300 truncate italic'}
                  >
                    {c.challengeName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
