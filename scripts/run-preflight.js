const { existsSync, readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_NODE_VERSION = [20, 19, 0];

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
  if (!isNodeVersionLessThanRequired(currentVersion, REQUIRED_NODE_VERSION)) {
    return;
  }

  const current = process.versions.node;
  const required = REQUIRED_NODE_VERSION.join('.');
  console.error(
    [
      `Unsupported Node.js version: ${current}`,
      `Required Node.js version: ${required}`,
      'CI uses Node 20 latest; upgrade Node (nvm use 20.19+)',
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

ensureSupportedNodeVersion();

if (runPsScript() !== false) {
  process.exit(0);
}

const isIgnoredDir = (dir) => dir === 'node_modules' || dir === '.git';
const packageJsonFiles = [];

const walk = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) continue;
      walk(join(dir, entry.name));
    } else if (entry.isFile() && entry.name === 'package.json') {
      packageJsonFiles.push(join(dir, entry.name));
    }
  }
};

walk('.');

const hasBom = packageJsonFiles.some((file) => {
const files = ['pnpm-workspace.yaml', 'package.json', join('apps', 'web', 'package.json')];

const disallowedLockfiles = new Set(['package-lock.json', 'yarn.lock']);

const findDisallowedLockfiles = (startDir) => {
  const entries = [];
  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    const dirEntries = require('fs').readdirSync(current, { withFileTypes: true });
    for (const entry of dirEntries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (disallowedLockfiles.has(entry.name)) {
        entries.push(fullPath);
      }
    }
  }
  return entries;
};
const hasBom = files.some((file) => {
  if (!existsSync(file)) return false;
  const buffer = readFileSync(file);
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
});

if (hasBom) {
  console.error('UTF-8 BOM detected in package.json files.');
  process.exit(1);
}

if (!existsSync('pnpm-lock.yaml')) {
  console.error('pnpm-lock.yaml is missing at the repository root.');
  process.exit(1);
}

if (existsSync('yarn.lock') || existsSync('package-lock.json')) {
  console.error('Unexpected lockfile detected (yarn.lock or package-lock.json).');
  process.exit(1);
}

console.log('Preflight checks passed.');
const disallowed = findDisallowedLockfiles(process.cwd());
if (disallowed.length) {
  console.error('Disallowed lockfiles detected. Remove these files so pnpm-lock.yaml is the only lockfile:');
  disallowed.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('No UTF-8 BOM detected in workspace metadata files.');
