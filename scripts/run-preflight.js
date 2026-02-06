const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const hasCommand = (command) => {
  const result = spawnSync(command, ['-Command', '"$PSVersionTable.PSVersion"'], { shell: true, stdio: 'ignore' });
  return result.status === 0;
};

const runPsScript = () => {
  const commands = ['pwsh', 'powershell'];
  for (const cmd of commands) {
    if (hasCommand(cmd)) {
      const result = spawnSync(cmd, ['-ExecutionPolicy', 'Bypass', '-File', '.\\scripts\\check-bom.ps1'], { stdio: 'inherit', shell: true });
      process.exit(result.status ?? 1);
    }
  }
  return false;
};

if (runPsScript() !== false) {
  process.exit(0);
}

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
  console.error('UTF-8 BOM detected in workspace metadata files.');
  process.exit(1);
}

const disallowed = findDisallowedLockfiles(process.cwd());
if (disallowed.length) {
  console.error('Disallowed lockfiles detected. Remove these files so pnpm-lock.yaml is the only lockfile:');
  disallowed.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('No UTF-8 BOM detected in workspace metadata files.');
