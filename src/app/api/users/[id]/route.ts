import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '@/lib/leaderboard';

export const runtime = 'nodejs';

// Returns the same UserProfile the SSR /u/[userId] page renders,
// as JSON. Public endpoint (matches the page's visibility) — no
// secret required.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getUserProfile(id);
  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(profile);
}
