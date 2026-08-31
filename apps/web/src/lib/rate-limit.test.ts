import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, getClientKey, resetRateLimitsForTests } from './rate-limit';

beforeEach(() => resetRateLimitsForTests());
afterEach(() => vi.unstubAllEnvs());

describe('rate limiter', () => {
  it('blocks after the configured limit until reset', () => {
    expect(checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 1000).allowed).toBe(true);
    expect(checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 1100).allowed).toBe(true);
    const blocked = checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 1200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 2000).allowed).toBe(true);
  });

  it('does not trust forwarding headers unless explicitly configured', () => {
    const request = new Request('https://shop.test/api/auth/callback/credentials', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });
    expect(getClientKey(request)).toBe('untrusted-proxy');

    vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
    expect(getClientKey(request)).toBe('203.0.113.10');
  });
});
