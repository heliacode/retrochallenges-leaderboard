'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Tiny client component: re-runs server data fetching when the tab
// becomes visible after being hidden. Used on /me so a profile edit
// made on the desktop app (or another browser tab) becomes visible
// without a manual reload when the user comes back to the dashboard.
//
// router.refresh() re-renders the closest server boundary (this page);
// no full document reload, no scroll reset.
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') router.refresh();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [router]);
  return null;
}
