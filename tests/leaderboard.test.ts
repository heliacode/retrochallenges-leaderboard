import { formatFrames, challengeHref } from '../src/lib/leaderboard';

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
