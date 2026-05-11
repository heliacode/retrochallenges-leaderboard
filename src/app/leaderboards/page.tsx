import { CatalogView } from '@/components/CatalogView';
import { Podium } from '@/components/Podium';
import { getTopPlayer } from '@/lib/podium';

// Skip build-time pre-render — we don't have a DB at build time on Railway.
export const dynamic = 'force-dynamic';

// Re-resolve every 60s so the podium reflects fresh submissions without
// forcing a full no-store on the page (the catalog underneath is fairly
// expensive). New runs that move the daily/weekly leader land within
// the next minute.
export const revalidate = 60;

// Canonical URL for the catalog under flawlessnes.com. The legacy root
// (/) on the leaderboards.retrochallenges.com host also renders this
// component via host-aware routing, so existing links keep working.
export default async function LeaderboardsPage() {
  const [daily, weekly, allTime] = await Promise.all([
    getTopPlayer('daily'),
    getTopPlayer('weekly'),
    getTopPlayer('all'),
  ]);
  return (
    <>
      <Podium daily={daily} weekly={weekly} allTime={allTime} />
      <CatalogView />
    </>
  );
}
