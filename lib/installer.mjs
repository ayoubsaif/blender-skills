// Installs the Blender skills into a Claude Code skills folder.
// No dependencies, Node 18+. The command-line entry point is bin/cli.mjs.

import { cp, readdir, readFile, rm, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(pkgRoot, 'skills');
const MARKER = '.blender-skills';          // marks folders this tool installed

const HELP = `Install Blender skills for Claude Code.

Usage
  npx @ayoubsaif/blender-skills [command] [options]

Commands
  install       Copy the skills (default)
  list          Show the skills in this package and whether they are installed
  uninstall     Remove skills this tool installed

Options
  -g, --global       ~/.claude/skills (default)
  -p, --project      ./.claude/skills in the current folder
  --dir <path>       Any other skills folder
  --only <a,b>       Only these skills
  --skip <a,b>       All skills except these
  -f, --force        Overwrite skills that are already there
  -n, --dry-run      Show what would happen, change nothing
  -v, --version      Print the version
  -h, --help         Show this help

Examples
  npx @ayoubsaif/blender-skills
  npx @ayoubsaif/blender-skills --project --only turntable,perfect-loop
  npx @ayoubsaif/blender-skills list
  npx @ayoubsaif/blender-skills uninstall --skip image-to-3d`;

export function parseArgs(argv) {
  const opts = { command: 'install', scope: 'global', force: false, dryRun: false };
  const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('-')) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case 'install': case 'list': case 'uninstall': opts.command = a; break;
      case '-g': case '--global': opts.scope = 'global'; break;
      case '-p': case '--project': opts.scope = 'project'; break;
      case '--dir': opts.scope = 'dir'; opts.dir = value(i, a); i++; break;
      case '--only': opts.only = list(value(i, a)); i++; break;
      case '--skip': opts.skip = list(value(i, a)); i++; break;
      case '-f': case '--force': opts.force = true; break;
      case '-n': case '--dry-run': opts.dryRun = true; break;
      case '-v': case '--version': opts.command = 'version'; break;
      case '-h': case '--help': opts.command = 'help'; break;
      default: throw new Error(`Unknown argument "${a}". Run with --help.`);
    }
  }
  return opts;
}

export function targetDir(opts, { cwd = process.cwd(), home = os.homedir() } = {}) {
  if (opts.scope === 'dir') {
    const d = opts.dir.replace(/^~(?=$|[\\/])/, home);
    return path.resolve(cwd, d);
  }
  if (opts.scope === 'project') return path.join(cwd, '.claude', 'skills');
  return path.join(home, '.claude', 'skills');
}

export async function availableSkills(root = skillsRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  const skills = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const file = path.join(root, e.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const text = await readFile(file, 'utf8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
    const field = (k) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(front)?.[1].trim();
    skills.push({ name: e.name, title: field('name') ?? e.name, description: field('description') ?? '' });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function pick(skills, opts) {
  const names = new Set(skills.map((s) => s.name));
  for (const n of [...(opts.only ?? []), ...(opts.skip ?? [])]) {
    if (!names.has(n)) throw new Error(`No skill named "${n}". Run "list" to see them.`);
  }
  return skills.filter((s) => (!opts.only || opts.only.includes(s.name)) && !(opts.skip ?? []).includes(s.name));
}

async function isDir(p) {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

export async function install(skills, dest, { force = false, dryRun = false, version = '0.0.0', log = console.log, from = skillsRoot } = {}) {
  const result = { installed: [], replaced: [], skipped: [] };
  if (!dryRun) await mkdir(dest, { recursive: true });
  for (const s of skills) {
    const to = path.join(dest, s.name);
    const exists = await isDir(to);
    if (exists && !force) {
      result.skipped.push(s.name);
      log(`  skip     ${s.name} (already there, use --force to overwrite)`);
      continue;
    }
    if (!dryRun) {
      if (exists) await rm(to, { recursive: true, force: true });
      await cp(path.join(from, s.name), to, { recursive: true });
      await writeFile(path.join(to, MARKER), `${version}\n`);
    }
    (exists ? result.replaced : result.installed).push(s.name);
    log(`  ${exists ? 'replace' : 'add    '}  ${s.name}`);
  }
  return result;
}

export async function uninstall(skills, dest, { dryRun = false, log = console.log } = {}) {
  const result = { removed: [], kept: [] };
  for (const s of skills) {
    const to = path.join(dest, s.name);
    if (!(await isDir(to))) continue;
    if (!existsSync(path.join(to, MARKER))) {
      result.kept.push(s.name);
      log(`  keep     ${s.name} (not installed by this tool)`);
      continue;
    }
    if (!dryRun) await rm(to, { recursive: true, force: true });
    result.removed.push(s.name);
    log(`  remove   ${s.name}`);
  }
  return result;
}

export async function main(argv) {
  const opts = parseArgs(argv);
  const pkg = JSON.parse(await readFile(path.join(pkgRoot, 'package.json'), 'utf8'));
  if (opts.command === 'help') return console.log(HELP);
  if (opts.command === 'version') return console.log(pkg.version);

  const dest = targetDir(opts);
  const skills = pick(await availableSkills(), opts);
  const dry = opts.dryRun ? ' (dry run, nothing changed)' : '';

  if (opts.command === 'list') {
    console.log(`Skills in ${pkg.name}@${pkg.version} — ✓ = installed in ${dest}\n`);
    for (const s of skills) {
      const mark = (await isDir(path.join(dest, s.name))) ? '✓' : ' ';
      console.log(`  ${mark} ${s.name.padEnd(26)} ${s.description.split('. ')[0]}`);
    }
    return;
  }

  if (opts.command === 'uninstall') {
    console.log(`Removing from ${dest}${dry}`);
    const r = await uninstall(skills, dest, opts);
    console.log(`\n${r.removed.length} removed, ${r.kept.length} kept.`);
    return;
  }

  console.log(`Installing ${skills.length} skill(s) into ${dest}${dry}`);
  const r = await install(skills, dest, { ...opts, version: pkg.version });
  console.log(`\n${r.installed.length} added, ${r.replaced.length} replaced, ${r.skipped.length} skipped.`);
  if (!opts.dryRun && (r.installed.length || r.replaced.length)) {
    console.log(`
Next:
  1. Start a new Claude Code session so the skills load.
  2. In Blender, install the blender-mcp add-on and connect it
     (https://github.com/ahujasid/blender-mcp).
  3. Install ffmpeg for the video skills, and set MESHY_API_KEY for image-to-3d.
  Output goes to $BLENDER_SKILLS_OUTPUT, or ~/Videos/Blender Skills.`);
  }
}
