import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// GET /api/users/[id]/avatar — streams the user's uploaded avatar blob.
// Public (no secret); the same accessibility level as the SSR profile
// page at /u/[id]. Short browser cache (60s) so a fresh upload becomes
// visible quickly after the user edits their profile, with stale-while-
// revalidate to soften the re-fetch cost on busy leaderboard pages.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      pictureBlob:     true,
      pictureMimeType: true,
      hasCustomAvatar: true,
      bannedAt:        true,
    },
  });
  if (!user || user.bannedAt || !user.hasCustomAvatar || !user.pictureBlob) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Prisma returns Bytes as Buffer in Node runtime. Wrapping in a Blob
  // gives us a clean BodyInit and Next.js streams it from there.
  const blob = new Blob([new Uint8Array(user.pictureBlob)], {
    type: user.pictureMimeType ?? 'application/octet-stream',
  });
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type':  user.pictureMimeType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
