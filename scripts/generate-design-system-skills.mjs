#!/usr/bin/env node
// Generate one DSH skill per bundled OpenDesign design system.
//
// Source: the open-source catalog in nexu-io/open-design (Apache-2.0):
//   https://github.com/nexu-io/open-design/tree/main/design-systems
//
// Usage:
//   node scripts/generate-design-system-skills.mjs
//   OD_DESIGN_SYSTEMS_DIR=<path> OD_SKILLS_OUT=<path> node scripts/generate-design-system-skills.mjs
//
// The default output is $DSH_HOME/open-design/design-system-skills, mounted by
// the OpenDesign preset through skill-filesystem.customSkillDirs.

import fs from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');

const candidates = [
  process.env.OD_DESIGN_SYSTEMS_DIR,
  path.join(dshHome, 'open-design', 'repo-design-systems', 'design-systems'),
  process.platform === 'win32'
    ? 'D:/Open Design/resources/open-design/design-systems'
    : '/Applications/Open Design.app/Contents/Resources/open-design/design-systems',
].filter(Boolean);

const sourceDir = candidates.find((candidate) => {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
});

if (!sourceDir) {
  console.error('OpenDesign design-systems directory not found. Set OD_DESIGN_SYSTEMS_DIR.');
  process.exit(1);
}

const outputDir = process.env.OD_SKILLS_OUT
  || path.join(dshHome, 'open-design', 'design-system-skills');

const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const quote = (value) => JSON.stringify(String(value));

function readMetadata(manifest, design, id) {
  const name = manifest?.name || id;
  const category = manifest?.category || '';
  const lines = design.split('\n');
  const quoteLines = [];
  let started = false;
  for (const line of lines) {
    if (/^>\s?/.test(line)) {
      quoteLines.push(line.replace(/^>\s?/, '').trim());
      started = true;
      continue;
    }
    if (started) break;
  }
  const quoteCategory = quoteLines
    .find((line) => /^Category:\s*/i.test(line))
    ?.replace(/^Category:\s*/i, '')
    .trim();
  const summary = quoteLines
    .filter((line) => !/^Category:\s*/i.test(line))
    .join(' ')
    .trim();
  return {
    name,
    category: quoteCategory || category,
    summary: summary || manifest?.description || '',
  };
}

function truncate(text, max = 280) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

await fs.mkdir(outputDir, { recursive: true });
const entries = await fs.readdir(sourceDir, { withFileTypes: true });
const systems = entries
  .filter((entry) => entry.isDirectory() && entry.name !== '_schema')
  .map((entry) => entry.name)
  .sort();

let generated = 0;
const skipped = [];

for (const id of systems) {
  const designPath = path.join(sourceDir, id, 'DESIGN.md');
  const manifestPath = path.join(sourceDir, id, 'manifest.json');
  let design;
  let manifest;
  try {
    [design, manifest] = await Promise.all([
      fs.readFile(designPath, 'utf8'),
      fs.readFile(manifestPath, 'utf8').then(JSON.parse),
    ]);
  } catch (error) {
    skipped.push(`${id}: ${error.message}`);
    continue;
  }
  design = normalize(design);
  const meta = readMetadata(manifest, design, id);
  const description = truncate(
    `OpenDesign design system — ${meta.name}${meta.category ? ` (${meta.category})` : ''}: ${meta.summary}`,
  );
  const withoutTitle = design.replace(/^# .+\n?/, '').trim();
  const skillName = `open-design-${id}`;
  const sourceUrl = `https://github.com/nexu-io/open-design/tree/main/design-systems/${id}`;
  const fit = meta.summary
    ? `, or matches: ${meta.summary}`
    : '.';
  const content = `---
name: ${skillName}
description: ${quote(description)}
metadata:
  group: open-design-design-systems
  designSystemId: ${quote(id)}
  category: ${quote(meta.category || 'Uncategorized')}
  source: ${quote(sourceUrl)}
---

# ${meta.name} — OpenDesign design system

> OpenDesign open-source design system \`${id}\` (Apache-2.0). Brand-referencing packages are aesthetic inspirations, not official brand assets.

Use this skill when the brief names **${meta.name}**, asks for the ${meta.category || 'matching'} visual direction${fit} Treat the specification below as the visual contract for this project; do not mix tokens from another design system unless the user asks.

## Specification

${withoutTitle}

## Source

- ${sourceUrl}
- Canonical files: \`DESIGN.md\`, \`tokens.css\`, \`manifest.json\`
`;

  const targetDir = path.join(outputDir, skillName);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, 'SKILL.md'), content, 'utf8');
  generated += 1;
}

console.log(`source: ${sourceDir}`);
console.log(`output: ${outputDir}`);
console.log(`generated: ${generated}`);
if (skipped.length) {
  console.log(`skipped: ${skipped.length}`);
  for (const item of skipped) console.log(`- ${item}`);
}
