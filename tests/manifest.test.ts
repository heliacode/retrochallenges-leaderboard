import {
  parseManifest,
  manifestKey,
  categoryLabel,
  filterSearchItems,
  type SearchItem,
} from '../src/lib/challenges-manifest';

describe('parseManifest', () => {
  test('empty / null / malformed input returns empty map', () => {
    expect(parseManifest(undefined as unknown as { games: never[] }).size).toBe(0);
    expect(parseManifest(null as unknown as { games: never[] }).size).toBe(0);
    expect(parseManifest({} as unknown as { games: never[] }).size).toBe(0);
    expect(parseManifest({ games: 'not an array' } as unknown as { games: never[] }).size).toBe(0);
  });

  test('skips games / challenges with missing or wrong-typed names', () => {
    const m = parseManifest({
      games: [
        { name: 'OK', challenges: [{ name: 'Real', category: 'boss' }] },
        { name: 'Bad', challenges: [{ category: 'score' } as unknown as { name: string }] }, // missing name
        { challenges: [{ name: 'NoGameName' }] } as unknown as { name: string; challenges: never[] },
        null as unknown as { name: string; challenges: never[] },
      ],
    });
    expect(m.size).toBe(1);
    expect(m.get('OK::Real')?.category).toBe('boss');
  });

  test('round-trips category and difficulty', () => {
    const m = parseManifest({
      games: [
        {
          name: 'Castlevania',
          challenges: [
            { name: 'Phantom Bat', category: 'boss', difficulty: 'Medium' },
            { name: 'Get 5000 points!', category: 'score', difficulty: 'Easy' },
          ],
        },
      ],
    });
    expect(m.size).toBe(2);
    expect(m.get(manifestKey('Castlevania', 'Phantom Bat'))).toEqual({
      game: 'Castlevania',
      challengeName: 'Phantom Bat',
      category: 'boss',
      difficulty: 'Medium',
    });
    expect(m.get(manifestKey('Castlevania', 'Get 5000 points!'))?.category).toBe('score');
  });

  test('absent category / difficulty stays undefined (not coerced to empty string)', () => {
    const m = parseManifest({
      games: [{ name: 'X', challenges: [{ name: 'Y' }] }],
    });
    const meta = m.get(manifestKey('X', 'Y'));
    expect(meta).toBeDefined();
    expect(meta?.category).toBeUndefined();
    expect(meta?.difficulty).toBeUndefined();
  });
});

describe('manifestKey', () => {
  test('joins game and challenge name with ::', () => {
    expect(manifestKey('Mega Man 2', 'Metal Man Boss Fight')).toBe(
      'Mega Man 2::Metal Man Boss Fight',
    );
  });
});

describe('categoryLabel', () => {
  test('maps known categories to display strings', () => {
    expect(categoryLabel('boss')).toBe('Boss Fights');
    expect(categoryLabel('speedrun')).toBe('Speedruns');
    expect(categoryLabel('survival')).toBe('Survival');
    expect(categoryLabel('score')).toBe('Score Targets');
  });

  test('undefined falls through to "Other"', () => {
    expect(categoryLabel(undefined)).toBe('Other');
  });

  test('unknown category strings pass through verbatim', () => {
    // Forward-compat: assets repo can ship a new category before we update
    // the leaderboard's vocabulary, and we render it as-is rather than
    // hiding it.
    expect(categoryLabel('gauntlet')).toBe('gauntlet');
  });
});

describe('filterSearchItems', () => {
  const items: SearchItem[] = [
    { type: 'game',      label: 'Castlevania',           href: '/g/Castlevania' },
    { type: 'game',      label: 'Mega Man 2',            href: '/g/Mega%20Man%202' },
    { type: 'challenge', label: 'Phantom Bat — No Subweapon!', context: 'Castlevania', href: '/c/...' },
    { type: 'challenge', label: 'Metal Man Boss Fight',  context: 'Mega Man 2',  href: '/c/...' },
    { type: 'challenge', label: 'Cross the Big Bridge!', context: 'Castlevania', href: '/c/...' },
  ];

  test('empty / whitespace query returns no results', () => {
    expect(filterSearchItems(items, '')).toEqual([]);
    expect(filterSearchItems(items, '   ')).toEqual([]);
  });

  test('case-insensitive substring match on label', () => {
    const r = filterSearchItems(items, 'METAL');
    expect(r.length).toBe(1);
    expect(r[0].label).toBe('Metal Man Boss Fight');
  });

  test('matches against context (parent game)', () => {
    const r = filterSearchItems(items, 'castlevania');
    // Game tile + 2 challenges sharing the Castlevania context.
    expect(r.length).toBe(3);
    // Game (label match, tier 0) ranks before challenges (context match, tier 1+).
    expect(r[0].type).toBe('game');
  });

  test('prefix matches outrank infix matches', () => {
    const r = filterSearchItems(items, 'man');
    // "Mega Man 2" (label prefix) and "Metal Man Boss Fight" both match;
    // game with prefix-on-label should appear before challenge that only
    // contains "man" mid-string.
    expect(r[0].label).toBe('Mega Man 2');
  });

  test('respects the limit', () => {
    expect(filterSearchItems(items, 'a', 2).length).toBe(2);
  });

  test('no matches returns empty array', () => {
    expect(filterSearchItems(items, 'xyzzy')).toEqual([]);
  });
});
