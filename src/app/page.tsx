import Link from 'next/link';
import { headers } from 'next/headers';
import { CatalogView } from '@/components/CatalogView';

// Skip build-time pre-render — we don't have a DB at build time on Railway,
// and we need to read the request host to decide what to render.
export const dynamic = 'force-dynamic';

const DOWNLOAD_URL = 'https://github.com/heliacode/flawlessnes-releases/releases/download/v1.5.1/RetroChallenges.Setup.1.5.1.exe';

// Hostnames that should still see the catalog at the root URL. Anything
// else (flawlessnes.com, www.flawlessnes.com, localhost during dev, etc.)
// gets the marketing landing page. When we cut over fully, remove this
// list and add a 301 redirect from the legacy host to flawlessnes.com.
const LEGACY_CATALOG_HOSTS = new Set([
  'leaderboards.retrochallenges.com',
]);

export default async function HomePage() {
  const host = (await headers()).get('host') ?? '';
  // Strip the port for local dev (Next dev server passes "localhost:3000").
  const hostname = host.split(':')[0].toLowerCase();
  if (LEGACY_CATALOG_HOSTS.has(hostname)) {
    return <CatalogView />;
  }
  return <LandingPage downloadUrl={DOWNLOAD_URL} />;
}

// ---------------------------------------------------------------------------
// Landing page (flawlessnes.com)
// ---------------------------------------------------------------------------
function LandingPage({ downloadUrl }: { downloadUrl: string }) {
  return (
    <div className="space-y-16">
      <Hero downloadUrl={downloadUrl} />
      <Features />
      <FeaturedCreator />
      <Creators />
    </div>
  );
}

function Hero({ downloadUrl }: { downloadUrl: string }) {
  return (
    <section className="text-center pt-8">
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight">
        Beat the NES.
        <br />
        <span className="text-indigo-300">Prove it.</span>
      </h1>
      <p className="mt-5 text-lg text-slate-300 max-w-2xl mx-auto">
        FlawlessNES turns retro NES games into bite-sized challenges with verified completions
        and live leaderboards. Run them in BizHawk; your scores ping the board the moment you win.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-colors"
        >
          Download for Windows
        </a>
        <Link
          href="/signin"
          className="inline-flex items-center gap-2 rounded-md border border-indigo-400 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-indigo-200 hover:bg-slate-800 transition-colors"
        >
          Sign in with Google
        </Link>
        <Link
          href="/leaderboards"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-indigo-500 hover:bg-slate-800 transition-colors"
        >
          Browse Leaderboards →
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Same Google account works across the desktop app and web — your stats follow you.
      </p>
    </section>
  );
}

function Features() {
  const items = [
    {
      title: 'Curated NES challenges',
      body: 'Boss fights, speedruns, score targets, survival gauntlets — each one a tight scenario you can pick up and run in a couple of minutes.',
    },
    {
      title: 'Verified completions',
      body: 'Win conditions read directly from emulator RAM. No screenshot uploads, no honor system. The challenge fires complete the instant you actually win.',
    },
    {
      title: 'Time-first leaderboards',
      body: 'Every challenge ranks by completion time. Score breaks ties. The fastest legitimate run wins — no exceptions.',
    },
  ];
  return (
    <section>
      <ul className="grid gap-4 sm:grid-cols-3">
        {items.map((it) => (
          <li
            key={it.title}
            className="rounded-lg border border-slate-700 bg-slate-900 p-5"
          >
            <h3 className="font-display text-lg font-semibold text-white">{it.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{it.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Featured-creator spotlight. Hand-curated card sitting between the
// generic features section and the broader creators strip — bigger
// visual weight, with both Twitch and YouTube CTAs side-by-side.
function FeaturedCreator() {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-6 sm:p-8">
      <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold mb-2">
        Featured creator
      </p>
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">Slackanater</h2>
      <p className="mt-3 text-slate-300 max-w-2xl">
        Retro NES streamer focused on damageless playthroughs and clean speedruns.
        Pulled off the world&rsquo;s first <span className="text-white font-medium">100% damageless run of Ninja Gaiden NES</span>{' '}
        — the kind of patience-and-pattern-recognition mastery FlawlessNES is built around.
        Catch live runs on Twitch and breakdowns on YouTube.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href="https://twitch.tv/slackanater"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-colors"
        >
          Watch on Twitch
        </a>
        <a
          href="https://www.youtube.com/channel/UCfXIDj6qnRZBRLgIib0PZbQ"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-indigo-500 hover:bg-slate-700 transition-colors"
        >
          Subscribe on YouTube
        </a>
      </div>
    </section>
  );
}

function Creators() {
  const channels = [
    { name: 'slackanater', url: 'https://twitch.tv/slackanater' },
    { name: 'mattd1980',   url: 'https://twitch.tv/mattd1980' },
    { name: 'jodosh',      url: 'https://twitch.tv/jodosh' },
  ];
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-white mb-1">Watch the creators live</h2>
      <p className="text-sm text-slate-400 mb-4">
        The folks building and breaking these challenges on stream — drop in for a watch.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {channels.map((c) => (
          <li key={c.name}>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-indigo-500 hover:bg-slate-800 transition-colors"
            >
              <span className="text-indigo-300 font-medium">twitch.tv/</span>
              {c.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
