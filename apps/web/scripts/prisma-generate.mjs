import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REQUIRED_NODE_VERSION = [20, 19, 0];
const REQUIRED_NODE_VERSION_TEXT = REQUIRED_NODE_VERSION.join('.');

const parseNodeVersion = (version) =>
  String(version)
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));

const isNodeVersionLessThanRequired = (current, required) => {
  for (let index = 0; index < required.length; index += 1) {
    const currentPart = current[index] ?? 0;
    const requiredPart = required[index] ?? 0;

    if (currentPart < requiredPart) return true;
    if (currentPart > requiredPart) return false;
  }

  return false;
};

const ensureSupportedNodeVersion = () => {
  const currentVersion = parseNodeVersion(process.versions.node);
  if (!isNodeVersionLessThanRequired(currentVersion, REQUIRED_NODE_VERSION)) {
    return;
  }

  console.error(
    [
      `Unsupported Node.js version: ${process.versions.node}`,
      `Required Node.js version: ${REQUIRED_NODE_VERSION_TEXT}`,
      'CI uses Node 20 latest; upgrade Node (nvm use 20.19+)',
    ].join('\n'),
  );
  process.exit(1);
};

ensureSupportedNodeVersion();

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public';
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(pnpmCommand, ['exec', 'prisma', 'generate', '--schema', 'prisma/schema.prisma'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

if (result.status !== 0) {
  console.error('Prisma generate failed.');
  process.exit(result.status ?? 1);
}
