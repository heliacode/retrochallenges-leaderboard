import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifySubmissionSecret } from '@/lib/auth';

export const runtime = 'nodejs';

// PATCH /api/users/me — change the signed-in user's display name. Identity
// comes from the body (googleSub) per the same trust model the runs
// endpoint uses: the submission secret authenticates the desktop app,
// and we trust the app-claimed user.
const PatchSchema = z.object({
  googleSub: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
});

export async function PATCH(req: NextRequest) {
  if (!verifySubmissionSecret(req.headers.get('x-rc-submission-secret'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

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

  try {
    const user = await prisma.user.update({
      where: { googleSub: parsed.data.googleSub },
      data: { name: parsed.data.name.trim() },
      select: { id: true, name: true },
    });
    return NextResponse.json({ ok: true, userId: user.id, name: user.name });
  } catch {
    // Most likely Prisma's P2025 (record not found) — user hasn't submitted
    // a run yet so they're not in our table. Return 404 with a clear code.
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
}
