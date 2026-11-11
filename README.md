# Blender Skills for Claude Code

Fifteen [Claude Code](https://claude.com/claude-code) skills for 3D product work in
Blender: camera moves rendered as transparent video, PolyHaven lighting and
textures, Meshy photo-to-3D, a glossy product finish and a Three.js web export.

A cross-platform fork of
[kevinbadi/blender-skills](https://github.com/kevinbadi/blender-skills) that runs
the same on Windows, macOS and Linux, and installs with one command.

## Install

```bash
npx @ayoubsaif/blender-skills
```

That copies every skill into `~/.claude/skills`, so it works in all your
projects. Start a new Claude Code session afterwards so the skills load.

| Command | What it does |
|---|---|
| `npx @ayoubsaif/blender-skills --project` | Install into `./.claude/skills` of the current folder instead |
| `npx @ayoubsaif/blender-skills --only turntable,perfect-loop` | Install some skills only (`--skip` for the reverse) |
| `npx @ayoubsaif/blender-skills list` | Show the skills and which are installed |
| `npx @ayoubsaif/blender-skills --force` | Update skills that are already installed |
| `npx @ayoubsaif/blender-skills uninstall` | Remove what this tool installed (never touches other folders) |
| `npx @ayoubsaif/blender-skills --dir <path>` | Any other skills folder |
| `npx @ayoubsaif/blender-skills --dry-run` | Show what would happen |

Existing skills with the same name are skipped unless you pass `--force`.

## Skills

**Camera moves** (rendered headless, encoded to ProRes 4444 or WebM with alpha)

| Skill | Shot |
|---|---|
| `turntable` | 360° orbit at constant speed |
| `perfect-loop` | Seamless 360° loop for endless playback or GIF |
| `slow-zoom` | Push-in to a hero detail with a lens shift |
| `dolly-rotate` | Move in while orbiting part way |
| `crane-shot` | Low-to-high reveal |
| `dynamic-full-loop` | Speed-ramped loop over every side, top and bottom |

**Photo to 3D** (Meshy API)

| Skill | |
|---|---|
| `image-to-3d` | One photo → textured GLB, imported into Blender |
| `multi-image-to-3d` | 2–4 views of one object → more accurate GLB |

**PolyHaven** (free HDRIs, textures and models)

| Skill | |
|---|---|
| `polyhaven-studio-setup` | HDRI lighting and a PBR ground plane |
| `polyhaven-scene-builder` | Full scene: HDRI, ground, pedestal, props |
| `polyhaven-texture-apply` | PBR texture set on one object |
| `polyhaven-material-swap` | Render one object in several materials |
| `polyhaven-hdri-showcase` | Render one product under several HDRIs |

**Finish and export**

| Skill | |
|---|---|
| `product-polish` | Import a GLB with a glossy finish and studio lights |
| `threejs-export` | GLB + standalone Three.js viewer page |

Ask in plain words: "make a turntable of this model", "zoom in on the logo",
"turn this photo into a 3D model", "light it like a studio".

## Requirements

- **Blender 4.2+** (tested on 5.2) with the
  [blender-mcp](https://github.com/ahujasid/blender-mcp) add-on connected
  (port 9876). The camera and Meshy skills also work with any MCP that runs
  Python in Blender; the PolyHaven, polish and export scripts talk to the
  blender-mcp socket directly.
- **Node 18+** for the installer and the bundled scripts.
- **ffmpeg** on PATH for the video skills.
- **`MESHY_API_KEY`** in your environment for the two Meshy skills. Each Meshy
  call spends credits; the skills confirm before the first run.

## Settings

| Environment variable | Default | Used by |
|---|---|---|
| `BLENDER_SKILLS_OUTPUT` | `~/Videos/Blender Skills` | Camera renders, Meshy models |
| `MESHY_API_KEY` | none | `image-to-3d`, `multi-image-to-3d` |

## Changes from upstream

- **Installs with npx**, globally or per project, with list/update/uninstall.
- **Works on Windows.** No hard-coded macOS paths. Output goes to a folder you can
  set. A leading `~` in script arguments works in PowerShell and cmd too. The
  scripts connect to `127.0.0.1`, so Node doesn't try IPv6 first.
- **Meshy without bash.** A Node helper (`scripts/meshy.mjs`) replaces the
  `curl`/`base64` steps: it creates the task, polls, downloads the GLB, and has
  `--dry-run` to check inputs without spending credits. The key is read from the
  environment only.
- **Camera rigs frame the real model.** They used to orbit the world origin at
  fixed distances. Now they measure the visible meshes and scale and center every
  shot to fit.
- **No MCP timeouts on render.** The scene is saved and rendered headless in the
  background, then encoded, instead of blocking Blender inside an MCP call.
- **Blender 4 and 5.** Keyframe interpolation is set through layered actions when
  they exist (Blender 5 removed `action.fcurves`), with a fallback for older
  versions.
- **Scripts are found from the skill's own folder**, not from paths that only
  worked inside the upstream repo.
- Skill names match their folders (`product-polish`, `threejs-export`).
- `blender-toolkit` is dropped: it needs a separate plugin and add-on from
  another author that aren't in this pack.

## Development

```bash
npm test                       # sync check + unit tests (no Blender needed)
npm run sync                   # after editing anything in shared/
```

`shared/camera-common.md` and `shared/meshy.mjs` are copied into the skills that
use them, because each installed skill must stand on its own. Edit them in
`shared/`, then run `npm run sync`.

To check the camera skills against a real Blender:

```bash
blender -b --factory-startup --python test/blender/check_camera_skills.py
```

### Publish

```bash
npm login
npm publish
```

`prepublishOnly` runs the tests first. The package is public under the
`@ayoubsaif` scope.

## License

Two parts. [NOTICE](NOTICE) lists exactly which files fall under each.

- **Code original to this fork** (the installer, the Meshy helper, the sync
  script and the tests) is under the [MIT License](LICENSE), © 2026 Ayoub Saif.
- **The skills themselves** are adapted from
  [kevinbadi/blender-skills](https://github.com/kevinbadi/blender-skills) and are
  not covered by the MIT License. The upstream repository has no license file,
  so its author keeps the rights to that work. If the author adds a license,
  those files follow it.

Original skills by [kevinbadi](https://github.com/kevinbadi). If you're the author
and want anything changed, please
[open an issue](https://github.com/ayoubsaif/blender-skills/issues).
