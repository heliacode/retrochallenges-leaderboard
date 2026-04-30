import { NextResponse } from 'next/server';
import { challengeHref, gameHref } from '@/lib/leaderboard';
import { getChallengesManifest, type SearchItem } from '@/lib/challenges-manifest';

// Flat search index for the header HeaderSearch. Built from the assets-repo
// manifest so brand-new challenges (zero runs yet) are still navigable.
// Public, GET-only, no auth — same trust model as challenges.json itself.
//
// Cached upstream by the manifest fetcher (5-min TTL); we add Cache-Control
// here so a CDN / browser can serve the same shape directly without round-
// tripping the server.
export const runtime = 'nodejs';

export async function GET() {
  const manifest = await getChallengesManifest();
  const games = new Set<string>();
  const challengeItems: SearchItem[] = [];
  for (const m of manifest.values()) {
    games.add(m.game);
    challengeItems.push({
      type: 'challenge',
      label: m.challengeName,
      context: m.game,
      href: challengeHref(m.game, m.challengeName),
    });
  }
  const gameItems: SearchItem[] = Array.from(games)
    .sort((a, b) => a.localeCompare(b))
    .map((g) => ({ type: 'game', label: g, href: gameHref(g) }));

  // Games first so a query like "castl" surfaces the hub before its
  // individual challenges; alphabetical within each tier.
  challengeItems.sort((a, b) => a.label.localeCompare(b.label));
  const items: SearchItem[] = [...gameItems, ...challengeItems];

  return NextResponse.json(items, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
    },
  });
}
