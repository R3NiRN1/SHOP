import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { availablePort, startAndVerify } from './bootstrap-startup.mjs';

const fixture = fileURLToPath(new URL('./fixtures/bootstrap-server.mjs', import.meta.url));
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
function settings(port, preview = true, scenario = 'normal') {
  return {
    command: process.execPath, args: [fixture, String(port), scenario], port, timeout: 30000,
    config: { NEXTAUTH_URL: `http://127.0.0.1:${port}`, ENABLE_STARTER_CATALOG: String(preview), ADMIN_EMAIL: 'admin@shop.test', ADMIN_PASSWORD: 'private-fixture-password', AUTH_SECRET: 'private-fixture-auth-secret', DATABASE_URL: 'postgresql://shop:private-db@localhost/shop' },
    mode: preview ? 'preview' : 'local',
  };
}

test('preview verifies rendered pages and expected 503, then releases its server', async () => {
  const port = await freePort();
  const result = await startAndVerify(settings(port));
  assert.equal(result.preview, true);
  await availablePort('127.0.0.1', port);
});

test('full startup verifies CSRF login, cookies, session and protected catalogue', async () => {
  const port = await freePort();
  const result = await startAndVerify(settings(port, false));
  assert.equal(result.login, 'verified');
  await availablePort('127.0.0.1', port);
});

test('occupied port is refused without stopping or adopting an existing server', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(startAndVerify(settings(server.address().port)), /Port .*already in use/);
    assert.equal(server.listening, true);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

for (const [scenario, message] of [['bad-page', /could not render/], ['not-ready', /readiness failed/], ['bad-login', /login failed/]]) {
  test(`${scenario} cannot produce a successful startup result and its server is stopped`, async () => {
    const port = await freePort();
    await assert.rejects(startAndVerify(settings(port, false, scenario)), message);
    await availablePort('127.0.0.1', port);
  });
}

test('early exit and timeout fail cleanly and release child processes', async () => {
  const first = await freePort();
  await assert.rejects(startAndVerify(settings(first, false, 'exit')), (error) => {
    assert.match(error.message, /exited before/);
    assert.ok(!error.message.includes('private-fixture-password'));
    return true;
  });
  const second = await freePort();
  await assert.rejects(startAndVerify({ ...settings(second, true, 'timeout'), timeout: 1500 }), /timed out/);
  await availablePort('127.0.0.1', second);
});

test('stopping a verified persistent launch releases the server without an error', async () => {
  const port = await freePort();
  const stop = new AbortController();
  const result = await startAndVerify({ ...settings(port), keepRunning: true, signal: stop.signal, onVerified: () => stop.abort() });
  assert.equal(result.preview, true);
  await availablePort('127.0.0.1', port);
});

test('production configuration is never started as a local development server', async () => {
  await assert.rejects(startAndVerify({ ...settings(3001), mode: 'production' }), /Production settings require deployment/);
});
