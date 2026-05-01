import { CatalogView } from '@/components/CatalogView';

// Skip build-time pre-render — we don't have a DB at build time on Railway.
export const dynamic = 'force-dynamic';

// Canonical URL for the catalog under flawlessnes.com. The legacy root
// (/) on the leaderboards.retrochallenges.com host also renders this
// component via host-aware routing, so existing links keep working.
export default function LeaderboardsPage() {
  return <CatalogView />;
}
