// Avatar upload validation. Constraints (decided in spec):
//   - <= 1 MB raw bytes
//   - <= 1024x1024 pixels
//   - must be square (width === height)
//   - PNG / JPEG / WebP only (the formats Sharp ships out of the box and
//     browsers render reliably)
//
// Pure-ish function: takes the upload Buffer + mimeType and returns either
// { ok: true, ... } or { ok: false, error }. The route handler does the
// I/O / DB write. Lets us test the entire validation policy without a
// running server.

import sharp from 'sharp';

export const AVATAR_MAX_BYTES = 1024 * 1024;            // 1 MB
export const AVATAR_MAX_DIM   = 1024;                   // 1024x1024
export const AVATAR_ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type AvatarValidationOk = {
  ok: true;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
};
export type AvatarValidationErr = {
  ok: false;
  code:
    | 'too_large'
    | 'unsupported_mime'
    | 'unreadable'
    | 'too_big_pixels'
    | 'not_square';
  message: string;
};
export type AvatarValidation = AvatarValidationOk | AvatarValidationErr;

export async function validateAvatarUpload(
  buffer: Buffer,
  mimeType: string | null | undefined,
): Promise<AvatarValidation> {
  if (buffer.length > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      code: 'too_large',
      message: `Image is ${buffer.length} bytes; limit is ${AVATAR_MAX_BYTES}.`,
    };
  }
  if (!mimeType || !AVATAR_ALLOWED_MIME.has(mimeType)) {
    return {
      ok: false,
      code: 'unsupported_mime',
      message: `Mime type "${mimeType}" not allowed. Use PNG, JPEG, or WebP.`,
    };
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch (err) {
    return {
      ok: false,
      code: 'unreadable',
      message: `Could not read image: ${(err as Error).message}`,
    };
  }

  const width  = meta.width  ?? 0;
  const height = meta.height ?? 0;

  if (width === 0 || height === 0) {
    return {
      ok: false,
      code: 'unreadable',
      message: 'Image has no dimensions.',
    };
  }

  if (width > AVATAR_MAX_DIM || height > AVATAR_MAX_DIM) {
    return {
      ok: false,
      code: 'too_big_pixels',
      message: `Image is ${width}x${height}; max is ${AVATAR_MAX_DIM}x${AVATAR_MAX_DIM}.`,
    };
  }

  if (width !== height) {
    return {
      ok: false,
      code: 'not_square',
      message: `Image must be square (received ${width}x${height}).`,
    };
  }

  return { ok: true, buffer, mimeType, width, height };
}
