#!/usr/bin/env node
// Copies the shared files in shared/ into every skill that uses them.
// Run `npm run sync` after editing anything in shared/. `--check` only reports drift.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SHARED = [
  {
    from: 'shared/camera-common.md',
    to: 'common.md',
    skills: ['turntable', 'perfect-loop', 'slow-zoom', 'dolly-rotate', 'crane-shot', 'dynamic-full-loop'],
  },
  {
    from: 'shared/meshy.mjs',
    to: 'scripts/meshy.mjs',
    skills: ['image-to-3d', 'multi-image-to-3d'],
  },
];

export async function sync({ check = false } = {}) {
  const drift = [];
  for (const { from, to, skills } of SHARED) {
    const src = await readFile(path.join(root, from), 'utf8');
    for (const skill of skills) {
      const dest = path.join(root, 'skills', skill, to);
      const current = await readFile(dest, 'utf8').catch(() => null);
      if (current === src) continue;
      drift.push(path.relative(root, dest));
      if (!check) {
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, src);
      }
    }
  }
  return drift;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const drift = await sync({ check });
  if (check && drift.length) {
    console.error(`Out of date (run npm run sync):\n  ${drift.join('\n  ')}`);
    process.exit(1);
  }
  console.log(drift.length ? `${check ? 'Out of date' : 'Updated'}: ${drift.join(', ')}` : 'All shared files up to date.');
}
