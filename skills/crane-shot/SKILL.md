---
name: crane-shot
description: Camera starts low and rises to reveal a 3D model from above in Blender, pulling back as it goes. Use when asked for a crane shot, a low-to-high move, or a dramatic reveal or unveiling.
---

# Crane shot

The camera starts low, looking up at the model, then rises and pulls back to show
it from above.

Read `common.md` in this skill's folder first (steps A, B, C).

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `duration` | `5` | Seconds |
| `fps` | `24` | Frames per second |
| `start` | `(1.0, -3.0, -0.2)` | Start position (× model scale, from center) — below center |
| `end` | `(1.5, -4.0, 3.5)` | End position — above, further back |
| `start_lens` / `end_lens` | `45` / `35` | Focal length in mm |

## Flow

1. **Frame the model** — `common.md` step A.

2. **Rig and animate.**

```python
import bpy
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z): return C + Vector((x, y, z)) * S

DURATION, FPS = 5, 24
START, END = (1.0, -3.0, -0.2), (1.5, -4.0, 3.5)
START_LENS, END_LENS = 45, 35
TOTAL = DURATION * FPS

bpy.ops.object.empty_add(type='PLAIN_AXES', location=C)
tgt = bpy.context.active_object; tgt.name = 'CraneTarget'
bpy.ops.object.camera_add(location=P(*START))
cam = bpy.context.active_object; cam.name = 'CraneCam'
trk = cam.constraints.new(type='TRACK_TO')
trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
scene.camera = cam

scene.frame_start, scene.frame_end, scene.render.fps = 1, TOTAL, FPS
cam.location = P(*START); cam.keyframe_insert(data_path='location', frame=1)
cam.data.lens = START_LENS; cam.data.keyframe_insert(data_path='lens', frame=1)
cam.location = P(*END); cam.keyframe_insert(data_path='location', frame=TOTAL)
cam.data.lens = END_LENS; cam.data.keyframe_insert(data_path='lens', frame=TOTAL)
# default BEZIER keys for a smooth crane move
'rig ok'
```

   If the model sits on a ground plane or pedestal, a start height below center
   can put the camera under the floor. Raise `START[2]` until the first frame is
   clear.

3. **Light it** — reuse the scene's lighting, or the five-light setup from the
   `turntable` skill.

4. **Render and encode** — `common.md` step C with `SHOT = 'crane_shot'`.
