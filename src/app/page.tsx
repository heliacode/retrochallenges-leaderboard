import Link from 'next/link';
import { headers } from 'next/headers';
import { CatalogView } from '@/components/CatalogView';

// Skip build-time pre-render — we don't have a DB at build time on Railway,
// and we need to read the request host to decide what to render.
export const dynamic = 'force-dynamic';

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
  return <LandingPage />;
}

// ---------------------------------------------------------------------------
// Landing page (flawlessnes.com)
// ---------------------------------------------------------------------------
function LandingPage() {
  return (
    <div className="space-y-16">
      <Hero />
      <Features />
      <Creators />
    </div>
  );
}

function Hero() {
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
          href="https://github.com/heliacode/RetroChallenges/releases/latest"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-colors"
        >
          Download for Windows
        </a>
        <Link
          href="/leaderboards"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-indigo-500 hover:bg-slate-800 transition-colors"
        >
          Browse Leaderboards →
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Sign in with Google coming soon — your stats follow you across desktop and web.
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
