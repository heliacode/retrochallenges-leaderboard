// Reads the challenges.json manifest from the assets repo so the
// leaderboard can render game/challenge metadata (category, difficulty)
// that the Run table doesn't carry. Assets are the source of truth — we
// don't replicate the manifest into the DB at submission time so authors
// can re-categorize without a migration.
//
// Network call is cheap (~3 KB) and infrequent. We cache in memory at
// module scope with a TTL, plus serve stale on failure so a flaky
// GitHub raw response doesn't break the page.

const MANIFEST_URL =
  'https://raw.githubusercontent.com/heliacode/retrochallenges-assets/refs/heads/main/challenges.json';
const TTL_MS = 5 * 60 * 1000; // 5 minutes — matches Next.js fetch revalidate hint below

interface RawManifestChallenge {
  name: string;
  category?: string;
  difficulty?: string;
}
interface RawManifestGame {
  name: string;
  challenges: RawManifestChallenge[];
}
interface RawManifest {
  games: RawManifestGame[];
}

export interface ChallengeMeta {
  game: string;
  challengeName: string;
  category?: string;
  difficulty?: string;
}

// Map key: `${game}::${challengeName}`. Identical key shape used elsewhere
// in the app for (game, challenge) tuples — see UserProfile aggregation.
export function manifestKey(game: string, challengeName: string): string {
  return `${game}::${challengeName}`;
}

let cache: { meta: Map<string, ChallengeMeta>; expiresAt: number } | null = null;

export async function getChallengesManifest(): Promise<Map<string, ChallengeMeta>> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) return cache.meta;

  try {
    const res = await fetch(MANIFEST_URL, {
      // Hint Next.js's fetch cache to revalidate every 5 min on the server.
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`manifest fetch ${res.status}`);
    const data = (await res.json()) as RawManifest;
    const meta = parseManifest(data);
    cache = { meta, expiresAt: now + TTL_MS };
    return meta;
  } catch (err) {
    console.warn(
      '[manifest] fetch failed, serving',
      cache ? 'stale cache' : 'empty map',
      ':',
      (err as Error).message,
    );
    // Serve stale rather than empty if we ever had a successful fetch —
    // an outage shouldn't make the navigation regress to flat lists.
    return cache?.meta ?? new Map();
  }
}

// Pure transform — exported so tests can hit it without touching fetch.
export function parseManifest(data: RawManifest): Map<string, ChallengeMeta> {
  const out = new Map<string, ChallengeMeta>();
  if (!data || !Array.isArray(data.games)) return out;
  for (const g of data.games) {
    if (!g || typeof g.name !== 'string' || !Array.isArray(g.challenges)) continue;
    for (const c of g.challenges) {
      if (!c || typeof c.name !== 'string') continue;
      out.set(manifestKey(g.name, c.name), {
        game: g.name,
        challengeName: c.name,
        category: c.category,
        difficulty: c.difficulty,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Category vocabulary (also lives in challenges.json metadata.categories;
// duplicated here so the leaderboard renders consistently even if the
// manifest fetch fails or a new category appears upstream).
// ---------------------------------------------------------------------------
export const CATEGORY_ORDER: readonly string[] = ['boss', 'speedrun', 'survival', 'score'];

export const CATEGORY_LABELS: Record<string, string> = {
  boss:     'Boss Fights',
  speedrun: 'Speedruns',
  survival: 'Survival',
  score:    'Score Targets',
  other:    'Other',
};

export function categoryLabel(category: string | undefined): string {
  if (!category) return CATEGORY_LABELS.other;
  return CATEGORY_LABELS[category] ?? category;
}
