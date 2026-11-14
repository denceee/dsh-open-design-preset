#!/usr/bin/env node
// Copy the prebuilt OpenDesign skills shipped with this package into the DSH
// data directories read by the OpenDesign preset.
//
// Usage:
//   node scripts/install-skills.mjs
//   DSH_HOME=<path> node scripts/install-skills.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');

const groups = [
  { from: 'skills', to: path.join(dshHome, 'open-design', 'skills') },
  { from: 'design-system-skills', to: path.join(dshHome, 'open-design', 'design-system-skills') },
];

let total = 0;
for (const group of groups) {
  const source = path.join(packageRoot, group.from);
  await fs.mkdir(group.to, { recursive: true });
  let installed = 0;
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    await fs.cp(path.join(source, entry.name), path.join(group.to, entry.name), {
      recursive: true,
      force: true,
    });
    installed += 1;
  }
  total += installed;
  console.log(`installed ${installed} skills into ${group.to}`);
}

console.log(`installed ${total} skills total`);
