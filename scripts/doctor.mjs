import { readFileSync } from 'node:fs';

const REQUIRED_NODE_VERSION = [24, 20, 0];
const REQUIRED_NODE_MAJOR = 24;
const REQUIRED_PNPM_VERSION = '11.25.0';
const CI_DATABASE_URLS = new Set(['postgresql://ci:ci@localhost:5432/ci?schema=public', 'file:./ci.db']);
const CI_AUTH_SECRET = 'ci-placeholder-not-for-prod';
const CI_ADMIN_EMAILS = new Set(['admin@example.com', 'admin@example.org']);
const CI_ADMIN_PASSWORDS = new Set(['admin', 'password']);
const MIN_AUTH_SECRET_LENGTH = 32;
const MIN_ADMIN_PASSWORD_LENGTH = 16;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
const validEmail = (value) => present(value) && EMAIL_PATTERN.test(value);
const exampleEmail = (value) =>
  typeof value === 'string' && ['@example.com', '@example.org', '@example.invalid'].some((suffix) => value.toLowerCase().endsWith(suffix));
const validPostgresUrl = (value) => {
  if (!present(value) || CI_DATABASE_URLS.has(value)) return false;
  try {
    return ['postgres:', 'postgresql:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const validCanonicalUrl = (value) => {
  if (!present(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
};

const rows = [];
const nodeVersion = parseVersion(process.versions.node);
const nodeSupported = nodeVersion[0] === REQUIRED_NODE_MAJOR && compareVersions(nodeVersion, REQUIRED_NODE_VERSION) >= 0;
rows.push({ check: 'Node.js', status: ok(nodeSupported), detail: `found ${process.versions.node}; require ${REQUIRED_NODE_MAJOR}.x at or above ${REQUIRED_NODE_VERSION.join('.')}` });
const userAgent = process.env.npm_config_user_agent ?? '';
const pnpmVersion = /pnpm\/(\d+\.\d+\.\d+)/.exec(userAgent)?.[1] ?? readPackageManagerVersion();
rows.push({ check: 'pnpm', status: ok(pnpmVersion === REQUIRED_PNPM_VERSION), detail: pnpmVersion ? `found ${pnpmVersion}; require exactly ${REQUIRED_PNPM_VERSION}` : 'version not detected' });

const databaseUrl = process.env.DATABASE_URL;
rows.push({ check: 'DATABASE_URL', status: ok(validPostgresUrl(databaseUrl)), detail: !present(databaseUrl) ? 'missing' : CI_DATABASE_URLS.has(databaseUrl) ? 'CI placeholder; runtime DB disabled' : validPostgresUrl(databaseUrl) ? 'PostgreSQL URL configured' : 'invalid or non-PostgreSQL URL' });
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
const validAuthSecret = present(authSecret) && authSecret.length >= MIN_AUTH_SECRET_LENGTH && authSecret !== CI_AUTH_SECRET;
rows.push({ check: 'AUTH secret', status: ok(validAuthSecret), detail: !present(authSecret) ? 'missing' : authSecret === CI_AUTH_SECRET ? 'CI placeholder; runtime auth disabled' : authSecret.length < MIN_AUTH_SECRET_LENGTH ? `too short; require at least ${MIN_AUTH_SECRET_LENGTH} characters` : 'configured' });
const adminEmail = process.env.ADMIN_EMAIL;
const validAdminEmail = validEmail(adminEmail) && !CI_ADMIN_EMAILS.has(String(adminEmail).trim().toLowerCase());
rows.push({ check: 'ADMIN_EMAIL', status: ok(validAdminEmail), detail: !present(adminEmail) ? 'missing' : !validEmail(adminEmail) ? 'invalid email' : CI_ADMIN_EMAILS.has(String(adminEmail).trim().toLowerCase()) ? 'CI placeholder; runtime auth disabled' : 'configured' });
const adminPassword = process.env.ADMIN_PASSWORD;
const validAdminPassword = present(adminPassword) && adminPassword.length >= MIN_ADMIN_PASSWORD_LENGTH && !CI_ADMIN_PASSWORDS.has(adminPassword);
rows.push({ check: 'ADMIN_PASSWORD', status: ok(validAdminPassword), detail: !present(adminPassword) ? 'missing' : CI_ADMIN_PASSWORDS.has(adminPassword) ? 'CI placeholder; runtime auth disabled' : adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH ? `too short; require at least ${MIN_ADMIN_PASSWORD_LENGTH} characters` : 'configured' });
const contactEmail = process.env.SHOP_CONTACT_EMAIL;
const validContactEmail = validEmail(contactEmail) && !exampleEmail(contactEmail);
rows.push({ check: 'SHOP_CONTACT_EMAIL', status: ok(validContactEmail), detail: !present(contactEmail) ? 'missing' : !validEmail(contactEmail) ? 'invalid email' : exampleEmail(contactEmail) ? 'placeholder; enquiry links disabled' : 'configured' });
const nextAuthUrl = process.env.NEXTAUTH_URL;
rows.push({ check: 'NEXTAUTH_URL', status: ok(validCanonicalUrl(nextAuthUrl)), detail: !present(nextAuthUrl) ? 'missing; set the canonical public HTTPS origin' : validCanonicalUrl(nextAuthUrl) ? 'canonical HTTPS origin configured' : 'require an origin-only HTTPS URL without credentials, path, query, or fragment' });
rows.push({ check: 'Proxy-header trust', status: process.env.TRUST_PROXY_HEADERS === 'true' ? 'warn' : 'ok', detail: process.env.TRUST_PROXY_HEADERS === 'true' ? 'enabled; verify the deployment proxy overwrites forwarding headers' : 'disabled' });
rows.push({ check: 'Readiness details', status: process.env.NODE_ENV === 'production' && process.env.READINESS_DETAILS === 'true' ? 'warn' : 'ok', detail: process.env.READINESS_DETAILS === 'true' ? 'dependency detail exposed' : 'minimal public detail' });
rows.push({ check: 'Starter catalogue', status: process.env.NODE_ENV === 'production' && process.env.ENABLE_STARTER_CATALOG === 'true' ? 'warn' : 'ok', detail: process.env.NODE_ENV === 'production' ? 'disabled in production by code' : process.env.ENABLE_STARTER_CATALOG === 'true' ? 'development demo enabled' : 'disabled' });

console.log('SHOP doctor');
for (const row of rows) console.log(`${row.status === 'ok' ? '✅' : '⚠️'} ${row.check}: ${row.detail}`);
