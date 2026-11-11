---
name: dolly-rotate
description: Camera moves in while orbiting part way around a 3D model in Blender, for a sweeping reveal. Use when asked for a dolly, a sweeping shot, or "move and rotate" camera motion.
---

# Dolly + rotate

The camera dollies toward the model while orbiting around it — livelier than a
straight zoom or a plain turntable.

Read `common.md` in this skill's folder first (steps A, B, C).

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `duration` | `5` | Seconds |
| `fps` | `24` | Frames per second |
| `rotation_degrees` | `90` | Orbit during the move |
| `start` | `(2.5, -4.0, 2.0)` | Start position (× model scale, from center) |
| `end` | `(1.5, -2.5, 1.5)` | End position |
| `start_lens` / `end_lens` | `40` / `50` | Focal length in mm |

## Flow

1. **Frame the model** — `common.md` step A.

2. **Rig and animate.** The camera is parented to an empty at the model center:
   the empty turns, the camera moves in its local space.

```python
import bpy, math
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']

DURATION, FPS, ROTATION_DEGREES = 5, 24, 90
START, END = (2.5, -4.0, 2.0), (1.5, -2.5, 1.5)
START_LENS, END_LENS = 40, 50
TOTAL = DURATION * FPS

bpy.ops.object.empty_add(type='PLAIN_AXES', location=C)
tgt = bpy.context.active_object; tgt.name = 'DollyTarget'
bpy.ops.object.camera_add()
cam = bpy.context.active_object; cam.name = 'DollyCam'
cam.parent = tgt                       # local coordinates from here on
def L(x, y, z): return Vector((x, y, z)) * S
trk = cam.constraints.new(type='TRACK_TO')
trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
scene.camera = cam

scene.frame_start, scene.frame_end, scene.render.fps = 1, TOTAL, FPS
tgt.rotation_euler = (0, 0, 0); tgt.keyframe_insert(data_path='rotation_euler', frame=1)
cam.location = L(*START); cam.keyframe_insert(data_path='location', frame=1)
cam.data.lens = START_LENS; cam.data.keyframe_insert(data_path='lens', frame=1)

tgt.rotation_euler = (0, 0, math.radians(ROTATION_DEGREES))
tgt.keyframe_insert(data_path='rotation_euler', frame=TOTAL)
cam.location = L(*END); cam.keyframe_insert(data_path='location', frame=TOTAL)
cam.data.lens = END_LENS; cam.data.keyframe_insert(data_path='lens', frame=TOTAL)
# default BEZIER keys for a smooth cinematic feel
'rig ok'
```

3. **Light it** — reuse the scene's lighting, or the five-light setup from the
   `turntable` skill.

4. **Render and encode** — `common.md` step C with `SHOT = 'dolly_rotate'`.
