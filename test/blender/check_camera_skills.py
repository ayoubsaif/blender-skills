"""Runs the camera skills' Python blocks in headless Blender against a test model.

    blender -b --factory-startup --python test/blender/check_camera_skills.py

Not part of `npm test` (needs Blender). For each camera skill it builds an
off-center, scaled cube, runs common.md step A, then the skill's rig block, and
checks the camera tracks the model and the frame range and interpolation are set.
"""
import os, re, sys, math, tempfile, traceback
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SKILLS = ['turntable', 'perfect-loop', 'slow-zoom', 'dolly-rotate', 'crane-shot', 'dynamic-full-loop']
EXPECT_INTERP = {'turntable': 'LINEAR', 'perfect-loop': 'LINEAR', 'dynamic-full-loop': 'BEZIER'}


def blocks(path):
    with open(path, encoding='utf-8') as f:
        return re.findall(r'```python\n(.*?)```', f.read(), re.S)


def reset(center, size):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(location=center)
    cube = bpy.context.active_object
    cube.scale = (size, size, size)
    bpy.context.view_layer.update()
    return cube


def fcurves(obj):
    act = obj.animation_data.action if obj.animation_data else None
    if act is None:
        return []
    if hasattr(act, 'layers') and len(act.layers):
        return [fc for l in act.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]
    return list(act.fcurves)


failures = []
os.environ['BLENDER_SKILLS_OUTPUT'] = tempfile.mkdtemp(prefix='bs-out-')
step_a = blocks(os.path.join(ROOT, 'shared', 'camera-common.md'))[0]

for skill in SKILLS:
    try:
        center, size = Vector((3.0, -1.0, 2.0)), 2.5
        reset(center, size)
        exec(compile(step_a, 'step A', 'exec'), {})
        scene = bpy.context.scene
        got = Vector(scene['bs_center'])
        assert (got - center).length < 1e-4, f'center {got} != {center}'
        assert abs(scene['bs_scale'] - (Vector((2, 2, 2)) * size).length / 2) < 1e-4

        rig = [b for b in blocks(os.path.join(ROOT, 'skills', skill, 'SKILL.md')) if "'rig ok'" in b]
        assert len(rig) == 1, f'expected one rig block, found {len(rig)}'
        exec(compile(rig[0], f'{skill} rig', 'exec'), {})

        cam = scene.camera
        assert cam is not None and cam.type == 'CAMERA', 'no scene camera'
        assert scene.frame_end > scene.frame_start, 'frame range not set'
        S = scene['bs_scale']
        for frame in (scene.frame_start, (scene.frame_start + scene.frame_end) // 2, scene.frame_end):
            scene.frame_set(frame)
            pos = cam.matrix_world.translation
            dist = (pos - center).length
            assert 0.5 * S < dist < 8 * S, f'frame {frame}: camera {dist:.2f} from model (scale {S:.2f})'
            forward = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
            to_model = (center - pos).normalized()
            if skill != 'slow-zoom':      # slow-zoom may aim at a chosen detail
                assert forward.dot(to_model) > 0.99, f'frame {frame}: camera not aimed at model'

        if skill in EXPECT_INTERP:
            tgt = next(o for o in scene.objects if o.type == 'EMPTY' and o.animation_data)
            modes = {kp.interpolation for fc in fcurves(tgt) for kp in fc.keyframe_points}
            assert modes == {EXPECT_INTERP[skill]}, f'interpolation {modes}'
        if skill in ('turntable', 'perfect-loop'):
            scene.frame_set(scene.frame_start)
            a = cam.matrix_world.translation.copy()
            scene.frame_set(scene.frame_end + 1)
            b = cam.matrix_world.translation.copy()
            assert (a - b).length < 1e-3 * S, 'loop does not close'
        print(f'PASS {skill}')
    except Exception as e:                # report every skill, then fail at the end
        failures.append(skill)
        print(f'FAIL {skill}: {e!r}')
        traceback.print_exc(limit=3)

print(f'Blender {bpy.app.version_string}: {len(SKILLS) - len(failures)}/{len(SKILLS)} camera skills OK')
sys.exit(1 if failures else 0)
