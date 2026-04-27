import {
  formatFrames,
  challengeHref,
  parseLeaderboardWindow,
  parseLeaderboardView,
  windowSince,
  isBetterRun,
} from '../src/lib/leaderboard';

describe('formatFrames', () => {
  test('returns em-dash for null', () => {
    expect(formatFrames(null)).toBe('—');
  });

  test('zero frames is 0:00.000', () => {
    expect(formatFrames(0)).toBe('0:00.000');
  });

  test('60 frames at 60fps is exactly 1 second', () => {
    expect(formatFrames(60)).toBe('0:01.000');
  });

  test('3600 frames is exactly 1 minute', () => {
    expect(formatFrames(3600)).toBe('1:00.000');
  });

  test('rounds millis cleanly', () => {
    // 90 frames at 60fps = 1.5s
    expect(formatFrames(90)).toBe('0:01.500');
  });
});

describe('challengeHref', () => {
  test('percent-encodes spaces and punctuation', () => {
    expect(challengeHref('Castlevania', 'Get 5000 points!')).toBe(
      '/c/Castlevania/Get%205000%20points!',
    );
  });

  test('round-trips a slashy name', () => {
    const name = 'Level 1/2 warp';
    const href = challengeHref('Super Mario Bros', name);
    expect(href.includes('%2F')).toBe(true);
  });
});

describe('parseLeaderboardWindow', () => {
  test('passes through valid window keys', () => {
    expect(parseLeaderboardWindow('daily')).toBe('daily');
    expect(parseLeaderboardWindow('weekly')).toBe('weekly');
    expect(parseLeaderboardWindow('all')).toBe('all');
  });

  test('falls back to "all" for unknown / missing values', () => {
    expect(parseLeaderboardWindow(undefined)).toBe('all');
    expect(parseLeaderboardWindow(null)).toBe('all');
    expect(parseLeaderboardWindow('')).toBe('all');
    expect(parseLeaderboardWindow('forever')).toBe('all');
  });
});

describe('parseLeaderboardView', () => {
  test('passes through valid view keys', () => {
    expect(parseLeaderboardView('best')).toBe('best');
    expect(parseLeaderboardView('all')).toBe('all');
  });
  test('falls back to "best" for unknown / missing values', () => {
    expect(parseLeaderboardView(undefined)).toBe('best');
    expect(parseLeaderboardView(null)).toBe('best');
    expect(parseLeaderboardView('')).toBe('best');
    expect(parseLeaderboardView('weekly')).toBe('best');
  });
});

describe('isBetterRun', () => {
  test('higher score is better', () => {
    expect(isBetterRun({ score: 5900, completionTimeFrames: 100 },
                       { score: 5000, completionTimeFrames: 50 })).toBe(true);
  });
  test('on score tie, faster time is better', () => {
    expect(isBetterRun({ score: 5000, completionTimeFrames: 50 },
                       { score: 5000, completionTimeFrames: 100 })).toBe(true);
  });
  test('on score tie, slower time is not better', () => {
    expect(isBetterRun({ score: 5000, completionTimeFrames: 200 },
                       { score: 5000, completionTimeFrames: 100 })).toBe(false);
  });
  test('any score beats null score', () => {
    expect(isBetterRun({ score: 1, completionTimeFrames: null },
                       { score: null, completionTimeFrames: 5 })).toBe(true);
    expect(isBetterRun({ score: null, completionTimeFrames: 5 },
                       { score: 1, completionTimeFrames: null })).toBe(false);
  });
  test('time-only challenges: faster wins', () => {
    expect(isBetterRun({ score: null, completionTimeFrames: 100 },
                       { score: null, completionTimeFrames: 200 })).toBe(true);
  });
  test('exact tie is not strictly better', () => {
    expect(isBetterRun({ score: 5000, completionTimeFrames: 100 },
                       { score: 5000, completionTimeFrames: 100 })).toBe(false);
  });
});

describe('windowSince', () => {
  const now = new Date('2026-04-26T12:00:00Z');

  test('returns null for "all" so the query gets no time filter', () => {
    expect(windowSince('all', now)).toBeNull();
  });

  test('"daily" cutoff is exactly 24h before now', () => {
    const cutoff = windowSince('daily', now);
    expect(cutoff).toEqual(new Date('2026-04-25T12:00:00Z'));
  });

  test('"weekly" cutoff is exactly 7 days before now', () => {
    const cutoff = windowSince('weekly', now);
    expect(cutoff).toEqual(new Date('2026-04-19T12:00:00Z'));
  });
});
