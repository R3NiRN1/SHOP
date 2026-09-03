import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminCredentialFingerprint, isSameOriginMutation, safeEqual } from './security';

afterEach(() => vi.unstubAllEnvs());

describe('security helpers', () => {
  it('compares credential strings without direct equality', () => {
    expect(safeEqual('correct horse battery staple', 'correct horse battery staple')).toBe(true);
    expect(safeEqual('correct horse battery staple', 'wrong')).toBe(false);
  });

  it('changes the admin fingerprint when credentials rotate', () => {
    vi.stubEnv('AUTH_SECRET', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('ADMIN_EMAIL', 'admin@shop.test');
    vi.stubEnv('ADMIN_PASSWORD', 'correct-horse-battery-staple');
    const first = getAdminCredentialFingerprint();

    vi.stubEnv('ADMIN_PASSWORD', 'rotated-horse-battery-staple');
    const second = getAdminCredentialFingerprint();

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('rejects cross-origin mutation requests', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const sameOrigin = new Request('https://shop.test/api/admin/varieties', {
      method: 'POST',
      headers: { origin: 'https://shop.test', 'sec-fetch-site': 'same-origin' },
    });
    const crossOrigin = new Request('https://shop.test/api/admin/varieties', {
      method: 'POST',
      headers: { origin: 'https://attacker.test', 'sec-fetch-site': 'cross-site' },
    });
    const browserSameOrigin = new Request('https://shop.test/api/admin/varieties', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    });
    const conflictingOrigin = new Request('https://shop.test/api/admin/varieties', {
      method: 'POST',
      headers: { origin: 'https://attacker.test', 'sec-fetch-site': 'same-origin' },
    });
    vi.stubEnv('NEXTAUTH_URL', 'https://shop.test');
    const proxiedSameOrigin = new Request('http://internal-host:3001/api/admin/varieties', {
      method: 'POST',
      headers: { origin: 'https://shop.test', 'sec-fetch-site': 'same-origin' },
    });
    const missingOrigin = new Request('https://shop.test/api/admin/varieties', { method: 'POST' });

    expect(isSameOriginMutation(sameOrigin)).toBe(true);
    expect(isSameOriginMutation(crossOrigin)).toBe(false);
    expect(isSameOriginMutation(browserSameOrigin)).toBe(true);
    expect(isSameOriginMutation(conflictingOrigin)).toBe(false);
    expect(isSameOriginMutation(proxiedSameOrigin)).toBe(true);
    expect(isSameOriginMutation(missingOrigin)).toBe(false);
  });
});
