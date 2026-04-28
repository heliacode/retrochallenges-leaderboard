import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserProfile } from '@/lib/leaderboard';

export const runtime = 'nodejs';

// Profile lookup by Google `sub` claim — what the desktop app
// has on hand from its sign-in (state.userInfo.googleSub). Saves
// the client from an extra round-trip just to translate sub -> uuid.
// Public; no secret required.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sub: string }> }) {
  const { sub } = await params;
  const user = await prisma.user.findUnique({ where: { googleSub: sub }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const profile = await getUserProfile(user.id);
  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(profile);
}
