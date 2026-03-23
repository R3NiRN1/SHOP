import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prismaCommand = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const prismaBin = path.join(__dirname, '..', 'node_modules', '.bin', prismaCommand);
import process from 'node:process';

const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public';
}

const child = spawn(prismaBin, ['generate'], {
  stdio: 'inherit',
  env,
});

child.on('error', (error) => {
  console.error('Failed to run prisma generate:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code) {
    process.exit(code);
  }
});
const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate'],
  {
    stdio: 'inherit',
    env,
    shell: true,
  },
);

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
