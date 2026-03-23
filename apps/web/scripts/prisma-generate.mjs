import { spawn } from 'node:child_process';
import process from 'node:process';

const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public';
}

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
