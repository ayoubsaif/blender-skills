---
name: multi-image-to-3d
description: Turn 2-4 photos of the same object from different angles into an accurate textured 3D model with the Meshy API and import it into Blender. Use when the user gives several views (front, back, sides) of one object and wants a 3D model.
---

# Multi-image to 3D

Sends 2–4 views of one object to Meshy's multi-image endpoint, which gives better
shape and texture than a single photo, then imports the GLB into Blender.

## Needs

- `MESHY_API_KEY` set in the environment. Never ask the user to paste it into
  chat, and never write it to a file or a command line.
- Node 18+
- Blender MCP connected, for the import step
- 2–4 images of the **same** object: local `.png` / `.jpg` / `.jpeg` or public URLs

Each call spends Meshy credits. Say so and confirm before the first run.

## Flow

1. **Check the inputs** without spending credits:

```bash
node "<skill-dir>/scripts/meshy.mjs" "<front>" "<back>" "<left>" "<right>" --dry-run
```

   `<skill-dir>` is this skill's folder. Quote every path.

2. **Generate** (runs until Meshy finishes — use a background command if your
   shell times out):

```bash
node "<skill-dir>/scripts/meshy.mjs" "<front>" "<back>" "<left>" "<right>" --name <name>
```

   The last stdout line is `{"glb": "<absolute path>", ...}`. With one image the
   script switches to the single-image endpoint by itself.

3. **Import and preview** with the MCP code tool. Ask before clearing the scene.

```python
import bpy
GLB = r'<glb path>'
CLEAR = False

if CLEAR:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=GLB)
new = [o for o in bpy.data.objects if o not in before]

if not any(o.type == 'LIGHT' for o in bpy.data.objects):
    bpy.ops.object.light_add(type='AREA', location=(2, -2, 3))
    key = bpy.context.active_object
    key.data.energy = 500; key.data.size = 3

for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'MATERIAL'
[o.name for o in new]
```

## Options

Same as `image-to-3d` — run the script with `--help`.

## Tips for good results

- Front, back, left and right work best; same lighting in every shot.
- Plain, light backgrounds; the whole object in frame.
- All images must be the same object. Past 4 views there is no gain (and Meshy
  refuses more than 4).

## Errors

- **400** — wrong image count or format, or an unreachable URL
- **402** — not enough Meshy credits
- **429** — rate limited; wait and retry
- **FAILED** — Meshy's reason is printed
