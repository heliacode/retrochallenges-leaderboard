// Catch-all handler that NextAuth v5 wires onto the auth API surface
// (sign-in, callback, session, csrf, providers, etc.). The actual config
// lives in src/auth.ts; this file is intentionally trivial.
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
