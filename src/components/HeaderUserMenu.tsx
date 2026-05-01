import Image from 'next/image';
import Link from 'next/link';
import { auth, signIn } from '@/auth';
import { effectivePictureUrl } from '@/lib/leaderboard';
import { prisma } from '@/lib/db';

// Header right-rail user menu. Server component so the signed-in /
// signed-out branch is decided on the server (no flash of "Sign in"
// for already-authed users). The Sign-In button is a server-action
// form posting to NextAuth's signIn('google'); avatar links straight
// to /me with no dropdown for v1 — sign-out lives on the dashboard.
export async function HeaderUserMenu() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/me' });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-colors"
        >
          Sign in
        </button>
      </form>
    );
  }

  // Pull the custom-avatar flag so the header shows the user-uploaded
  // picture if one exists. Cheap one-row read; cached by Next's request
  // memoization since other server components on the same request also
  // hit the user table.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, pictureUrl: true, hasCustomAvatar: true },
  });
  if (!user) {
    // Edge case: session refers to a user that's been deleted. Fall
    // through to the signed-out shape so the UI doesn't crash.
    return null;
  }

  const avatar = effectivePictureUrl(user);

  return (
    <Link
      href="/me"
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
      aria-label="Your dashboard"
    >
      {avatar ? (
        <Image
          src={avatar}
          alt=""
          width={28}
          height={28}
          className="rounded-full"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-slate-700" aria-hidden="true" />
      )}
      <span className="hidden sm:inline truncate max-w-[8rem]">{user.name}</span>
    </Link>
  );
}
