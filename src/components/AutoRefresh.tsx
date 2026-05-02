'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Periodic router.refresh() so the catalog's recent-activity feed picks
// up new runs without the visitor manually reloading. Pauses when the
// tab isn't visible (Chromium throttles intervals there anyway, but
// being explicit avoids hammering the server with stale-cache requests
// from background tabs).
//
// 30-second cadence is a soft trade — fast enough to feel live during
// a streamer's session, slow enough that the server isn't refetching
// every Run row + manifest every couple seconds.
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
