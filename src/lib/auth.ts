import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Constant-time compare — a regular === on the secret leaks length + a few
// bytes via timing. For a secret this hot (every submission goes through
// it) we pay the 2µs to do it right.
function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifySubmissionSecret(headerValue: string | null | undefined): boolean {
  const expected = process.env.SUBMISSION_SECRET;
  if (!expected) {
    // Fail closed: an unconfigured server should never accept submissions.
    console.error('SUBMISSION_SECRET is not set; rejecting submission.');
    return false;
  }
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expected);
}

// Dual-auth resolver for endpoints that act on the signed-in user's
// own row (PATCH /api/users/me, POST /api/users/me/avatar). The web /me
// page calls them through a NextAuth session; the desktop app posts with
// the shared submission secret + googleSub in the body. We accept either,
// normalize to a User.id, and return null if neither identifies a user.
//
// Caller pre-parses the body so the helper doesn't need to know its shape;
// pass the googleSub it found (if any) so the secret path can resolve to
// a user record.
export async function resolveTargetUserId(
  req: NextRequest,
  bodyGoogleSub: string | null | undefined,
): Promise<string | null> {
  // 1. Web session — preferred path on flawlessnes.com /me.
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  // 2. Legacy: shared submission secret + body googleSub. Same trust
  //    model the runs endpoint uses; keeps the desktop app working
  //    unchanged through the migration to web auth.
  if (!verifySubmissionSecret(req.headers.get('x-rc-submission-secret'))) return null;
  if (!bodyGoogleSub) return null;
  const user = await prisma.user.findUnique({
    where: { googleSub: bodyGoogleSub },
    select: { id: true },
  });
  return user?.id ?? null;
}

// Admin session gate. Session-based equivalent of the bearer-token
// admin path — used by the /admin pages and their server actions.
//
// Two ways in:
//   1. User.isAdmin == true (DB-backed; granted/revoked via /admin/users)
//   2. Bootstrap allowlist (hardcoded emails)
//
// The bootstrap allowlist exists so the very first admin can never be
// locked out — even if a botched DB write demotes everyone, the
// hardcoded address still authenticates. Treat ADMIN_BOOTSTRAP_EMAILS
// as "owners who can always recover the system".
const ADMIN_BOOTSTRAP_EMAILS = new Set<string>([
  'mdrimonakos@gmail.com',
]);

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_BOOTSTRAP_EMAILS.has(email.toLowerCase());
}

// Throws (via Next's notFound()) if the caller isn't a signed-in admin.
// notFound() pretends the page doesn't exist rather than 401-ing — keeps
// the admin URL invisible to anyone fishing for it.
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;
  if (!userId) notFound();

  // Bootstrap path — short-circuit without a DB read.
  if (isBootstrapAdminEmail(email)) {
    return { userId, email: email as string };
  }

  // DB-backed path. Single indexed lookup, cheap.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, bannedAt: true },
  });
  if (!user || !user.isAdmin || user.bannedAt) notFound();

  return { userId, email: email as string };
}

export function verifyAdminToken(headerValue: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error('ADMIN_TOKEN is not set; rejecting admin request.');
    return false;
  }
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expected);
}
