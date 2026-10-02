import { afterEach, describe, expect, it, vi } from 'vitest';
import { paymentAvailability, paymentConfig } from './commerce-config';

afterEach(() => vi.unstubAllEnvs());

describe('payment activation', () => {
  const setup = () => {
    vi.stubEnv('PAYMENTS_ENABLED', 'true');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123456789abcdef');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_123456789abcdef');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3001');
    vi.stubEnv('SHOP_DELIVERY', 'collection');
  };

  it('stays disabled without an explicit flag and requires all settings', () => {
    vi.stubEnv('PAYMENTS_ENABLED', 'false');
    expect(paymentAvailability().enabled).toBe(false);
    setup();
    expect(paymentAvailability()).toMatchObject({ enabled: true, testMode: true, shippingPence: 0 });
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    expect(paymentAvailability().enabled).toBe(false);
  });

  it('requires HTTPS and a second explicit switch for live keys', () => {
    setup();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_123456789abcdef');
    expect(() => paymentConfig()).toThrow('Live payments require explicit activation.');
    vi.stubEnv('SHOP_ALLOW_LIVE_PAYMENTS', 'true');
    expect(() => paymentConfig()).toThrow('Configure the shop URL');
    vi.stubEnv('NEXTAUTH_URL', 'https://shop.test');
    expect(paymentConfig()).toMatchObject({ live: true, origin: 'https://shop.test' });
  });

  it('requires a shipping charge when shipping is selected', () => {
    setup();
    vi.stubEnv('SHOP_DELIVERY', 'shipping');
    vi.stubEnv('SHOP_SHIPPING_PENCE', '');
    expect(() => paymentConfig()).toThrow('Set the postage charge');
    vi.stubEnv('SHOP_SHIPPING_PENCE', '250');
    expect(paymentConfig().shippingPence).toBe(250);
  });
});
