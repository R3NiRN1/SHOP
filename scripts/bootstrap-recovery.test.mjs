import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfiguration, newRecovery, prepareDatabase, readRecovery, step, writeRecovery } from './bootstrap-recovery.mjs';
import { saveConfig } from './bootstrap-lib.mjs';

const config = { AUTH_SECRET: 'private-auth-secret-at-least-32-characters', ADMIN_PASSWORD: 'private-$HOME-${PATH}#password', ADMIN_EMAIL: 'admin@shop.test', SHOP_CONTACT_EMAIL: 'orders@shop.test', DATABASE_URL: 'postgresql://shop:password@localhost/shop', NEXTAUTH_URL: 'http://localhost:3001', ENABLE_STARTER_CATALOG: 'false' };

test('failed preparation resumes without replacing settings, secrets or consent', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-recovery-'));
  try {
    const env = join(directory, '.env.local');
    const file = join(directory, 'state.json');
    saveConfig(env, config);
    const before = readFileSync(env, 'utf8');
    const state = newRecovery(env, 'local');
    state.migrateRequested = true;
    await assert.rejects(step(file, state, 'dependencies', () => { throw new Error('simulated interrupted install'); }));
    const resumed = readRecovery(file, env, 'local');
    assert.equal(resumed.activeStep, 'dependencies');
    assert.equal(resumed.migrateRequested, true);
    assert.deepEqual(loadConfiguration(env).config, config);
    await step(file, resumed, 'dependencies', () => {});
    assert.equal(readRecovery(file, env, 'local').activeStep, null);
    assert.equal(readFileSync(env, 'utf8'), before);
    assert.ok(!readFileSync(file, 'utf8').includes(config.ADMIN_PASSWORD));
  } finally { rmSync(directory, { recursive: true }); }
});

test('changing a database target cancels old migration consent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-target-change-'));
  try {
    const env = join(directory, '.env.local');
    const file = join(directory, 'state.json');
    saveConfig(env, config);
    const state = { ...newRecovery(env, 'local'), migrateRequested: true, migrationAuthorized: true };
    writeRecovery(file, state);
    saveConfig(env, { ...config, DATABASE_URL: 'postgresql://shop:password@localhost/different' }, true);
    const changed = readRecovery(file, env, 'local');
    assert.equal(changed.migrateRequested, false);
    assert.equal(changed.migrationAuthorized, false);
  } finally { rmSync(directory, { recursive: true }); }
});

const evidence = { hash: 'schema-hash', objects: ['User'], migrations: { initial: 'checksum' } };
const applied = { objects: [{ schema_name: 'public', object_name: '_prisma_migrations' }, { schema_name: 'public', object_name: 'User' }], history: [{ migration_name: 'initial', checksum: 'checksum', finished_at: 'done', rolled_back_at: null }] };

test('a crash after SQL commits recovers using persisted consent and matching migration history', async () => {
  const state = { migrationAuthorized: false, migrationHash: null };
  let persisted;
  await assert.rejects(prepareDatabase({ state, evidence, inspect: async () => ({ objects: [], history: [] }), persist: () => { persisted = structuredClone(state); }, deploy: () => { throw new Error('simulated lost acknowledgement after commit'); } }));
  assert.equal(persisted.migrationAuthorized, true);
  let deployed = 0;
  await prepareDatabase({ state: persisted, evidence, inspect: async () => applied, persist: () => {}, deploy: () => { deployed++; } });
  assert.equal(deployed, 1);
  assert.equal(persisted.migrationApplied, true);
});

for (const [name, state, snapshot, changedEvidence] of [
  ['unowned nonempty database', { migrationAuthorized: false }, applied, evidence],
  ['failed SQL migration', { migrationAuthorized: true, migrationHash: evidence.hash }, { ...applied, history: [{ ...applied.history[0], finished_at: null }] }, evidence],
  ['unknown history checksum', { migrationAuthorized: true, migrationHash: evidence.hash }, { ...applied, history: [{ ...applied.history[0], checksum: 'other' }] }, evidence],
  ['unrelated objects', { migrationAuthorized: true, migrationHash: evidence.hash }, { ...applied, objects: [...applied.objects, { schema_name: 'public', object_name: 'CustomerData' }] }, evidence],
  ['changed migration files', { migrationAuthorized: true, migrationHash: evidence.hash }, applied, { ...evidence, hash: 'new-schema' }],
]) {
  test(`${name} prevents automatic migration`, async () => {
    let deployed = false;
    await assert.rejects(prepareDatabase({ state, evidence: changedEvidence, inspect: async () => snapshot, persist: () => {}, deploy: () => { deployed = true; } }));
    assert.equal(deployed, false);
  });
}

test('unmanaged config and corrupt checkpoints fail without changing the files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-invalid-recovery-'));
  try {
    const env = join(directory, '.env.local');
    const file = join(directory, 'state.json');
    writeFileSync(env, 'ADMIN_PASSWORD=do-not-replace');
    assert.throws(() => loadConfiguration(env), /not generated/);
    saveConfig(env, config, true);
    writeFileSync(file, '{invalid-json');
    assert.throws(() => readRecovery(file, env, 'local'), /unreadable/);
    assert.equal(readFileSync(file, 'utf8'), '{invalid-json');
    // Explicit reconfiguration can start fresh without trusting corrupt state.
    writeRecovery(file, newRecovery(env, 'local'));
    assert.equal(readRecovery(file, env, 'local').migrateRequested, false);
  } finally { rmSync(directory, { recursive: true }); }
});
