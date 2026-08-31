type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const MAX_BUCKETS = 5_000;
const globalForRateLimit = globalThis as unknown as {
  shopRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalForRateLimit.shopRateLimitBuckets ?? new Map<string, Bucket>();
globalForRateLimit.shopRateLimitBuckets = buckets;

const evictExpiredAndBound = (now: number) => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
};

export const getClientKey = (request: Request) => {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return 'untrusted-proxy';

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip')?.trim() || 'unknown';
};

export const checkRateLimit = (
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now = Date.now(),
): RateLimitResult => {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (!current) evictExpiredAndBound(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0 };
};

export const resetRateLimitsForTests = () => buckets.clear();
