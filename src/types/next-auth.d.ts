// NextAuth's default Session.user shape doesn't include `id`. We surface
// it from the database session in src/auth.ts's session callback, and
// declare it here so server / client components can read it type-safely.
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
