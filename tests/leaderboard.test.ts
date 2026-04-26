import { formatFrames, challengeHref, parseLeaderboardWindow, windowSince } from '../src/lib/leaderboard';

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
