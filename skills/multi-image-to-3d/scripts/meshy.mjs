#!/usr/bin/env node
// Meshy image(s) -> GLB. Cross-platform (Node 18+, no dependencies).
//
//   node meshy.mjs <image> [more images...] [options]
//
// One image uses Meshy's image-to-3d endpoint, 2-4 use multi-image-to-3d.
// Images can be local .png/.jpg/.jpeg files or public http(s) URLs.
// The API key is read from MESHY_API_KEY and is never printed or written.
//
// This file is generated from shared/meshy.mjs in the source repo.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const API = 'https://api.meshy.ai/openapi/v1';

const HELP = `Usage: node meshy.mjs <image> [image2 image3 image4] [options]

Options
  --out <dir>          Output folder (default: $BLENDER_SKILLS_OUTPUT/models,
                       else ~/Videos/Blender Skills/models)
  --name <name>        GLB file name without extension (default: first image name)
  --ai-model <id>      meshy-5 | meshy-6 | latest (default: meshy-6)
  --topology <t>       quad | triangle (default: triangle)
  --polycount <n>      100-300000 (default: 30000)
  --remesh             Remesh to the polycount/topology
  --no-texture         Geometry only (fewer credits)
  --no-pbr             No metallic/roughness/normal maps
  --symmetry <m>       off | auto | on (default: auto)
  --pose <p>           a-pose | t-pose (characters only)
  --poll <seconds>     Seconds between status checks (default: 10)
  --timeout <minutes>  Give up after this long (default: 30)
  --dry-run            Check inputs and print the request, without calling Meshy
  -h, --help           Show this help

Prints progress on stderr and one JSON line on stdout when done:
  {"glb": "<absolute path>", "taskId": "...", "endpoint": "..."}`;

function parseArgs(argv) {
  const opts = { images: [], aiModel: 'meshy-6', topology: 'triangle', polycount: 30000,
    remesh: false, texture: true, pbr: true, symmetry: 'auto', pose: '', poll: 10,
    timeout: 30, dryRun: false };
  const need = (i, flag) => {
    if (i + 1 >= argv.length) throw new Error(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h': case '--help': opts.help = true; break;
      case '--out': opts.out = need(i, a); i++; break;
      case '--name': opts.name = need(i, a); i++; break;
      case '--ai-model': opts.aiModel = need(i, a); i++; break;
      case '--topology': opts.topology = need(i, a); i++; break;
      case '--polycount': opts.polycount = Number(need(i, a)); i++; break;
      case '--remesh': opts.remesh = true; break;
      case '--no-texture': opts.texture = false; break;
      case '--no-pbr': opts.pbr = false; break;
      case '--symmetry': opts.symmetry = need(i, a); i++; break;
      case '--pose': opts.pose = need(i, a); i++; break;
      case '--poll': opts.poll = Number(need(i, a)); i++; break;
      case '--timeout': opts.timeout = Number(need(i, a)); i++; break;
      case '--dry-run': opts.dryRun = true; break;
      default:
        if (a.startsWith('--')) throw new Error(`Unknown option ${a}`);
        opts.images.push(a);
    }
  }
  return opts;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

async function toImageUrl(input) {
  if (/^https?:\/\//i.test(input)) return input;
  const file = path.resolve(input);
  if (!existsSync(file)) throw new Error(`Image not found: ${file}`);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error(`Meshy accepts .png, .jpg or .jpeg, not ${path.basename(file)}`);
  return `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
}

async function call(url, key, init = {}) {
  const res = await fetch(url, { ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers } });
  const text = await res.text();
  if (!res.ok) {
    const hint = { 401: 'check MESHY_API_KEY', 402: 'not enough Meshy credits',
      429: 'rate limited, wait and retry' }[res.status];
    throw new Error(`Meshy ${res.status}${hint ? ` (${hint})` : ''}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || opts.images.length === 0) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 1);
  }
  if (opts.images.length > 4) throw new Error('Meshy takes 1 to 4 images');

  const multi = opts.images.length > 1;
  const endpoint = multi ? 'multi-image-to-3d' : 'image-to-3d';
  const base = process.env.BLENDER_SKILLS_OUTPUT || path.join(os.homedir(), 'Videos', 'Blender Skills');
  const outDir = path.resolve(opts.out || path.join(base, 'models'));
  const first = opts.images[0];
  const name = (opts.name || (/^https?:/i.test(first) ? 'model'
    : path.basename(first, path.extname(first)))).replace(/[^\w.-]+/g, '_');

  const urls = await Promise.all(opts.images.map(toImageUrl));
  const body = {
    ai_model: opts.aiModel,
    topology: opts.topology,
    target_polycount: opts.polycount,
    should_remesh: opts.remesh,
    should_texture: opts.texture,
    enable_pbr: opts.pbr,
    symmetry_mode: opts.symmetry,
    target_formats: ['glb'],
    ...(opts.pose ? { pose_mode: opts.pose } : {}),
    ...(multi ? { image_urls: urls } : { image_url: urls[0] }),
  };

  if (opts.dryRun) {
    const shown = { ...body };
    const short = (u) => (u.startsWith('data:') ? `${u.slice(0, 30)}… (${u.length} chars)` : u);
    if (shown.image_url) shown.image_url = short(shown.image_url);
    if (shown.image_urls) shown.image_urls = shown.image_urls.map(short);
    console.log(JSON.stringify({ endpoint: `${API}/${endpoint}`, out: path.join(outDir, `${name}.glb`), body: shown }, null, 2));
    return;
  }

  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error('Set MESHY_API_KEY first (https://www.meshy.ai > API).');

  const { result: taskId } = await call(`${API}/${endpoint}`, key, { method: 'POST', body: JSON.stringify(body) });
  if (!taskId) throw new Error('Meshy did not return a task id');
  console.error(`Task ${taskId} created (${endpoint})`);

  const deadline = Date.now() + opts.timeout * 60_000;
  let task;
  for (;;) {
    task = await call(`${API}/${endpoint}/${taskId}`, key);
    if (task.status === 'SUCCEEDED') break;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`Meshy task ${task.status}: ${task.task_error?.message || 'no reason given'}`);
    }
    if (Date.now() > deadline) throw new Error(`Timed out after ${opts.timeout} min (task ${taskId} still ${task.status})`);
    console.error(`  ${task.status} ${task.progress ?? 0}%`);
    await sleep(opts.poll);
  }

  const glbUrl = task.model_urls?.glb;
  if (!glbUrl) throw new Error('Task finished but has no GLB url');
  const res = await fetch(glbUrl);
  if (!res.ok) throw new Error(`GLB download failed: ${res.status}`);
  await mkdir(outDir, { recursive: true });
  const glb = path.join(outDir, `${name}.glb`);
  await writeFile(glb, Buffer.from(await res.arrayBuffer()));
  console.error(`Saved ${glb}`);
  console.log(JSON.stringify({ glb, taskId, endpoint }));
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
