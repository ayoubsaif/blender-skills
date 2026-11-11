# Camera shot — shared steps

Every camera skill in this pack (turntable, perfect-loop, slow-zoom, dolly-rotate,
crane-shot, dynamic-full-loop) uses these steps. Each Python block is a separate
Blender MCP call (`execute_blender_code` / `execute_code`), so values are passed
between calls through scene custom properties, never through Python globals.

> This file is generated from `shared/camera-common.md` in the source repo.
> Edit it there and run `npm run sync`.

## A. Frame the model (run first)

Finds the visible meshes, their combined center and size, and stores them on the
scene. All camera positions in the skill are written for a model about 2 units
across and get multiplied by `bs_scale` and offset by `bs_center`.

```python
import bpy, os
from mathutils import Vector

scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == 'MESH' and o.visible_get()]
if not meshes:
    raise RuntimeError('No visible mesh in the scene. Import the model first.')

pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center = (lo + hi) / 2
scale = max((hi - lo).length, 1e-3) / 2.0

out = os.environ.get('BLENDER_SKILLS_OUTPUT') or os.path.join(
    os.path.expanduser('~'), 'Videos', 'Blender Skills')
os.makedirs(out, exist_ok=True)

scene['bs_center'] = list(center)
scene['bs_scale'] = scale
scene['bs_out'] = out
{'center': list(center), 'scale': scale, 'output': out,
 'meshes': [o.name for o in meshes], 'blender': bpy.app.binary_path}
```

Keep the returned `output` and `blender` paths: you need them in step C.

Helper used by the rig code — place `C`, `S` and `P()` at the top of a rig call:

```python
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z):            # position relative to the model, scaled to its size
    return C + Vector((x, y, z)) * S
```

## B. Keyframe interpolation (Blender 4.x and 5.x)

Blender 4.4+ stores keys in layered actions and Blender 5.0 removed
`action.fcurves`. This works on both:

```python
def set_interp(obj, mode):          # mode: 'LINEAR' or 'BEZIER'
    ad = obj.animation_data
    act = ad.action if ad else None
    if act is None:
        return
    if hasattr(act, 'layers') and len(act.layers):
        fcs = [fc for layer in act.layers for strip in layer.strips
               for cb in strip.channelbags for fc in cb.fcurves]
    else:
        fcs = list(act.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = mode
```

## C. Render and encode

Rendering a whole animation inside an MCP call blocks Blender until the call
times out. Set up the render in Blender, save a copy of the scene, and render it
headless in the background instead.

1. Render settings and a saved copy (replace `SHOT` with the skill's shot name,
   e.g. `turntable`):

```python
import bpy, os
scene = bpy.context.scene
SHOT = 'turntable'
out = scene['bs_out']

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.film_transparent = True
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

frames = os.path.join(out, f'{SHOT}_frames', '')
os.makedirs(frames, exist_ok=True)
scene.render.filepath = frames

blend = os.path.join(out, f'{SHOT}.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend, copy=True)
{'blend': blend, 'frames': frames, 'blender': bpy.app.binary_path}
```

   GPU rendering is optional: set it in Blender's Preferences > System, not here,
   so the script works on machines without a supported GPU.

2. Render headless as a background shell command (it can take minutes). Use the
   `blender` path returned above. Quote every path — Windows paths often contain
   spaces:

```bash
"<blender>" -b "<blend>" -a
```

   In PowerShell, start the line with `& ` because the program path is quoted.

3. When the frames are all there, encode. It is one line so it runs the same in
   bash, zsh and PowerShell:

```bash
ffmpeg -y -framerate 24 -i "<frames>%04d.png" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le "<output>/<SHOT>.mov"
```

   For the web (smaller, keeps transparency):

```bash
ffmpeg -y -framerate 24 -i "<frames>%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 "<output>/<SHOT>.webm"
```

   Match `-framerate` to the skill's `fps`. If Blender is closed or crashes part
   way, encode the frames that exist — a partial render is still usable.

## Defaults

| Setting | Default |
|---|---|
| Output folder | `$BLENDER_SKILLS_OUTPUT`, else `~/Videos/Blender Skills` |
| Size | 1920×1080, 24 fps |
| Background | transparent (ProRes 4444 or VP9 with alpha) |
| Engine | Cycles, 64 samples, denoised |
