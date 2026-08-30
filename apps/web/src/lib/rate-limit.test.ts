import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, resetRateLimitsForTests } from './rate-limit';

beforeEach(() => resetRateLimitsForTests());

describe('rate limiter', () => {
  it('blocks after the configured limit until reset', () => {
    expect(checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 1000).allowed).toBe(true);
    expect(checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 1100).allowed).toBe(true);
    const blocked = checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 1200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(checkRateLimit('auth:test', { limit: 2, windowMs: 1000 }, 2000).allowed).toBe(true);
  });
});
