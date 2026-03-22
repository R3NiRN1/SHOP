import { readFileSync } from 'node:fs';

const REQUIRED_NODE_VERSION = [20, 19, 0];
const REQUIRED_PNPM_VERSION = [10, 0, 0];
const CI_PLACEHOLDER_DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public';
const CI_PLACEHOLDER_AUTH_SECRET = 'ci-placeholder-not-for-prod';

const parseVersion = (value) =>
  String(value ?? '')
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));

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
  } catch {
    return null;
  }
};

const getStatus = (ok) => (ok ? 'ok' : 'warn');

const rows = [];
rows.push({
  check: 'Node.js',
  status: getStatus(compareVersions(parseVersion(process.versions.node), REQUIRED_NODE_VERSION) >= 0),
  detail: `found ${process.versions.node}; require ${REQUIRED_NODE_VERSION.join('.')}`,
});

const userAgent = process.env.npm_config_user_agent ?? '';
const pnpmVersion = /pnpm\/(\d+\.\d+\.\d+)/.exec(userAgent)?.[1] ?? readPackageManagerVersion();
rows.push({
  check: 'pnpm',
  status: getStatus(Boolean(pnpmVersion) && compareVersions(parseVersion(pnpmVersion), REQUIRED_PNPM_VERSION) >= 0),
  detail: pnpmVersion ? `found ${pnpmVersion}; require ${REQUIRED_PNPM_VERSION.join('.')}` : 'version not detected; run via pnpm when possible',
});

const databaseUrl = process.env.DATABASE_URL;
rows.push({
  check: 'DATABASE_URL',
  status: getStatus(Boolean(databaseUrl)),
  detail: databaseUrl
    ? databaseUrl === CI_PLACEHOLDER_DATABASE_URL
      ? 'set to CI placeholder (build-only safe, runtime DB unavailable)'
      : 'set'
    : 'missing; Prisma generate will use a CI-safe placeholder, runtime DB access still needs a real value',
});

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
rows.push({
  check: 'AUTH secret',
  status: getStatus(Boolean(authSecret && authSecret !== CI_PLACEHOLDER_AUTH_SECRET)),
  detail: authSecret
    ? authSecret === CI_PLACEHOLDER_AUTH_SECRET
      ? 'set to CI placeholder (build-only safe, runtime auth disabled)'
      : 'set'
    : 'missing; runtime auth is disabled until AUTH_SECRET or NEXTAUTH_SECRET is provided',
});

console.log('SHOP doctor');
for (const row of rows) {
  const prefix = row.status === 'ok' ? '✅' : '⚠️';
  console.log(`${prefix} ${row.check}: ${row.detail}`);
}
