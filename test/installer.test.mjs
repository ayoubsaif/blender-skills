import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs, targetDir, availableSkills, pick, install, uninstall } from '../lib/installer.mjs';
import { sync } from '../scripts/sync-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quiet = () => {};
const tmp = () => mkdtemp(path.join(os.tmpdir(), 'blender-skills-'));

test('parseArgs: defaults, scopes and lists', () => {
  assert.deepEqual(parseArgs([]), { command: 'install', scope: 'global', force: false, dryRun: false });
  const o = parseArgs(['list', '-p', '--only', 'turntable, slow-zoom', '-f', '-n']);
  assert.equal(o.command, 'list');
  assert.equal(o.scope, 'project');
  assert.deepEqual(o.only, ['turntable', 'slow-zoom']);
  assert.ok(o.force && o.dryRun);
  assert.equal(parseArgs(['--dir', 'x']).scope, 'dir');
  assert.throws(() => parseArgs(['--dir']), /needs a value/);
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
});

test('targetDir resolves global, project and custom folders', () => {
  const env = { cwd: path.resolve('/work'), home: path.resolve('/home/me') };
  assert.equal(targetDir({ scope: 'global' }, env), path.join(env.home, '.claude', 'skills'));
  assert.equal(targetDir({ scope: 'project' }, env), path.join(env.cwd, '.claude', 'skills'));
  assert.equal(targetDir({ scope: 'dir', dir: '~/s' }, env), path.join(env.home, 's'));
  assert.equal(targetDir({ scope: 'dir', dir: 'rel' }, env), path.join(env.cwd, 'rel'));
});

test('every skill folder has a SKILL.md whose name matches the folder', async () => {
  const skills = await availableSkills();
  assert.equal(skills.length, 15);
  for (const s of skills) {
    assert.equal(s.title, s.name, `${s.name}: frontmatter name must match folder`);
    assert.ok(s.description.length > 20, `${s.name}: needs a description`);
  }
});

test('pick filters and rejects unknown names', async () => {
  const skills = await availableSkills();
  assert.deepEqual(pick(skills, { only: ['turntable'] }).map((s) => s.name), ['turntable']);
  assert.equal(pick(skills, { skip: ['turntable'] }).length, skills.length - 1);
  assert.throws(() => pick(skills, { only: ['nope'] }), /No skill named "nope"/);
});

test('install copies skills, skips existing ones and overwrites with force', async () => {
  const dest = await tmp();
  try {
    const skills = pick(await availableSkills(), { only: ['turntable', 'image-to-3d'] });
    let r = await install(skills, dest, { version: '9.9.9', log: quiet });
    assert.deepEqual(r.installed.sort(), ['image-to-3d', 'turntable']);
    assert.ok(existsSync(path.join(dest, 'turntable', 'SKILL.md')));
    assert.ok(existsSync(path.join(dest, 'turntable', 'common.md')));
    assert.ok(existsSync(path.join(dest, 'image-to-3d', 'scripts', 'meshy.mjs')));
    assert.equal((await readFile(path.join(dest, 'turntable', '.blender-skills'), 'utf8')).trim(), '9.9.9');

    await writeFile(path.join(dest, 'turntable', 'SKILL.md'), 'edited');
    r = await install(skills, dest, { log: quiet });
    assert.deepEqual(r.skipped.sort(), ['image-to-3d', 'turntable']);
    assert.equal(await readFile(path.join(dest, 'turntable', 'SKILL.md'), 'utf8'), 'edited');

    r = await install(skills, dest, { force: true, log: quiet });
    assert.equal(r.replaced.length, 2);
    assert.notEqual(await readFile(path.join(dest, 'turntable', 'SKILL.md'), 'utf8'), 'edited');
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test('dry run changes nothing', async () => {
  const dest = path.join(await tmp(), 'not-created');
  const r = await install(await availableSkills(), dest, { dryRun: true, log: quiet });
  assert.equal(r.installed.length, 15);
  assert.ok(!existsSync(dest));
});

test('uninstall removes only folders this tool installed', async () => {
  const dest = await tmp();
  try {
    const skills = pick(await availableSkills(), { only: ['turntable', 'slow-zoom'] });
    await install(pick(skills, { only: ['turntable'] }), dest, { log: quiet });
    await mkdir(path.join(dest, 'slow-zoom'));                // someone else's folder
    const r = await uninstall(skills, dest, { log: quiet });
    assert.deepEqual(r.removed, ['turntable']);
    assert.deepEqual(r.kept, ['slow-zoom']);
    assert.deepEqual(await readdir(dest), ['slow-zoom']);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test('CLI runs end to end through the bin file', async () => {
  const dest = await tmp();
  try {
    const bin = path.join(root, 'bin', 'cli.mjs');
    const out = execFileSync(process.execPath, [bin, '--dir', dest, '--only', 'perfect-loop'], { encoding: 'utf8' });
    assert.match(out, /1 added/);
    assert.ok(existsSync(path.join(dest, 'perfect-loop', 'SKILL.md')));
    assert.match(execFileSync(process.execPath, [bin, 'list', '--dir', dest], { encoding: 'utf8' }), /✓ perfect-loop/);
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(execFileSync(process.execPath, [bin, '-v'], { encoding: 'utf8' }).trim(), pkg.version);
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
});

test('shared files are in sync', async () => {
  assert.deepEqual(await sync({ check: true }), []);
});

test('no machine-specific paths left in the skills', async () => {
  const bad = /\/Users\/kevin|Blender Test|reference_meshy_api|skills\/blender-/;
  const walk = async (dir) => (await readdir(dir, { withFileTypes: true })).flatMap((e) => e);
  for (const skill of await readdir(path.join(root, 'skills'))) {
    const dir = path.join(root, 'skills', skill);
    const files = [path.join(dir, 'SKILL.md')];
    if (existsSync(path.join(dir, 'scripts'))) {
      for (const f of await walk(path.join(dir, 'scripts'))) files.push(path.join(dir, 'scripts', f.name));
    }
    for (const f of files) {
      assert.doesNotMatch(await readFile(f, 'utf8'), bad, f);
    }
  }
});

test('all bundled scripts parse', async () => {
  for (const skill of await readdir(path.join(root, 'skills'))) {
    const dir = path.join(root, 'skills', skill, 'scripts');
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      execFileSync(process.execPath, ['--check', path.join(dir, f)]);
    }
  }
});

test('meshy helper: dry run builds the right request without a key', async () => {
  const dir = await tmp();
  try {
    // 1x1 transparent PNG
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    const a = path.join(dir, 'front.png');
    const b = path.join(dir, 'back.png');
    await writeFile(a, png); await writeFile(b, png);
    const script = path.join(root, 'skills', 'image-to-3d', 'scripts', 'meshy.mjs');
    const env = { ...process.env, MESHY_API_KEY: '' };

    const one = JSON.parse(execFileSync(process.execPath, [script, a, '--dry-run', '--out', dir], { encoding: 'utf8', env }));
    assert.match(one.endpoint, /\/image-to-3d$/);
    assert.match(one.body.image_url, /^data:image\/png;base64,/);
    assert.equal(one.out, path.join(dir, 'front.glb'));

    const two = JSON.parse(execFileSync(process.execPath, [script, a, b, '--dry-run', '--topology', 'quad'], { encoding: 'utf8', env }));
    assert.match(two.endpoint, /\/multi-image-to-3d$/);
    assert.equal(two.body.image_urls.length, 2);
    assert.equal(two.body.topology, 'quad');

    assert.throws(() => execFileSync(process.execPath, [script, a], { env, stdio: 'pipe' }), /MESHY_API_KEY/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
