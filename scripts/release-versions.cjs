const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

// Resolve from the application so pnpm's isolated workspace layout is respected.
const appRequire = createRequire(path.resolve(__dirname, '../apps/web/package.json'));
const packages = { next: 'next', next_auth: 'next-auth', react: 'react', prisma: 'prisma' };

const lines = Object.entries(packages).map(([key, name]) => {
  // Some packages (next-auth) do not export package.json. Walk from the
  // resolved entry point to the matching package metadata instead.
  let entry;
  try {
    entry = appRequire.resolve(`${name}/package.json`);
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    entry = appRequire.resolve(name);
  }
  let directory = path.dirname(entry);
  let metadata;
  for (;;) {
    const candidate = path.join(directory, 'package.json');
    if (fs.existsSync(candidate)) {
      const value = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (value.name === name) { metadata = value; break; }
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`Cannot find installed metadata for ${name}`);
    directory = parent;
  }
  const { version } = metadata;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) {
    throw new Error(`Invalid installed version for ${name}`);
  }
  return `${key}=${version}\n`;
});
process.stdout.write(lines.join(''));
