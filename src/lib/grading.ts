// Per-challenge grade derivation.
//
// The manifest defines a per-challenge `grades.thresholds` array
// ordered SSS → SS → S → A → B by `maxFrames`. gradeForRun walks
// the array and returns the FIRST grade whose maxFrames the player's
// completionTimeFrames falls under. Stateless on purpose — no DB
// column, no migration. Re-grade on every read so a manifest tweak
// retroactively updates everyone's badges.
//
// All five grades are guaranteed present on every challenge in the
// catalog (audited via challenges.json on 2026-05-04), so the only
// nullable cases are: no thresholds at all (future challenge with
// just a win/fail flag, no time grading) or the run has no
// completionTimeFrames (score-only, no time recorded).

export type Grade = 'SSS' | 'SS' | 'S' | 'A' | 'B';

export const GRADE_ORDER: readonly Grade[] = ['SSS', 'SS', 'S', 'A', 'B'];

export interface GradeThreshold {
  grade: string;
  maxFrames: number;
}

export function gradeForRun(
  thresholds: GradeThreshold[] | undefined | null,
  completionTimeFrames: number | null | undefined,
): Grade | null {
  if (!thresholds || thresholds.length === 0) return null;
  if (completionTimeFrames == null || completionTimeFrames < 0) return null;

  for (const t of thresholds) {
    if (typeof t.maxFrames !== 'number') continue;
    if (completionTimeFrames <= t.maxFrames) {
      return GRADE_ORDER.includes(t.grade as Grade) ? (t.grade as Grade) : null;
    }
  }
  return null;
}

// Tailwind classes for the grade chip. Color intent:
//   SSS → bright gold (the "earned it" tier)
//   SS  → silver / platinum
//   S   → orange / bronze
//   A   → cyan
//   B   → muted slate
const GRADE_STYLES: Record<Grade, string> = {
  SSS: 'bg-amber-400/20  text-amber-200  border border-amber-400/50',
  SS:  'bg-slate-200/20  text-slate-100  border border-slate-300/40',
  S:   'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  A:   'bg-cyan-500/20   text-cyan-300   border border-cyan-500/40',
  B:   'bg-slate-500/20  text-slate-400  border border-slate-500/40',
};

export function gradeChipClass(grade: Grade | null): string {
  if (!grade) return 'bg-slate-700/40 text-slate-500 border border-slate-700';
  return GRADE_STYLES[grade];
}

// Returns true when `a` is the same OR a strictly better grade than
// `b` (e.g., bestGrade(SSS, SS) → true). Used by trophy aggregation
// to pick the highest grade across multiple runs on the same
// challenge. null counts as worst.
export function gradeRank(g: Grade | null): number {
  if (!g) return GRADE_ORDER.length;          // worse than B
  return GRADE_ORDER.indexOf(g);              // SSS=0 → B=4
}

export function isBetterOrEqualGrade(a: Grade | null, b: Grade | null): boolean {
  return gradeRank(a) <= gradeRank(b);
}

// Aggregate a player's grade tally across the catalog. Drives the
// Trophy Room: count per grade + completion percentages.
export interface TrophyStats {
  totalChallenges: number;       // every challenge in the manifest
  attemptedChallenges: number;   // user has at least one visible run
  tally: Record<Grade, number>;  // best-grade-per-challenge counts
  sssPct: number;                // sss / total (0-100)
  ssOrBetterPct: number;         // (sss + ss) / total
  attemptedPct: number;          // attempted / total
}

export function emptyTrophyStats(totalChallenges: number): TrophyStats {
  return {
    totalChallenges,
    attemptedChallenges: 0,
    tally: { SSS: 0, SS: 0, S: 0, A: 0, B: 0 },
    sssPct: 0,
    ssOrBetterPct: 0,
    attemptedPct: 0,
  };
}

// `bestGrades` = one entry per challenge the user has attempted, with
// the best grade earned across the user's runs on that challenge.
export function summarizeTrophies(
  totalChallenges: number,
  bestGrades: (Grade | null)[],
): TrophyStats {
  const stats = emptyTrophyStats(totalChallenges);
  stats.attemptedChallenges = bestGrades.length;
  for (const g of bestGrades) {
    if (g) stats.tally[g] += 1;
  }
  if (totalChallenges > 0) {
    stats.sssPct        = Math.round((stats.tally.SSS / totalChallenges) * 100);
    stats.ssOrBetterPct = Math.round(((stats.tally.SSS + stats.tally.SS) / totalChallenges) * 100);
    stats.attemptedPct  = Math.round((stats.attemptedChallenges / totalChallenges) * 100);
  }
  return stats;
}
