---
name: image-to-3d
description: Turn one photo into a textured 3D model with the Meshy API and import it into Blender. Use when the user gives a single image and asks to make it 3D, convert it to a 3D model, or get it into Blender. For 2-4 photos of the same object use multi-image-to-3d.
---

# Image to 3D

Sends one photo to Meshy, waits for the model, saves the GLB and imports it into
the open Blender scene.

## Needs

- `MESHY_API_KEY` set in the environment (Meshy > API settings). Never ask the
  user to paste the key into chat, and never write it to a file or a command line.
- Node 18+ (for the helper script)
- Blender MCP connected, for the import step
- One image: a local `.png` / `.jpg` / `.jpeg`, or a public URL

Each call spends Meshy credits. Say so and confirm before the first run.

## Flow

1. **Check the input** without spending credits:

```bash
node "<skill-dir>/scripts/meshy.mjs" "<image>" --dry-run
```

   `<skill-dir>` is this skill's folder (shown when the skill loads). Quote the
   paths — Windows paths often contain spaces.

2. **Generate.** This polls until Meshy finishes (usually 1–4 minutes), so run it
   as a background command if your shell has a short timeout:

```bash
node "<skill-dir>/scripts/meshy.mjs" "<image>" --name <name>
```

   Progress goes to stderr. The last stdout line is JSON:
   `{"glb": "<absolute path>", "taskId": "...", "endpoint": "image-to-3d"}`.
   Run with `--help` for the options below.

3. **Import into Blender** with the MCP code tool. Ask before clearing the scene.

```python
import bpy
GLB = r'<glb path>'                     # raw string: safe for Windows backslashes
CLEAR = False                           # True only if the user agreed

if CLEAR:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=GLB)
new = [o for o in bpy.data.objects if o not in before]
[o.name for o in new]
```

   Next steps that pair well: `product-polish` for a glossy finish,
   `polyhaven-studio-setup` for lighting, then any camera skill.

## Options

| Option | Default | Notes |
|---|---|---|
| `--out <dir>` | `$BLENDER_SKILLS_OUTPUT/models`, else `~/Videos/Blender Skills/models` | |
| `--name <name>` | image file name | GLB file name |
| `--ai-model` | `meshy-6` | `meshy-5`, `meshy-6`, `latest` |
| `--topology` | `triangle` | `quad` for cleaner editing |
| `--polycount` | `30000` | 100–300,000 |
| `--remesh` | off | Remesh to polycount/topology |
| `--no-texture` | textured | Geometry only, fewer credits |
| `--no-pbr` | PBR on | Skip metallic/roughness/normal maps |
| `--symmetry` | `auto` | `off`, `auto`, `on` |
| `--pose` | none | `a-pose`, `t-pose` for characters |

## Errors

The script exits non-zero with a short reason:
- **401** — key missing or wrong
- **402** — not enough Meshy credits; tell the user
- **429** — rate limited; wait and retry
- **FAILED** — Meshy's own reason is printed; often a busy background or a
  cropped object. Suggest a cleaner photo.
- Blender MCP not connected — ask the user to start the add-on's server.
