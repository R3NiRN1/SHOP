import { afterEach, describe, expect, it, vi } from 'vitest';
import { authRuntimeState, contactRuntimeState, hasRuntimeDatabaseUrl, isStarterCatalogEnabled } from './runtime-env';

afterEach(() => vi.unstubAllEnvs());

describe('runtime configuration', () => {
  it('rejects CI placeholders as runtime auth', () => {
    vi.stubEnv('DATABASE_URL', 'file:./ci.db');
    vi.stubEnv('AUTH_SECRET', 'ci-placeholder-not-for-prod');
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
    vi.stubEnv('ADMIN_PASSWORD', 'admin');
    expect(authRuntimeState().enabled).toBe(false);
    expect(hasRuntimeDatabaseUrl()).toBe(false);
  });

  it('requires every auth dependency', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://shop:secret@db:5432/shop');
    vi.stubEnv('AUTH_SECRET', 'a-long-random-runtime-secret');
    vi.stubEnv('ADMIN_EMAIL', 'admin@shop.test');
    vi.stubEnv('ADMIN_PASSWORD', 'a-strong-admin-password');
    expect(authRuntimeState()).toEqual({ enabled: true, issues: [] });
  });

  it('never enables starter catalogue in production', () => {
    vi.stubEnv('ENABLE_STARTER_CATALOG', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isStarterCatalogEnabled()).toBe(false);
  });

  it('rejects placeholder contact addresses', () => {
    vi.stubEnv('SHOP_CONTACT_EMAIL', 'hello@example.org');
    expect(contactRuntimeState().configured).toBe(false);
    vi.stubEnv('SHOP_CONTACT_EMAIL', 'orders@shop.test');
    expect(contactRuntimeState()).toEqual({ configured: true, email: 'orders@shop.test' });
  });
});
