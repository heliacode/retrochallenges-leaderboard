import type { Metadata } from 'next';
import Link from 'next/link';
import { HeaderSearch } from '@/components/HeaderSearch';
import { HeaderUserMenu } from '@/components/HeaderUserMenu';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlawlessNES Leaderboard',
  description: 'Community leaderboards for FlawlessNES — retro gaming challenges with verified completions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-slate-925 text-slate-200 font-sans antialiased">
        <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
            <Link href="/" className="font-display text-xl font-bold text-white shrink-0">
              FlawlessNES
            </Link>
            <div className="flex-1 flex justify-end">
              <HeaderSearch />
            </div>
            <HeaderUserMenu />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

        <footer className="border-t border-slate-700 mt-16 py-6 text-center text-xs text-slate-500">
          <span>&copy; 2026 FlawlessNES</span>
          <span className="mx-3">&middot;</span>
          <Link href="/releases" className="hover:text-slate-300">Release notes</Link>
        </footer>
      </body>
    </html>
  );
}
