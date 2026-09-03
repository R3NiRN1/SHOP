import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const doctorPath = fileURLToPath(new URL('../../../../scripts/doctor.mjs', import.meta.url));

const runDoctor = (environment: Record<string, string>) =>
  execFileSync(process.execPath, [doctorPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TRUST_PROXY_HEADERS: '',
      READINESS_DETAILS: '',
      ENABLE_STARTER_CATALOG: '',
      ...environment,
    },
  });

describe('SHOP doctor', () => {
  it('reports the pinned toolchain and accepts production-shaped configuration', () => {
    const output = runDoctor({
      npm_config_user_agent: 'pnpm/11.25.0 node/v24.20.0',
      DATABASE_URL: 'postgresql://doctor:doctor@127.0.0.1:5432/doctor?schema=public',
      AUTH_SECRET: '0123456789abcdef0123456789abcdef',
      ADMIN_EMAIL: 'admin@shop.test',
      ADMIN_PASSWORD: 'doctor-admin-password',
      SHOP_CONTACT_EMAIL: 'orders@shop.test',
      NEXTAUTH_URL: 'https://shop.test',
    });

    expect(output).toContain('require 24.x at or above 24.20.0');
    expect(output).toContain('pnpm: found 11.25.0; require exactly 11.25.0');
    expect(output).toContain('DATABASE_URL: PostgreSQL URL configured');
    expect(output).toContain('AUTH secret: configured');
    expect(output).toContain('NEXTAUTH_URL: canonical HTTPS origin configured');
  });

  it('identifies weak, placeholder, and unsafe deployment settings', () => {
    const output = runDoctor({
      DATABASE_URL: 'file:./ci.db',
      AUTH_SECRET: 'short',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'admin',
      SHOP_CONTACT_EMAIL: 'not-an-email',
      NEXTAUTH_URL: 'http://shop.test/path',
      TRUST_PROXY_HEADERS: 'true',
      READINESS_DETAILS: 'true',
      ENABLE_STARTER_CATALOG: 'true',
    });

    expect(output).toContain('DATABASE_URL: CI placeholder; runtime DB disabled');
    expect(output).toContain('AUTH secret: too short; require at least 32 characters');
    expect(output).toContain('ADMIN_EMAIL: CI placeholder; runtime auth disabled');
    expect(output).toContain('ADMIN_PASSWORD: CI placeholder; runtime auth disabled');
    expect(output).toContain('SHOP_CONTACT_EMAIL: invalid email');
    expect(output).toContain('NEXTAUTH_URL: require an origin-only HTTPS URL');
    expect(output).toContain('Proxy-header trust: enabled; verify the deployment proxy overwrites forwarding headers');
    expect(output).toContain('Readiness details: dependency detail exposed');
  });
});
