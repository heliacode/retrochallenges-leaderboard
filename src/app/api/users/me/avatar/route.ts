import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySubmissionSecret } from '@/lib/auth';
import { validateAvatarUpload, AVATAR_MAX_BYTES } from '@/lib/avatar';

export const runtime = 'nodejs';

// Next's body-size limit defaults to 1 MB on app-router routes; raise it
// to a hair above ours so the validator catches "too_large" with the
// exact byte count rather than the framework killing the request first.
export const maxDuration = 30;

// POST /api/users/me/avatar — multipart/form-data with:
//   field "googleSub": string  (identifies which user; same trust model
//                                as /api/runs)
//   field "avatar":   File     (PNG / JPEG / WebP, <= 1MB, <= 1024^2, square)
export async function POST(req: NextRequest) {
  if (!verifySubmissionSecret(req.headers.get('x-rc-submission-secret'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const googleSub = form.get('googleSub');
  const avatar    = form.get('avatar');

  if (typeof googleSub !== 'string' || googleSub.length === 0) {
    return NextResponse.json({ error: 'missing_googleSub' }, { status: 400 });
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
      where: { googleSub },
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
