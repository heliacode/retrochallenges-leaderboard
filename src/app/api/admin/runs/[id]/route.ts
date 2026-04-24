import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export const runtime = 'nodejs';

// Soft-delete a run. We keep the row (for audit) but flag hiddenAt so it
// stops appearing in public leaderboards. Pair with a reason for future
// moderation log work.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAdminToken(req.headers.get('x-admin-token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const reason = new URL(req.url).searchParams.get('reason') ?? null;

  try {
    const run = await prisma.run.update({
      where: { id },
      data: {
        hiddenAt: new Date(),
        hiddenReason: reason,
      },
      select: { id: true, hiddenAt: true },
    });
    return NextResponse.json({ ok: true, runId: run.id, hiddenAt: run.hiddenAt });
  } catch (err) {
    // Most likely P2025 "record not found"; we don't leak Prisma error codes.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
