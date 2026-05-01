// NextAuth v5 configuration. Single Google OAuth provider, Prisma adapter
// for the User/Account/Session tables, database session strategy so server
// components can read the session via auth() with no JWT decode.
//
// Identity model: NextAuth's User.id (uuid) maps 1:1 to our existing
// User.id (uuid). The existing User.googleSub column holds Google's stable
// `sub` claim, populated on user-create from the OAuth profile so the
// desktop app keeps using the same identity as the website.

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Auth.js v5 refuses to handle auth requests when it can't verify the
  // host (default outside Vercel). We're behind Railway's proxy on the
  // known NEXTAUTH_URL host, so trust the X-Forwarded-Host header.
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Existing desktop-app users have a User row keyed by googleSub but
      // no Account row. Without this flag, their first website sign-in
      // hits OAuthAccountNotLinked. Safe here because Google is our only
      // provider and Google always verifies email ownership server-side
      // — there's no second untrusted provider that could spoof email.
      allowDangerousEmailAccountLinking: true,
      // Mirror the OAuth profile into the columns that pre-existed
      // (googleSub + pictureUrl) so the rest of the app keeps reading
      // them without a separate migration step. The adapter still fills
      // in the standard NextAuth columns (email, emailVerified, image,
      // name) on the same row.
      profile(profile) {
        return {
          id: undefined, // let Prisma generate the uuid
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          // App-specific columns:
          googleSub: profile.sub,
          pictureUrl: profile.picture ?? null,
        } as never;  // wider shape than NextAuth's default User
      },
    }),
  ],
  session: { strategy: 'database' },
  // Branded sign-in landing page — beats NextAuth's default unstyled
  // provider list. The page itself bounces already-signed-in users to
  // the post-auth target so it never shows when it shouldn't.
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    // Surface the user's database id on the session object so server
    // components can call getUserProfile(session.user.id) directly.
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    // First-sign-in linking: an existing desktop-app user (created with
    // googleSub but no Account row) gets matched by email here. The
    // adapter's default behaviour creates an Account row pointing at the
    // existing User instead of creating a duplicate.
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && profile?.sub) {
        // Backfill googleSub if a brand-new user record was just created
        // by the adapter (it doesn't know about our app-specific column).
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleSub: profile.sub as string,
            pictureUrl: (profile.picture as string | undefined) ?? null,
          },
        }).catch(() => {
          // Non-fatal — user might already have these set, or the row
          // might not exist yet on the very first call. Logged for debug.
          console.warn('[auth] backfill googleSub/pictureUrl no-op for', user.id);
        });
      }
      return true;
    },
  },
});
