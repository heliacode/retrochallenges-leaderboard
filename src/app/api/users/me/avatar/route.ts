import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveTargetUserId } from '@/lib/auth';
import { validateAvatarUpload, AVATAR_MAX_BYTES } from '@/lib/avatar';

export const runtime = 'nodejs';

// Next's body-size limit defaults to 1 MB on app-router routes; raise it
// to a hair above ours so the validator catches "too_large" with the
// exact byte count rather than the framework killing the request first.
export const maxDuration = 30;

// POST /api/users/me/avatar — multipart/form-data with:
//   field "googleSub": string  (only required when authenticating via the
//                                shared submission secret; ignored when a
//                                NextAuth session is present)
//   field "avatar":   File     (PNG / JPEG / WebP, <= 1MB, <= 1024^2, square)
//
// Dual auth: web /me page calls this through a NextAuth session; the
// desktop app posts with submission secret + googleSub.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const googleSubField = form.get('googleSub');
  const googleSub = typeof googleSubField === 'string' && googleSubField.length > 0
    ? googleSubField
    : null;
  const avatar    = form.get('avatar');

  const userId = await resolveTargetUserId(req, googleSub);
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!(avatar instanceof File)) {
    return NextResponse.json({ error: 'missing_avatar_file' }, { status: 400 });
  }
  if (avatar.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', detail: `Image is ${avatar.size} bytes; limit is ${AVATAR_MAX_BYTES}.` },
      { status: 413 },
    );
  }

  const arrayBuffer = await avatar.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);
  const validation  = await validateAvatarUpload(buffer, avatar.type);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.code, detail: validation.message },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        pictureBlob:     validation.buffer,
        pictureMimeType: validation.mimeType,
        hasCustomAvatar: true,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, userId: user.id });
  } catch {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
}
