import sharp from 'sharp';
import {
  validateAvatarUpload,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIM,
} from '../src/lib/avatar';

// Generate a tiny PNG of a given size at runtime via Sharp. Beats shipping
// fixture images and lets each test target an exact dimension/format.
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(width: number, height: number, quality = 80): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 200 },
    },
  })
    .jpeg({ quality })
    .toBuffer();
}

describe('validateAvatarUpload', () => {
  test('accepts a valid 256x256 PNG', async () => {
    const buf = await makePng(256, 256);
    const result = await validateAvatarUpload(buf, 'image/png');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(256);
      expect(result.height).toBe(256);
      expect(result.mimeType).toBe('image/png');
    }
  });

  test('accepts a valid 1024x1024 PNG (max edge case)', async () => {
    const buf = await makePng(AVATAR_MAX_DIM, AVATAR_MAX_DIM);
    const result = await validateAvatarUpload(buf, 'image/png');
    expect(result.ok).toBe(true);
  });

  test('accepts JPEG and WebP', async () => {
    const jpg = await makeJpeg(128, 128);
    const jpgResult = await validateAvatarUpload(jpg, 'image/jpeg');
    expect(jpgResult.ok).toBe(true);

    const webp = await sharp({
      create: { width: 128, height: 128, channels: 3, background: '#cccccc' },
    })
      .webp()
      .toBuffer();
    const webpResult = await validateAvatarUpload(webp, 'image/webp');
    expect(webpResult.ok).toBe(true);
  });

  test('rejects when bytes exceed 1MB', async () => {
    // Stuff a junk buffer larger than the limit; Sharp won't even be called
    // because the size guard short-circuits.
    const huge = Buffer.alloc(AVATAR_MAX_BYTES + 1, 0);
    const result = await validateAvatarUpload(huge, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('too_large');
  });

  test('rejects unsupported mime types (gif, svg, etc.)', async () => {
    const buf = await makePng(64, 64);
    const result = await validateAvatarUpload(buf, 'image/gif');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unsupported_mime');
  });

  test('rejects null/missing mime type', async () => {
    const buf = await makePng(64, 64);
    const result = await validateAvatarUpload(buf, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unsupported_mime');
  });

  test('rejects images larger than 1024x1024', async () => {
    const buf = await makePng(1025, 1025);
    const result = await validateAvatarUpload(buf, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('too_big_pixels');
  });

  test('rejects non-square images', async () => {
    const buf = await makePng(512, 256);
    const result = await validateAvatarUpload(buf, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_square');
  });

  test('rejects unreadable bytes claiming to be a PNG', async () => {
    // Random bytes with the right MIME — Sharp can't parse, must reject.
    const garbage = Buffer.from('not actually a png file at all', 'utf8');
    const result = await validateAvatarUpload(garbage, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unreadable');
  });

  test('rejects 0-byte input', async () => {
    const empty = Buffer.alloc(0);
    const result = await validateAvatarUpload(empty, 'image/png');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unreadable');
  });
});
