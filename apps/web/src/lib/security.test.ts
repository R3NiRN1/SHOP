import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminCredentialFingerprint, safeEqual } from './security';

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
});
