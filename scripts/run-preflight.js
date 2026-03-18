const { existsSync, readFileSync } = require('fs');
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

const files = ['pnpm-workspace.yaml', 'package.json', join('apps', 'web', 'package.json')];
const hasBom = files.some((file) => {
  if (!existsSync(file)) return false;
  const buffer = readFileSync(file);
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
});

if (hasBom) {
  console.error('UTF-8 BOM detected in workspace metadata files.');
  process.exit(1);
}

console.log('No UTF-8 BOM detected in workspace metadata files.');
