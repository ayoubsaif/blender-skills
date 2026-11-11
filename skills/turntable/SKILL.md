---
name: turntable
description: 360-degree turntable camera orbit around a 3D product in Blender, rendered as a transparent video. Use when asked for a turntable, spin, orbit or "show all angles" video of a model.
---

# Turntable

Orbits the camera 360° around the model at constant speed. Starts on the front.

Read `common.md` in this skill's folder first: it has the framing step (A), the
interpolation helper (B) and the render/encode steps (C) used below.

## Needs

- Blender MCP connected (blender-mcp add-on, port 9876, or Blender's own MCP)
- The model already in the scene
- ffmpeg on PATH

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `duration` | `5` | Seconds |
| `fps` | `24` | Frames per second |
| `distance` | `4.5` | Camera distance (× model scale) |
| `height` | `2.0` | Camera height above center (× model scale) |
| `lens` | `50` | Focal length in mm |

## Flow

1. **Frame the model** — run `common.md` step A.

2. **Find the front.** Render four small stills and ask the user which is the
   front. Default front is −Y.

```python
import bpy, os
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']; out = scene['bs_out']
def P(x, y, z): return C + Vector((x, y, z)) * S

bpy.ops.object.empty_add(type='PLAIN_AXES', location=C)
tgt = bpy.context.active_object; tgt.name = 'FacingTarget'
bpy.ops.object.camera_add()
cam = bpy.context.active_object; cam.name = 'FacingCam'
cam.constraints.new(type='TRACK_TO').target = tgt
scene.camera = cam

old = (scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath)
scene.render.resolution_x, scene.render.resolution_y = 480, 270
files = []
for label, pos in {'front': (0, -4.5, 2), 'right': (4.5, 0, 2),
                   'back': (0, 4.5, 2), 'left': (-4.5, 0, 2)}.items():
    cam.location = P(*pos)
    scene.render.filepath = os.path.join(out, f'facing_{label}.png')
    bpy.ops.render.render(write_still=True)
    files.append(scene.render.filepath)
scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath = old

bpy.data.objects.remove(cam, do_unlink=True)
bpy.data.objects.remove(tgt, do_unlink=True)
files
```

   Show the four images. If the front is not −Y, rotate the start angle in step 3
   (right = 90°, back = 180°, left = 270°).

3. **Rig and animate.** The camera is parented to an empty at the model center;
   the empty spins.

```python
import bpy, math
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z): return C + Vector((x, y, z)) * S

DURATION, FPS, DISTANCE, HEIGHT, LENS = 5, 24, 4.5, 2.0, 50
START_DEG = 0                         # from step 2
TOTAL = DURATION * FPS

bpy.ops.object.empty_add(type='PLAIN_AXES', location=C)
tgt = bpy.context.active_object; tgt.name = 'TurntableTarget'
bpy.ops.object.camera_add(location=P(0, -DISTANCE, HEIGHT))
cam = bpy.context.active_object; cam.name = 'TurntableCamera'
cam.data.lens = LENS
trk = cam.constraints.new(type='TRACK_TO')
trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
cam.parent = tgt
cam.matrix_parent_inverse = tgt.matrix_world.inverted()
scene.camera = cam

scene.frame_start, scene.frame_end, scene.render.fps = 1, TOTAL, FPS
tgt.rotation_euler = (0, 0, math.radians(START_DEG))
tgt.keyframe_insert(data_path='rotation_euler', frame=1)
tgt.rotation_euler = (0, 0, math.radians(START_DEG + 360))
tgt.keyframe_insert(data_path='rotation_euler', frame=TOTAL + 1)

# set_interp from common.md step B
def set_interp(obj, mode):
    act = obj.animation_data.action if obj.animation_data else None
    if act is None: return
    if hasattr(act, 'layers') and len(act.layers):
        fcs = [fc for l in act.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]
    else:
        fcs = list(act.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points: kp.interpolation = mode
set_interp(tgt, 'LINEAR')             # constant speed
'rig ok'
```

4. **Light it** (skip if the scene already has lighting the user likes, e.g. from
   `polyhaven-studio-setup`). Warm color goes on the lights, not the world.

```python
import bpy, math
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z): return C + Vector((x, y, z)) * S

def area(name, pos, energy, size, color, rot):
    bpy.ops.object.light_add(type='AREA', location=P(*pos))
    l = bpy.context.active_object; l.name = name
    l.data.energy = energy * S * S; l.data.size = size * S
    l.data.color = color
    l.rotation_euler = tuple(math.radians(a) for a in rot)

area('GoldenKey',    (3, -3, 4),   2000, 3, (1.0, 0.78, 0.45), (45, 0, 25))
area('WarmFill',     (-3, -2, 3),  1000, 5, (1.0, 0.75, 0.40), (40, 0, -30))
area('OverheadWash', (0, 0, 5),     800, 8, (1.0, 0.92, 0.75), (0, 0, 0))
area('WarmRim',      (0, 4, 2),     800, 3, (1.0, 0.65, 0.30), (-40, 0, 180))
area('SideGlow',     (4, 0, 0.5),   600, 2, (1.0, 0.80, 0.50), (5, 0, 90))

if not scene.world:
    scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background')
if bg:
    bg.inputs['Color'].default_value = (0.95, 0.95, 0.95, 1)
    bg.inputs['Strength'].default_value = 0.3
'lights ok'
```

5. **Render and encode** — `common.md` step C with `SHOT = 'turntable'`.
