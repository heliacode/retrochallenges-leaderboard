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

// ---------------------------------------------------------------------------
// FlawlessNES ranking
//
// The FlawlessNES challenge family scores by HITS TAKEN, not time. Every
// FlawlessNES challenge shares ONE fixed table (also computed in the
// challenge .lua so the in-game HUD and the board agree exactly):
//
//   Hits  Rank      Score
//   0     Flawless  5000
//   1     A         3500
//   2     B         2750
//   3     C         2000
//   4     D         1250
//   5+    D         round(1250 * 0.85^(hits-4))   (geometric tail, never 0)
//
// The desktop client submits the SCORE, which is strictly monotonic-
// decreasing in hits — so the board ranks by score DESC and recovers both
// the rank label and the hit count from the score alone. No DB column for
// hits is needed, and the existing (game, challengeName, score DESC,
// completionTimeFrames ASC) index serves the ranking directly.
export type FlawlessRank = 'Flawless' | 'A' | 'B' | 'C' | 'D';

export const FLAWLESS_RANK_ORDER: readonly FlawlessRank[] = ['Flawless', 'A', 'B', 'C', 'D'];

// Rank label from the submitted score (cutoffs straight off the table).
export function flawlessRankForScore(score: number | null | undefined): FlawlessRank | null {
  if (score == null) return null;
  if (score >= 5000) return 'Flawless';
  if (score >= 3500) return 'A';
  if (score >= 2750) return 'B';
  if (score >= 2000) return 'C';
  return 'D';
}

// Exact inverse of the scoring table: recover hits from the score.
// 0..4 hits live in the linear top band (score = 3500 - 750*(h-1));
// 5+ hits invert the geometric tail. Returns null when there's no score.
export function flawlessHitsForScore(score: number | null | undefined): number | null {
  if (score == null) return null;
  if (score >= 5000) return 0;
  if (score >= 1250) return Math.round((3500 - score) / 750) + 1; // h = 1..4
  // score = 1250 * 0.85^(h-4)  ->  h = 4 + ln(score/1250)/ln(0.85)
  const h = 4 + Math.log(score / 1250) / Math.log(0.85);
  return Math.max(5, Math.round(h));
}

const FLAWLESS_RANK_STYLES: Record<FlawlessRank, string> = {
  Flawless: 'bg-amber-400/20   text-amber-200   border border-amber-400/50',
  A:        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  B:        'bg-cyan-500/20    text-cyan-300    border border-cyan-500/40',
  C:        'bg-indigo-500/20  text-indigo-300  border border-indigo-500/40',
  D:        'bg-slate-500/20   text-slate-400   border border-slate-500/40',
};

export function flawlessRankChipClass(rank: FlawlessRank | null): string {
  if (!rank) return 'bg-slate-700/40 text-slate-500 border border-slate-700';
  return FLAWLESS_RANK_STYLES[rank];
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
