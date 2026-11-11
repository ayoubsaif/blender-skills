---
name: slow-zoom
description: Cinematic slow push-in toward a hero detail of a 3D model in Blender (logo, texture, feature), with a focal-length shift. Use when asked to zoom in, push in, do a close-up or a reveal shot.
---

# Slow zoom

The camera pushes in from a wide shot to a close-up on one detail while the lens
goes from wide to tight, for a light dolly-zoom feel.

Read `common.md` in this skill's folder first (steps A, B, C).

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `duration` | `5` | Seconds |
| `fps` | `24` | Frames per second |
| `start` | `(1.5, -4.0, 3.0)` | Start position (× model scale, from center) |
| `end` | `(0.3, -1.8, 1.2)` | End position |
| `start_lens` / `end_lens` | `35` / `65` | Focal length in mm |
| `focus` | model center | Point to push toward |

## Flow

1. **Frame the model** — `common.md` step A.

2. **Pick the focus point.** Ask the user which detail to zoom into. To aim at a
   specific spot, ask them to put the 3D cursor on it (or select a vertex) and read
   `bpy.context.scene.cursor.location`. Otherwise use the model center.

3. **Rig and animate.**

```python
import bpy
from mathutils import Vector
scene = bpy.context.scene
C = Vector(scene['bs_center']); S = scene['bs_scale']
def P(x, y, z): return C + Vector((x, y, z)) * S

DURATION, FPS = 5, 24
START, END = (1.5, -4.0, 3.0), (0.3, -1.8, 1.2)
START_LENS, END_LENS = 35, 65
FOCUS = C                              # or Vector(scene.cursor.location)
TOTAL = DURATION * FPS

bpy.ops.object.empty_add(type='PLAIN_AXES', location=FOCUS)
tgt = bpy.context.active_object; tgt.name = 'ZoomTarget'
bpy.ops.object.camera_add(location=P(*START))
cam = bpy.context.active_object; cam.name = 'SlowZoomCam'
trk = cam.constraints.new(type='TRACK_TO')
trk.target = tgt; trk.track_axis = 'TRACK_NEGATIVE_Z'; trk.up_axis = 'UP_Y'
scene.camera = cam

scene.frame_start, scene.frame_end, scene.render.fps = 1, TOTAL, FPS
cam.location = P(*START); cam.keyframe_insert(data_path='location', frame=1)
cam.data.lens = START_LENS; cam.data.keyframe_insert(data_path='lens', frame=1)
cam.location = P(*END); cam.keyframe_insert(data_path='location', frame=TOTAL)
cam.data.lens = END_LENS; cam.data.keyframe_insert(data_path='lens', frame=TOTAL)
# keep the default BEZIER keys for a smooth ease in and out
'rig ok'
```

4. **Light it** — reuse the scene's lighting, or the five-light setup from the
   `turntable` skill.

5. **Render and encode** — `common.md` step C with `SHOT = 'slow_zoom'`.

## Tips

- Don't switch to LINEAR here; the ease in/out is the point of the shot.
- The X offset on the start position gives a diagonal, more cinematic approach.
