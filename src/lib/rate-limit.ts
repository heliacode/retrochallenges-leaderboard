// In-memory sliding-window rate limiter.
//
// Why in-memory: at our scale (a few hundred users / a few hundred
// requests per day) we don't need Redis. Each Next.js process tracks
// its own buckets; on a multi-instance deploy a determined attacker
// could get N×limit through, but that's still N×10/min, not infinity.
//
// Memory bound: a periodic sweep evicts buckets whose newest entry is
// older than the window — so the Map size tracks active IPs only,
// not lifetime IPs.

interface Bucket {
  // Sorted ascending; oldest at index 0.
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX       = 10;
const SWEEP_INTERVAL_MS = 60_000;

// Periodic cleanup so the Map doesn't grow unbounded on a long-running
// process. unref() so the timer doesn't prevent Node from exiting in
// tests / scripts that import this module.
const sweep = setInterval(() => {
  const cutoff = Date.now() - DEFAULT_WINDOW_MS;
  for (const [key, bucket] of buckets) {
    const fresh = bucket.timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      bucket.timestamps = fresh;
    }
  }
}, SWEEP_INTERVAL_MS);
sweep.unref?.();

export interface RateLimitResult {
  allowed: boolean;
  // Requests still allowed in the current window after this call.
  remaining: number;
  // Milliseconds until the oldest in-window request falls out — i.e.
  // when the next slot opens up. 0 when allowed=true.
  resetMs: number;
}

// Records one hit for `key` and returns whether it's within the
// allowed rate. Sliding-window: prunes timestamps older than `windowMs`
// before counting, so the limit is "max requests in the last windowMs".
export function rateLimit(
  key: string,
  max: number = DEFAULT_MAX,
  windowMs: number = DEFAULT_WINDOW_MS,
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  // In-place prune — cheap because timestamps is small.
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, oldest + windowMs - now),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: max - bucket.timestamps.length,
    resetMs: 0,
  };
}

// Test helper — wipes all bucket state. Not for production use.
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
