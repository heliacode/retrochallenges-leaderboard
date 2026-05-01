import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  getReleases,
  primaryDownload,
  type Release,
  type ReleaseAsset,
} from '@/lib/releases';

// Server-rendered list of recent FlawlessNES desktop-app releases. Pulled
// from the GitHub Releases API at request time (10-min revalidate). Each
// release shows its tag, date, body (rendered markdown), and a download
// button for the most-likely platform-native asset.
//
// Public route — no auth needed; matches the leaderboard browse pages.
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export default async function ReleasesPage() {
  const releases = await getReleases();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-white mb-2">Release notes</h1>
        <p className="text-slate-400">
          What&rsquo;s shipped in the FlawlessNES desktop app, newest first. Auto-update offers
          each new build on launch — or grab the installer below.
        </p>
      </header>

      {releases.length === 0 ? (
        <p className="text-slate-400">
          Couldn&rsquo;t reach the GitHub releases API. Try again in a few minutes, or browse{' '}
          <a
            href="https://github.com/heliacode/RetroChallenges/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 hover:text-indigo-200 underline"
          >
            the releases page directly on GitHub
          </a>
          .
        </p>
      ) : (
        <ol className="space-y-6 list-none">
          {releases.map((r) => (
            <li key={r.id}>
              <ReleaseCard release={r} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReleaseCard({ release }: { release: Release }) {
  const dl = primaryDownload(release.assets);
  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <header className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-white truncate">
            {release.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            <span className="font-mono">{release.tagName}</span>
            {release.publishedAt && (
              <>
                <span className="mx-2">&middot;</span>
                <time dateTime={release.publishedAt}>
                  {new Date(release.publishedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </>
            )}
            {release.prerelease && (
              <>
                <span className="mx-2">&middot;</span>
                <span className="text-amber-300">prerelease</span>
              </>
            )}
          </p>
        </div>
        {dl && <DownloadButton asset={dl} />}
      </header>

      {release.body.trim() ? (
        <div className="prose prose-invert prose-sm max-w-none mt-4 text-slate-300">
          <ReactMarkdown
            // Override default tag styling so the markdown blends with
            // the rest of the page. Tailwind's prose plugin isn't
            // installed; we style each tag inline instead.
            components={{
              h1: (p) => <h3 className="font-display text-base font-semibold text-white mt-4 mb-2" {...p} />,
              h2: (p) => <h3 className="font-display text-base font-semibold text-white mt-4 mb-2" {...p} />,
              h3: (p) => <h4 className="font-display text-sm font-semibold text-white mt-3 mb-1" {...p} />,
              p:  (p) => <p className="text-sm text-slate-300 my-2" {...p} />,
              ul: (p) => <ul className="list-disc list-outside pl-5 my-2 space-y-1 text-sm text-slate-300" {...p} />,
              ol: (p) => <ol className="list-decimal list-outside pl-5 my-2 space-y-1 text-sm text-slate-300" {...p} />,
              li: (p) => <li className="text-sm text-slate-300" {...p} />,
              code: (p) => <code className="bg-slate-800 px-1 py-0.5 rounded text-xs text-indigo-300 font-mono" {...p} />,
              pre: (p) => <pre className="bg-slate-800 p-3 rounded text-xs text-slate-200 font-mono overflow-x-auto my-2" {...p} />,
              a:  (p) => <a className="text-indigo-300 hover:text-indigo-200 underline" target="_blank" rel="noopener noreferrer" {...p} />,
              strong: (p) => <strong className="text-white font-semibold" {...p} />,
              em: (p) => <em className="italic" {...p} />,
              hr: () => <hr className="border-slate-700 my-4" />,
              table: (p) => <table className="border-collapse my-3 text-xs" {...p} />,
              th: (p) => <th className="border-b border-slate-700 px-2 py-1 text-left text-slate-400 font-medium" {...p} />,
              td: (p) => <td className="border-b border-slate-800 px-2 py-1 text-slate-300" {...p} />,
            }}
          >
            {release.body}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-slate-500 mt-4 italic">No release notes provided.</p>
      )}

      <footer className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <Link
          href={release.htmlUrl}
          className="hover:text-slate-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub →
        </Link>
        {release.assets.length > 1 && (
          <span>{release.assets.length} downloadable assets</span>
        )}
      </footer>
    </article>
  );
}

function DownloadButton({ asset }: { asset: ReleaseAsset }) {
  return (
    <a
      href={asset.browser_download_url}
      className="shrink-0 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-colors"
    >
      Download {prettyBytes(asset.size)}
    </a>
  );
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
