#!/usr/bin/env node
// Copy the prebuilt OpenDesign design-system skills shipped with this package
// into the DSH data directory read by the OpenDesign preset.
//
// Usage:
//   node scripts/install-design-system-skills.mjs
//   DSH_HOME=<path> node scripts/install-design-system-skills.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const source = path.join(packageRoot, 'design-system-skills');
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const target = path.join(dshHome, 'open-design', 'design-system-skills');

await fs.mkdir(target, { recursive: true });

let installed = 0;
for (const entry of await fs.readdir(source, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('open-design-')) continue;
  await fs.cp(path.join(source, entry.name), path.join(target, entry.name), {
    recursive: true,
    force: true,
  });
  installed += 1;
}

console.log(`installed ${installed} design-system skills into ${target}`);
