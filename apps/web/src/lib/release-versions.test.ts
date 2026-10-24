import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('records installed application versions even when invoked outside the workspace', () => {
  const script = fileURLToPath(new URL('../../../../scripts/release-versions.cjs', import.meta.url));
  const appRequire = createRequire(new URL('../../package.json', import.meta.url));
  const output = execFileSync(process.execPath, [script], { cwd: tmpdir(), encoding: 'utf8' });
  const versions = Object.fromEntries(output.trim().split('\n').map((line) => line.split('=')));
  expect(versions).toEqual(Object.fromEntries(
    Object.entries({ next: 'next', next_auth: 'next-auth', react: 'react', prisma: 'prisma' })
      .map(([key, name]) => [key, name === 'next-auth'
        ? JSON.parse(readFileSync(new URL('../../node_modules/next-auth/package.json', import.meta.url), 'utf8')).version
        : appRequire(`${name}/package.json`).version]),
  ));
}, 15_000);
