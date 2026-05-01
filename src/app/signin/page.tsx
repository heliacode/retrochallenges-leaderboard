import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

// Branded sign-in page. NextAuth's pages.signIn config points here so
// signIn('google') calls (from the header button or anywhere else) land
// on this page first when the user isn't authenticated. The single big
// "Sign in with Google" button kicks the actual OAuth round-trip via a
// server action.
//
// Already-signed-in users get bounced to /me immediately rather than
// shown the sign-in form (which would be confusing).
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const session = await auth();
  const sp = await searchParams;
  const target = sp.callbackUrl || '/me';
  if (session?.user?.id) {
    redirect(target);
  }

  return (
    <section className="max-w-md mx-auto py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-white mb-2">
        Sign in to <span className="text-indigo-300">FlawlessNES</span>
      </h1>
      <p className="text-slate-400 mb-8">
        Your runs from the desktop app — and any you submit going forward — show up under
        your dashboard once you sign in. Same Google account either side.
      </p>

      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: target });
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-colors"
        >
          <GoogleGlyph />
          Sign in with Google
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        We only read your Google name, email, and profile picture. Nothing is shared with
        third parties. <Link href="/" className="underline hover:text-slate-300">Back to home</Link>.
      </p>
    </section>
  );
}

function GoogleGlyph() {
  // Inline so the page has zero client-side image fetches. Standard Google
  // brand "G" colors (kept on purpose, the brand asset is multicoloured).
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.4 39.6 16.1 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.7 35.5 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
