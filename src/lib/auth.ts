import { timingSafeEqual } from 'node:crypto';

// Constant-time compare — a regular === on the secret leaks length + a few
// bytes via timing. For a secret this hot (every submission goes through
// it) we pay the 2µs to do it right.
function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifySubmissionSecret(headerValue: string | null | undefined): boolean {
  const expected = process.env.SUBMISSION_SECRET;
  if (!expected) {
    // Fail closed: an unconfigured server should never accept submissions.
    console.error('SUBMISSION_SECRET is not set; rejecting submission.');
    return false;
  }
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expected);
}

export function verifyAdminToken(headerValue: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    console.error('ADMIN_TOKEN is not set; rejecting admin request.');
    return false;
  }
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expected);
}
