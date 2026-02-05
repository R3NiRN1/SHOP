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
