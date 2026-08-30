import { readFileSync } from 'node:fs';

const REQUIRED_NODE_VERSION = [20, 19, 0];
const REQUIRED_PNPM_VERSION = [10, 0, 0];
const CI_DATABASE_URLS = new Set(['postgresql://ci:ci@localhost:5432/ci?schema=public', 'file:./ci.db']);
const CI_AUTH_SECRET = 'ci-placeholder-not-for-prod';

const parseVersion = (value) => String(value ?? '').replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10));
const compareVersions = (current, required) => {
  for (let index = 0; index < required.length; index += 1) {
    const currentPart = current[index] ?? 0;
    const requiredPart = required[index] ?? 0;
    if (currentPart < requiredPart) return -1;
    if (currentPart > requiredPart) return 1;
  }
  return 0;
};
const readPackageManagerVersion = () => {
  try {
    const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return packageManager?.split('@')[1] ?? null;
  } catch { return null; }
};
const ok = (condition) => condition ? 'ok' : 'warn';
const present = (value) => typeof value === 'string' && value.trim().length > 0;

const rows = [];
rows.push({ check: 'Node.js', status: ok(compareVersions(parseVersion(process.versions.node), REQUIRED_NODE_VERSION) >= 0), detail: `found ${process.versions.node}; require ${REQUIRED_NODE_VERSION.join('.')}` });
const userAgent = process.env.npm_config_user_agent ?? '';
const pnpmVersion = /pnpm\/(\d+\.\d+\.\d+)/.exec(userAgent)?.[1] ?? readPackageManagerVersion();
rows.push({ check: 'pnpm', status: ok(Boolean(pnpmVersion) && compareVersions(parseVersion(pnpmVersion), REQUIRED_PNPM_VERSION) >= 0), detail: pnpmVersion ? `found ${pnpmVersion}; require ${REQUIRED_PNPM_VERSION.join('.')}` : 'version not detected' });

const databaseUrl = process.env.DATABASE_URL;
rows.push({ check: 'DATABASE_URL', status: ok(present(databaseUrl) && !CI_DATABASE_URLS.has(databaseUrl)), detail: !present(databaseUrl) ? 'missing' : CI_DATABASE_URLS.has(databaseUrl) ? 'CI placeholder; runtime DB disabled' : 'configured' });
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
rows.push({ check: 'AUTH secret', status: ok(present(authSecret) && authSecret !== CI_AUTH_SECRET), detail: !present(authSecret) ? 'missing' : authSecret === CI_AUTH_SECRET ? 'CI placeholder; runtime auth disabled' : 'configured' });
const adminEmail = process.env.ADMIN_EMAIL;
rows.push({ check: 'ADMIN_EMAIL', status: ok(present(adminEmail) && !String(adminEmail).includes('@example.')), detail: present(adminEmail) ? (String(adminEmail).includes('@example.') ? 'placeholder' : 'configured') : 'missing' });
const adminPassword = process.env.ADMIN_PASSWORD;
rows.push({ check: 'ADMIN_PASSWORD', status: ok(present(adminPassword) && !['admin', 'password'].includes(adminPassword)), detail: present(adminPassword) ? (['admin', 'password'].includes(adminPassword) ? 'placeholder' : 'configured') : 'missing' });
const contactEmail = process.env.SHOP_CONTACT_EMAIL;
rows.push({ check: 'SHOP_CONTACT_EMAIL', status: ok(present(contactEmail) && !String(contactEmail).includes('@example.')), detail: present(contactEmail) ? (String(contactEmail).includes('@example.') ? 'placeholder' : 'configured') : 'missing' });
rows.push({ check: 'Starter catalogue', status: process.env.NODE_ENV === 'production' && process.env.ENABLE_STARTER_CATALOG === 'true' ? 'warn' : 'ok', detail: process.env.NODE_ENV === 'production' ? 'disabled in production by code' : process.env.ENABLE_STARTER_CATALOG === 'true' ? 'development demo enabled' : 'disabled' });

console.log('SHOP doctor');
for (const row of rows) console.log(`${row.status === 'ok' ? '✅' : '⚠️'} ${row.check}: ${row.detail}`);
