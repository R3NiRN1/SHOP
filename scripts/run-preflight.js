const { existsSync, readFileSync, readdirSync } = require('fs');
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
