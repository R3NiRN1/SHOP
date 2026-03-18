import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public';
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'generate'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

if (result.status !== 0) {
  console.error('Prisma generate failed.');
  process.exit(result.status ?? 1);
}
