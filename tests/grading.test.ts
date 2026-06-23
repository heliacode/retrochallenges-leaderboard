import {
  gradeForRun,
  gradeRank,
  isBetterOrEqualGrade,
  summarizeTrophies,
  emptyTrophyStats,
  GRADE_ORDER,
  flawlessRankForScore,
  flawlessHitsForScore,
  type Grade,
} from '../src/lib/grading';

const STD_THRESHOLDS = [
  { grade: 'SSS', maxFrames: 1200 },
  { grade: 'SS',  maxFrames: 2400 },
  { grade: 'S',   maxFrames: 4800 },
  { grade: 'A',   maxFrames: 9000 },
  { grade: 'B',   maxFrames: 999999 },
];

describe('gradeForRun', () => {
  test('returns the highest grade the player beat', () => {
    expect(gradeForRun(STD_THRESHOLDS, 600)).toBe('SSS');
    expect(gradeForRun(STD_THRESHOLDS, 1200)).toBe('SSS');
    expect(gradeForRun(STD_THRESHOLDS, 1201)).toBe('SS');
    expect(gradeForRun(STD_THRESHOLDS, 2400)).toBe('SS');
    expect(gradeForRun(STD_THRESHOLDS, 4801)).toBe('A');
    expect(gradeForRun(STD_THRESHOLDS, 9000)).toBe('A');
    expect(gradeForRun(STD_THRESHOLDS, 9001)).toBe('B');
  });

  test('null when run has no completionTimeFrames', () => {
    expect(gradeForRun(STD_THRESHOLDS, null)).toBeNull();
    expect(gradeForRun(STD_THRESHOLDS, undefined)).toBeNull();
  });

  test('null when challenge has no thresholds', () => {
    expect(gradeForRun(undefined, 100)).toBeNull();
    expect(gradeForRun(null, 100)).toBeNull();
    expect(gradeForRun([], 100)).toBeNull();
  });

  test('null on negative completionTimeFrames', () => {
    expect(gradeForRun(STD_THRESHOLDS, -1)).toBeNull();
  });

  test('skips thresholds with non-numeric maxFrames', () => {
    const malformed = [
      { grade: 'SSS', maxFrames: 'fast' as unknown as number },
      { grade: 'SS',  maxFrames: 2400 },
    ];
    expect(gradeForRun(malformed, 1000)).toBe('SS');
  });

  test('null on unknown grade strings (forward-compat: ignored, not thrown)', () => {
    const unknown = [
      { grade: 'GOD',  maxFrames: 100 },
      { grade: 'SSS',  maxFrames: 1200 },
    ];
    // Player beat the GOD threshold, but it's not a known grade.
    expect(gradeForRun(unknown, 50)).toBeNull();
  });
});

describe('gradeRank + isBetterOrEqualGrade', () => {
  test('SSS ranks highest, B ranks lowest, null is worst', () => {
    expect(gradeRank('SSS')).toBe(0);
    expect(gradeRank('SS')).toBe(1);
    expect(gradeRank('B')).toBe(4);
    expect(gradeRank(null)).toBe(GRADE_ORDER.length);
  });

  test('isBetterOrEqualGrade compares correctly', () => {
    expect(isBetterOrEqualGrade('SSS', 'SS')).toBe(true);
    expect(isBetterOrEqualGrade('SS', 'SSS')).toBe(false);
    expect(isBetterOrEqualGrade('A', 'A')).toBe(true);
    expect(isBetterOrEqualGrade('B', null)).toBe(true);
    expect(isBetterOrEqualGrade(null, 'B')).toBe(false);
  });
});

describe('summarizeTrophies', () => {
  test('all-empty player gets zero everything', () => {
    const stats = summarizeTrophies(25, []);
    expect(stats.totalChallenges).toBe(25);
    expect(stats.attemptedChallenges).toBe(0);
    expect(stats.tally.SSS).toBe(0);
    expect(stats.sssPct).toBe(0);
    expect(stats.attemptedPct).toBe(0);
  });

  test('per-grade tally + percentages', () => {
    const grades: (Grade | null)[] = ['SSS', 'SSS', 'SS', 'S', 'S', 'S', 'A', 'B'];
    const stats = summarizeTrophies(25, grades);
    expect(stats.attemptedChallenges).toBe(8);
    expect(stats.tally).toEqual({ SSS: 2, SS: 1, S: 3, A: 1, B: 1 });
    expect(stats.sssPct).toBe(8);                 // 2/25 = 8%
    expect(stats.ssOrBetterPct).toBe(12);         // 3/25 = 12%
    expect(stats.attemptedPct).toBe(32);          // 8/25 = 32%
  });

  test('null grades count as attempts but contribute to no tally', () => {
    const stats = summarizeTrophies(10, [null, null, 'SSS']);
    expect(stats.attemptedChallenges).toBe(3);
    expect(stats.tally.SSS).toBe(1);
    expect(stats.sssPct).toBe(10);                // 1/10
  });

  test('division-by-zero protection when totalChallenges is 0', () => {
    const stats = summarizeTrophies(0, []);
    expect(stats.sssPct).toBe(0);
    expect(stats.attemptedPct).toBe(0);
  });
});

describe('emptyTrophyStats', () => {
  test('reproducible empty shape', () => {
    expect(emptyTrophyStats(25)).toEqual({
      totalChallenges: 25,
      attemptedChallenges: 0,
      tally: { SSS: 0, SS: 0, S: 0, A: 0, B: 0 },
      sssPct: 0,
      ssOrBetterPct: 0,
      attemptedPct: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// FlawlessNES scoring (the fixed hit table — must mirror the challenge .lua)
// ---------------------------------------------------------------------------
describe('flawlessRankForScore', () => {
  test('maps each table cutoff to its rank', () => {
    expect(flawlessRankForScore(5000)).toBe('Flawless');
    expect(flawlessRankForScore(3500)).toBe('A');
    expect(flawlessRankForScore(2750)).toBe('B');
    expect(flawlessRankForScore(2000)).toBe('C');
    expect(flawlessRankForScore(1250)).toBe('D');
    expect(flawlessRankForScore(93)).toBe('D');
  });
  test('null when no score', () => {
    expect(flawlessRankForScore(null)).toBeNull();
    expect(flawlessRankForScore(undefined)).toBeNull();
  });
});

describe('flawlessHitsForScore', () => {
  test('inverts the full published table exactly', () => {
    // Hits → Score pairs straight from the FlawlessNES spec table.
    const table: [number, number][] = [
      [0, 5000], [1, 3500], [2, 2750], [3, 2000], [4, 1250],
      [5, 1063], [6, 903], [7, 768], [10, 472], [20, 93],
    ];
    for (const [hits, score] of table) {
      expect(flawlessHitsForScore(score)).toBe(hits);
    }
  });
  test('null when no score', () => {
    expect(flawlessHitsForScore(null)).toBeNull();
  });
});
