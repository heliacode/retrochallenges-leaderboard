// Simple download page. Hard-linked to the GitHub release asset on the
// public flawlessnes-releases repo (anonymous-downloadable). The
// download.flawlessnes.com mirror is hand-maintained, so we link
// straight at GitHub to avoid the CDN getting out of sync per release.
export const dynamic = 'force-dynamic';

const DOWNLOAD_URL = 'https://github.com/heliacode/flawlessnes-releases/releases/download/v1.6.0/RetroChallenges.Setup.1.6.0.exe';
const VERSION = '1.6.0';

export default function ReleasesPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-white mb-2">Download FlawlessNES</h1>
        <p className="text-slate-400">
          The FlawlessNES desktop app for Windows. Auto-update offers each new build on launch.
        </p>
      </header>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <h2 className="font-display text-xl font-bold text-white">Windows installer</h2>
        <p className="text-sm text-slate-400 mt-1">Version {VERSION}</p>
        <div className="mt-5">
          <a
            href={DOWNLOAD_URL}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-colors"
          >
            Download for Windows
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Windows SmartScreen will warn that the installer isn&rsquo;t code-signed — click{' '}
          <strong className="text-slate-300">More info</strong> →{' '}
          <strong className="text-slate-300">Run anyway</strong>.
        </p>
      </section>
    </div>
  );
}
