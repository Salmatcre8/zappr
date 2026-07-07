// Lightweight in-memory fixed-window rate limiter, keyed by client IP.
//
// NOTE: state lives in a single serverless instance's memory, so this is a
// first line of defense against a single abuser hammering the agent endpoint,
// not a distributed guarantee across all Vercel instances. It needs no extra
// service and keeps us backend-stateless. For a hard, cross-instance limit
// (once traffic justifies it) back this with Upstash Redis (@upstash/ratelimit)
// and a REST URL/token env var — same call shape, swap the store.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** epoch ms when the current window resets */
  resetAt: number;
  /** seconds until reset, for a Retry-After header */
  retryAfter: number;
}

/**
 * Allow up to `limit` hits per `windowMs` for a given key.
 * Returns ok:false once the window is exhausted.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep so the map can't grow unbounded under churn.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    resetAt: bucket.resetAt,
    retryAfter: 0,
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
