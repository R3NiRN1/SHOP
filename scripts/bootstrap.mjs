import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { databaseUrl, email, newSecret, password, redact, saveConfig, siteUrl } from './bootstrap-lib.mjs';
import { loadConfiguration, migrationEvidence, newRecovery, prepareDatabase, readRecovery, stateName, step, writeRecovery } from './bootstrap-recovery.mjs';
import { startAndVerify } from './bootstrap-startup.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = resolve(root, 'apps/web/.env.local');
const options = new Set(process.argv.slice(2));
const config = {};
const stateFile = resolve(root, stateName);
let rl;
let muted = false;
const controller = new AbortController();

function execute(command, args, { capture = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd: root, env,
    encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.signal === 'SIGINT' || result.status === 0xC000013A) {
    throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
  }
  if (result.error || result.status !== 0) {
    // Database commands are captured so credentials cannot leak in failure output.
    if (capture && result.stderr) console.error(redact(result.stderr, config));
    throw new Error(`${command} ${args.join(' ')} failed. Fix the reported issue, then retry. Configuration already saved is kept.`);
  }
  return result.stdout?.trim() ?? '';
}

function pnpm(args, settings = {}) {
  // Corepack honors packageManager in package.json, without changing global shims.
  // Run its JS entry with Node so Windows .cmd shims need no shell quoting.
  const nodeDirectory = dirname(realpathSync(process.execPath));
  const candidates = [
    resolve(nodeDirectory, 'node_modules/corepack/dist/corepack.js'),
    resolve(nodeDirectory, '../lib/node_modules/corepack/dist/corepack.js'),
  ];
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    candidates.push(resolve(directory, 'node_modules/corepack/dist/corepack.js'));
    const shim = resolve(directory, 'corepack');
    if (existsSync(shim)) candidates.push(realpathSync(shim));
  }
  const entry = candidates.find(existsSync);
  if (!entry) throw new Error('Corepack is missing. Ask IT to install Corepack with the pinned Node 24 toolchain, then retry.');
  return execute(process.execPath, [entry, 'pnpm', ...args], {
    ...settings,
    env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', ...settings.env },
  });
}

function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 20) throw new Error('Install Node.js 24.20.0 (see .nvmrc), reopen the terminal, then run this command again.');
}

async function ask(label, { secret = false, fallback = '', validate = (value) => value.trim() } = {}) {
  for (;;) {
    try {
      if (secret) { process.stdout.write(label); muted = true; }
      const answer = await rl.question(secret ? '' : label, { signal: controller.signal });
      muted = false;
      if (secret) process.stdout.write('\n');
      return validate(answer || fallback);
    } catch (error) {
      muted = false;
      if (error.name === 'AbortError') throw error;
      console.log(error.message);
    }
  }
}

const yes = (label) => ask(`${label} [y/N]: `, {
  validate(value) {
    if (!/^(y|yes|n|no)?$/i.test(value.trim())) throw new Error('Type y for yes or n for no.');
    return /^(y|yes)$/i.test(value.trim());
  },
});

async function inspectDatabase() {
  if ((new URL(config.DATABASE_URL).searchParams.get('schema') ?? 'public') !== 'public') {
    throw new Error('Guided migrations require the public schema. Ask the database owner to follow docs/RELEASE.md for a custom schema.');
  }
  const appRequire = createRequire(resolve(root, 'apps/web/package.json'));
  const { Client } = appRequire('pg');
  const client = new Client({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 8000, query_timeout: 8000 });
  try {
    await client.connect();
    const objects = await client.query("SELECT n.nspname AS schema_name, c.relname AS object_name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S') UNION ALL SELECT n.nspname, t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND t.typtype = 'e'");
    const history = objects.rows.some((object) => object.schema_name === 'public' && object.object_name === '_prisma_migrations')
      ? (await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations"')).rows : [];
    return { objects: objects.rows, history };
  } catch (error) {
    throw new Error('Could not verify the database. No migration was run. Check the server, connection URL, permissions and required SSL settings with your database administrator.');
  } finally { await client.end().catch(() => {}); }
}

function initializeState(mode) {
  return readRecovery(stateFile, envFile, mode);
}

async function startup(mode, state, keepRunning = false) {
  if (mode === 'production') throw new Error('Production settings require deployment verification; no local development server was started. See docs/INSTALL.md.');
  const appRequire = createRequire(resolve(root, 'apps/web/package.json'));
  let entry;
  try { entry = appRequire.resolve('next/dist/bin/next'); }
  catch { throw new Error('Application dependencies are missing. Run node scripts/bootstrap.mjs --resume first.'); }
  const host = new URL(config.NEXTAUTH_URL).hostname === '[::1]' ? '::1' : '127.0.0.1';
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  state.activeStep = 'startup';
  state.status = 'incomplete';
  writeRecovery(stateFile, state);
  console.log('Starting SHOP on loopback and checking catalogue, readiness and administrator access...');
  try {
    await startAndVerify({ config, mode, command: process.execPath, args: [entry, 'dev', '--hostname', host, '--port', '3001'], cwd: resolve(root, 'apps/web'), keepRunning, signal: shutdown.signal,
      onVerified(result) {
        state.activeStep = null;
        state.status = 'verified';
        state.verifiedAt = new Date().toISOString();
        state.completed = [...new Set([...state.completed, 'startup'])];
        writeRecovery(stateFile, state);
        console.log(result.preview ? 'PASS: preview pages and liveness work; database/admin readiness is disabled as expected.' : 'PASS: catalogue, database readiness, administrator login and authenticated catalogue access work.');
        if (keepRunning) console.log(`Open ${config.NEXTAUTH_URL}. Keep this window open. Press Ctrl+C to stop SHOP.`);
      },
    });
  } catch (error) {
    if (error.name !== 'AbortError') {
      state.activeStep = 'startup';
      state.status = 'incomplete';
      writeRecovery(stateFile, state);
    }
    throw error;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

async function installSetup(mode, state) {
  if (pnpm(['--version'], { capture: true }) !== '11.25.0') throw new Error('Expected pnpm 11.25.0; check the pinned Corepack toolchain.');
  await step(stateFile, state, 'preflight', () => execute(process.execPath, [resolve(root, 'scripts/run-preflight.js')]));
  // Repeating these operations repairs partial installs without replacing configuration.
  await step(stateFile, state, 'dependencies', () => pnpm(['install', '--frozen-lockfile', '--config.optimistic-repeat-install=false']));
  const env = { ...process.env, ...config };
  if (!env.DATABASE_URL) delete env.DATABASE_URL;
  await step(stateFile, state, 'client', () => pnpm(['-C', 'apps/web', 'exec', 'prisma', 'generate'], { capture: true, env }));
  if (state.migrateRequested && mode !== 'preview') {
    await step(stateFile, state, 'database', () => prepareDatabase({
      state, evidence: migrationEvidence(root), inspect: inspectDatabase,
      persist: () => writeRecovery(stateFile, state),
      deploy: () => pnpm(['-C', 'apps/web', 'exec', 'prisma', 'migrate', 'deploy'], { capture: true, env }),
    }));
    console.log('Database migration verified.');
  }
  if (mode === 'production') {
    state.status = 'configured';
    state.activeStep = null;
    writeRecovery(stateFile, state);
    console.log('Production configuration prepared. No local development server was started. Deployment, HTTPS and deployed health/login checks are still required; see docs/INSTALL.md.');
    return;
  }
  await startup(mode, state);
  console.log('Startup checks passed; the temporary verification server has stopped.');
  console.log('To use SHOP: double-click Start-SHOP.cmd on Windows, or run node scripts/bootstrap.mjs --start.');
  if (mode !== 'preview') console.log('Generated passwords remain private in apps/web/.env.local.');
}

async function resume(onlyStartup = false, keepRunning = false) {
  const loaded = loadConfiguration(envFile);
  Object.assign(config, loaded.config);
  const state = initializeState(loaded.mode);
  if (options.has('--migrate-empty')) state.migrateRequested = true;
  if (onlyStartup) return startup(loaded.mode, state, keepRunning);
  console.log(`Resuming from ${state.activeStep ?? 'saved configuration'}. Existing passwords and configuration will not be rewritten.`);
  writeRecovery(stateFile, state);
  await installSetup(loaded.mode, state);
}

async function main() {
  if (options.has('--help')) {
    console.log('SHOP guided setup\n\nnode scripts/bootstrap.mjs                  Guided installation or resume\nnode scripts/bootstrap.mjs --resume         Repair/finish without replacing settings\nnode scripts/bootstrap.mjs --verify-startup  Check startup, then stop the test server\nnode scripts/bootstrap.mjs --start          Verify and keep the local app running\nnode scripts/bootstrap.mjs --reconfigure    Back up settings and repeat questionnaire\nnode scripts/bootstrap.mjs --configure-only Write settings without installing\nnode scripts/bootstrap.mjs --check          Read-only prerequisite check\n\nFor a new empty database: --resume --migrate-empty (never resets a database).\nTeam walkthrough: docs/INSTALL.md');
    return;
  }
  if ([...options].some((option) => !['--configure-only', '--check', '--resume', '--start', '--verify-startup', '--reconfigure', '--migrate-empty'].includes(option))) throw new Error('Unknown option. Run node scripts/bootstrap.mjs --help.');
  if (['--check', '--resume', '--start', '--verify-startup'].filter((option) => options.has(option)).length > 1 ||
      (['--resume', '--start', '--verify-startup', '--check'].some((option) => options.has(option)) && (options.has('--configure-only') || options.has('--reconfigure'))) ||
      (options.has('--migrate-empty') && !options.has('--resume'))) throw new Error('Use one action at a time. --migrate-empty is only valid with --resume.');
  checkNode();
  console.log('\nSHOP setup — catalogue and administrator installation\n');
  if (options.has('--check')) {
    console.log(`Node ${process.versions.node}: OK`);
    const version = pnpm(['--version'], { capture: true });
    if (version !== '11.25.0') throw new Error('Expected pnpm 11.25.0; check Corepack and package.json.');
    console.log(`pnpm ${version}: OK\nConfiguration: ${existsSync(envFile) ? 'already exists; will be protected' : 'not created yet'}\nNo project configuration changed. Database connectivity was not checked.`);
    return;
  }
  if (options.has('--resume')) return resume();
  if (options.has('--start') || options.has('--verify-startup')) return resume(true, options.has('--start'));
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Open an interactive terminal to run the questionnaire. Use --help for instructions.');
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
  rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  rl.on('SIGINT', () => { controller.abort(); rl.close(); });
  rl.on('close', () => controller.abort());
  let replace = false;
  if (existsSync(envFile)) {
    console.log('An existing apps/web/.env.local was found. Its contents will never be displayed.');
    if (!options.has('--reconfigure') && !options.has('--configure-only')) {
      console.log('1. Resume/repair using existing settings (recommended).\n2. Back up settings and reconfigure.\n3. Exit without changes.');
      const action = await ask('Choose 1, 2 or 3 [1]: ', { fallback: '1', validate(value) { if (!['1', '2', '3'].includes(value.trim())) throw new Error('Choose 1, 2 or 3.'); return value.trim(); } });
      if (action === '3') return;
      if (action === '1') { rl.close(); rl = null; return resume(); }
    }
    replace = await yes('Back it up and create a new configuration?');
    if (!replace) { console.log('Existing configuration kept. Nothing changed.'); return; }
  }
  console.log('1. Quick preview — sample catalogue, no database or administrator login.\n2. Full local app — your PostgreSQL database and administrator login.\n3. Production preparation — public HTTPS address and production database.\n');
  const mode = await ask('Choose 1, 2 or 3 [1]: ', { fallback: '1', validate(value) { if (!['1', '2', '3'].includes(value.trim())) throw new Error('Choose 1, 2 or 3.'); return value.trim(); } });
  const demo = mode === '1';
  const production = mode === '3';
  Object.assign(config, {
    DATABASE_URL: '', AUTH_SECRET: newSecret(), ADMIN_EMAIL: '', ADMIN_PASSWORD: '', SHOP_CONTACT_EMAIL: '',
    NEXTAUTH_URL: 'http://localhost:3001', TRUST_PROXY_HEADERS: 'false', READINESS_DETAILS: 'false', ENABLE_STARTER_CATALOG: demo ? 'true' : 'false',
  });
  let migrate = false;
  if (!demo) {
    console.log('\nUse a NEW, EMPTY PostgreSQL database dedicated to SHOP. Database creation instructions are in docs/INSTALL.md.\n');
    config.DATABASE_URL = await ask('Paste your PostgreSQL connection URL (hidden): ', { secret: true, validate: databaseUrl });
    config.ADMIN_EMAIL = await ask('Administrator email: ', { validate: email });
    for (;;) {
      const answer = await ask('Administrator password (hidden; Enter generates one): ', { secret: true, validate: (value) => value ? password(value) : '' });
      if (!answer) { config.ADMIN_PASSWORD = newSecret(); break; }
      const confirmation = await ask('Confirm administrator password (hidden): ', { secret: true, validate: (value) => value });
      if (answer === confirmation) { config.ADMIN_PASSWORD = answer; break; }
      console.log('Passwords did not match. Please try again.');
    }
    config.SHOP_CONTACT_EMAIL = await ask('Public email for customer enquiries: ', { validate: email });
    config.NEXTAUTH_URL = await ask(production ? 'Public site address (https://...): ' : 'Local site address [http://localhost:3001]: ', {
      fallback: production ? '' : 'http://localhost:3001', validate: (value) => siteUrl(value, production),
    });
    if (!options.has('--configure-only')) migrate = await yes('Apply SHOP migrations, only after the database is verified empty?');
  }
  const install = !options.has('--configure-only');
  console.log(`\nReview\nMode: ${demo ? 'Preview' : production ? 'Production preparation' : 'Full local app'}\nConfiguration: apps/web/.env.local${replace ? ' (existing file backed up)' : ''}\nDependencies: ${install ? 'frozen install + Prisma generation' : 'not installed'}\nDatabase: ${migrate ? 'verify empty, then apply migration' : 'no migrations'}\nSecrets: generated/entered securely; never printed.\n`);
  if (!await yes('Continue with this setup?')) { console.log('Cancelled. No configuration or database changes made.'); return; }
  // Restore normal terminal handling before child processes, including Ctrl+C.
  rl.close();
  rl = null;
  // Verify the toolchain before writing anything when installation is requested.
  if (install && pnpm(['--version'], { capture: true }) !== '11.25.0') throw new Error('Expected pnpm 11.25.0. No configuration was written.');
  const backup = saveConfig(envFile, config, replace);
  console.log(`Configuration saved.${backup ? ` Backup: ${backup}` : ''}`);
  const modeName = demo ? 'preview' : production ? 'production' : 'local';
  const state = newRecovery(envFile, modeName);
  state.migrateRequested = migrate;
  writeRecovery(stateFile, state);
  if (!install) { console.log('Configuration only: dependencies, database and production build have NOT been prepared. Follow docs/INSTALL.md to complete setup.'); return; }
  await installSetup(modeName, state);
}

try { await main(); }
catch (error) {
  console.error(`\nSetup stopped: ${redact(error.name === 'AbortError' ? 'cancelled; saved configuration, if any, was kept.' : error.message, config)}\nRecover without changing settings: node scripts/bootstrap.mjs --resume\nHelp: docs/INSTALL.md`);
  process.exitCode = error.name === 'AbortError' ? 130 : 1;
} finally { muted = false; rl?.close(); }
