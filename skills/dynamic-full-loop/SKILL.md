---
name: dynamic-full-loop
description: Speed-ramped camera loop around a 3D model in Blender — slow on each side, fast whips between, including top and bottom views. Use when asked for a full loop, speed ramp, dynamic spin or an every-angle hero video.
---

# Dynamic full loop

The camera orbits on two axes with speed ramping: it lingers on each side and
whips quickly between them, passing under the model on the way round.

Read `common.md` in this skill's folder first (steps A, B, C).

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `duration` | `10` | Seconds (the key timings below assume 240 frames) |
| `fps` | `24` | Frames per second |
| `distance` | `4.0` | Camera distance (× model scale) |
| `height` | `1.8` | Camera height (× model scale) |
| `lens` | `45` | Focal length in mm |

## Flow

1. **Frame the model** — `common.md` step A.

2. **Rig and animate.** Keys close together with a small turn = slow; keys far
   apart with a big turn = fast. Key frames are written for 240 frames and
   stretched to the chosen length.

```python
import bpy, math
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z): return C + Vector((x, y, z)) * S

DURATION, FPS, DISTANCE, HEIGHT, LENS = 10, 24, 4.0, 1.8, 45
TOTAL = DURATION * FPS
def F(f): return max(1, round(1 + (f - 1) * (TOTAL - 1) / 239))

bpy.ops.object.empty_add(type='PLAIN_AXES', location=C)
tgt = bpy.context.active_object; tgt.name = 'DynamicTarget'
bpy.ops.object.camera_add(location=P(0, -DISTANCE, HEIGHT))
cam = bpy.context.active_object; cam.name = 'DynamicCam'
cam.data.lens = LENS
trk = cam.constraints.new(type='TRACK_TO')
trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
cam.parent = tgt
cam.matrix_parent_inverse = tgt.matrix_world.inverted()
scene.camera = cam
scene.frame_start, scene.frame_end, scene.render.fps = 1, TOTAL, FPS

# horizontal orbit: slow on a face, fast whip to the next
kf_z = [(1, 0), (30, 10), (45, 90), (75, 100), (90, 180), (120, 190),
        (135, 270), (165, 280), (180, 330), (210, 340), (225, 355), (240, 360)]
# vertical tilt: level, a little over, then under the model and back
kf_x = [(1, 0), (30, 0), (75, 15), (120, 0), (135, -20), (165, -45),
        (180, -60), (210, -30), (240, 0)]

for f, d in kf_z:
    tgt.rotation_euler[2] = math.radians(d)
    tgt.keyframe_insert(data_path='rotation_euler', index=2, frame=F(f))
for f, d in kf_x:
    tgt.rotation_euler[0] = math.radians(d)
    tgt.keyframe_insert(data_path='rotation_euler', index=0, frame=F(f))

def set_interp(obj, mode):
    act = obj.animation_data.action if obj.animation_data else None
    if act is None: return
    if hasattr(act, 'layers') and len(act.layers):
        fcs = [fc for l in act.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]
    else:
        fcs = list(act.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = mode
            kp.easing = 'AUTO'
set_interp(tgt, 'BEZIER')
'rig ok'
```

3. **Light it** — reuse the scene's lighting, or the five-light setup from the
   `turntable` skill. Light from below too, or the under-view goes dark.

4. **Render and encode** — `common.md` step C with `SHOT = 'dynamic_full_loop'`.

## Notes

- The tilt passes under the model: remove any ground plane or pedestal first, or
  the camera goes through it.
- If Blender stalls on a heavy mesh, encode the frames that finished.
