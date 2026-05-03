import {
  rateLimit,
  _resetRateLimitForTests,
} from '../src/lib/rate-limit';

beforeEach(() => {
  _resetRateLimitForTests();
});

describe('rateLimit', () => {
  test('allows up to `max` requests in a window', () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit('k', 5, 60_000, 1_000_000 + i);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
  });

  test('rejects the (max+1)th request in the window', () => {
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000, 1_000_000 + i);
    const r = rateLimit('k', 3, 60_000, 1_000_005);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetMs).toBeGreaterThan(0);
  });

  test('resetMs counts down to when the oldest request falls out of window', () => {
    rateLimit('k', 1, 1000, 1_000_000);                  // first request at t=1_000_000
    const r = rateLimit('k', 1, 1000, 1_000_400);        // second at t+400, denied
    expect(r.allowed).toBe(false);
    // Oldest entry (t=1_000_000) falls out at t=1_001_000; 600ms remaining.
    expect(r.resetMs).toBe(600);
  });

  test('window slides — old entries don\'t count after windowMs', () => {
    rateLimit('k', 2, 1000, 1_000_000);                  // 2 requests inside window
    rateLimit('k', 2, 1000, 1_000_500);
    const denied = rateLimit('k', 2, 1000, 1_000_800);   // 3rd at 800ms — denied
    expect(denied.allowed).toBe(false);
    // Now jump past the first request's window expiry (1_001_000+).
    const allowed = rateLimit('k', 2, 1000, 1_002_000);  // first dropped, room for one
    expect(allowed.allowed).toBe(true);
  });

  test('different keys are tracked independently', () => {
    rateLimit('a', 1, 60_000, 1_000_000);
    const a2 = rateLimit('a', 1, 60_000, 1_000_001);
    expect(a2.allowed).toBe(false);
    const b1 = rateLimit('b', 1, 60_000, 1_000_001);
    expect(b1.allowed).toBe(true);
  });

  test('allowed requests report remaining correctly', () => {
    expect(rateLimit('k', 3, 60_000, 1_000_000).remaining).toBe(2);
    expect(rateLimit('k', 3, 60_000, 1_000_001).remaining).toBe(1);
    expect(rateLimit('k', 3, 60_000, 1_000_002).remaining).toBe(0);
  });
});
