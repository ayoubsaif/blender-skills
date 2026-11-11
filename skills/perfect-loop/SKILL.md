---
name: perfect-loop
description: Seamless looping 360-degree turntable of a 3D model in Blender where the last frame flows into the first. Use when asked for a looping, seamless, infinite or GIF-style spin for a website or social post.
---

# Perfect loop

A 360° turntable whose last frame leads straight into the first, for endless
playback.

Read `common.md` in this skill's folder first (steps A, B, C).

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `duration` | `5` | Seconds |
| `fps` | `24` | Frames per second |
| `distance` | `4.0` | Camera distance (× model scale) |
| `height` | `2.0` | Camera height (× model scale) |
| `lens` | `50` | Focal length in mm |

## Flow

1. **Frame the model** — `common.md` step A.

2. **Rig and animate.** The 360° key goes on frame `TOTAL + 1`, one past the last
   rendered frame, so frame `TOTAL` sits one step before frame 1 and no frame is
   shown twice.

```python
import bpy, math
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z): return C + Vector((x, y, z)) * S

DURATION, FPS, DISTANCE, HEIGHT, LENS = 5, 24, 4.0, 2.0, 50
TOTAL = DURATION * FPS

bpy.ops.object.empty_add(type='PLAIN_AXES', location=C)
tgt = bpy.context.active_object; tgt.name = 'PerfectLoopTarget'
bpy.ops.object.camera_add(location=P(0, -DISTANCE, HEIGHT))
cam = bpy.context.active_object; cam.name = 'PerfectLoopCam'
cam.data.lens = LENS
trk = cam.constraints.new(type='TRACK_TO')
trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
cam.parent = tgt
cam.matrix_parent_inverse = tgt.matrix_world.inverted()
scene.camera = cam

scene.frame_start, scene.frame_end, scene.render.fps = 1, TOTAL, FPS
tgt.rotation_euler = (0, 0, 0)
tgt.keyframe_insert(data_path='rotation_euler', frame=1)
tgt.rotation_euler = (0, 0, math.radians(360))
tgt.keyframe_insert(data_path='rotation_euler', frame=TOTAL + 1)

def set_interp(obj, mode):
    act = obj.animation_data.action if obj.animation_data else None
    if act is None: return
    if hasattr(act, 'layers') and len(act.layers):
        fcs = [fc for l in act.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]
    else:
        fcs = list(act.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points: kp.interpolation = mode
set_interp(tgt, 'LINEAR')
'rig ok'
```

3. **Light it** — reuse the scene's lighting, or the five-light setup from the
   `turntable` skill.

4. **Render and encode** — `common.md` step C with `SHOT = 'perfect_loop'`. For a
   GIF:

```bash
ffmpeg -y -framerate 24 -i "<frames>%04d.png" -vf "fps=24,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse" -loop 0 "<output>/perfect_loop.gif"
```

## Rules for a clean seam

- LINEAR interpolation only. BEZIER slows down at the ends and stutters at the seam.
- 360° key one frame past the render range.
- No keys on camera distance, height or lens.
- Play the result on repeat to check the seam.
