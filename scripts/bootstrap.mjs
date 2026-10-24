import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { delimiter, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { assertEmptyDatabase, databaseUrl, email, newSecret, password, redact, saveConfig, siteUrl } from './bootstrap-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = resolve(root, 'apps/web/.env.local');
const options = new Set(process.argv.slice(2));
const config = {};
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

async function verifyDatabase() {
  const appRequire = createRequire(resolve(root, 'apps/web/package.json'));
  const { Client } = appRequire('pg');
  const client = new Client({ connectionString: config.DATABASE_URL, connectionTimeoutMillis: 8000, query_timeout: 8000 });
  try {
    await client.connect();
    const tables = await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')");
    assertEmptyDatabase(tables.rows);
  } catch (error) {
    if (error.message.startsWith('This database')) throw error;
    throw new Error('Could not verify the database. No migration was run. Check the server, connection URL, permissions and required SSL settings with your database administrator.');
  } finally { await client.end().catch(() => {}); }
}

async function main() {
  if (options.has('--help')) {
    console.log('SHOP guided setup\n\nnode scripts/bootstrap.mjs                 Guided installation\nnode scripts/bootstrap.mjs --configure-only  Write configuration without installing or migrating\nnode scripts/bootstrap.mjs --check           Read-only prerequisite check\n\nTeam walkthrough: docs/INSTALL.md');
    return;
  }
  if ([...options].some((option) => !['--configure-only', '--check'].includes(option))) throw new Error('Unknown option. Run node scripts/bootstrap.mjs --help.');
  checkNode();
  console.log('\nSHOP setup — catalogue and administrator installation\n');
  if (options.has('--check')) {
    console.log(`Node ${process.versions.node}: OK`);
    const version = pnpm(['--version'], { capture: true });
    if (version !== '11.25.0') throw new Error('Expected pnpm 11.25.0; check Corepack and package.json.');
    console.log(`pnpm ${version}: OK\nConfiguration: ${existsSync(envFile) ? 'already exists; will be protected' : 'not created yet'}\nNo project configuration changed. Database connectivity was not checked.`);
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Open an interactive terminal to run the questionnaire. Use --help for instructions.');
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
  rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  rl.on('SIGINT', () => { controller.abort(); rl.close(); });
  rl.on('close', () => controller.abort());
  let replace = false;
  if (existsSync(envFile)) {
    console.log('An existing apps/web/.env.local was found. Its contents will never be displayed.');
    replace = await yes('Back it up and create a new configuration?');
    if (!replace) { console.log('Existing configuration kept. Nothing changed. See docs/INSTALL.md for startup and troubleshooting.'); return; }
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
  if (!install) { console.log('Configuration only: dependencies, database and production build have NOT been prepared. Follow docs/INSTALL.md to complete setup.'); return; }
  execute(process.execPath, [resolve(root, 'scripts/run-preflight.js')]);
  pnpm(['install', '--frozen-lockfile']);
  const generateEnv = { ...process.env, ...config };
  if (!generateEnv.DATABASE_URL) delete generateEnv.DATABASE_URL;
  pnpm(['-C', 'apps/web', 'exec', 'prisma', 'generate'], { capture: true, env: generateEnv });
  if (migrate) {
    console.log('Checking that the database is reachable and empty...');
    await verifyDatabase();
    pnpm(['-C', 'apps/web', 'exec', 'prisma', 'migrate', 'deploy'], { capture: true, env: { ...process.env, ...config } });
    console.log('Database verified and migrations applied.');
  }
  if (!demo && !migrate) {
    console.log('Dependencies installed. Database setup is incomplete: no migration or connectivity check was performed. Follow the existing-database procedure in docs/RELEASE.md before using admin features.');
  } else {
    console.log(`\n${demo ? 'Preview ready. Administrator login is disabled in preview mode.' : 'Application dependencies and database are prepared.'}`);
  }
  if (production) {
    console.log('Production configuration prepared. Deployment is still required: transfer settings through your hosting secret store, run corepack pnpm build, configure HTTPS and verify /api/ready. See docs/INSTALL.md.');
  } else {
    console.log('Next: run corepack pnpm dev, then open http://localhost:3001. Stop it with Ctrl+C.');
  }
  if (!demo) console.log('Login: /admin. If a password was generated, retrieve ADMIN_PASSWORD privately from apps/web/.env.local. Do not send that file to the team.');
}

try { await main(); }
catch (error) {
  console.error(`\nSetup stopped: ${redact(error.name === 'AbortError' ? 'cancelled; saved configuration, if any, was kept.' : error.message, config)}\nHelp: docs/INSTALL.md`);
  process.exitCode = error.name === 'AbortError' ? 130 : 1;
} finally { muted = false; rl?.close(); }
