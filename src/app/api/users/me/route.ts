import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { resolveTargetUserId } from '@/lib/auth';

export const runtime = 'nodejs';

// PATCH /api/users/me — change the signed-in user's display name.
//
// Two callers:
//  - Web /me page: NextAuth session identifies the user; body.googleSub
//    is ignored (and may be omitted).
//  - Desktop app: shared submission secret + body.googleSub in the
//    payload (legacy trust model).
//
// resolveTargetUserId() normalizes both into a User.id.
const PatchSchema = z.object({
  // Optional under web-session auth; required under secret auth. The
  // resolver enforces "secret-auth without googleSub" → 401.
  googleSub: z.string().min(1).max(128).optional(),
  name: z.string().min(1).max(120),
});

export async function PATCH(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const userId = await resolveTargetUserId(req, parsed.data.googleSub ?? null);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name.trim() },
      select: { id: true, name: true },
    });
    return NextResponse.json({ ok: true, userId: user.id, name: user.name });
  } catch {
    // Most likely Prisma's P2025 (record not found) — race with admin
    // delete or stale session. Return 404 with a clear code.
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
}
