const { existsSync, readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_NODE_VERSION = [24, 20, 0];
const REQUIRED_NODE_MAJOR = 24;
const JSON_FILES_TO_VALIDATE = ['package.json', join('apps', 'web', 'package.json')];
const WORKSPACE_METADATA_FILES = ['pnpm-workspace.yaml', ...JSON_FILES_TO_VALIDATE];
const DISALLOWED_LOCKFILES = new Set(['package-lock.json', 'yarn.lock']);

const parseNodeVersion = (version) =>
  String(version)
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));

const isNodeVersionLessThanRequired = (current, required) => {
  for (let index = 0; index < required.length; index += 1) {
    const currentPart = current[index] ?? 0;
    const requiredPart = required[index] ?? 0;

    if (currentPart < requiredPart) return true;
    if (currentPart > requiredPart) return false;
  }

  return false;
};

const ensureSupportedNodeVersion = () => {
  const currentVersion = parseNodeVersion(process.versions.node);
  const supported =
    currentVersion[0] === REQUIRED_NODE_MAJOR &&
    !isNodeVersionLessThanRequired(currentVersion, REQUIRED_NODE_VERSION);

  if (supported) return;

  console.error(
    [
      `Unsupported Node.js version: ${process.versions.node}`,
      `Required Node.js line: ${REQUIRED_NODE_MAJOR}.x, minimum ${REQUIRED_NODE_VERSION.join('.')}`,
      'CI uses Node 24.20.0 LTS; use the version in .nvmrc for production parity.',
    ].join('\n'),
  );
  process.exit(1);
};

const hasCommand = (command) => {
  const result = spawnSync(command, ['-Command', '"$PSVersionTable.PSVersion"'], { shell: true, stdio: 'ignore' });
  return result.status === 0;
};

const runPsScript = () => {
  const commands = ['pwsh', 'powershell'];
  for (const cmd of commands) {
    if (hasCommand(cmd)) {
      const result = spawnSync(cmd, ['-ExecutionPolicy', 'Bypass', '-File', '.\\scripts\\check-bom.ps1'], {
        stdio: 'inherit',
        shell: true,
      });
      process.exit(result.status ?? 1);
    }
  }

  return false;
};

const validateJsonParse = (file) => {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (_error) {
    console.error(`Invalid JSON in ${file}; fix commas/quotes/BOM.`);
    process.exit(1);
  }
};

const hasUtf8Bom = (file) => {
  if (!existsSync(file)) return false;
  const buffer = readFileSync(file);
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
};

const findDisallowedLockfiles = (startDir) => {
  const entries = [];
  const stack = [startDir];

  while (stack.length) {
    const current = stack.pop();
    const dirEntries = readdirSync(current, { withFileTypes: true });

    for (const entry of dirEntries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;

      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (DISALLOWED_LOCKFILES.has(entry.name)) {
        entries.push(fullPath);
      }
    }
  }

  return entries;
};

ensureSupportedNodeVersion();

for (const file of JSON_FILES_TO_VALIDATE) {
  validateJsonParse(file);
}

if (runPsScript() !== false) {
  process.exit(0);
}

if (WORKSPACE_METADATA_FILES.some(hasUtf8Bom)) {
  console.error('UTF-8 BOM detected in workspace metadata files.');
  process.exit(1);
}

if (!existsSync('pnpm-lock.yaml')) {
  console.error('pnpm-lock.yaml is missing at the repository root.');
  process.exit(1);
}

const disallowed = findDisallowedLockfiles(process.cwd());
if (disallowed.length) {
  console.error('Disallowed lockfiles detected. Remove these files so pnpm-lock.yaml is the only lockfile:');
  disallowed.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('Preflight checks passed.');
