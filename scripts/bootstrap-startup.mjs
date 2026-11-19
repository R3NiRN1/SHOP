import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { redact } from './bootstrap-lib.mjs';

export async function availablePort(host, port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is already in use or unavailable. Stop the other app yourself, then retry. Setup will not stop an existing server.`)));
    server.listen({ host, port, exclusive: true }, () => server.close(resolve));
  });
}

async function stopChild(child) {
  if (!child.pid) return;
  const waitForExit = () => Promise.race([
    new Promise((resolve) => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once('exit', resolve); }),
    delay(3000, undefined, { ref: false }),
  ]);
  if (process.platform === 'win32') {
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 15000 });
    }
  } else if (child.pid) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already stopped. */ }
    await delay(100);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* No remaining workers. */ }
  }
  await waitForExit();
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await waitForExit();
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
    throw new Error(`Could not stop the startup test process ${child.pid}. Stop that process before retrying; setup has not been marked complete.`);
  }
}

function cookiesFrom(response, jar) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

export async function verifyApplication(origin, config, mode, request) {
  const health = await request('/api/health');
  const live = await health.json();
  if (health.status !== 200 || live.ok !== true || live.kind !== 'liveness') throw new Error('The server did not return the expected SHOP liveness response.');
  for (const path of ['/', '/varieties']) {
    const response = await request(path);
    const body = await response.text();
    if (response.status !== 200 || !body.includes(path === '/' ? 'Seeds with stories.' : 'Seed varieties')) {
      throw new Error(`SHOP could not render ${path}. Startup verification failed.`);
    }
    if (mode === 'preview' && !/demo/i.test(body)) throw new Error('Preview did not show the labelled sample catalogue.');
  }
  const response = await request('/api/ready');
  const readiness = await response.json();
  if (mode === 'preview') {
    if (response.status !== 503 || readiness.ready !== false || readiness.kind !== 'readiness') throw new Error('Preview readiness was unexpected; database/admin features must remain disabled.');
    return { preview: true, login: 'disabled as expected' };
  }
  if (response.status !== 200 || readiness.ready !== true) throw new Error('Database/admin readiness failed. Check database access, completed migrations and configuration, then run --resume.');
  const jar = new Map();
  const csrfResponse = await request('/api/auth/csrf');
  cookiesFrom(csrfResponse, jar);
  const csrf = await csrfResponse.json();
  if (csrfResponse.status !== 200 || typeof csrf.csrfToken !== 'string') throw new Error('Administrator sign-in could not obtain a CSRF token.');
  const cookie = () => [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
  const login = await request('/api/auth/callback/credentials', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie(), origin, 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD, callbackUrl: origin, json: 'true' }),
  });
  cookiesFrom(login, jar);
  await login.arrayBuffer();
  const sessionResponse = await request('/api/auth/session', { headers: { cookie: cookie() } });
  const session = await sessionResponse.json();
  if (sessionResponse.status !== 200 || session.role !== 'ADMIN' || session.user?.email !== config.ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Administrator login failed. Settings were kept; verify the configured credentials and database, then run --resume.');
  }
  const admin = await request('/api/admin/varieties', { headers: { cookie: cookie() } });
  if (admin.status !== 200 || !Array.isArray((await admin.json()).varieties)) throw new Error('Authenticated catalogue access failed; check the database schema before retrying.');
  return { preview: false, login: 'verified' };
}

export async function startAndVerify({ config, mode, command, args, cwd, keepRunning = false, timeout = 180000, port = 3001, signal, onVerified = () => {} }) {
  if (mode === 'production') throw new Error('Production settings require deployment verification. The local launcher will not run a development server against production configuration.');
  const url = new URL(config.NEXTAUTH_URL);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || Number(url.port) !== port) {
    throw new Error('Local startup checks require an HTTP loopback address on the configured port. Use --reconfigure to correct NEXTAUTH_URL.');
  }
  const host = url.hostname === '[::1]' ? '::1' : '127.0.0.1';
  await availablePort(host, port);
  const child = spawn(command, args, { cwd, env: { ...process.env, ...config, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true });
  let logs = '';
  let failure;
  const capture = (data) => { logs = (logs + data.toString()).slice(-65536); };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.on('error', (error) => { failure = error; });
  const deadline = Date.now() + timeout;
  const assertRunning = () => {
    signal?.throwIfAborted();
    if (failure || child.exitCode !== null || child.signalCode !== null) throw new Error('SHOP exited before startup checks completed.');
    if (Date.now() >= deadline) throw new Error('Startup verification timed out. Check the toolchain and server output, then retry --verify-startup.');
  };
  try {
    // Next only emits this after binding the requested port; never verify another app.
    while (!logs.includes('Ready in')) { assertRunning(); await delay(100); }
    const origin = url.origin;
    const request = async (path, settings = {}) => {
      assertRunning();
      const response = await fetch(origin + path, { ...settings, signal: AbortSignal.any([AbortSignal.timeout(Math.max(1, Math.min(30000, deadline - Date.now()))), ...(signal ? [signal] : [])]) });
      assertRunning();
      return response;
    };
    const result = await verifyApplication(origin, config, mode, request);
    assertRunning();
    await onVerified(result);
    if (keepRunning && !signal?.aborted) {
      assertRunning();
      await Promise.race([
        new Promise((resolve, reject) => child.once('exit', () => signal?.aborted ? resolve() : reject(new Error('SHOP stopped unexpectedly. Run --start to retry.')))),
        new Promise((resolve) => { if (signal?.aborted) resolve(); else signal?.addEventListener('abort', resolve, { once: true }); }),
      ]);
    }
    return result;
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    throw new Error(redact(`${error.message}\n${logs.slice(-12000)}`, config));
  } finally { await stopChild(child); }
}
