// Fetches the desktop app's GitHub releases for /releases. Public API,
// no auth — same trust model as the assets-repo manifest fetcher.
//
// Cached at the Next fetch layer with a 10-min revalidate; we don't ship
// new releases often enough to need anything tighter, and the GitHub API
// has a 60-req/hr rate limit for unauthed requests so being conservative
// matters.

const RELEASES_URL =
  'https://api.github.com/repos/heliacode/RetroChallenges/releases?per_page=20';
const REVALIDATE_SECONDS = 600; // 10 min

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface Release {
  id: number;
  tagName: string;
  name: string;
  publishedAt: string | null;
  htmlUrl: string;
  body: string;            // raw markdown
  prerelease: boolean;
  draft: boolean;
  assets: ReleaseAsset[];
}

interface RawAsset {
  name: string;
  browser_download_url: string;
  size: number;
}
interface RawRelease {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  html_url: string;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: RawAsset[];
}

export async function getReleases(): Promise<Release[]> {
  try {
    const res = await fetch(RELEASES_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'FlawlessNES-Website/1.0',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.warn('[releases] GitHub fetch failed:', res.status);
      return [];
    }
    const data = (await res.json()) as RawRelease[];
    return data
      .filter((r) => !r.draft)
      .map((r) => ({
        id: r.id,
        tagName: r.tag_name,
        name: r.name || r.tag_name,
        publishedAt: r.published_at,
        htmlUrl: r.html_url,
        body: r.body || '',
        prerelease: r.prerelease,
        draft: r.draft,
        assets: r.assets.map((a) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: a.size,
        })),
      }));
  } catch (err) {
    console.warn('[releases] fetch error:', (err as Error).message);
    return [];
  }
}

// Pick the "best" download asset for a release — the platform-native
// installer takes precedence over the auto-update YAML metadata, the
// portable binaries, and source-code tarballs. Used by the page to
// surface a single Download button per release.
export function primaryDownload(assets: ReleaseAsset[]): ReleaseAsset | null {
  if (assets.length === 0) return null;
  const ranked = [...assets].sort((a, b) => assetRank(a.name) - assetRank(b.name));
  return ranked[0];
}

function assetRank(name: string): number {
  const n = name.toLowerCase();
  if (n.endsWith('.exe')) return 0;     // Windows installer (NSIS)
  if (n.endsWith('.dmg')) return 1;     // macOS image
  if (n.endsWith('.appimage')) return 2; // Linux portable
  if (n.endsWith('.zip') || n.endsWith('.tar.gz')) return 3; // bundled artifacts
  if (n.endsWith('.yml') || n.endsWith('.yaml')) return 9;   // auto-update metadata
  return 5;
}
