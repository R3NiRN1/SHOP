import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertEmptyDatabase, databaseUrl, email, newSecret, password, redact, saveConfig, serializeEnv, siteUrl } from './bootstrap-lib.mjs';

test('rejects placeholder, malformed and wrong-mode configuration', () => {
  for (const value of ['admin@example.com', 'missing-at-sign', 'a@b\n.test']) assert.throws(() => email(value));
  assert.equal(email(' Team@Shop.test '), 'team@shop.test');
  for (const value of ['file:./dev.db', 'postgresql://ci:ci@localhost:5432/ci', 'postgresql://localhost/']) assert.throws(() => databaseUrl(value));
  assert.equal(databaseUrl('postgresql://shop:pass@localhost/shop'), 'postgresql://shop:pass@localhost/shop');
  for (const value of ['http://shop.test', 'https://localhost:3001', 'https://shop.test/admin', 'https://user:pass@shop.test', 'https://shop.test?x=1']) assert.throws(() => siteUrl(value, true));
  assert.equal(siteUrl('https://shop.test/', true), 'https://shop.test');
  assert.equal(siteUrl('http://localhost:3001/', false), 'http://localhost:3001');
  assert.throws(() => siteUrl('http://localhost:3000', false));
  assert.throws(() => siteUrl('http://remote.test:3001', false));
  for (const value of ['short', 'a'.repeat(16) + '\n', 'a'.repeat(16) + '"', 'a'.repeat(16) + '\\']) assert.throws(() => password(value));
  assert.equal(password('correct-$horse#battery'), 'correct-$horse#battery');
});

test('generates distinct strong secrets and rejects nonempty databases', () => {
  const first = newSecret();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, newSecret());
  assert.doesNotThrow(() => assertEmptyDatabase([]));
  assert.throws(() => assertEmptyDatabase([{ relname: 'existing_customer_data' }]), /No migration was run/);
});

test('preserves existing configuration and backs it up before explicit replacement', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-installer-'));
  try {
    const file = join(directory, '.env.local');
    writeFileSync(file, 'original-private-settings');
    assert.throws(() => saveConfig(file, { AUTH_SECRET: 'new' }), /Existing configuration kept/);
    assert.equal(readFileSync(file, 'utf8'), 'original-private-settings');
    assert.throws(() => saveConfig(file, { AUTH_SECRET: 'bad\nvalue' }, true));
    assert.equal(readFileSync(file, 'utf8'), 'original-private-settings');
    const backup = saveConfig(file, { AUTH_SECRET: 'new-private-settings' }, true);
    assert.equal(readFileSync(backup, 'utf8'), 'original-private-settings');
    assert.match(readFileSync(file, 'utf8'), /AUTH_SECRET="new-private-settings"/);
  } finally { rmSync(directory, { recursive: true }); }
});

test('configuration round-trips through the actual Next.js environment loader without dollar expansion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-installer-env-'));
  try {
    const config = { ADMIN_PASSWORD: 'strong-$HOME-${PATH}#password', AUTH_SECRET: newSecret(), DATABASE_URL: 'postgresql://shop:pass%24word@localhost/shop' };
    writeFileSync(join(directory, '.env.local'), serializeEnv(config));
    const appRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
    const nextRequire = createRequire(appRequire.resolve('next/package.json'));
    const loader = nextRequire.resolve('@next/env');
    const env = { ...process.env };
    for (const key of Object.keys(config)) delete env[key];
    const result = spawnSync(process.execPath, ['-e', 'const [loader, dir] = process.argv.slice(1); const {combinedEnv} = require(loader).loadEnvConfig(dir, true); console.log(JSON.stringify({ADMIN_PASSWORD:combinedEnv.ADMIN_PASSWORD,AUTH_SECRET:combinedEnv.AUTH_SECRET,DATABASE_URL:combinedEnv.DATABASE_URL}));', loader, directory], { encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), config);
  } finally { rmSync(directory, { recursive: true }); }
});

test('redacts full URLs, encoded and decoded database passwords and generated credentials', () => {
  const config = { DATABASE_URL: 'postgresql://shop:private%24db@localhost/shop', AUTH_SECRET: 'private-auth-secret', ADMIN_PASSWORD: 'private-admin-password' };
  const output = redact(Object.values(config).join(' ') + ' private%24db private$db', config);
  assert.equal(output, '[redacted] [redacted] [redacted] [redacted] [redacted]');
});

test('help needs no terminal; piped input fails without writing configuration', () => {
  const script = fileURLToPath(new URL('./bootstrap.mjs', import.meta.url));
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /docs\/INSTALL.md/);
  const piped = spawnSync(process.execPath, [script, '--configure-only'], { encoding: 'utf8', input: '1\ny\n' });
  assert.equal(piped.status, 1);
  assert.match(piped.stderr, /interactive terminal/);
});
