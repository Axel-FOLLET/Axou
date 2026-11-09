"""Cat animation in headless Blender: builds every clip of public/models/cat.glb with the IK controllers of the source rig.

Poses are described by the absolute position (armature space) of the IK controllers; the rig's IK does the rest. A `Root`
bone added above all root bones carries the roll (side, back) and the global translation. Each pose is put back on the
ground automatically (lowest vertex of the evaluated mesh). Clips are baked bone by bone into the GLB (all bones,
controllers included).

Usage (Windows, Git Bash, from the Lost root; about 20 s per run):
  B="/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- preview <action> <frame>... [--views side,front,top,persp]
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- export public/models/cat.glb
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- info
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- calib
Diagnostic modes `scan`, `sweep`, `hump` and `carry` are described at the end of the file.
PNG previews go to .shots/blender/ (git-ignored); each render prints a MEASURE line (mesh-to-ground distance, foot height,
hip, shoulder) and HEADPITCH (muzzle, > 0 = down).

Armature frame: -Y = muzzle, +Y = tail, +Z = up, +X = cat's left. The cat is about 10 units long.

Pitfalls:
  - IK with chain_count = 0 (Spine, Spine.002, Spine.004) goes up to the root: with Root added the chain changed and the
    rest pose rose by 0.65 units; prep() freezes the length;
  - the neck IK (Neck.002 -> Head_controller, chain of 3) overrides the Copy Rotation of Neck.002: head orientation depends
    on the neck base -> controller direction and on the chain folding, not on the controller rotation. head_at() places
    the controller at distance 2.4 (neck nearly straight, length 2.46) with a calibrated 21.3° offset (`calib` mode).
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix, Quaternion, Euler

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, ".shots", "blender")
FPS = 24
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

arm = bpy.data.objects["Armature"]
cat = bpy.data.objects["Cat"]
scene = bpy.context.scene
scene.render.fps = FPS

# ------------------------------------------------------------------ rig preparation
def prep():
    for o in list(bpy.data.objects):
        if o.name not in {"Armature", "Cat", "Sphere", "Sphere.001", "Empty"}:
            bpy.data.objects.remove(o, do_unlink=True)
    for md in list(cat.modifiers):
        if md.type == "PARTICLE_SYSTEM":
            cat.modifiers.remove(md)
    arm.animation_data_clear()
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    root = eb.new("Root")
    root.head = (0, 0, 0)
    root.tail = (0, 1, 0)
    for b in eb:
        if b.parent is None and b.name != "Root":
            b.parent = root
            b.use_connect = False
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.matrix_basis = Matrix.Identity(4)
    # chain_count = 0 IKs reached the old root; with Root they would include it.
    # Freeze the original length (bone count up to the old root included).
    for pb in arm.pose.bones:
        for c in pb.constraints:
            if c.type == "IK" and c.chain_count == 0:
                n, b = 0, pb
                while b is not None and b.name != "Root":
                    n += 1
                    b = b.parent
                c.chain_count = n
                print(f"IKCHAIN {pb.name} -> {n}")
    # Hind legs: the foot IK (chain of 3: metatarsus, shin, thigh) overrides the hock IK (chain of 2) and folds the
    # leg when the hock must touch the ground (sitting: knee 2.5 units above the ground, above the hip, hock never
    # down). "IK1" only turns the metatarsus: thigh and shin then follow the hock target. The poses of this script use
    # IK1; the source walk and run, made for the 3-bone IK, keep "IK" (influences keyed in each action, see
    # ik_mode()).
    for n in ("Foot_Back_L", "Foot_Back_R"):
        pb = arm.pose.bones[n]
        old = pb.constraints["IK"]
        c = pb.constraints.new("IK")
        c.name = "IK1"
        c.target, c.subtarget = old.target, old.subtarget
        c.chain_count, c.iterations, c.use_tail = 1, old.iterations, old.use_tail
        c.influence = 0.0

prep()

def ik_mode(short, frame=1):
    """Chooses the hind foot IK for the active action and keys the influences (constant value)."""
    for n in ("Foot_Back_L", "Foot_Back_R"):
        cs = arm.pose.bones[n].constraints
        cs["IK"].influence, cs["IK1"].influence = (0.0, 1.0) if short else (1.0, 0.0)
        cs["IK"].keyframe_insert("influence", frame=frame)
        cs["IK1"].keyframe_insert("influence", frame=frame)

def use_action(act):
    """Active action (Blender 4.4+: without a slot, the action animates nothing)."""
    arm.animation_data_create()
    arm.animation_data.action = act
    if getattr(act, "slots", None) and arm.animation_data.action_slot is None:
        arm.animation_data.action_slot = act.slots[0]

# ------------------------------------------------------------------ "cute" reshape
# The source model is a realistic adult cat (fox muzzle, small eyes, big ears, thin legs). The rest mesh is deformed
# before any pose: the bones do not move, so the skin still follows the skeleton. Each deformation is smooth:
#   - ears scaled toward their base (by the ear bone weights), then stretched along their base-to-tip axis;
#   - legs thickened around their bones (by the leg bone weights);
#   - wider cheeks, larger skull, then a "magnifier" on each eye: eyeball and eyelid opening grow together (spatial
#     deformations, also applied to the eyeballs).
# The shape keys of the mesh receive the same deformation.
# EAR_SCALE: ear tips 1.49 eye-widths above the eyes, at the low end of the real range (1.46 to 1.73).
# EAR_STRETCH: lengthens the ears along their axis, which a uniform scale cannot do (height 0.63 against a target of
# 0.98).
EAR_SCALE, EAR_STRETCH = 0.85, 1.45
EAR_BONES = {"Ear", "Ear.001", "Ear.002", "Ear.006", "Ear.003", "Ear.004"}
LEG_THICK = {"Thigh_front_L": 1.12, "Thigh_front_R": 1.12, "Calf_Front_L": 1.3, "Calf_Front_R": 1.3,
             "Foot_front_L2": 1.25, "Foot_front_L2.002": 1.25, "Foot_front_L": 1.2, "Foot_front_R": 1.2,
             "Thigh_Back_L": 1.12, "Thigh_Back_R": 1.12, "Calf_back_L": 1.3, "Calf_back_R": 1.3,
             "Foot_Back_L": 1.25, "Foot_Back_R": 1.25, "Foot_Back_L2": 1.2, "Foot_Back_L2.002": 1.2}
CHEEK = 0.18                    # cheek widening (fraction)
# In front of plane y = MUZZLE_Y (units), MUZZLE shortens the muzzle and CHIN pulls back the lower face, below the
# mouth (z < ~2.4). Both at 0: the profile of the source model is kept.
MUZZLE_Y, MUZZLE, CHIN = -4.0, 0.0, 0.0
SKULL, HEAD_SCALE = Vector((0, -3.7, 3.0)), 1.12        # skull magnifier: centre (armature units) and factor
EYE_SCALE, EYE_R1, EYE_R2 = 1.45, 0.2, 0.65              # eye magnifier: factor, full radius and falloff radius (units)

def _smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def _magnify(p, c, k, r1, r2):
    """Magnifies by k around c up to r1, no effect beyond r2."""
    d = (p - c).length
    return c + (p - c) * (1 + (k - 1) * (1 - _smooth(r1, r2, d)))

def _perp(p, a, b):
    """Offset of p from segment [a, b], perpendicular to the bone."""
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return p - (a + ab * t)

def _head_shape(p):
    p = p.copy()
    p.x *= 1 + CHEEK * _smooth(-3.3, -3.9, p.y) * _smooth(1.9, 2.4, p.z)
    t = max(0.0, MUZZLE_Y - p.y)
    p.y += MUZZLE * t * t / (t + 0.3) + CHIN * t * _smooth(2.4, 2.0, p.z)
    return _magnify(p, SKULL, HEAD_SCALE, 0.7, 1.6)

def _real_weights(obj, v):
    """Normalised weights over the groups named after a bone (`Bone.0xx` groups are skipped)."""
    names = {g.index: g.name for g in obj.vertex_groups}
    w = {names[e.group]: e.weight for e in v.groups if names[e.group] in arm.data.bones and e.weight > 0}
    s = sum(w.values())
    return {k: x / s for k, x in w.items()} if s > 0 else {}

def reshape():
    bone = lambda n: (arm.matrix_world @ arm.data.bones[n].head_local, arm.matrix_world @ arm.data.bones[n].tail_local)
    ear_base = {1: bone("Ear")[0], -1: bone("Ear.006")[0]}
    ear_axis = {1: (bone("Ear.002")[1] - ear_base[1]).normalized(),
                -1: (bone("Ear.004")[1] - ear_base[-1]).normalized()}
    leg = {n: bone(n) for n in LEG_THICK}
    eyes = [bpy.data.objects[n] for n in ("Sphere", "Sphere.001")]
    centers = []
    for o in eyes:
        ws = [o.matrix_world @ v.co for v in o.data.vertices]
        centers.append(_head_shape(sum(ws, Vector()) / len(ws)))

    def warp(p, w):
        we = sum(w.get(n, 0) for n in EAR_BONES)
        if we:
            base = ear_base[1 if p.x > 0 else -1]
            p = base + (p - base) * (1 - (1 - EAR_SCALE) * we)
        for n, k in LEG_THICK.items():
            if w.get(n):
                p = p + _perp(p, *leg[n]) * (k - 1) * w[n]
        p = _head_shape(p)
        for c in centers:
            p = _magnify(p, c, EYE_SCALE, EYE_R1, EYE_R2)
        if we:
            side = 1 if p.x > 0 else -1
            ax = ear_axis[side]
            p = p + ax * ax.dot(p - ear_base[side]) * (EAR_STRETCH - 1) * we
        return p

    for o in [cat] + eyes:
        mw, mi = o.matrix_world, o.matrix_world.inverted()
        W = [_real_weights(o, v) for v in o.data.vertices]
        blocks = o.data.shape_keys.key_blocks if o.data.shape_keys else []
        for kb in blocks:
            for i, d in enumerate(kb.data):
                d.co = mi @ warp(mw @ d.co, W[i])
        for i, v in enumerate(o.data.vertices):
            v.co = mi @ warp(mw @ v.co, W[i])
        o.data.update()
    print("RESHAPE ok, eyes", [tuple(round(x, 3) for x in c) for c in centers])

if "--raw" not in ARGS:
    reshape()
REST ={b.name: (Vector(b.head_local), Vector(b.tail_local), b.matrix_local.copy()) for b in arm.data.bones}
CTRL = [b.name for b in arm.data.bones if b.parent and b.parent.name == "Root"]

def mesh_min_z():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = cat.evaluated_get(dg)
    m = ev.to_mesh()
    mw = ev.matrix_world
    z = min((mw @ v.co).z for v in m.vertices)
    ev.to_mesh_clear()
    return z

scene.frame_set(1)
bpy.context.view_layer.update()
G = mesh_min_z()  # ground level = lowest point of the mesh at rest

# ------------------------------------------------------------------ pose by points
def set_bone(name, pos=None, rot=None, aim=None, pre=None, off=Vector((0, 0, 0))):
    """Places a controller (direct child of Root) in armature space.
    pos: Vector; aim: wanted bone direction; rot: Euler degrees (X, Y, Z) applied next;
    pre: 3x3 Matrix applied last (global roll)."""
    pb = arm.pose.bones[name]
    head, tail, rest = REST[name]
    R = Matrix.Identity(4)
    if aim is not None:
        R = (tail - head).rotation_difference(Vector(aim)).to_matrix().to_4x4()
    if rot is not None:
        R = Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4() @ R
    if pre is not None:
        R = pre.to_4x4() @ R
    p = (Vector(pos) if pos is not None else head) + off
    pb.matrix = Matrix.Translation(p) @ R @ rest.to_3x3().to_4x4()

def set_root(pos=(0, 0, 0), rot=(0, 0, 0), quat=None, off=Vector((0, 0, 0))):
    pb = arm.pose.bones["Root"]
    pb.location = Vector(pos) + off
    pb.rotation_quaternion = quat if quat is not None else Euler([math.radians(a) for a in rot], "XYZ").to_quaternion()

def _apply(pose, off):
    set_root(off=off, **pose.get("Root", {}))
    bpy.context.view_layer.update()
    for name in CTRL:
        spec = pose.get(name)
        if spec is None:
            set_bone(name, off=off)
        else:
            set_bone(name, off=off, **spec)
    bpy.context.view_layer.update()

# Ears. "_ears" = (outward, backward, opening) in degrees, rotation of Ear / Ear.006 in the armature rest frame: tip
# outward (around Y), backward (around X), opening turned sideways (around Z). Both bones are keyed in ALL actions
# (zero rotation by default): an unkeyed bone would keep the value of the previous action at export (like the Pivot).
EAR_ROOTS = {"Ear": 1, "Ear.006": -1}

def set_ears(spec=None):
    out, back, opn = spec or (0, 0, 0)
    for n, s in EAR_ROOTS.items():
        Ra = (Matrix.Rotation(math.radians(s * out), 3, "Y") @ Matrix.Rotation(math.radians(-back), 3, "X")
              @ Matrix.Rotation(math.radians(s * opn), 3, "Z"))
        M = REST[n][2].to_3x3()
        arm.pose.bones[n].rotation_quaternion = (M.inverted() @ Ra @ M).to_quaternion()

# Jaw. The Mouth bone (child of Head, 157 weighted vertices) opens the lower jaw by a positive rotation around its
# local X. "_mouth" = opening in degrees. Keyed in ALL actions (like the ears), at its original rotation MOUTH_Q0 by
# default.
MOUTH_Q0 = arm.pose.bones["Mouth"].rotation_quaternion.copy()

def set_mouth(deg=0):
    q = MOUTH_Q0.copy()
    if deg:
        q = MOUTH_Q0 @ Quaternion((1, 0, 0), math.radians(deg))
    arm.pose.bones["Mouth"].rotation_quaternion = q

def apply_pose(pose, ground=True):
    """pose: dict name -> dict(pos=, rot=, aim=, pre=); 'Root' -> dict(pos=, rot=|quat=).
    With ground=True, everything is raised so that the mesh touches ground G."""
    set_ears(pose.get("_ears"))
    set_mouth(pose.get("_mouth", 0))
    _apply(pose, Vector((0, 0, 0)))
    off = 0.0
    # "_noground" (Carried kitten): no grounding, the pose stays where it is written.
    if ground and not pose.get("_noground"):
        for _ in range(3):
            dz = G - mesh_min_z()
            if abs(dz) < 0.01:
                break
            off += dz
            _apply(pose, Vector((0, 0, off)))
    # "_air" (Pounce, airborne phase): height added after grounding. Key ignored by _apply.
    if pose.get("_air"):
        _apply(pose, Vector((0, 0, off + pose["_air"])))

_LAST_Q = {}

def key_all(frame):
    for name in list(EAR_ROOTS) + ["Mouth"]:
        arm.pose.bones[name].keyframe_insert("rotation_quaternion", frame=frame)
    for name in CTRL + ["Root"]:
        pb = arm.pose.bones[name]
        # Quaternion sign continuity: `pb.matrix = …` canonicalises the sign (w >= 0), so between keys q and -q (same
        # rotation) the interpolation goes through zero and the mesh explodes on one frame. q and -q are equivalent:
        # pick the one in the same hemisphere as the previous key of the bone.
        q = pb.rotation_quaternion.copy()
        prev = _LAST_Q.get(name)
        if prev is not None and q.dot(prev) < 0:
            q.negate()
            pb.rotation_quaternion = q
        _LAST_Q[name] = q
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("rotation_quaternion", frame=frame)

# Clips whose keys start from the rest pose (see build_action), and clips with the Spine Pivot constraint off: with it
# on, the Pet and Carried meshes blow up to thousands of units within a second.
RESET_KEYS = {"Pet", "Sleep", "Carried"}
PIVOT_OFF = {"Pet", "Carried"}
def build_action(name, keys, interpolation="BEZIER"):
    """keys: list of (time_s, pose). Creates the action and makes it active.
    The rig has a dependency cycle (Pivot constraint of Spine toward its child Spine.001): evaluation keeps state from
    one evaluation to the next, and between distant keys the spine could explode. For RESET_KEYS, each key starts from
    the rest pose, which makes those poses stable (`scan --reset` mode)."""
    if name in bpy.data.actions:  # replaces the source action of the same name (Walk)
        bpy.data.actions.remove(bpy.data.actions[name])
    if name in LOOP_FRAMES:
        interpolation = "LINEAR"  # one key per frame: no flat tangent at the loop point
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    ik_mode(short=True)
    # Spine Pivot constraint (target: its child Spine.001, source of the cycle): off in PIVOT_OFF actions, keyed at 1
    # elsewhere (an unkeyed value would remain that of the previous action at export).
    piv = next(c for c in arm.pose.bones["Spine"].constraints if c.type == "PIVOT")
    piv.influence = float(os.environ.get("ANIM_PIVOT", "0" if name in PIVOT_OFF else "1"))
    piv.keyframe_insert("influence", frame=1)
    _LAST_Q.clear()
    for t, pose in keys:
        if name in RESET_KEYS:
            apply_pose(REST_POSE)
        apply_pose(pose)
        if os.environ.get("ANIM_KEYLOG"):
            print(f"KEY {name} t={t} f{round(t * FPS) + 1} min={mesh_min_z() - G:.2f} root={tuple(round(v, 2) for v in arm.pose.bones['Root'].location)}")
        key_all(round(t * FPS) + (0 if name in SEAMLESS else 1))
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = interpolation
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
    act.frame_range = (1, round(keys[-1][0] * FPS) + 1)
    if name in LOOP_FRAMES:
        # The export bakes one frame more than the range: for a seamless loop, the range ends one frame before the
        # last key.
        act.frame_range = (1, LOOP_FRAMES[name])
    if name in SEAMLESS:
        act.frame_range = (0, LOOP_FRAMES[name])
    return act

# Short seamless loops: glTF time = frame / 24, so a (1, N) range gives keys from 1/24 to N/24 s; three.js holds the
# first key from 0 to 1/24 s and jumps from last to first at the loop (a one-frame stop and jump per cycle). Here keys
# go from frame 0 to N (last = first): no stop. Walk, Stalk and Carried keep the (1, N) rule.
SEAMLESS = {"Trot", "run"}

# ------------------------------------------------------------------ vocabulary
V = Vector
def P(x, y, z): return V((x, y, z))

# Rest points (armature space)
S = REST["Thigh_front_L"][0]        # shoulder (origin of both front legs)
N = REST["Neck"][0]                 # base of the neck
M1 = REST["Spine_controller_1"][0]  # middle of the spine
M0 = REST["Spine"][0]               # back of the spine
H = REST["Hip"][0]                  # head of the Hip bone
HJ = REST["Hip"][1]                 # hip joint
HD = REST["Head_controller"][0]     # base of the head
T = REST["Tail_controller"][0]      # tail tip
FL, FR = REST["Foot_front_IK_L"][0], REST["Foot_front_IK_R"][0]
BL, BR = REST["Foot_Back_IK_L"][0], REST["Foot_Back_IK_R"][0]
WL, WR = REST["Knee_front_IK_L"][0], REST["Knee_front_IK_R"][0]   # wrists (front "knee" targets)
KL, KR = REST["Knee_back_IK_L"][0], REST["Knee_back_IK_R"][0]     # hocks
PAW = 0.27  # height of the IK target of a planted foot above the ground (measured at rest, units)
NECK_ELEV = math.degrees(math.atan2((HD - N).z, -(HD - N).y))  # about 38°: neck-to-head elevation at rest, muzzle horizontal

def head_at(N_, pitch=0, yaw=0, dist=2.4):
    """Head controller position: the neck IK (3 bones) overrides the copy rotation, so the head orientation follows
    the neck base -> controller direction. The chain is kept nearly straight (dist 2.4 of 2.46) to avoid zigzag
    folding. pitch > 0 = muzzle down, yaw > 0 = toward +X. Calibration (`calib` mode): real muzzle = input - 21.3° at
    dist 2.4,
    - 36.2° at dist 2.25, linear for input >= 0 (below that the IK folds the neck the other way: avoid)."""
    off = 21.3 + (2.4 - dist) * 99.3
    e = math.radians(NECK_ELEV - (pitch + off))
    y = math.radians(yaw)
    d = V((math.sin(y) * math.cos(e), -math.cos(y) * math.cos(e), math.sin(e)))
    return Vector(N_) + dist * d

def body(S_=S, N_=N, M1_=M1, M0_=M0, H_=H, HJ_=HJ, HD_=HD, head_rot=(0, 0, 0), T_=T, tail_aim=None):
    """Spine, neck, head and tail by points."""
    return {
        "Thigh_front_L": dict(pos=S_), "Thigh_front_R": dict(pos=S_),
        "Shoulder_front_L": dict(pos=N_, aim=S_ - N_),
        "Neck": dict(pos=N_, aim=HD_ - N_), "Spine_controller_2": dict(pos=N_),
        "Spine_controller_1": dict(pos=M1_),
        "Spine": dict(pos=M0_, aim=H_ - M0_),
        "Hip": dict(pos=H_, aim=HJ_ - H_), "Tail": dict(pos=H_, aim=(tail_aim if tail_aim is not None else HJ_ - H_)),
        "Head_controller": dict(pos=HD_, rot=head_rot),
        "Tail_controller": dict(pos=T_),
    }

def legs(fl=FL, fr=FR, bl=BL, br=BR, wl=None, wr=None, kl=None, kr=None, faim=None, baim=None, fl_aim=None, fr_aim=None):
    """Legs: foot positions (IK targets) and wrists/hocks (default: rest offset)."""
    return {
        "Foot_front_IK_L": dict(pos=fl, aim=fl_aim or faim), "Foot_front_IK_R": dict(pos=fr, aim=fr_aim or faim),
        "Foot_Back_IK_L": dict(pos=bl, aim=baim), "Foot_Back_IK_R": dict(pos=br, aim=baim),
        "Knee_front_IK_L": dict(pos=wl if wl is not None else fl + (WL - FL)),
        "Knee_front_IK_R": dict(pos=wr if wr is not None else fr + (WR - FR)),
        "Knee_back_IK_L": dict(pos=kl if kl is not None else bl + (KL - BL)),
        "Knee_back_IK_R": dict(pos=kr if kr is not None else br + (KR - BR)),
    }

def pose(*parts, root=None):
    p = {}
    for part in parts:
        p.update(part)
    if root:
        p["Root"] = root
    return p

def rolled(p, deg, pivot, axis="Y"):
    """Copy of the pose rotated by deg° around the Y axis (along the body) through pivot.
    axis="X": pitch (deg < 0: muzzle up), used by Jump and JumpDown."""
    M = Matrix.Rotation(math.radians(deg), 3, axis)
    pv = Vector(pivot)
    out = {}
    for name, spec in p.items():
        if name == "Root":
            continue
        s = dict(spec)
        base = Vector(s["pos"]) if s.get("pos") is not None else REST[name][0]
        s["pos"] = pv + M @ (base - pv)
        if s.get("aim") is not None:
            s["aim"] = M @ Vector(s["aim"])
        s["pre"] = M @ s["pre"] if s.get("pre") is not None else M
        out[name] = s
    out["Root"] = dict(pos=pv - M @ pv, quat=M.to_quaternion())
    return out

# Twisting roll. rolled() turns everything as one block (a log); here the front (shoulders, front legs), the head and
# the rear (pelvis, hind legs, tail) each have their own angle, and the middle of the spine and Root take the average.
# The head leads, as on a real cat.
FRONT_CTRL = {"Neck", "Spine_controller_2", "Shoulder_front_L", "Thigh_front_L", "Thigh_front_R",
              "Foot_front_IK_L", "Foot_front_IK_R", "Knee_front_IK_L", "Knee_front_IK_R"}
# "Spine" (parentless root of the stretchable spine IKs) rolls with the pelvis: at the average angle, the spine
# explodes from frame to frame during a hold.
REAR_CTRL = {"Hip", "Tail", "Tail_controller", "Foot_Back_IK_L", "Foot_Back_IK_R",
             "Knee_back_IK_L", "Knee_back_IK_R", "Spine"}

def twisted(p, front, rear, head=None, pivot=None):
    """Like rolled(), with one angle per body part (degrees around Y)."""
    pivot = pivot or PIVOT
    mid = (front + rear) / 2
    out = {}
    for name in p:
        if name == "Root":
            continue
        deg = (head if head is not None else front) if name == "Head_controller" else \
              front if name in FRONT_CTRL else rear if name in REAR_CTRL else mid
        out[name] = rolled({name: p[name]}, deg, pivot)[name]
    out["Root"] = rolled({}, mid, pivot)["Root"]
    return out

def pole(root, foot, rest_root, rest_foot, rest_pole, out=0.0):
    """Elbow/hock target: the rest offset (target - root-foot midpoint), turned in the Y-Z plane like the leg.
    The target stays on the same side of the leg as at rest: the IK never bends the joint backwards."""
    d0, d1 = rest_foot - rest_root, foot - root
    a = math.atan2(d1.z, d1.y) - math.atan2(d0.z, d0.y)
    o = rest_pole - (rest_root + rest_foot) / 2
    c, s = math.cos(a), math.sin(a)
    m = (root + foot) / 2
    return P(foot.x + out * (1 if foot.x >= 0 else -1), m.y + c * o.y - s * o.z, m.z + s * o.y + c * o.z)

g = G
REST_POSE = pose(body(), legs())

# --- Sit: rump on the ground, leaning torso, vertical front legs (as at rest), folded hind legs, tail on the ground.
# The trunk is the rest trunk tilted as a block by SIT_TILT° around the shoulder: the shoulder does not move, the hip
# goes down. 28°: the rump touches the ground at the same time as the four feet. Hock just behind the hip, metatarsus
# flat forward (length 1.87), knee in front and low.
SIT_TILT = 28
def _tilt(p, deg=SIT_TILT, pivot=S, dz=0.0):
    """Rest point turned by deg° (rump down) around the X axis through pivot."""
    return pivot + Matrix.Rotation(math.radians(-deg), 3, "X") @ (Vector(p) - pivot) + V((0, 0, dz))
# Straight sitting spine, the back forming a regular convex arc. Middle lowered (M0 -0.2, M1 -0.3) and pelvis raised
# by 0.3 (H and HJ) to reduce the back hump in the GLB; rump and feet stay on the ground.
SIT_BODY = dict(HJ_=_tilt(HJ, dz=0.3), H_=_tilt(H, dz=0.3), M0_=_tilt(M0, dz=-0.2), M1_=_tilt(M1, dz=-0.3),
                N_=_tilt(N, dz=0.95), S_=S.copy())  # raised neck: head above the shoulders
SIT_N = SIT_BODY["N_"]
_hock = SIT_BODY["HJ_"].y + 0.25
SIT_HIND = dict(bl=P(0.8, _hock - 1.85, g + PAW), br=P(-0.8, _hock - 1.85, g + PAW), baim=(0, -1, 0.05),
                kl=P(0.8, _hock, g + 0.5), kr=P(-0.8, _hock, g + 0.5))
SIT = pose(
    body(**SIT_BODY, HD_=head_at(SIT_N, pitch=4), T_=P(1.6, 1.6, g + 0.3)),
    legs(**SIT_HIND),
)
# Pet keeps its own sitting body (only dz of H, HJ, M0 and M1 differ; SIT_HIND depends only on HJ_.y).
_PET_SIT_BODY = dict(SIT_BODY, HJ_=_tilt(HJ), H_=_tilt(H), M0_=_tilt(M0, dz=0.15), M1_=_tilt(M1, dz=0.1))

# Yawn: sitting yawn, starts from SIT and returns to it. Only the head (raised: negative head_at input, muzzle = input
# within 1° from -20 to 60°), the jaw ("_mouth", see set_mouth) and the ears (slightly back) change. Angles by eye on
# previews.
def yawn_pose(mouth, pitch, dist, ears=None):
    p = pose(body(**SIT_BODY, HD_=head_at(SIT_N, pitch=pitch, dist=dist), T_=P(1.6, 1.6, g + 0.3)), legs(**SIT_HIND))
    p["_mouth"] = mouth
    if ears:
        p["_ears"] = ears
    return p
YAWN_START = yawn_pose(12, -4, 2.4, ears=(0, 8, 0))
YAWN_WIDE = yawn_pose(45, -12, 2.4, ears=(0, 18, 0))
YAWN_END = yawn_pose(5, 2, 2.4, ears=(0, 5, 0))

# SitNpc: adult sit reserved for NPCs; SIT and Sit remain the kitten's. From reference photos: round rump on the
# ground, convex back with no dip before the rump, thighs raised against the flank, nearly vertical front legs. The
# back follows an arc from the shoulder: each rest segment (S-M1, M1-M0, M0-H, H-HJ), shortened by SITNPC_SCALE
# (compressed body: the spine IKs are stretchable), goes down by SITNPC_ARC degrees below the horizontal toward the
# rear, then each point is lowered by SITNPC_DZ. Neck, shoulder and head: those of SIT (NPC hats). Tail aimed relative
# to HJ_ and above the ground (otherwise grounding raises Root).
# Known limit: a gap under the belly just behind the front legs (27 % of the height); filling it lowered the head or
# pulled back the front legs.
SITNPC_ARC = (15, 32, 50, 70)  # degrees below horizontal of the four back segments
SITNPC_SCALE = 0.8  # shortening of those segments (factor)
SITNPC_DZ = dict(M1_=-0.3, M0_=-0.1, H_=-0.5, HJ_=-0.5)  # extra lowering (units)
SITNPC_HOCK = (1.2, -0.9, 0.45)  # hock from HJ_: x, y offset, height (units)
SITNPC_FOOT = 1.8  # flat foot forward of the hock (units)
SITNPC_FRONT = (0.59, -2.3)  # front feet: x, y (units)
SITNPC_TAIL = (2.0, 3.0, 0.4)  # tail tip: x, y past HJ_, height above the ground (units)
def _sitnpc_body(arc=SITNPC_ARC, dz=SITNPC_DZ):
    b, cur, rest = dict(SIT_BODY), S.copy(), [S, M1, M0, H, HJ]
    for i, (k, a) in enumerate(zip(("M1_", "M0_", "H_", "HJ_"), arc)):
        L = (rest[i + 1] - rest[i]).length * SITNPC_SCALE
        cur = cur + V((0, L * math.cos(math.radians(a)), -L * math.sin(math.radians(a))))
        b[k] = cur + V((0, 0, dz[k]))
    return b
SITNPC_BODY = _sitnpc_body()
def _sitnpc_pose(b=SITNPC_BODY, hock=SITNPC_HOCK):
    hj, (hx, hdy, hz), (fx, fy) = b["HJ_"], hock, SITNPC_FRONT
    tail = P(SITNPC_TAIL[0], hj.y + SITNPC_TAIL[1], g + SITNPC_TAIL[2])
    return pose(
        body(**b, HD_=head_at(SIT_N, pitch=4), T_=tail),
        legs(bl=P(hx, hj.y + hdy - SITNPC_FOOT, g + PAW), br=P(-hx, hj.y + hdy - SITNPC_FOOT, g + PAW),
             baim=(0, -1, 0.05), kl=P(hx, hj.y + hdy, g + hz), kr=P(-hx, hj.y + hdy, g + hz),
             fl=P(fx, fy, g + PAW), fr=P(-fx, fy, g + PAW)),
    )
# SIT_NPC stays the base of Defeat and BRUSH_LAYER_SIT, whose GLB output must not change; only SitNpc uses SIT_NPC_V2
# below.
SIT_NPC = _sitnpc_pose()

# SitNpc v2: same construction as SIT_NPC with three changed settings (neck, shoulder, head, front legs, tail: as
# SIT_NPC, head always straight), chosen on previews (side, front, back) against reference photos.
# - SITNPC_V2_HOCK: hock 1.6 to the side and under the hip, 0.5 above the ground: the leg folds fully under the thigh,
#   only the toes show, and the thighs stand away from the chest (pear silhouette from front and back).
# - SITNPC_V2_ARC: slightly tighter back arc (degrees): rump gathered under the body. Tighter (20, 38, 56, 74 or
#   more), the stretchable spine tears.
# - SITNPC_V2_DZ: middle of the back lowered by 0.55 units: less withers hump, a single convex arc down to the rump.
SITNPC_V2_ARC = (16, 34, 53, 72)
SITNPC_V2_DZ = dict(SITNPC_DZ, M1_=-0.55)
SITNPC_V2_HOCK = (1.6, 0.0, 0.5)
SIT_NPC_V2 = _sitnpc_pose(_sitnpc_body(SITNPC_V2_ARC, SITNPC_V2_DZ), SITNPC_V2_HOCK)

# --- Sphinx: belly on the ground, front legs stretched, rear folded.
LIE_N = P(0, -1.4, g + 2.9)
# Without LIE_DY the M1_ -> M0_ spine length is 1.30 units against 1.63 at rest: the compressed IK chain
# Spine.001-Spine.004 folds in a zigzag and makes a camel hump. The whole rear (M0_, hip, hind legs, tail) moves back
# by LIE_DY.
LIE_DY = 0.35
LIE = pose(
    body(HJ_=P(0, 3.0 + LIE_DY, g + 1.5), H_=P(0, 2.2 + LIE_DY, g + 2.2), M0_=P(0, 1.1 + LIE_DY, g + 2.45),
         M1_=P(0, -0.2, g + 2.5), N_=LIE_N, S_=P(0, -2.3, g + 1.8), HD_=head_at(LIE_N, pitch=8),
         T_=P(1.2, 5.8 + LIE_DY, g + 0.3)),
    # Front legs folded under the chest.
    legs(fl=P(0.65, -3.5, g + PAW), fr=P(-0.65, -3.5, g + PAW), faim=(0, -1, -0.1),
         wl=P(0.75, -2.8, g + 0.45), wr=P(-0.75, -2.8, g + 0.45),
         bl=P(0.95, 1.5 + LIE_DY, g + PAW), br=P(-0.95, 1.5 + LIE_DY, g + PAW), baim=(0, -1, 0.05),
         kl=P(0.95, 3.3 + LIE_DY, g + 0.6), kr=P(-0.95, 3.3 + LIE_DY, g + 0.6)),
)
# Settling after the sphinx: a hind leg slides to the side (0.7 x offset, by eye).
LIE_SETTLE = pose(LIE, {
    "Foot_Back_IK_L": dict(pos=P(1.65, 1.6 + LIE_DY, g + PAW), aim=(0, -1, 0.05)),
    "Knee_back_IK_L": dict(pos=P(1.55, 3.3 + LIE_DY, g + 0.6)),
})

# --- Tucked body (legs folded without support): base of the poses on the side and on the back.
# +90° roll around Y: the +X side (cat's left) goes toward the ground, the belly (z < ZC) toward -X.
ZC = g + 2.6  # spine axis, roll pivot
TUCK_N = P(0, -1.2, ZC)
# The spine would otherwise be too short (zigzag, S-shaped torso from above): the rear moves back by TUCK_DY, like
# LIE_DY.
TUCK_DY = 0.4
TUCK_BODY = dict(HJ_=P(0, 3.2 + TUCK_DY, g + 2.1), H_=P(0, 2.3 + TUCK_DY, ZC), M0_=P(0, 1.2 + TUCK_DY, ZC + 0.1),
                 M1_=P(0, 0.0, ZC + 0.1), N_=TUCK_N, S_=P(0, -2.1, g + 2.0))
TUCK_LEGS = dict(fl=P(0.7, -3.0, g + 1.1), fr=P(-0.7, -3.0, g + 1.1), faim=(0, -0.6, -0.8),
                 wl=P(0.8, -2.6, g + 1.7), wr=P(-0.8, -2.6, g + 1.7),
                 bl=P(0.8, 1.9 + TUCK_DY, g + 0.9), br=P(-0.8, 1.9 + TUCK_DY, g + 0.9), baim=(0, -0.8, -0.6),
                 kl=P(0.8, 3.2 + TUCK_DY, g + 1.0), kr=P(-0.8, 3.2 + TUCK_DY, g + 1.0))
TUCK = pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=10), T_=P(0.6, 6.3 + TUCK_DY, g + 1.2)), legs(**TUCK_LEGS))
PIVOT = (0, 0.5, ZC)
SIDE = rolled(TUCK, 90, PIVOT)      # on the side, head resting
# On the back: head upside down, chin up, slightly raised (negative pitch in the standing frame).
BACK_YAW = -30  # degrees: head resting on the cheek (0: upside down, ears stuck in the ground)
# Legs on the back, before the 180° roll (lower z = higher after): front legs folded at the wrists, limp, falling
# toward the chest; hind legs stretched toward the tail, spread, knees out. Targets computed by pole() so that joints
# never bend backwards. On the back, shoulders at BACK_FRONT°, pelvis at BACK_REAR°: hips stay slightly on the side.
# Values by eye.
BACK_FRONT, BACK_REAR = 175, 155
_S_T, _HJ_T = TUCK_BODY["S_"], TUCK_BODY["HJ_"]
_HJ_R = REST["Hip"][1]

def _legs_back(fl, bl):
    """Left feet fl (front) and bl (rear); right side mirrored; targets by pole()."""
    fr, br = P(-fl.x, fl.y, fl.z), P(-bl.x, bl.y, bl.z)
    return dict(fl=fl, fr=fr, bl=bl, br=br, faim=(0, 0.4, 0.9), baim=(0.2, 0.8, -0.5),
                wl=pole(_S_T, fl, S, FL, WL), wr=pole(_S_T, fr, S, FR, WR),
                kl=pole(_HJ_T, bl, _HJ_R, BL, KL, 0.4), kr=pole(_HJ_T, br, _HJ_R, BR, KR, 0.4))

# front legs folded on the chest, wrists bent; hind legs stretched toward the tail, spread
BACK_LEGS = _legs_back(P(0.8, -2.7, g + 1.0), P(1.5, 5.6, g + 0.6))


# Roll transitions: between two keys, the Root position is interpolated in a straight line while its rotation follows
# the arc, so the body dips under the ground. Two intermediate keys, at 45° (lying -> side) and 135° (side -> back),
# reduce the dip.
# Twisting roll for Pet: head first, then shoulders, pelvis last. Angles by eye. Legs go from TUCK_LEGS to BACK_LEGS
# between side and back.
_TUCK_LEGS_P = _legs_back(TUCK_LEGS["fl"], TUCK_LEGS["bl"])
_TUCK_LEGS_P.update(faim=TUCK_LEGS["faim"], baim=TUCK_LEGS["baim"])
# At mid-roll, feet halfway and targets recomputed by pole(): averaged, they crossed the leg.
_HALF_LEGS = _legs_back((V(TUCK_LEGS["fl"]) + BACK_LEGS["fl"]) / 2, (V(TUCK_LEGS["bl"]) + BACK_LEGS["bl"]) / 2)

# --- Pet on the back: poses written before the roll in the TUCK frame, then turned by twisted(). Elbows and hocks
# always by pole().
def _legs_pet(fl, fr, bl, br, faim=(0, 0.4, 0.9), baim=(0.2, 0.8, -0.5), kr_out=0.4):
    """Legs without mirroring (asymmetry); elbow and hock targets by pole()."""
    return dict(fl=fl, fr=fr, bl=bl, br=br, faim=faim, baim=baim,
                wl=pole(_S_T, fl, S, FL, WL), wr=pole(_S_T, fr, S, FR, WR),
                kl=pole(_HJ_T, bl, _HJ_R, BL, KL, 0.4), kr=pole(_HJ_T, br, _HJ_R, BR, KR, kr_out))

_BACK_FR0 = P(-BACK_LEGS["fl"].x, BACK_LEGS["fl"].y, BACK_LEGS["fl"].z)  # = BACK_LEGS["fr"]
PET_BACK_LEGS = _legs_pet(
    BACK_LEGS["fl"] + V((-0.2, -0.3, 0.3)),   # front leg on the ground side, near the chest
    _BACK_FR0 + V((0.1, 0.1, 0.4)),           # upper front leg, folded tighter
    P(2.3, 5.2, g + 1.8),                     # lower hind leg, on the ground behind the pelvis
    P(1.5, 4.9, g + 1.6))                     # upper hind leg, stacked over it (x > 0)

def _pet_back_body(phase=0.0, head_pitch=20, head_yaw=BACK_YAW, legs_=None):
    """Tucked body of TUCK_BODY, head on the cheek, sweeping tail."""
    return pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=head_pitch, yaw=head_yaw),
                     T_=P(0.6 + 0.4 * math.sin(phase), 6.3, g + 1.2)),
                legs(**(legs_ or PET_BACK_LEGS)))


# Shoulder roll on the back (degrees): lowered to 120 to keep the mesh from tearing.

_PET_TUCK_LEGS = dict(_TUCK_LEGS_P)  # legs of _TUCK_LEGS_P for HEAD1 and HEAD2
_PET_UP_LEGS = _legs_pet(TUCK_LEGS["fl"], TUCK_LEGS["fr"],                           # front legs folded under the chest
                         _HALF_LEGS["bl"], _HALF_LEGS["br"],                           # hind legs from _HALF_LEGS
                         faim=TUCK_LEGS["faim"], baim=_HALF_LEGS["baim"])

# In-between key (by eye): between PET_UP_FRONT and LIE the mesh dipped 0.50 units under the ground.
# (PET_HEAD1 … PET_UP_MID are not used by the Pet clip; the `scan` mode uses _pet_back_body and _PET_UP_LEGS.)

# --- Flank poses. The cat lies on its SIDE only, like Sleep (SLEEP_HEAD / SLEEP_ROLL / SIDE, stable poses): roll
# FLANK_FRONT / FLANK_REAR below 90°, resting on shoulder and hip. Front legs folded, head raised and tilted (head
# roll FLANK_HEAD well below the body's: face turned up), hind legs stretched toward the tail, one over the other,
# tail brought toward the belly. Frame before roll = TUCK's (roll +θ around Y: x before roll becomes height, z becomes
# horizontal); everything is multiplied by PET_SIDE. Values by eye on previews: head roll 12 ± 8°, yaw ± 9°, chin 2°
# to 10°.
FLANK_FRONT, FLANK_REAR, FLANK_HEAD = 80, 76, 12
# PET_SIDE = -1: roll side that shows the belly, paws and face to the default camera (lower legs on the -X side, the
# right one below). Sleep keeps its own side.
PET_SIDE = -1
def _px(x):
    return PET_SIDE * x
FLANK_LEGS = _legs_pet(
    P(_px(0.35), -3.0, g + 1.35),     # upper front (left): folded, slightly back
    P(_px(0.95), -3.2, g + 1.0),      # lower front (right): folded under the chin
    P(_px(0.6), 4.8 + TUCK_DY, g + 1.3),   # upper hind (left): stacked
    P(_px(1.2), 5.0 + TUCK_DY, g + 1.0),   # lower hind (right): stretched toward the tail
    faim=(0, -0.6, -0.8), baim=(_px(0.1), 0.8, -0.55))

def flank_body(rub=0.0, sway=0.0, legs_=None):
    """Tucked body of TUCK_BODY, FLANK_LEGS legs. rub -1..1: head rubbing (yaw ± 9°; chin from 2° to 10°, raised when
    rub > 0); sway -1..1: swaying tail tip, brought toward the belly."""
    return pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=6 - 4 * rub, yaw=_px(-9 * rub)),
                     T_=P(_px(1.0), 5.4 + TUCK_DY, g + 0.7 + 0.5 * sway)),
                legs(**(legs_ or FLANK_LEGS)))


# The head leads, cheek toward the ground; legs still folded (TUCK_LEGS, like SLEEP_HEAD) and TUCK chin (pitch 10):
# otherwise the mesh dips under the ground. Head roll kept to 12-15° so that the head stays straight.
# The shoulder lands, legs still folded: they stretch only once the body is nearly on its side (PET_FLANK), otherwise
# the mesh dips 0.84 units under the ground.


# Mid-roll key raised by 0.2: the mesh went 0.22 units under the ground between PET_CHEEK and PET_SHOULDER_DOWN.

# Relaxed ears during petting (outward, backward, opening sideways; degrees; see EAR_ROOTS). k: fraction, to enter and
# leave smoothly. Ears spread to the sides, with no backward tilt or pinna rotation: other settings read as a horn
# from the game camera.
PET_EARS = (30, 0, 0)
def _relaxed(p, k=1.0):
    return dict(p, _ears=tuple(k * a for a in PET_EARS))

# --- Current Pet clip. The poses above (PET_CHEEK, PET_HALF_ROLL, PET_SHOULDER_DOWN, PET_FLANK, pet_flank,
# PET_RISE_HEAD, PET_RISE) are not used by it. Crouch between rest and LIE: body, legs and tail blended by k (0 =
# standing, 1 = LIE).
def _mixp(a, b, k):
    return a + (V(b) - a) * k
_LIE_B = dict(HJ_=P(0, 3.0 + LIE_DY, g + 1.5), H_=P(0, 2.2 + LIE_DY, g + 2.2), M0_=P(0, 1.1 + LIE_DY, g + 2.45),
              M1_=P(0, -0.2, g + 2.5), N_=LIE_N, S_=P(0, -2.3, g + 1.8))
_REST_B = dict(HJ_=HJ, H_=H, M0_=M0, M1_=M1, N_=N, S_=S)
_LEG_KEYS = (("fl", "Foot_front_IK_L", FL), ("fr", "Foot_front_IK_R", FR), ("bl", "Foot_Back_IK_L", BL),
             ("br", "Foot_Back_IK_R", BR), ("wl", "Knee_front_IK_L", WL), ("wr", "Knee_front_IK_R", WR),
             ("kl", "Knee_back_IK_L", KL), ("kr", "Knee_back_IK_R", KR))

def _spine_at(out, p, deg):
    """`Spine` turned to the shoulder angle (not the pelvis one, see REAR_CTRL): otherwise the roll of the pelvis (Hip
    bone) exceeds that of the shoulders, which must go first. Only on roll keys."""
    out["Spine"] = rolled({"Spine": p["Spine"]}, _px(deg), PIVOT)["Spine"]
    return out

def pet_crouch(k, head_pitch, front=0, rear=0, head_roll=0, ears=0.5, tail_k=None):
    b = {key: _mixp(_REST_B[key], _LIE_B[key], k) for key in _REST_B}
    lg = {key: _mixp(V(d), V(LIE[c]["pos"]), k) for key, c, d in _LEG_KEYS}
    p = pose(body(**b, HD_=head_at(b["N_"], pitch=head_pitch),
                  T_=_mixp(T, LIE["Tail_controller"]["pos"], k if tail_k is None else tail_k)), legs(**lg))
    if front or rear or head_roll:
        p = _spine_at(twisted(p, _px(front), _px(rear), head=_px(head_roll)), p, front)
    return _relaxed(p, ears)

# Front legs stretched forward on the ground during the roll (no paw at muzzle level), then folded at the wrists once
# the head is down (PET_FOLD_LEGS, from 1.5 s).
PET_REACH_LEGS = _legs_pet(
    P(_px(0.45), -3.1, g + 0.6), P(_px(0.95), -2.9, g + 0.35),
    FLANK_LEGS["bl"], FLANK_LEGS["br"], faim=(0, -1, -0.1), baim=FLANK_LEGS["baim"])
PET_FOLD_LEGS = _legs_pet(
    P(_px(0.35), -2.6, g + 1.2), P(_px(0.95), -2.8, g + 0.9),
    FLANK_LEGS["bl"], FLANK_LEGS["br"], faim=(0, -0.6, -0.8), baim=FLANK_LEGS["baim"])

def pet_pose(front, rear, head_roll, head_pitch, head_yaw=0, legs_=None, tail_sway=0.0, ears=1.0, spine=None):
    """Tucked body (TUCK_BODY) rolled: shoulders front, pelvis rear, head head_roll (degrees); head_pitch < 0 raises
    the chin (head_at)."""
    p = pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=head_pitch, yaw=_px(head_yaw)),
                  T_=P(_px(1.0), 5.4 + TUCK_DY, g + 0.7 + 0.5 * tail_sway)),
             legs(**(legs_ or PET_FOLD_LEGS)))
    out = twisted(p, _px(front), _px(rear), head=_px(head_roll))
    if spine is not None:
        out = _spine_at(out, p, spine)
    return _relaxed(out, ears)

# Descent: the head lowers first (0-0.45 s), the body crouches, then falls on its side shoulders first (0.6-1.0 s).
# CROUCH2 and RISE_CROUCH0: in-between keys that keep the mesh from dipping under the ground.
PET_HEAD_DOWN = _relaxed(pose(body(HD_=head_at(N, pitch=16)), legs()), 0.2)
PET_HEAD_DOWN2 = _relaxed(pose(body(HD_=head_at(N, pitch=24)), legs()), 0.4)
PET_CROUCH = pet_crouch(0.55, 24, front=12, rear=0, head_roll=12)
PET_CROUCH2 = pet_crouch(0.85, 26, front=18, rear=3, head_roll=18, ears=0.6)
PET_DROP = pet_pose(25, 5, 22, 26, legs_=PET_REACH_LEGS, ears=0.6, spine=25)
PET_SHOULDER_DOWN2 = pet_pose(60, 30, 35, 18, legs_=PET_REACH_LEGS, ears=0.9, spine=60)
PET_LAID = pet_pose(80, 76, 30, 10, legs_=PET_REACH_LEGS)
PET_FOLDED = pet_pose(80, 76, 22, -8)
# Hold: raised head, three held poses, changes of 0.25 to 0.375 s between them. PET_UP0 is the pose at 3.0 s (Brain.js
# puts the clip back at 3.0 s on click).
PET_UP0 = pet_pose(80, 76, 12, -24)
PET_UP1 = pet_pose(80, 76, 25, -30, head_yaw=-20, tail_sway=0.4)
PET_UP2 = pet_pose(80, 76, 0, -22, head_yaw=15, tail_sway=-0.3)
# Getting up: the head rises first (7.0-7.2 s), then the front of the body, with no stop in sphinx.
PET_RISE_HEAD2 = pet_pose(77, 75, 0, -40, legs_=PET_REACH_LEGS, ears=0.5)
PET_RISE_FRONT = pet_pose(35, 60, 0, -52, legs_=PET_REACH_LEGS, ears=0.2)
PET_RISE_CROUCH0 = pet_crouch(0.9, -20, front=28, rear=42, head_roll=0, ears=0.1, tail_k=0.5)
PET_RISE_CROUCH = pet_crouch(0.6, -5, front=5, rear=10, head_roll=0, ears=0, tail_k=0.15)

# --- Sleep: same head-first transition as Pet, up to the side only (SIDE = TUCK rolled by 90°). Two in-between keys
# replace the block roll LIE_SETTLE -> SIDE, which dipped 0.51 units under the ground. Angles by eye.
SLEEP_HEAD = twisted(TUCK, 10, 0, head=50)
SLEEP_ROLL = twisted(TUCK, 60, 40, head=85)
# In-between key halfway between SLEEP_HEAD and SLEEP_ROLL: front at 45°, smallest mesh dip of the options tried.
SLEEP_ROLL45 = twisted(TUCK, 45, 30, head=70)

# --- Sleeping curl: described standing with the spine diving toward the belly (Y-Z plane), then rolled by 90°: the
# curve ends up in the ground plane, head toward the hind legs. Closed C spine, tucked head, gathered legs, tail tip
# brought toward the head. Values by eye on previews. curl_up() also serves the wake-up: after the roll, yaw < 0
# raises the head and pitch turns it horizontally (looking around).
def curl_up(n=P(0, -0.6, ZC - 1.6), pitch=80, yaw=15):
    return pose(
        body(HJ_=P(0, 2.6, ZC - 1.2), H_=P(0, 2.0, ZC - 0.3), M0_=P(0, 1.0, ZC - 0.2), M1_=P(0, -0.1, ZC - 0.8),
             N_=n, S_=P(0, -1.0, ZC - 2.3), HD_=head_at(n, pitch=pitch, yaw=yaw),
             T_=P(0.6, -1.4, ZC - 2.2), tail_aim=(0, 0.3, -0.95)),
        legs(fl=P(0.9, -2.0, g + 1.2), fr=P(0.4, -1.8, g + 1.3), faim=(0, -0.6, -0.8),
             wl=P(0.9, -1.7, g + 1.7), wr=P(0.4, -1.5, g + 1.8),
             bl=P(0.9, 1.3, g + 0.9), br=P(0.4, 1.4, g + 1.0), baim=(0, -0.8, -0.6),
             kl=P(0.9, 2.8, g + 1.1), kr=P(0.4, 2.9, g + 1.2)),
    )
CURL = rolled(curl_up(), 90, PIVOT)

# --- Wake: the curl stays, only the head rises then looks around. No yawn here: that is the sitting clip Yawn. Head
# positions by eye.
WAKE_N = P(0, -1.2, ZC - 0.5)
CURL_HEAD = rolled(curl_up(n=WAKE_N, pitch=15, yaw=-45), 90, PIVOT)   # head raised
CURL_LOOK1 = rolled(curl_up(n=WAKE_N, pitch=0, yaw=-40), 90, PIVOT)   # looking to one side
CURL_LOOK2 = rolled(curl_up(n=WAKE_N, pitch=40, yaw=-45), 90, PIVOT)  # looking to the other side

# --- Stretch: front legs stretched, low chest, high rump. Hip-to-shoulder line about 30° below the horizontal. Tail
# held roughly horizontal behind instead of raised. Values by eye.
STRETCH_N = P(0, -1.4, g + 2.6)
STRETCH = pose(
    body(HJ_=P(0, 3.3, g + 4.2), H_=P(0, 2.3, g + 4.7), M0_=P(0, 1.1, g + 4.3), M1_=P(0, -0.2, g + 3.5),
         N_=STRETCH_N, S_=P(0, -2.4, g + 2.0), HD_=head_at(STRETCH_N, pitch=12),
         T_=P(0, 6.2, g + 4.3)),
    legs(fl=P(0.6, -5.3, g + PAW), fr=P(-0.6, -5.3, g + PAW), faim=(0, -1, -0.15),
         wl=P(0.7, -4.5, g + 0.5), wr=P(-0.7, -4.5, g + 0.5),
         bl=P(0.7, 2.9, g + PAW), br=P(-0.7, 2.9, g + PAW),
         kl=P(0.7, 4.0, g + 1.9), kr=P(-0.7, 4.0, g + 1.9)),
)
# Arched back while standing, before the stretch: raised mid-back, low head, front legs one step forward, tail in a
# hook. Values by eye.
ARCH_N = N - V((0, 0, 0.3))
ARCH = pose(
    body(N_=ARCH_N, M1_=M1 + V((0, 0, 0.9)), M0_=M0 + V((0, 0, 0.9)), H_=H + V((0, 0, 0.2)),
         HD_=head_at(ARCH_N, pitch=30), T_=P(0, 5.0, g + 7.6)),
    legs(fl=FL + V((0, -0.5, 0)), fr=FR + V((0, -0.5, 0))),
)

# --- Grooming: sitting, left front paw raised to chin height, slightly out so that it stays visible behind the head;
# head toward the paw. Values by eye.
def groom(lick):
    """lick in [0, 1]: 0 head toward the paw, 1 head slightly raised (lick)."""
    return pose(
        body(**SIT_BODY, HD_=head_at(SIT_N, pitch=35 - 10 * lick, yaw=15), T_=P(1.6, 1.6, g + 0.3)),
        legs(fl=P(1.0, -2.7, g + 2.8), fr=P(-0.6, -2.0, g + PAW), fl_aim=(0.3, -0.5, 0.8),
             wl=P(1.0, -2.0, g + 2.2), **SIT_HIND),
    )

GROOM0, GROOM1 = groom(0), groom(1)

# --- Walk (replaces the stalking cycle of the source file). Lateral sequence of the cat: rear L, front L (0.15 cycle
# later), rear R (0.5), front R (0.65). Each foot stays down for WALK_DUTY of the cycle and moves back at constant
# speed (the ground scrolls under the cat: in-place clip), then returns in the air. Body at rest height; grounding
# each frame gives the slight bounce. Tail kept upright (T), the natural carriage of a walking cat.
WALK_FRAMES = 24          # one cycle = 1 s at 24 fps; played × 1.25 in Cat.js (WALK_RATE) = 0.8 s
WALK_STRIDE = 3.2         # planted foot travel during stance (units); ground scroll = WALK_STRIDE / WALK_DUTY per cycle
WALK_DUTY = 0.67          # stance factor: middle of the real range, 0.61 to 0.73

def _foot_track(phase, center, lift, stride=WALK_STRIDE, duty=WALK_DUTY):
    """Offset (dy, dz) of a foot for its phase in [0, 1): 0 = touches down forward."""
    half = stride / 2
    if phase < duty:
        return center - half + stride * phase / duty, 0.0
    s = (phase - duty) / (1 - duty)
    e = s * s * (3 - 2 * s)
    return center + half - stride * e, lift * math.sin(math.pi * s)

def walk_pose(t):
    """t in [0, 1): time within the cycle."""
    f = {}
    for side, x in (("L", 1), ("R", -1)):
        off = 0.0 if side == "L" else 0.5
        # Hind: ball of the foot and hock keep their rest offset, the hock rises more.
        dy, dz = _foot_track((t + off) % 1, -0.2, 0.7)
        b, k = (BL, KL) if side == "L" else (BR, KR)
        f["b" + side] = b + V((0, dy, dz))
        f["k" + side] = k + V((0, dy + 0.4 * dz, 1.3 * dz))
        # Front, 0.15 cycle after the hind leg on the same side: the wrist leads, the leg folds.
        dy, dz = _foot_track((t + off - 0.15) % 1, -0.4, 0.8)
        fo, w = (FL, WL) if side == "L" else (FR, WR)
        f["f" + side] = fo + V((0, dy + 0.3 * dz, dz))
        f["w" + side] = w + V((0, dy - 0.4 * dz, 1.2 * dz))
    bob = 0.06 * math.cos(4 * math.pi * t)
    up = V((0, 0, bob))
    return pose(
        body(S_=S + up, N_=N + up, M1_=M1 + up, M0_=M0 + up, H_=H + up, HJ_=HJ + up,
             HD_=head_at(N + up, pitch=6 + 2 * math.cos(4 * math.pi * t)), T_=T + up),
        legs(fl=f["fL"], fr=f["fR"], wl=f["wL"], wr=f["wR"], bl=f["bL"], br=f["bR"], kl=f["kL"], kr=f["kR"]),
    )

# --- Fast gaits: near click = walk, medium = trot, far = run. Same foot tracking as the walk (_foot_track: in-place
# clip). The ground scrolls STRIDE / DUTY units per cycle: no-slip speed = STRIDE / DUTY × model scale / cycle
# duration (read from the GLB). Values by eye, tuned on previews and GLB measures.
def _gait_legs(t, phases, stride, duty, lift_b, lift_f, cb, cf):
    """Feet and wrists/hocks for one step: phases = {"bL", "bR", "fL", "fR"} (0 = touchdown)."""
    f = {}
    for side in ("L", "R"):
        dy, dz = _foot_track((t - phases["b" + side]) % 1, cb, lift_b, stride, duty)
        b, k = (BL, KL) if side == "L" else (BR, KR)
        f["b" + side.lower()] = b + V((0, dy, dz))
        f["k" + side.lower()] = k + V((0, dy + 0.4 * dz, 1.3 * dz))
        dy, dz = _foot_track((t - phases["f" + side]) % 1, cf, lift_f, stride, duty)
        fo, w = (FL, WL) if side == "L" else (FR, WR)
        f["f" + side.lower()] = fo + V((0, dy + 0.3 * dz, dz))
        f["w" + side.lower()] = w + V((0, dy - 0.4 * dz, 1.2 * dz))
    return legs(**f)

# Trot: diagonal support (rear L + front R, then rear R + front L). 9-frame cycle (0.375 s), stance 0.45 of the cycle
# (no suspension frame: 4/9 < 0.45 and 5/9 > 0.5). Body lowered by 0.3: at rest height the front leg cannot reach the
# ground at the end of the stride (shoulder 3.9 from the foot, leg 3.95).
TROT_FRAMES = 9
TROT_STRIDE = 3.6  # backward travel of a planted foot during stance (units)
TROT_DUTY = 0.45
TROT_PHASES = {"bL": 0.0, "fR": 0.0, "bR": 0.5, "fL": 0.5}

def trot_pose(t):
    """t in [0, 1): time within the trot cycle."""
    bob = 0.08 * math.cos(4 * math.pi * t)
    b = _spine(N.z - g - 0.3 + bob, H.z - g - 0.3 + bob, S.z - g - 0.3 + bob)
    return pose(
        body(**b, HD_=head_at(b["N_"], pitch=8 + 2 * math.cos(4 * math.pi * t)), T_=T + V((0, 0.6, -0.6 + bob))),
        _gait_legs(t, TROT_PHASES, TROT_STRIDE, TROT_DUTY, 0.9, 1.0, -0.2, -0.6),
    )

# Run: rotary gallop (rear L, rear R, front R, front L), 8-frame cycle (0.333 s), stance 0.25 of the cycle; two
# suspensions (frames 3 and 7: no foot down), body carried by "_air". The spine extends after the hind push (about
# 0.42) and gathers after the front one (about 0.92); front high during rear stance, low during front stance
# (pitching). Body lowered by 0.5 so that the legs reach both ends of the stride.
RUN_FRAMES = 8
RUN_STRIDE = 4.0  # backward travel of a planted foot during stance (units)
RUN_DUTY = 0.25
RUN_PHASES = {"bL": 0.0, "bR": 0.1, "fR": 0.5, "fL": 0.6}
RUN_AIR = 0.5  # suspension height (units)
RUN_ARCH = 0.3  # back arch when the spine gathers (units)

def run_pose(t):
    """t in [0, 1): time within the gallop cycle."""
    rock = math.cos(2 * math.pi * (t - 0.2))
    stretch = 0.25 + 0.25 * math.cos(2 * math.pi * (t - 0.42))   # 0 to 0.5: never compressed, which would hump the spine
    n_z, h_z = N.z - g - 0.5 + 0.2 * rock, H.z - g - 0.5 - 0.2 * rock
    b = _spine(n_z, h_z, n_z - (N.z - S.z), stretch=stretch)
    # Arched back when the spine gathers (otherwise the middle sags).
    arch = RUN_ARCH * (1 - stretch / 0.5)
    b["M1_"], b["M0_"] = b["M1_"] + V((0, 0, arch)), b["M0_"] + V((0, 0, arch))
    p = pose(
        body(**b, HD_=head_at(b["N_"], pitch=12 + 4 * rock), T_=P(0, 6.4 + 0.3 * stretch, g + 6.3 - 0.4 * rock)),
        _gait_legs(t, RUN_PHASES, RUN_STRIDE, RUN_DUTY, 1.6, 1.4, 0.0, -0.7),
    )
    if not any((t - ph) % 1 < RUN_DUTY for ph in RUN_PHASES.values()):
        p["_air"] = RUN_AIR
    return p

# --- Stalk and Pounce, from video study of real cats. Values by eye, tuned on previews.
def _spine(n_z, h_z, s_z, dx=0.0, stretch=0.0):
    """Displaced spine: neck base N_ and pelvis H_ at n_z / h_z above the ground, shoulder at s_z.
    M1_/M0_ keep their rest offset to the neck-pelvis line (interpolated, no rounded back); HJ_ follows the pelvis.
    dx shifts the pelvis in x (wiggle), stretch lengthens the body."""
    dn, dh = g + n_z - N.z, g + h_z - H.z
    def sh(p):
        w = min(1.0, max(0.0, (p.y - N.y) / (H.y - N.y)))
        return p + V((dx * w, stretch * (w - 0.5), dn + (dh - dn) * w))
    return dict(N_=sh(N), M1_=sh(M1), M0_=sh(M0), H_=sh(H), HJ_=sh(HJ), S_=P(0, S.y - stretch / 2, g + s_z))

def _hind(bl, br, hj, baim=None, hock_up=0.0):
    """Hind feet; hocks by pole() (rest side), raised by hock_up: otherwise, when stalking, the metatarsus lies on the
    ground and lifts the feet."""
    up = V((0, 0, hock_up))
    return dict(bl=bl, br=br, baim=baim, kl=pole(hj, bl, HJ, BL, KL) + up, kr=pole(hj, br, HJ, BR, KR) + up)

STALK_FRAMES = 48                   # 2.0 s cycle (48 frames at 24 fps)
STALK_STRIDE = 0.6 * WALK_STRIDE    # shorter than the walk (units)
STALK_DUTY = 0.8                    # stance factor: foot down for a long time
STALK_LIFT = 0.4                    # foot lift (units)
# Low body, belly almost on the ground: shoulder 2.2, neck 3.0 and pelvis 4.1 units above the ground. Pelvis at 4.1
# rather than 3.8, which laid the metatarsus on the ground; rise of 1.1 units from neck to pelvis (0.62 at rest).
STALK_BODY = _spine(3.0, 4.1, 2.2)
STALK_HEAD = head_at(STALK_BODY["N_"], pitch=18)   # head lowered (degrees)
# Tail tip behind the pelvis at about its height: horizontal and stiff.
STALK_TAIL = P(0, 6.6, g + 3.3)

def stalk_pose(t):
    """t in [0, 1): time within the stalking cycle. Same lateral sequence as the walk (rear L 0, front L 0.15, rear R
    0.5, front R 0.65), no bounce."""
    f = {}
    for side, x in (("L", 1), ("R", -1)):
        off = 0.0 if side == "L" else 0.5
        dy, dz = _foot_track((t + off) % 1, -0.2, STALK_LIFT, STALK_STRIDE, STALK_DUTY)
        b = BL if side == "L" else BR
        f["b" + side] = b + V((0, dy, dz))
        dy, dz = _foot_track((t + off - 0.15) % 1, -0.4, STALK_LIFT, STALK_STRIDE, STALK_DUTY)
        fo, w = (FL, WL) if side == "L" else (FR, WR)
        f["f" + side] = fo + V((0, dy + 0.3 * dz, dz))
        # Wrists: + 0.3 in x on the outer side (elbows out).
        f["w" + side] = f["f" + side] + (w - fo) + V((0.3 * x, 0, 0))
    return pose(
        body(**STALK_BODY, HD_=STALK_HEAD, T_=STALK_TAIL),
        legs(fl=f["fL"], fr=f["fR"], wl=f["wL"], wr=f["wR"],
             **_hind(f["bL"], f["bR"], STALK_BODY["HJ_"], hock_up=0.8)),
    )

# Pounce (2.5 s, preparation shortened; Brain may hold CROUCH before it). Front legs flat on the ground stretched
# forward, low elbows: feet and wrists based on LIE (stable pose).
_PO_FRONT = dict(fl=P(0.65, -3.3, g + PAW), fr=P(-0.65, -3.3, g + PAW), faim=(0, -1, -0.1),
                 wl=P(0.75, -2.6, g + 0.45), wr=P(-0.75, -2.6, g + 0.45))
_PO_HIND_F = (P(0.75, 2.4, g + PAW), P(-0.75, 2.4, g + PAW))   # hind feet under the pelvis
# Crouch: pelvis at 3.9 so that the rump starts at about shoulder level, then rises during the wiggle.
_PO_CROUCH_B = _spine(2.7, 3.9, 1.9)
PO_PITCH, PO_PIN_PITCH = 25, 30   # head pitch in CROUCH and PIN (degrees)
# Hocks raised (_hind, hock_up): otherwise the metatarsus on the ground lifts all four feet by 0.31 units.
PO_HOCK = 0.8
POUNCE_CROUCH = pose(
    body(**_PO_CROUCH_B, HD_=head_at(_PO_CROUCH_B["N_"], pitch=PO_PITCH),   # see PO_PITCH
         T_=P(0.8, 6.4, g + 0.6)),                                   # low tail at the start
    legs(**_PO_FRONT, **_hind(*_PO_HIND_F, _PO_CROUCH_B["HJ_"], hock_up=PO_HOCK)))

PO_WIGGLE = 0.2   # wiggle duration (s)

def pounce_wiggle(t, dur=1.2):
    """0.4 -> 0.4 + dur: wiggle (3 Hz, pelvis x ± 0.15, rump +0.3 to +0.6; hind feet alternately lifted by 0.1; hooked
    tail, beating tip)."""
    u = (t - 0.4) / dur
    s = math.sin(2 * math.pi * 3 * (t - 0.4))
    b = _spine(2.7, 3.9 + 0.5 * u, 1.9, dx=0.15 * s)
    bl, br = _PO_HIND_F
    bl, br = bl + V((0, 0, 0.1 * max(s, 0))), br + V((0, 0, 0.1 * max(-s, 0)))
    return pose(
        body(**b, HD_=head_at(b["N_"], pitch=PO_PITCH),
             T_=P(0.4 * s, 6.0, g + 0.6 + 2.0 * min(1.0, 3 * u))),   # tail hooks upward
        legs(**_PO_FRONT, **_hind(bl, br, b["HJ_"], hock_up=PO_HOCK)))

# Step and lowering: shoulder -0.2, one front foot forward by 0.4 in y.
_PO_STEP_B = _spine(2.5, 4.4, 1.7)
POUNCE_STEP = pose(
    body(**_PO_STEP_B, HD_=head_at(_PO_STEP_B["N_"], pitch=PO_PITCH), T_=P(0, 6.0, g + 2.6)),
    legs(**{**_PO_FRONT, "fl": P(0.65, -3.7, g + PAW), "wl": P(0.75, -3.0, g + 0.45)},
         **_hind(*_PO_HIND_F, _PO_STEP_B["HJ_"], hock_up=PO_HOCK)))

# Launch: horizontal, elongated, raised body; front legs stretched forward, hind legs stretched backward. Hind feet
# still on the ground (push): no "_air".
_PO_LAUNCH_B = _spine(4.0, 4.3, 3.4, stretch=1.0)
POUNCE_LAUNCH = pose(
    body(**_PO_LAUNCH_B, HD_=head_at(_PO_LAUNCH_B["N_"], pitch=3), T_=P(0, 7.4, g + 4.0)),   # pitch 0-5
    legs(fl=P(0.6, -5.0, g + 1.3), fr=P(-0.6, -5.0, g + 1.3), faim=(0, -1, -0.15),
         **_hind(P(0.75, 6.4, g + 0.8), P(-0.75, 6.4, g + 0.8), _PO_LAUNCH_B["HJ_"], baim=(0, 0.6, -0.8))))
# Air: max height about +1.0 (low, skimming leap), pitch about 10, front legs coming down. In-place clip: forward
# motion is left to Cat.js.
_PO_AIR_B = _spine(4.0, 4.3, 3.4, stretch=0.8)
POUNCE_AIR = pose(
    body(**_PO_AIR_B, HD_=head_at(_PO_AIR_B["N_"], pitch=10), T_=P(0, 7.2, g + 4.2)),
    legs(fl=P(0.6, -4.6, g + 0.6), fr=P(-0.6, -4.6, g + 0.6), faim=(0, -1, -0.3),
         **_hind(P(0.75, 5.8, g + 1.4), P(-0.75, 5.8, g + 1.4), _PO_AIR_B["HJ_"], baim=(0, 0.6, -0.8))))
POUNCE_AIR["_air"] = 1.0
# In-between keys: between STEP and LAUNCH the mesh dipped 0.65 units; between LAND and PIN it floated up to +0.19.
# Poses grounded by apply_pose.
_PO_PUSH_B = _spine(3.2, 4.4, 2.5, stretch=0.5)
POUNCE_PUSH = pose(
    body(**_PO_PUSH_B, HD_=head_at(_PO_PUSH_B["N_"], pitch=10), T_=P(0, 6.8, g + 3.4)),
    legs(fl=P(0.6, -4.3, g + 0.8), fr=P(-0.6, -4.3, g + 0.8), faim=(0, -1, -0.15),
         **_hind(P(0.75, 4.4, g + PAW), P(-0.75, 4.4, g + PAW), _PO_PUSH_B["HJ_"], baim=(0, 0.6, -0.8))))
_PO_SETTLE_B = _spine(2.9, 4.2, 2.2, stretch=0.25)
POUNCE_SETTLE = pose(
    body(**_PO_SETTLE_B, HD_=head_at(_PO_SETTLE_B["N_"], pitch=PO_PITCH), T_=P(0.4, 6.6, g + 2.4)),
    legs(fl=P(0.65, -3.8, g + PAW), fr=P(-0.65, -3.8, g + PAW), faim=(0, -1, -0.1),
         wl=P(0.75, -3.1, g + 0.45), wr=P(-0.75, -3.1, g + 0.45),
         **_hind(P(0.75, 3.2, g + 0.6), P(-0.75, 3.2, g + 0.6), _PO_SETTLE_B["HJ_"], hock_up=PO_HOCK)))
# Land: front legs on the ground ahead, pelvis still high, pitch about 20, hind legs coming in.
_PO_LAND_B = _spine(3.2, 4.6, 2.6, stretch=0.5)
POUNCE_LAND = pose(
    body(**_PO_LAND_B, HD_=head_at(_PO_LAND_B["N_"], pitch=20), T_=P(0, 6.8, g + 4.0)),
    legs(fl=P(0.65, -4.0, g + PAW), fr=P(-0.65, -4.0, g + PAW), faim=(0, -1, -0.1),
         **_hind(P(0.75, 4.2, g + 1.4), P(-0.75, 4.2, g + 1.4), _PO_LAND_B["HJ_"])))
# Pin: crouched, low shoulders, pitch about 30 (muzzle toward the paws), front feet down, hind feet under the pelvis.
# Return to rest handled by Brain.
_PO_PIN_B = _spine(2.6, 3.9, 1.8)
POUNCE_PIN = pose(
    body(**_PO_PIN_B, HD_=head_at(_PO_PIN_B["N_"], pitch=PO_PIN_PITCH), T_=P(0.8, 6.4, g + 0.8)),
    legs(**{**_PO_FRONT, "fl": P(0.65, -3.6, g + PAW), "fr": P(-0.65, -3.6, g + PAW),
            "wl": P(0.75, -2.9, g + 0.45), "wr": P(-0.75, -2.9, g + 0.45)},
         **_hind(*_PO_HIND_F, _PO_PIN_B["HJ_"], hock_up=PO_HOCK)))

# --- Jump / JumpDown: leap onto a low wall of 0.3 to 0.5 m (3.5 to 5.8 units; 0.8 m cat) and descent. In-place clips:
# root motion (forward and height) comes from the game; each key is grounded (lowest mesh point at root level). Poses
# written standing then pitched (pitched, deg > 0: muzzle up). Positions and durations by eye.
def pitched(p, deg, pivot):
    return rolled(p, -deg, pivot, axis="X")

def _jbody(n_z, h_z, s_z, stretch=0.0, pitch=0, tail=None):
    b = _spine(n_z, h_z, s_z, stretch=stretch)
    return body(**b, HD_=head_at(b["N_"], pitch=pitch), T_=tail if tail is not None else P(0, 6.6, g + 3.0)), b

def _jlegs(fy, fz, by, bz, hj, faim=(0, -1, -0.1), baim=None, hock_up=0.0, fx=0.65, bx=0.75):
    """Front feet at (±fx, fy, g+fz), hind at (±bx, by, g+bz); elbows at rest offset, hocks by pole()."""
    return legs(fl=P(fx, fy, g + fz), fr=P(-fx, fy, g + fz), faim=faim,
                **_hind(P(bx, by, g + bz), P(-bx, by, g + bz), hj, baim=baim, hock_up=hock_up))

def _jpose(spine, leg, deg=0, pivot=(0, 0, 0)):
    (bd, b) = spine
    p = pose(bd, leg(b["HJ_"]))
    return pitched(p, deg, P(*pivot)) if deg else p

# Crouched, loaded rear (bent hocks, hind feet forward under the belly), looking at the top of the wall (horizontal
# muzzle, body slightly reared).
JUMP_CROUCH = _jpose(_jbody(2.8, 3.4, 2.0, pitch=0, tail=P(0, 6.4, g + 1.0)),
                     lambda hj: _jlegs(-3.2, PAW, 2.0, PAW, hj, hock_up=0.8))
# Push: rear unfolding (feet still down, behind), front legs folded against the chest, body reared by 22° (pivot: hind
# feet).
JUMP_PUSH = _jpose(_jbody(4.4, 4.4, 3.6, stretch=0.8, pitch=0, tail=P(0, 7.4, g + 3.4)),
                   lambda hj: _jlegs(-3.4, 2.2, 5.4, PAW, hj, faim=(0, -0.3, -0.95), baim=(0, 0.6, -0.8)),
                   22, (0, 5.4, g))
# Airborne: stretched body, front legs reaching forward and up (toward the top of the wall), hind legs trailing, tail
# as a counterbalance.
JUMP_AIR = _jpose(_jbody(4.2, 4.3, 3.6, stretch=1.0, pitch=0, tail=P(0, 7.6, g + 3.6)),
                  lambda hj: _jlegs(-5.4, 2.4, 7.8, 3.8, hj, faim=(0, -1, 0.1), baim=(0, 1, 0)),
                  18, (0, 0.5, g + 4))
# Front legs on top (higher than the hind feet, still hanging).
JUMP_REACH = _jpose(_jbody(3.8, 4.3, 3.0, stretch=0.8, pitch=10, tail=P(0, 7.2, g + 3.0)),
                    lambda hj: _jlegs(-4.8, PAW, 4.4, 1.8, hj),
                    12, (0, -4.8, g))
# Hind legs brought under the belly (pulling up), body levelling off.
JUMP_PULL = _jpose(_jbody(3.2, 4.2, 2.4, stretch=0.2, pitch=15, tail=P(0, 6.8, g + 2.6)),
                   lambda hj: _jlegs(-4.0, PAW, 2.6, 1.4, hj, hock_up=0.8),
                   4, (0, -4.0, g))
# Soft landing on top: four feet down, crouched, then standing.
JUMP_LAND = _jpose(_jbody(2.9, 3.9, 2.2, pitch=20, tail=P(0.4, 6.6, g + 2.0)),
                   lambda hj: _jlegs(-3.6, PAW, 2.8, PAW, hj, hock_up=0.8))

# JumpDown: looking down, front legs forward, push, front legs stretched toward the ground (diving body), front then
# hind landing, cushioning.
JDOWN_LOOK = _jpose(_jbody(2.9, 4.2, 2.0, pitch=25, tail=P(0, 6.6, g + 2.6)),
                    lambda hj: _jlegs(-3.8, PAW, 2.6, PAW, hj, hock_up=0.8))
JDOWN_AIR = _jpose(_jbody(4.0, 4.3, 3.4, stretch=0.8, pitch=8, tail=P(0, 7.2, g + 4.4)),
                   lambda hj: _jlegs(-5.0, 1.2, 5.0, 2.0, hj, faim=(0, -0.8, -0.6), baim=(0, 0.6, -0.8)),
                   -25, (0, -5.0, g))
JDOWN_FRONT = _jpose(_jbody(3.4, 4.6, 2.6, stretch=0.5, pitch=12, tail=P(0, 7.0, g + 4.4)),
                     lambda hj: _jlegs(-4.2, PAW, 4.4, 1.8, hj, baim=(0, 0.6, -0.8)),
                     -18, (0, -4.2, g))
JDOWN_LAND = _jpose(_jbody(2.8, 3.9, 2.1, pitch=20, tail=P(0.4, 6.6, g + 2.0)),
                    lambda hj: _jlegs(-3.8, PAW, 2.8, PAW, hj, hock_up=0.8))

# --- Carried: kitten carried by the nape (Maman holds it in her mouth, Mouth bone). Inert kitten with folded limbs
# (nape reflex): standing pose tilted by CARRY_DEG° muzzle up around the nape (CARRY_NAPE, back of the neck). No
# grounding ("_noground"): the game hangs the kitten from the mouth by the nape bone. Sway with a period of
# CARRY_FRAMES frames (2 s), one key per frame (LOOP_FRAMES). Angles and amplitudes by eye. Closed eyes: procedural
# eyelids in Cat.js (no eyelid bone or shape key in the model). Targets in the standing body frame, then tilted around
# CARRY_NAPE:
# - front legs: wrist at CARRY_WRIST from shoulder S, in front of the chest; paw at CARRY_PAW_F from S, pointing down;
# - hind legs: hock at CARRY_HOCK from hip HJ, just behind and below it; paw at CARRY_PAW_B from HJ, forward under the
#   belly;
# - slightly rounded back: M1, M0, H and HJ raised by CARRY_ARCH;
# - tail hanging behind, between the hind legs (CARRY_TAIL from raised H), high enough to stay above the lowest hind
#   foot.
# CARRY_PAW_B z (-1.76) keeps the nape-to-lowest-point distance on which the release timing (OPENING.dropAt) depends.
CARRY_FRAMES = 48  # 2 s cycle at 24 fps
CARRY_DEG = 10  # tilt around the nape (degrees, ± 3 with the sway)
CARRY_PITCH = 18  # head_at input before the tilt (degrees)
CARRY_WRIST = V((0.8, -0.9, -0.9))     # from S (x: left side, mirrored on the right), units
CARRY_PAW_F = V((0.75, -1.1, -1.45))   # from S, units
CARRY_PAW_F_AIM = V((0, 0.2, -0.95))
CARRY_HOCK = V((1.2, 0.3, -1.0))       # from HJ, units
CARRY_PAW_B = V((1.25, -1.0, -1.76))   # from HJ, units
CARRY_ARCH = (0.3, 0.45, 0.35, 0.3)    # rise of M1, M0, H, HJ (units)
CARRY_TAIL = V((0, 2.0, -0.7))         # from raised H, units
CARRY_NAPE = N + 0.35 * (HD - N) + V((0, 0, 0.45))

def carry_pose(ph):
    s = math.sin(2 * math.pi * ph)
    c = math.cos(2 * math.pi * ph)
    deg = CARRY_DEG + 3 * s
    a1, a0, ah, aj = CARRY_ARCH
    H_, HJ_ = H + V((0, 0, ah)), HJ + V((0, 0, aj))
    stand = pose(body(HD_=head_at(N, pitch=CARRY_PITCH + 3 * c), M1_=M1 + V((0, 0, a1)),
                      M0_=M0 + V((0, 0, a0)), H_=H_, HJ_=HJ_), legs())
    p = pitched(stand, deg, CARRY_NAPE)
    M = Matrix.Rotation(math.radians(-deg), 3, "X")
    rot = lambda q: CARRY_NAPE + M @ (Vector(q) - CARRY_NAPE)
    sw = V((0, 0.15 * c, 0))   # the legs trail behind the sway
    for side, x in (("L", 1), ("R", -1)):
        mx = lambda v: V((x * v.x, v.y, v.z))
        p[f"Foot_front_IK_{side}"] = dict(pos=rot(S + mx(CARRY_PAW_F) + sw), aim=M @ CARRY_PAW_F_AIM)
        p[f"Knee_front_IK_{side}"] = dict(pos=rot(S + mx(CARRY_WRIST) + sw))
        p[f"Foot_Back_IK_{side}"] = dict(pos=rot(HJ_ + mx(CARRY_PAW_B) + sw), aim=None)
        p[f"Knee_back_IK_{side}"] = dict(pos=rot(HJ_ + mx(CARRY_HOCK) + sw))
    p["Tail_controller"] = dict(pos=rot(H_ + CARRY_TAIL) + V((0.3 * s, 0, 0)))
    p["_noground"] = True
    return p

# --- HeadShake: standing, the kitten shakes its head (the helmet falls off during this clip, on the game side). Body
# at REST_POSE; only the head rolls around the front-back axis (Y): Head_controller turned by SHAKE_GAIN × amplitude
# around Y, at its rest position (rotating around the muzzle has almost no effect because the neck IK overrides it).
# Ears spread (SHAKE_EARS) while shaking. 4 Hz, one extreme every 0.125 s (3 frames), readable at 24 fps without
# aliasing; a wet cat shakes at about 6 Hz, which would leave only 2 frames per half-oscillation. Amplitudes by eye,
# strongest at 0.5 s (head roll about 38°), then damped. Named to bake between Groom and Idle (alphabetical export
# order): neighbouring clips that both end in REST_POSE.
SHAKE_GAIN = 62  # degrees of controller rotation per unit of amplitude
SHAKE_EARS = 20  # ear spread (degrees)
SHAKE_AMP = (0.6, -0.9, 1.0, -0.85, 0.6, -0.3)   # extremes at 0.25 s, 0.375 s, … 0.875 s
def shake_pose(a, ears=SHAKE_EARS):
    return dict(pose(body(head_rot=(0, a * SHAKE_GAIN, 0)), legs()), _ears=(ears, 0, 0))

# ================================================================== kitten combat clips
# Names and order: the export bakes clips in case-insensitive alphabetical order, and the rig cycle (Spine Pivot)
# carries state from one clip to the next. Names are chosen so that each existing clip following a new one follows a
# clip that ends like its former predecessor:
#   - Knockback bakes between JumpDown and Lie: JumpDown ends in REST_POSE, Knockback too;
#   - Swipe, SwordPull, SwordRun, SwordSwing, SwordWalk bake between Stretch (ends in REST_POSE) and Trot; Swipe
#     starts from the end of Stretch, and Trot from the end of SwordWalk (loop): Trot has a key on every frame.
#   "Scratch" would have baked between run and Sit and shifted Sit: rejected for "Swipe".
# Built after Yawn (end of ACTIONS), without changing the order of existing clips.

# --- Swipe (claw): attack of the kitten without the sword, left front paw (+X side, facing the preview cameras)
# forward. Cocked at 0.2 s (weight back, paw folded at chest height, ears back), strike at 0.33 s (paw stretched in
# front of the muzzle, shoulders raised, open mouth: hiss), follow-through down 0.46 s, paw down 0.7 s, standing 0.9
# s. Durations by eye.
def _swipe_pose(b, pitch, fl, fl_aim=None, fr=FR, mouth=0, ears=None):
    p = pose(body(**b, HD_=head_at(b["N_"], pitch=pitch)), legs(fl=fl, fl_aim=fl_aim, fr=fr))
    p["_mouth"] = mouth
    if ears:
        p["_ears"] = ears
    return p
SWIPE_COCK = _swipe_pose(_spine(4.5, 5.3, 4.0), 12, P(0.85, -2.6, g + 2.5), fl_aim=(0, -0.3, -0.95),
                         ears=(5, 25, 0))
SWIPE_HIT = _swipe_pose(_spine(4.9, 5.2, 4.5, stretch=0.4), 6, P(0.75, -5.6, g + 2.7), fl_aim=(0, -1, 0.1),
                        fr=FR + V((0, -0.4, 0)), mouth=18, ears=(10, 30, 0))
SWIPE_FOLLOW = _swipe_pose(_spine(4.7, 5.2, 4.3, stretch=0.3), 10, P(0.65, -4.8, g + 1.3), fl_aim=(0, -0.7, -0.7),
                           fr=FR + V((0, -0.4, 0)), mouth=8, ears=(5, 20, 0))
SWIPE_BACK = _swipe_pose(_spine(4.6, 5.3, 4.1), 8, FL + V((0, -0.5, 0.5)), ears=(0, 8, 0))

# --- Knockback: the brush blow throws the kitten backward and it lands. In-place clip (the recoil is left to the
# game); reused on the mountain. Impact 0.08 s (head thrown back, front legs lifted, body reared 14° around the hind
# feet, ears back, mouth open), airborne 0.28 s (reared 10°, hind legs stretched down for the landing, "_air"
# KB_AIR_H: the mesh really leaves the ground), hind legs down 0.45 s (flat, reared 8°), front legs down and crouching
# 0.6 s, rising 0.95 s, standing 1.3 s. The lowest point must stay nearly grounded: the ground contact of Cat.js
# (outside combat, down at rate 10, up at rate 30) pulls the body down during flight and rises late on landing. Hence
# the small KB_AIR_H (1.3 cm), the landing margins KB_TOUCH_AIR / KB_SETTLE_AIR (soft descent) and the KB_FLINCH key
# on frame 2.
KB_AIR_H = 0.15  # flight height above the ground (units)
KB_TOUCH_AIR = 0.08  # landing margin on KB_TOUCH (units)
KB_SETTLE_AIR = 0.06  # landing margin on KB_SETTLE (units)
# Start-of-impact key (0.04 s, frame 2), halfway between rest and KB_HIT: without it the rest-to-impact interpolation
# dips 0.077 units under the ground.
KB_FLINCH = _jpose(_jbody(4.8, 5.15, 4.3, pitch=-7, tail=P(0, 4.9, g + 5.7)),
                   lambda hj: _jlegs(-2.1, 0.7, 2.8, PAW, hj, faim=(0, -0.75, -0.65), hock_up=0.25),
                   7, (0, 2.85, g))
KB_FLINCH.update(_mouth=10, _ears=(5, 18, 0))
KB_HIT = _jpose(_jbody(4.9, 5.0, 4.4, pitch=-15, tail=P(0, 5.6, g + 2.4)),
                lambda hj: _jlegs(-2.6, 1.2, 2.9, PAW, hj, faim=(0, -0.5, -0.85), hock_up=0.5),
                14, (0, 2.9, g))
KB_HIT.update(_mouth=20, _ears=(10, 35, 0))
# Body raised by 0.4 and hind feet at PAW (legs stretched down) to partly compensate for the low flight (KB_AIR_H).
KB_AIR = _jpose(_jbody(4.8, 5.0, 4.3, pitch=-5, tail=P(0, 6.6, g + 4.6)),
                lambda hj: _jlegs(-3.0, 1.6, 3.4, PAW, hj, faim=(0, -1, -0.2), baim=(0, 0.3, -0.95)),
                10, (0, 0.5, g + 4))
KB_AIR.update(_air=KB_AIR_H, _mouth=10, _ears=(10, 30, 0))
KB_TOUCH = _jpose(_jbody(4.2, 4.3, 3.8, pitch=5, tail=P(0, 6.8, g + 3.6)),
                  lambda hj: _jlegs(-3.2, 1.4, 3.4, PAW, hj, hock_up=0.4),
                  8, (0, 3.4, g))
KB_TOUCH.update(_ears=(5, 25, 0), _air=KB_TOUCH_AIR)
# In-between key (0.52 s): without it, frame 13 between KB_TOUCH and KB_LAND dips 0.11 units under the ground.
KB_SETTLE = _jpose(_jbody(3.6, 4.1, 3.0, pitch=12, tail=P(0.2, 6.7, g + 2.8)),
                   lambda hj: _jlegs(-3.1, 0.8, 3.1, PAW, hj, hock_up=0.6),
                   4, (0, 3.1, g))
KB_SETTLE.update(_ears=(5, 22, 0), _air=KB_SETTLE_AIR)
KB_LAND = _jpose(_jbody(3.0, 3.9, 2.3, pitch=18, tail=P(0.4, 6.6, g + 2.0)),
                 lambda hj: _jlegs(-3.0, PAW, 2.8, PAW, hj, hock_up=0.8))
KB_LAND.update(_ears=(5, 20, 0))
KB_RECOVER = _jpose(_jbody(4.2, 4.9, 3.7, pitch=10, tail=P(0.2, 5.6, g + 5.0)),
                    lambda hj: _jlegs(-2.0, PAW, 2.7, PAW, hj, hock_up=0.3))
KB_RECOVER.update(_ears=(0, 8, 0))

# --- Sword in the mouth. The grip is held across the mouth, between the jaws; the blade sticks out to the left (+X).
# To balance the blade the head is carried high: neck base raised by SW_NECK_UP, muzzle up (SW_PITCH head_at input),
# mouth slightly open on the grip (SW_MOUTH, see set_mouth). Values by eye.
SW_NECK_UP = 0.5  # neck base raised (units)
SW_PITCH = -14  # head_at input (degrees, < 0 = muzzle up)
SW_MOUTH = 8  # mouth opening on the grip (degrees)
_SW_UP = V((0, 0, SW_NECK_UP))
# Stance with the sword held (start and end of SwordSwing, end of SwordPull): REST_POSE body, head high.
SWORD_STANCE = dict(pose(body(N_=N + _SW_UP, HD_=head_at(N + _SW_UP, pitch=SW_PITCH)), legs()),
                    _mouth=SW_MOUTH)

def _walk_legs(t, stride, duty):
    """Walk feet (same lateral sequence and offsets as walk_pose), explicit stride and stance."""
    f = {}
    for side in ("L", "R"):
        off = 0.0 if side == "L" else 0.5
        dy, dz = _foot_track((t + off) % 1, -0.2, 0.7, stride, duty)
        b, k = (BL, KL) if side == "L" else (BR, KR)
        f["b" + side.lower()] = b + V((0, dy, dz))
        f["k" + side.lower()] = k + V((0, dy + 0.4 * dz, 1.3 * dz))
        dy, dz = _foot_track((t + off - 0.15) % 1, -0.4, 0.8, stride, duty)
        fo, w = (FL, WL) if side == "L" else (FR, WR)
        f["f" + side.lower()] = fo + V((0, dy + 0.3 * dz, dz))
        f["w" + side.lower()] = w + V((0, dy - 0.4 * dz, 1.2 * dz))
    return legs(**f)

# SwordWalk: walk with the sword in the mouth. Same lateral sequence as Walk, slightly shorter stride (carried load;
# by eye), reduced bounce and head nod (stable blade). One key per frame; seamless loop (SEAMLESS, keys from frame 0
# to N). No-slip speed = SWALK_STRIDE / SWALK_DUTY × scale × rate / cycle duration read from the GLB.
SWALK_FRAMES = 24     # one cycle = 1.0 s at 24 fps
SWALK_STRIDE = 3.0    # backward travel of a planted foot during stance (units)
SWALK_DUTY = 0.67     # stance factor, like Walk

def sword_walk_pose(t):
    """t in [0, 1): time within the sword-walk cycle."""
    up = V((0, 0, 0.04 * math.cos(4 * math.pi * t)))
    n = N + up + _SW_UP
    p = pose(body(S_=S + up, N_=n, M1_=M1 + up, M0_=M0 + up, H_=H + up, HJ_=HJ + up,
                  HD_=head_at(n, pitch=SW_PITCH + 1 * math.cos(4 * math.pi * t)), T_=T + up),
             _walk_legs(t, SWALK_STRIDE, SWALK_DUTY))
    p["_mouth"] = SW_MOUTH
    return p

# SwordRun: gallop with the sword in the mouth. Same rotary gallop as run (RUN_PHASES, suspensions, "_air" SRUN_AIR,
# spine extending and gathering), slightly shorter stride (by eye), neck base raised by SW_NECK_UP, muzzle up and
# reduced head pitch (SW_PITCH ± 3 instead of 12 ± 4).
SRUN_FRAMES = 8       # one cycle = 0.333 s, like run
SRUN_STRIDE = 3.8
SRUN_DUTY = 0.25
# Own suspension SRUN_AIR and margin SRUN_LAND under the legs, fading after each landing (frames 0, 1, 2 then 4, 5, 6
# of 8): with the 0.5 suspension of run, the ground contact of Cat.js rises late on landing (rate 30) and the feet dip
# under the ground. The lowest point now comes down on a slope the contact can follow; the base margin (0.09 = 8 mm)
# also covers the dip of the fade from Idle.
SRUN_AIR = 0.18  # suspension height (units)
SRUN_LAND = {0: 0.15, 1: 0.12, 2: 0.09, 4: 0.15, 5: 0.12, 6: 0.09}  # margin under the legs by frame (units)

def sword_run_pose(t):
    """t in [0, 1): time within the sword-gallop cycle (modelled on run_pose)."""
    rock = math.cos(2 * math.pi * (t - 0.2))
    stretch = 0.25 + 0.25 * math.cos(2 * math.pi * (t - 0.42))
    n_z, h_z = N.z - g - 0.5 + 0.2 * rock, H.z - g - 0.5 - 0.2 * rock
    b = _spine(n_z, h_z, n_z - (N.z - S.z), stretch=stretch)
    arch = RUN_ARCH * (1 - stretch / 0.5)
    b["M1_"], b["M0_"] = b["M1_"] + V((0, 0, arch)), b["M0_"] + V((0, 0, arch))
    b["N_"] = b["N_"] + _SW_UP
    p = pose(
        body(**b, HD_=head_at(b["N_"], pitch=SW_PITCH + 3 * rock), T_=P(0, 6.4 + 0.3 * stretch, g + 6.3 - 0.4 * rock)),
        _gait_legs(t, RUN_PHASES, SRUN_STRIDE, SRUN_DUTY, 1.6, 1.4, 0.0, -0.7),
    )
    if not any((t - ph) % 1 < SRUN_DUTY for ph in RUN_PHASES.values()):
        p["_air"] = SRUN_AIR
    else:
        p["_air"] = SRUN_LAND.get(round(t * SRUN_FRAMES) % SRUN_FRAMES, 0.0)
    p["_mouth"] = SW_MOUTH
    return p

# SwordSwing (sword strike): head sweep with the sword in the mouth. The blade starts on the left; turning the head
# left (yaw > 0) brings it back, right (yaw < 0) sweeps it forward. Cocked 0.25 s (head left, weight back), strike
# 0.38 s (head centred, front of the body forward), end of sweep 0.5 s (head right, furthest forward), return 0.8 s,
# stance 1.2 s. Angles and durations by eye.
def swing_pose(yaw, pitch=SW_PITCH, lunge=0.0, ears=(0, 15, 0)):
    fwd = V((0, -lunge, -0.3 * lunge))
    n = N + _SW_UP + fwd
    p = pose(body(S_=S + 0.6 * fwd, N_=n, M1_=M1 + 0.3 * fwd, HD_=head_at(n, pitch=pitch, yaw=yaw)), legs())
    p.update(_mouth=SW_MOUTH, _ears=ears)
    return p
SWING_WIND = swing_pose(40, pitch=-8, lunge=-0.3)
SWING_HIT = swing_pose(0, pitch=-2, lunge=0.4, ears=(5, 25, 0))
SWING_END = swing_pose(-50, pitch=2, lunge=0.6, ears=(5, 25, 0))
SWING_BACK = swing_pose(-30, pitch=-6, lunge=0.3)

# SwordPull (drawing the sword from the stone): the sword is planted almost upright in a low stone, grip at muzzle
# height, in front of the front legs. The kitten pulls its head back to look, then tilts its head (roll PULL_ROLL,
# left ear down) to take the upright grip across the mouth, bites, braces (front legs forward, pelvis lowered, hind
# legs forward under the belly), pulls in two jerks then in one go (head and neck slide along the blade, direction
# PULL_DIR, without turning: the grip stays in the mouth), the sword comes out, it straightens its head (roll back),
# raises it with the sword across, then returns to the sword stance.
# Timeline: look 0.3 s, head at the grip with open mouth 0.6 s, bite 0.8 s (PULL_T_GRAB), brace 1.1 s, jerks 1.35 and
# 1.55 s, out 1.9 s (PULL_T_FREE), head straight 2.3 s (PULL_T_HELD), sword raised 2.6-3.1 s, stance 3.5 s. Preview
# sword and stone: see setup_props. PULL_DIR = opposite of the blade axis at the bite, read in Blender (PULLAXIS line
# of preview mode); to change if PULL_ROLL, PULL_PITCH or _PULL_N change. Values by eye.
PULL_T_GRAB, PULL_T_FREE, PULL_T_HELD = 0.8, 1.9, 2.3  # seconds: bite, blade out, head straight
PULL_ROLL = 75        # degrees; > 0: +X side (left ear) down
PULL_DIR = V((-0.411, -0.179, 0.894))
PULL_PITCH = 15  # head_at input (degrees)
_PULL_N = N.z - g - 0.1
_PULL_B = _spine(_PULL_N, H.z - g, S.z - g - 0.3)

def pull_pose(d=0.0, h_z=H.z - g, mouth=SW_MOUTH, hind=0.0, front=0.6, ears=(0, 5, 0)):
    """Head at the grip (roll PULL_ROLL), slid by d along PULL_DIR; pelvis at h_z; hind: hind feet forward under the
    belly; front: front legs forward (bracing)."""
    b = _spine(_PULL_N, h_z, S.z - g - 0.3)
    b["N_"] = _PULL_B["N_"] + PULL_DIR * d
    hd = head_at(_PULL_B["N_"], pitch=PULL_PITCH) + PULL_DIR * d
    p = pose(body(**b, HD_=hd, head_rot=(0, PULL_ROLL, 0), T_=P(0.4, 6.4, g + 3.0)),
             legs(fl=FL + V((0, -front, 0)), fr=FR + V((0, -front, 0)),
                  **_hind(BL + V((0, -hind, 0)), BR + V((0, -hind, 0)), b["HJ_"], hock_up=0.5 * hind)))
    p.update(_mouth=mouth, _ears=ears)
    return p
# Look: head back and above the grip (otherwise the sword goes through the head).
_PULL_LOOK_N = N + V((0, 0.9, 0.5))
PULL_LOOK = dict(pose(body(N_=_PULL_LOOK_N, HD_=head_at(_PULL_LOOK_N, pitch=40)), legs()), _ears=(0, 0, 0))
PULL_REACH = pull_pose(mouth=22, front=0.5)
PULL_BITE = pull_pose(mouth=6, front=0.5)
PULL_BRACE = pull_pose(h_z=H.z - g - 0.6, hind=0.6, front=0.9, ears=(0, 15, 0))
PULL_TUG1 = pull_pose(d=0.4, h_z=H.z - g - 0.8, hind=0.7, front=0.9, ears=(0, 20, 0))
PULL_TUG2 = pull_pose(d=0.25, h_z=H.z - g - 0.7, hind=0.7, front=0.9, ears=(0, 20, 0))
PULL_OUT = pull_pose(d=1.6, h_z=H.z - g - 1.0, hind=0.8, front=0.9, ears=(0, 25, 0))
_PULL_TURN_B = _spine(4.8, 4.8, 4.1)
PULL_TURN = dict(pose(body(**_PULL_TURN_B, HD_=head_at(_PULL_TURN_B["N_"], pitch=0), head_rot=(0, PULL_ROLL / 3, 0)),
                      legs(fl=FL + V((0, -0.3, 0)), fr=FR + V((0, -0.3, 0)))), _mouth=SW_MOUTH, _ears=(0, 10, 0))
_PULL_RAISE_N = N + _SW_UP + V((0, 0.2, 0.6))
PULL_RAISE = dict(pose(body(N_=_PULL_RAISE_N, HD_=head_at(_PULL_RAISE_N, pitch=-28), T_=T + V((0, 0.3, 0.3))),
                       legs()), _mouth=SW_MOUTH, _ears=(0, -5, 0))

# ================================================================== Chartiste and ending clips
# Built after the existing clips (ACTIONS.update below).
#   - BrushHold (2.0 s loop, breathing): guard of the Chartiste. Front right leg (FR bone, -X side) raised in front of
#     the chest, gripping the handle of the giant brush; three legs on the ground. Also used as a LAYER: the game
#     takes only the front right leg tracks (Foot_front_IK_R, Knee_front_IK_R, Thigh_front_R, Calf_Front_R,
#     Foot_front_L2.002, Foot_front_R) over SitNpc, Idle or Walk; the shoulder (Thigh_front_R) stays at S, as in those
#     three clips, and the paw does not touch the ground.
#   - BrushSwing (1.7 s): cocked at 0.25 s and held to 0.7 s, strike 0.7 -> 0.83 s, top down and from outside (-X) to
#     the front, follow-through 0.95 s, back to guard 1.7 s.
#   - Flinch (0.75 s): body and head recoil at 0.1 s, ears back, guard at 0.75 s, brush kept.
#   - Defeat (2.8 s, played once then frozen): three widening sways (0.35, 0.8, 1.25 s), brush dropped at
#     DEFEAT_T_DROP, sitting at 1.8 s, final pose held from 2.3 to 2.8 s.
#   - SwordToPaw (2.1 s): from SWORD_STANCE (sword in the mouth); paw at the grip 0.6 s (ST_T_GRAB), mouth open and
#     head withdrawn 0.85 s, sword presented in front 1.15 s (ST_T_FWD), sitting with raised sword 2.1 s (=
#     SWORD_PAW_HOLD, first frame of SwordPawHold).
#   - SwordPawHold (2.0 s loop): sitting, sword raised in the front right paw (end screen).
#   - StepBack (1.0 s loop): in-place walk of Maman backing away at an angle (SB_* constants).
# Durations, angles and positions by eye.
BH_LEG_LEN = 4.458          # front right leg, shoulder -> tip of Foot_front_L2.002 (3 bones), measured in Blender (units)
BRUSH_LEN = 1.2 * BH_LEG_LEN   # handle + tuft, from the grip point (5.35 units)
PAW_BONE = "Foot_front_R"   # bone holding the paw in the game (Npc.js pawHolder: paw, descendant of the calf)
PAW_PT_L = V((0, 0.2, 0))   # grip point in the PAW_BONE frame (middle of the bone, length 0.394)
# Guard: foot (Foot_front_IK_R target), wrist (Knee_front_IK_R) and foot aim, armature frame.
BH_FR = P(-0.8, -3.6, g + 2.9)
BH_WR = BH_FR + V((-0.05, 0.45, -0.6))
BH_PAW_AIM = V((0.2, -0.75, 0.6))
# Handle in the guard: direction (held end toward the tuft) in armature frame, toward the right outside (-X), the
# front (-Y) and up; grip point read in Blender (BRUSHHOLD line of preview mode).
BRUSH_DIR = V((-0.45, -0.72, 0.53)).normalized()
BRUSH_GRIP = V((-0.759, -3.753, 0.143))

def _rot_to(d0, d1):
    return V(d0).normalized().rotation_difference(V(d1).normalized()).to_matrix()

def _fr_spec(p, fr, wr, brush=None, aim=BH_PAW_AIM, pre=None):
    """Front right leg of pose p: foot fr, wrist wr; the foot keeps the guard aim, turned by the rotation bringing
    BRUSH_DIR onto brush (so the handle follows direction brush)."""
    if brush is not None:
        pre = _rot_to(BRUSH_DIR, brush)
    p["Foot_front_IK_R"] = dict(pos=fr, aim=aim, pre=pre)
    p["Knee_front_IK_R"] = dict(pos=wr)
    return p

BH_NECK = V((0, 0.2, 0.6))  # raised neck: proud guard
def _bh_pose(front=V((0, 0, 0)), breath=0.0, dx=0.0, pitch=0, yaw=0, roll=0, neck=V((0, 0, 0)),
             fr=None, wr=None, brush=None, ears=(0, 5, 0), mouth=0, tail=None):
    """Standing guard: front of the body (shoulder, neck, middle) shifted by front; pelvis shifted by dx in x; neck
    raised by breath and shifted by neck; front right foot fr / wrist wr (default: those of the guard, shifted by
    front); handle directed by brush."""
    front = V(front)
    hip = V((dx, 0, 0))
    n = N + BH_NECK + front + neck + V((0, 0, breath))
    sh = V((0, front.y, 0))  # recoil or lunge: the whole body follows (planted legs), otherwise the back sags
    p = pose(body(S_=S + front, N_=n, M1_=M1 + 0.85 * front + 0.5 * hip + V((0, 0, 0.5 * breath)),
                  M0_=M0 + 0.7 * sh + hip, H_=H + 0.6 * sh + hip, HJ_=HJ + 0.6 * sh + hip,

                  HD_=head_at(n, pitch=pitch, yaw=yaw), head_rot=(0, roll, 0),
                  T_=tail if tail is not None else T + V((0.3, 0.6, -1.2)) + hip), legs())
    _fr_spec(p, fr if fr is not None else BH_FR + front, wr if wr is not None else BH_WR + front,
             brush=brush)
    p.update(_ears=ears, _mouth=mouth)
    return p

# BrushHold: breathing (neck ±0.06, head ±1.5°), swaying tail tip. One key per frame.
BH_FRAMES = 48
def brush_hold_pose(t):
    b = math.sin(2 * math.pi * t)
    return _bh_pose(breath=0.06 * b, pitch=-2 - 1.5 * b,
                    tail=T + V((0.3 + 0.35 * math.sin(2 * math.pi * t + 1.0), 0.6, -1.2)))
BH0 = brush_hold_pose(0)

# BrushSwing: cocked (front of the body back, paw and brush raised back and out, ears back, mouth slightly open),
# cocked held a bit further, passing key, strike (body forward, paw stretched forward and low, handle forward and
# down, mouth open, ears back), follow-through (handle passing in front to the left), recovery.
SWG_COCK = _bh_pose(front=V((0, 0.45, -0.1)), pitch=0, yaw=-6, fr=P(-1.9, -2.6, g + 5.5),
                    wr=P(-1.6, -2.4, g + 4.65), brush=(-0.5, 0.55, 0.67), ears=(0, 22, 0), mouth=6)
SWG_COCK2 = _bh_pose(front=V((0, 0.55, -0.12)), pitch=-1, yaw=-8, fr=P(-2.0, -2.5, g + 5.65),
                     wr=P(-1.7, -2.3, g + 4.75),
                     brush=(-0.55, 0.6, 0.58), ears=(0, 26, 0), mouth=8)
SWG_MID = _bh_pose(front=V((0, 0.1, -0.15)), pitch=6, fr=P(-1.6, -3.6, g + 4.6),
                   wr=P(-1.4, -3.1, g + 4.0), brush=(-0.45, -0.35, 0.82), ears=(5, 30, 0), mouth=14)
SWG_HIT = _bh_pose(front=V((0, -0.5, -0.35)), pitch=12, fr=P(-0.75, -5.0, g + 2.4),
                   wr=P(-0.75, -4.35, g + 2.65), brush=(-0.26, -0.93, -0.26), ears=(10, 35, 0), mouth=22)
SWG_FOLLOW = _bh_pose(front=V((0, -0.55, -0.4)), pitch=14, fr=P(-0.35, -4.7, g + 2.3),
                      wr=P(-0.4, -4.05, g + 2.55), brush=(0.3, -0.88, -0.2), ears=(5, 28, 0), mouth=12)
SWG_RECOVER = _bh_pose(front=V((0, -0.2, -0.15)), pitch=10, fr=P(-0.75, -3.6, g + 2.7),
                       wr=P(-0.8, -3.1, g + 2.15), brush=(-0.45, -0.55, 0.7), ears=(0, 12, 0), mouth=4)

# Flinch: passing key at 0.04 s, recoil at 0.1 s (front of the body back and low, neck withdrawn, muzzle up, ears
# back, mouth open), damped return at 0.3 s, guard at 0.75 s. The brush follows the paw and tips slightly back.
FL_MID = _bh_pose(front=V((0, 0.25, -0.05)), pitch=0, brush=(-0.48, -0.5, 0.72), ears=(5, 20, 0), mouth=6)
FL_HIT = _bh_pose(front=V((0, 0.55, -0.15)), neck=V((0, 0.3, 0.15)), pitch=-12, brush=(-0.5, -0.3, 0.81),
                  ears=(10, 40, 0), mouth=14)
FL_BACK = _bh_pose(front=V((0, 0.3, -0.1)), neck=V((0, 0.1, 0.05)), pitch=0, brush=(-0.47, -0.55, 0.69),

                   ears=(5, 25, 0), mouth=4)

# Defeat: sways of the front of the body and pelvis (dx), head tilting (roll) and lowering; the brush tips with the
# paw, then the paw opens and goes down toward the ground (brush dropped at DEFEAT_T_DROP, see setup_paw_props); falls
# into a sit (compressed SIT_NPC, impact then rebound), head low, ears drooping. The brush is DROPPED: the paw must
# land to cushion the fall, and a Chartiste letting go of the tool reads as freed.
DEFEAT_T_DROP = 1.4  # seconds into the Defeat clip
DF_SWAY1 = _bh_pose(front=V((0.2, 0, -0.05)), dx=0.25, roll=8, pitch=14, brush=(-0.4, -0.35, 0.85),
                    ears=(10, 10, 0))
DF_SWAY2 = _bh_pose(front=V((-0.35, 0.05, -0.12)), dx=-0.4, roll=-12, pitch=20, brush=(-0.65, -0.3, 0.7),
                    ears=(15, 12, 0))
DF_SWAY3 = _bh_pose(front=V((0.45, 0.1, -0.25)), dx=0.55, roll=16, pitch=26, brush=(-0.55, -0.4, 0.73),
                    ears=(20, 15, 0), mouth=6)
DF_DROP = _bh_pose(front=V((-0.1, 0.0, -0.45)), dx=-0.2, roll=-6, pitch=30, fr=P(-0.75, -3.5, g + 1.0),
                   wr=P(-0.8, -2.9, g + 1.5), brush=(-0.8, -0.3, 0.5), ears=(20, 15, 0), mouth=4)

def _defeat_sit(dn=0.0, pitch=30, ears=(25, 15, 0)):
    n = SIT_N + V((0, -0.1, dn))
    p = dict(SIT_NPC)
    p.update(body(**dict(SITNPC_BODY, N_=n), HD_=head_at(n, pitch=pitch), T_=SIT_NPC["Tail_controller"]["pos"]))
    p.update(_ears=ears, _mouth=0)
    return p
DF_SIT = _defeat_sit(dn=-0.45, pitch=24, ears=(25, 25, 0))
DF_SETTLE = _defeat_sit(dn=-0.15, pitch=28)
DF_FINAL = _defeat_sit(dn=-0.2, pitch=32)


# SwordToPaw / SwordPawHold: the front right paw takes the grip on the right side of the mouth (point SWPAW_XH of the
# grip axis, sword frame), the mouth opens and the head withdraws back and up, the sword turns in front of the face
# (blade forward, SWPAW_MID_DIR), then the cat sits and raises the sword, blade up (SWPAW_DIR). Sitting rather than
# standing on three legs: the end screen holds the pose for long, and the sit is the stable pose with a free paw.
ST_T_GRAB, ST_T_FWD, ST_T_END = 0.6, 1.15, 2.1  # seconds: grab, sword forward, end
SWPAW_XH = -0.65                                  # grip point held by the paw (sword frame)
SWPAW_MID_DIR = V((-0.15, -0.95, 0.27)).normalized()
SWPAW_DIR = V((-0.3, -0.4, 0.87)).normalized()
SWPAW_AIM = V((0.1, -0.9, 0.4))
ST_GRAB_FR = P(-0.65, -4.51, g + 5.37)               # foot at the grip (tuned with the PROP line of preview mode)
def _st_pose(n_off=V((0, 0, 0)), pitch=SW_PITCH, fr=FR, wr=None, aim=SWPAW_AIM, mouth=SW_MOUTH, ears=(0, 10, 0)):
    n = N + _SW_UP + n_off
    p = pose(body(N_=n, HD_=head_at(n, pitch=pitch)), legs())
    _fr_spec(p, fr, wr if wr is not None else fr + V((-0.05, 0.6, -0.45)), aim=aim)
    p.update(_mouth=mouth, _ears=ears)
    return p
ST_REACH = _st_pose(pitch=SW_PITCH + 4, fr=P(-0.75, -3.6, g + 3.7), ears=(0, 5, 0))
ST_GRAB = _st_pose(pitch=SW_PITCH + 4, fr=ST_GRAB_FR, ears=(0, 5, 0))
ST_OPEN = _st_pose(n_off=V((0, 0.45, 0.2)), pitch=SW_PITCH - 6, fr=ST_GRAB_FR, mouth=24, ears=(0, 15, 0))
ST_FWD = _st_pose(n_off=V((0, 0.35, 0.1)), pitch=SW_PITCH + 6, fr=P(-0.85, -4.3, g + 4.2), mouth=4)

SWPAW_FRAMES = 48
SWPAW_FR = P(-1.3, -4.5, g + 3.6)
SWPAW_WR = SWPAW_FR + V((-0.05, 0.45, -0.6))
def sword_paw_pose(t=0.0):
    """Sitting (SIT), head high, sword raised in the front right paw; t: breathing (loop)."""
    b = math.sin(2 * math.pi * t)
    up = V((0, 0, 0.05 * b))
    n = SIT_N + up
    p = pose(body(**dict(SIT_BODY, N_=n), HD_=head_at(n, pitch=-8 - 1.5 * b), T_=P(1.6, 1.6, g + 0.3)),
             legs(**SIT_HIND))
    _fr_spec(p, SWPAW_FR + 0.5 * up, SWPAW_WR + 0.5 * up, aim=SWPAW_AIM)
    p.update(_ears=(0, -5, 0), _mouth=0)
    return p
SWORD_PAW_HOLD = sword_paw_pose(0)
# Standing -> sitting transition (sword in front, paw at mid height).
ST_SITTING = dict(sword_paw_pose(0))
_fr_spec(ST_SITTING, P(-1.1, -4.5, g + 3.8), P(-1.15, -3.9, g + 3.3), aim=SWPAW_AIM)

ST_SITTING.update(_ears=(0, 5, 0))

# StepBack (Maman backing off after setting the kitten down): in-place walk, intended motion SB_DIR (armature frame:
# backward +Y and right -X, 26.6° off straight back; Story.js sidestep {x -0.2, z -0.4}). Each planted foot slides
# toward -SB_DIR (+X, -Y) at constant speed during stance (the ground scrolls under the cat: in-place clip), then
# returns in the air toward +SB_DIR. Foot order: the walk's, reversed (front L 0, rear L 0.15, front R 0.5, rear R
# 0.65: the front leads when backing up). The ground scrolls SB_STRIDE / SB_DUTY units per cycle of SB_FRAMES frames,
# along SB_DIR.
SB_FRAMES = 24              # one cycle = 1.0 s at 24 fps
SB_STRIDE = 2.4             # slide of a planted foot during stance (units, along SB_DIR)
SB_DUTY = 0.65              # stance factor
SB_DIR = V((-0.447, 0.894, 0)).normalized()
SB_PHASES = {"fl": 0.0, "bl": 0.15, "fr": 0.5, "br": 0.65}

def _sb_track(phase, lift):
    """Offset (a, dz) of a foot along SB_DIR: a = +half at touchdown, -half at lift-off."""
    half = SB_STRIDE / 2
    if phase < SB_DUTY:
        return half - SB_STRIDE * phase / SB_DUTY, 0.0
    s = (phase - SB_DUTY) / (1 - SB_DUTY)
    e = s * s * (3 - 2 * s)
    return -half + SB_STRIDE * e, lift * math.sin(math.pi * s)

def step_back_pose(t):
    f = {}
    for side in ("l", "r"):
        a, dz = _sb_track((t - SB_PHASES["b" + side]) % 1, 0.6)
        b, k = (BL, KL) if side == "l" else (BR, KR)
        o = SB_DIR * a + V((0, -0.2, 0))
        f["b" + side] = b + o + V((0, 0, dz))
        f["k" + side] = k + o + V((0, -0.3 * dz, 1.3 * dz))
        a, dz = _sb_track((t - SB_PHASES["f" + side]) % 1, 0.7)
        fo, w = (FL, WL) if side == "l" else (FR, WR)
        o = SB_DIR * a + V((0, -0.4, 0))
        f["f" + side] = fo + o + V((0, -0.2 * dz, dz))
        f["w" + side] = w + o + V((0, 0.3 * dz, 1.2 * dz))
    bob = V((0, 0, 0.05 * math.cos(4 * math.pi * t)))
    sway = V((-0.06 * math.sin(2 * math.pi * t), 0, 0))
    up = bob + sway
    return pose(body(S_=S + up, N_=N + up, M1_=M1 + up, M0_=M0 + bob, H_=H + bob - sway, HJ_=HJ + bob - sway,
                     HD_=head_at(N + up, pitch=12 + 1.5 * math.cos(4 * math.pi * t)), T_=T + V((0, 0.3, -0.8))),
                legs(**f))

# Layer control pose (preview mode only, never exported): SIT_NPC whose front right leg takes the BrushHold guard
# targets (same root-relative tracks as in the game: shoulder at S in both clips).
BRUSH_LAYER_SIT = _fr_spec(dict(SIT_NPC), BH_FR, BH_WR, brush=BRUSH_DIR)

def _mix_pose(a, b, k):
    """Intermediate pose between two poses (fraction k toward b), grounded separately by apply_pose. Serves as a
    standing -> sitting passing key: without it, interpolating two grounded keys puts the mesh under the ground."""
    out = {}
    for name in set(a) | set(b):
        sa, sb = a.get(name), b.get(name)
        if name.startswith("_") or sa is None or sb is None:
            if isinstance(sa, (tuple, int, float)) and isinstance(sb, (tuple, int, float)):
                out[name] = (tuple(x + (y - x) * k for x, y in zip(sa, sb)) if isinstance(sa, tuple)
                             else sa + (sb - sa) * k)
            else:
                out[name] = sa if k < 0.5 else sb
            continue
        head, tail, _ = REST[name]
        s = {"pos": V(sa.get("pos", head)).lerp(V(sb.get("pos", head)), k)}
        if sa.get("aim") is not None or sb.get("aim") is not None:
            da = V(sa["aim"] if sa.get("aim") is not None else tail - head).normalized()
            db = V(sb["aim"] if sb.get("aim") is not None else tail - head).normalized()
            s["aim"] = da.lerp(db, k)
        if sa.get("rot") is not None or sb.get("rot") is not None:
            ra, rb = sa.get("rot") or (0, 0, 0), sb.get("rot") or (0, 0, 0)
            s["rot"] = tuple(x + (y - x) * k for x, y in zip(ra, rb))
        if sa.get("pre") is not None or sb.get("pre") is not None:
            qa = (sa["pre"] if sa.get("pre") is not None else Matrix.Identity(3)).to_quaternion()
            qb = (sb["pre"] if sb.get("pre") is not None else Matrix.Identity(3)).to_quaternion()
            s["pre"] = qa.slerp(qb, k).to_matrix()
        out[name] = s
    return out
def _mix_keys(t0, a, t1, b, n=3):
    """n evenly spaced passing keys between (t0, a) and (t1, b)."""
    return [(t0 + (t1 - t0) * j / (n + 1), _mix_pose(a, b, j / (n + 1))) for j in range(1, n + 1)]

LOOP_FRAMES = {"Walk": WALK_FRAMES, "Stalk": STALK_FRAMES, "Carried": CARRY_FRAMES, "Trot": TROT_FRAMES, "run": RUN_FRAMES,
               "SwordWalk": SWALK_FRAMES, "SwordRun": SRUN_FRAMES}
# Sword loops: same seamless rule as Trot and run (keys from frame 0 to N, see SEAMLESS).
SEAMLESS |= {"SwordWalk", "SwordRun"}
# Chartiste and ending loops: same seamless rule.
LOOP_FRAMES.update({"BrushHold": BH_FRAMES, "SwordPawHold": SWPAW_FRAMES, "StepBack": SB_FRAMES})
SEAMLESS |= {"BrushHold", "SwordPawHold", "StepBack"}

ACTIONS = {
    "Rest": [(0, REST_POSE), (1, REST_POSE)],
    "Idle": [(0, REST_POSE), (2, REST_POSE)],
    # HeadShake (see SHAKE_GAIN): ears spread 0-0.125 s, shaking 0.25-0.875 s at 4 Hz (strongest at 0.5 s), back to
    # REST_POSE at 1.25 s.
    "HeadShake": [(0, REST_POSE), (0.125, shake_pose(0, ears=10))]
                 + [(0.25 + 0.125 * i, shake_pose(a)) for i, a in enumerate(SHAKE_AMP)]
                 + [(1.0, shake_pose(0, ears=8)), (1.25, REST_POSE)],
    "Walk": [(i / FPS, walk_pose(i / WALK_FRAMES)) for i in range(WALK_FRAMES + 1)],
    "Sit": [(0, REST_POSE), (1.2, SIT), (3, SIT)],
    # Lie: sit 0.5 s, pause 0.4 s, descent 0.6 s, settling 0.5 s: 2.0 s in total (real cats 1.5 to 2.5 s). Cat.js
    # CLIPS.Lie.hold = 2.0.
    "Lie": [(0, REST_POSE), (0.5, SIT), (0.9, SIT), (1.5, LIE), (2.0, LIE_SETTLE), (3, LIE_SETTLE)],
    # Pet (see PET_HEAD_DOWN): lying on the side, never on the back. Head lowers 0-0.45 s, crouch 0.6 s (halfway
    # standing-lying), fall shoulders first 0.6-1.0 s (side at 0.96 s), folded legs and raised head 1.0-1.875 s, hold
    # 1.875 -> 7.0 s (Brain.js PET_PADDLE; loop PET_LOOP 6.0 -> 3.0 s, same pose PET_UP0), head-first rise 7.0 -> 8.6
    # s (Brain.js PET_RISE). Entries: Brain.js PET_FROM (sit 0.69, lie 1.06, gaits 0.6, idle 0).
    "Pet": [(0, REST_POSE), (0.3, PET_HEAD_DOWN), (0.45, PET_HEAD_DOWN2), (0.6, PET_CROUCH),
            (0.66, PET_CROUCH2), (0.72, PET_DROP), (0.87, PET_SHOULDER_DOWN2), (1.0, PET_LAID),
            (1.5, PET_FOLDED), (1.875, PET_UP0), (3.0, PET_UP0), (3.375, PET_UP1), (4.25, PET_UP1),
            (4.5, PET_UP2), (5.5, PET_UP2), (5.875, PET_UP0), (7.0, PET_UP0), (7.2, PET_RISE_HEAD2),
            (7.5, PET_RISE_FRONT), (7.7, PET_RISE_CROUCH0), (7.9, PET_RISE_CROUCH), (8.6, REST_POSE)],
    # Sleep: same lying down as Lie up to 2.0 s, side at 2.6 s like Pet, curl at 3.8 s, held to 6 s. Cat.js
    # CLIPS.Sleep.hold = 3.8 (time CURL is reached). Head-first move to the side (SLEEP_HEAD 2.2 s, SLEEP_ROLL 2.4 s):
    # see SLEEP_HEAD.
    "Sleep": [(0, REST_POSE), (0.5, SIT), (0.9, SIT), (1.5, LIE), (2.0, LIE_SETTLE), (2.2, SLEEP_HEAD),
              (2.3, SLEEP_ROLL45), (2.4, SLEEP_ROLL), (2.6, SIDE), (3.8, CURL), (6, CURL)],
    # Wake: starts from CURL (end of Sleep); head raised in 0.7 s, looking around for 2.4 s (0.7-3.1 s), no yawn (no
    # shape key). Does not get up at once: sphinx at 4.3 s held for 1 s, standing at 6.2 s (durations by eye; Brain
    # chains to standing).
    "Wake": [(0, CURL), (0.7, CURL_HEAD), (1.5, CURL_LOOK1), (2.3, CURL_LOOK2), (3.1, CURL_HEAD),
             (4.3, LIE), (5.3, LIE), (6.2, REST_POSE)],
    # Stretch: arched back in 0.4 s, held 0.6 s; forward stretch reached in 0.4 s, held 1.4 s; back in 0.4 s. Total
    # 3.2 s.
    "Stretch": [(0, REST_POSE), (0.4, ARCH), (1.0, ARCH), (1.4, STRETCH), (2.8, STRETCH), (3.2, REST_POSE)],
    # Groom: a lick (raised head, GROOM1) every 0.5 s (12 exact frames), five licks from 1.65 to 3.65 s. Sitting at
    # 4.5 s, standing at 5.3 s. Durations by eye.
    "Groom": [(0, REST_POSE), (0.8, SIT), (1.4, GROOM0)]
             + [(1.4 + 0.25 * i, GROOM1 if i % 2 else GROOM0) for i in range(1, 11)]
             + [(4.5, SIT), (5.3, REST_POSE)],
    # Stalk: 2.0 s loop, one key per frame like Walk; frozen stops handled by Brain.
    "Stalk": [(i / FPS, stalk_pose(i / STALK_FRAMES)) for i in range(STALK_FRAMES + 1)],
    # Pounce: wiggle sampled every 2 frames (3 Hz) for 0.2 s (PO_WIGGLE), i.e. 0.6 period.
    "Pounce": [(0, REST_POSE), (0.4, POUNCE_CROUCH)]
              + [(0.4 + k / 12, pounce_wiggle(0.4 + k / 12, PO_WIGGLE)) for k in range(1, 2)]
              + [(0.6, pounce_wiggle(0.6, PO_WIGGLE)), (0.65, POUNCE_STEP),
                 (0.7, POUNCE_PUSH),                # passing key against a dip (see POUNCE_PUSH)
                 (0.75, POUNCE_LAUNCH), (0.95, POUNCE_AIR), (1.1, POUNCE_LAND),
                 (1.3, POUNCE_SETTLE),              # passing key against floating (see POUNCE_PUSH)
                 (1.5, POUNCE_PIN)],
    # Jump (in place, see JUMP_CROUCH): crouch 0.3 s held to 0.45 s, push 0.6 s (hind feet leave the ground), airborne
    # 0.75 s, front legs on top 0.9 s, hind legs brought in 1.05 s, landing 1.25 s, standing 1.6 s. Durations by eye.
    "Jump": [(0, REST_POSE), (0.3, JUMP_CROUCH), (0.45, JUMP_CROUCH), (0.6, JUMP_PUSH), (0.75, JUMP_AIR),
             (0.9, JUMP_REACH), (1.05, JUMP_PULL), (1.25, JUMP_LAND), (1.6, REST_POSE)],
    # JumpDown: look down 0.3 s, push and flight 0.5 s, front legs on the ground 0.7 s, hind legs 0.85 s, standing
    # 1.25 s.
    "JumpDown": [(0, REST_POSE), (0.3, JDOWN_LOOK), (0.5, JDOWN_AIR), (0.7, JDOWN_FRONT), (0.85, JDOWN_LAND),
                 (1.25, REST_POSE)],
    # Carried (see carry_pose): 2.0 s loop, one key per frame like Walk.
    "Carried": [(i / FPS, carry_pose(i / CARRY_FRAMES)) for i in range(CARRY_FRAMES + 1)],
    # Trot and run: "run" replaces the source action of the same name (Cat.js and Brain.js already play it;
    # build_action removes the old one).
    "Trot": [(i / FPS, trot_pose(i / TROT_FRAMES)) for i in range(TROT_FRAMES + 1)],
    "run": [(i / FPS, run_pose(i / RUN_FRAMES)) for i in range(RUN_FRAMES + 1)],
    # SitNpc: NPC sit (Chagicien, Chartiste), see SIT_NPC_V2; keys like Sit. Built before Yawn: the rig keeps state
    # between evaluations, and Carried (baked first) starts from the state of the last clip built and baked, Yawn.
    # Built last, Carried would shift (tail, 3.8°).
    "SitNpc": [(0, REST_POSE), (1.2, SIT_NPC_V2), (3, SIT_NPC_V2)],
    # Sitting yawn, built last. Mouth opening and head rising 0-1.0 s, held wide open to 1.5 s, closed at 1.9 s, back
    # to SIT at 2.3 s.
    "Yawn": [(0, SIT), (0.5, YAWN_START), (1.0, YAWN_WIDE), (1.5, YAWN_WIDE), (1.9, YAWN_END), (2.3, SIT)],
    # --- Kitten combat clips, built after the existing clips.
    # Knockback (see KB_HIT): impact 0.08 s, airborne 0.28 s (intended flight), hind legs down 0.45 s, transition key
    # 0.52 s, cushion 0.6 s, rising 0.95 s, standing 1.3 s. KB_FLINCH key at 0.04 s: see KB_AIR_H.
    "Knockback": [(0, REST_POSE), (0.04, KB_FLINCH), (0.08, KB_HIT), (0.28, KB_AIR), (0.45, KB_TOUCH), (0.52, KB_SETTLE), (0.6, KB_LAND),
                  (0.95, KB_RECOVER), (1.3, REST_POSE)],
    # Swipe (see SWIPE_COCK): cocked 0.2 s, strike 0.33 s (contact), follow-through 0.46 s, paw down 0.7 s, standing
    # 0.9 s.
    "Swipe": [(0, REST_POSE), (0.2, SWIPE_COCK), (0.33, SWIPE_HIT), (0.46, SWIPE_FOLLOW), (0.7, SWIPE_BACK),
              (0.9, REST_POSE)],
    # SwordWalk, SwordRun (see sword_walk_pose, sword_run_pose): loops, one key per frame.
    "SwordWalk": [(i / FPS, sword_walk_pose(i / SWALK_FRAMES)) for i in range(SWALK_FRAMES + 1)],
    "SwordRun": [(i / FPS, sword_run_pose(i / SRUN_FRAMES)) for i in range(SRUN_FRAMES + 1)],
    # SwordSwing (see swing_pose): cocked 0.25 s, strike 0.38 s, end of sweep 0.5 s, return 0.8 s, stance 1.2 s.
    "SwordSwing": [(0, SWORD_STANCE), (0.25, SWING_WIND), (0.38, SWING_HIT), (0.5, SWING_END), (0.8, SWING_BACK),
                   (1.2, SWORD_STANCE)],
    # SwordPull (see PULL_T_GRAB): built last.
    "SwordPull": [(0, REST_POSE), (0.3, PULL_LOOK), (0.6, PULL_REACH), (PULL_T_GRAB, PULL_BITE), (1.1, PULL_BRACE),
                  (1.35, PULL_TUG1), (1.55, PULL_TUG2), (PULL_T_FREE, PULL_OUT), (PULL_T_HELD, PULL_TURN),
                  (2.6, PULL_RAISE), (3.1, PULL_RAISE), (3.5, SWORD_STANCE)],
}
# --- Chartiste and ending clips (see BH_LEG_LEN), built after the others.
ACTIONS.update({
    "BrushHold": [(i / FPS, brush_hold_pose(i / BH_FRAMES)) for i in range(BH_FRAMES + 1)],
    "BrushSwing": [(0, BH0), (0.25, SWG_COCK), (0.7, SWG_COCK2), (0.76, SWG_MID), (0.83, SWG_HIT),
                   (0.95, SWG_FOLLOW), (1.3, SWG_RECOVER), (1.7, BH0)],
    "Flinch": [(0, BH0), (0.04, FL_MID), (0.1, FL_HIT), (0.3, FL_BACK), (0.75, BH0)],
    "Defeat": [(0, BH0), (0.35, DF_SWAY1), (0.8, DF_SWAY2), (1.25, DF_SWAY3), (DEFEAT_T_DROP, DF_DROP),
               *_mix_keys(DEFEAT_T_DROP, DF_DROP, 1.8, DF_SIT), (1.8, DF_SIT), (2.05, DF_SETTLE), (2.3, DF_FINAL), (2.8, DF_FINAL)],
    "SwordToPaw": [(0, SWORD_STANCE), (0.35, ST_REACH), (ST_T_GRAB, ST_GRAB), (0.85, ST_OPEN),
                   (ST_T_FWD, ST_FWD), *_mix_keys(ST_T_FWD, ST_FWD, 1.6, ST_SITTING), (1.6, ST_SITTING),
                   (ST_T_END, SWORD_PAW_HOLD)],
    "SwordPawHold": [(i / FPS, sword_paw_pose(i / SWPAW_FRAMES)) for i in range(SWPAW_FRAMES + 1)],
    "StepBack": [(i / FPS, step_back_pose(i / SB_FRAMES)) for i in range(SB_FRAMES + 1)],
})
# Preview-mode-only actions (never built at export): BrushHold layer check.
PREVIEW_ONLY = {"BrushLayerSit": [(0, BRUSH_LAYER_SIT), (1, BRUSH_LAYER_SIT)]}

# ------------------------------------------------------------------ preview props (sword, stone)
# Created by setup_props() in preview mode ONLY, never on export (the game's sword is built in code). export() deletes
# everything other than CatArmature, CatBody, EyeA and EyeB anyway; these props have no action (placed directly, no
# key).
# Sword: local frame X = blade axis (pommel toward -X), Z = blade width, Y = thickness; origin at the centre of the
# grip. Held: grip across the mouth, between the jaws (SWORD_GRIP, armature rest frame), blade toward the cat's left,
# 15° back, 5° up (SWORD_DIR). Parented to the Head bone (parent of Mouth and Nose): it follows the head and upper
# jaw; Mouth only opens the lower jaw (SW_MOUTH stays small). Dimensions by eye.
SWORD_PROP_CLIPS = {"SwordWalk", "SwordRun", "SwordSwing", "SwordPull"}
SW_GRIP, SW_GUARD, SW_BLADE = 0.75, 0.14, 4.0     # half-grip, guard, blade (units, cat about 10)
SWORD_GRIP = V((0, -4.15, 2.32))
SWORD_DIR = V((math.cos(math.radians(15)), math.sin(math.radians(15)), math.sin(math.radians(5)))).normalized()

def _frame(x, up=V((0, 0, 1))):
    x = Vector(x).normalized()
    y = Vector(up).cross(x).normalized()
    return Matrix((x, y, x.cross(y))).transposed()

SWORD_HOLD = Matrix.Translation(SWORD_GRIP) @ _frame(SWORD_DIR).to_4x4()
HEAD_REST_INV = arm.data.bones["Head"].matrix_local.inverted()
SWORD_HOLD_L = HEAD_REST_INV @ SWORD_HOLD   # held sword, in the Head bone frame

def _prop_obj(name, verts, faces, rgba, parent=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba
    me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.parent = parent
    return o

def _prism(x0, x1, hy0, hz0, hy1=None, hz1=None):
    """Prism along X, section (2 hy × 2 hz) at x0 and at x1."""
    hy1, hz1 = (hy0 if hy1 is None else hy1), (hz0 if hz1 is None else hz1)
    v = [(x0, -hy0, -hz0), (x0, hy0, -hz0), (x0, hy0, hz0), (x0, -hy0, hz0),
         (x1, -hy1, -hz1), (x1, hy1, -hz1), (x1, hy1, hz1), (x1, -hy1, hz1)]
    return v, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]

def make_sword():
    root = bpy.data.objects.new("PropSword", None)
    scene.collection.objects.link(root)
    x1 = SW_GRIP + SW_GUARD
    _prop_obj("PropSwordGrip", *_prism(-SW_GRIP, SW_GRIP, 0.1, 0.1), (0.35, 0.18, 0.08, 1), root)
    _prop_obj("PropSwordPommel", *_prism(-SW_GRIP - 0.22, -SW_GRIP, 0.15, 0.15), (0.85, 0.65, 0.15, 1), root)
    _prop_obj("PropSwordGuard", *_prism(SW_GRIP, x1, 0.12, 0.6), (0.85, 0.65, 0.15, 1), root)
    _prop_obj("PropSwordBlade", *_prism(x1, x1 + SW_BLADE, 0.035, 0.17, 0.01, 0.02), (0.82, 0.86, 0.9, 1), root)
    return root

def make_stone(top, tip):
    """Stone on the ground, around the planted part of the blade (from top, the entry point, to tip)."""
    cx, cy = (top.x + tip.x) / 2, (top.y + tip.y) / 2
    a, b = abs(top.x - tip.x) / 2 + 0.8, abs(top.y - tip.y) / 2 + 0.8
    h = top.z - G + 0.05
    v = [(cx + sx * a, cy + sy * b, G) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    v += [(cx + sx * a * 0.75, cy + sy * b * 0.75, G + h) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return _prop_obj("PropStone", v, f, (0.45, 0.45, 0.48, 1))

def _head_world():
    return arm.matrix_world @ arm.pose.bones["Head"].matrix

def _lerp_m(A, B, e):
    la, ra, _ = A.decompose()
    lb, rb, _ = B.decompose()
    return Matrix.Translation(la.lerp(lb, e)) @ ra.slerp(rb, e).to_matrix().to_4x4()

def setup_props(name):
    """Preview mode: sword (and stone for SwordPull). Returns a place(f) function to call before rendering frame f
    (SwordPull), or None (sword parented to the Head bone, nothing to do per frame)."""
    if name in BRUSH_PROP_CLIPS or name in SWORD_PAW_CLIPS:  # prop held in the paw
        return setup_paw_props(name)
    if name not in SWORD_PROP_CLIPS:
        return None
    sword = make_sword()
    if name != "SwordPull":
        scene.frame_set(1)
        bpy.context.view_layer.update()
        sword.parent, sword.parent_type, sword.parent_bone = arm, "BONE", "Head"
        bpy.context.view_layer.update()
        sword.matrix_world = _head_world() @ SWORD_HOLD_L
        return None
    # SwordPull, equivalent of an animated Child Of constraint, computed frame by frame:
    # - before the bite (kg): planted sword, P0 = held position at the bite (the grip is in the mouth at kg); the
    #   blade goes into the stone;
    # - from kg to the exit (kf): the sword slides along its axis, by the component on that axis of the motion of the
    #   held grip (it cannot turn in the stone);
    # - from kf to kh: the sword follows the head, its local frame going from the exit's to SWORD_HOLD_L;
    # - after kh: held (as if parented to Head).
    kg, kf, kh = (round(t * FPS) + 1 for t in (PULL_T_GRAB, PULL_T_FREE, PULL_T_HELD))
    Hk = {}
    for k in range(1, kh + 1):
        scene.frame_set(k)
        if k in (kg, kf):
            Hk[k] = _head_world().copy()
    P0 = Hk[kg] @ SWORD_HOLD_L
    u = P0.col[0].to_3d().normalized()          # blade axis, toward the tip (into the stone)
    gl = HEAD_REST_INV @ SWORD_GRIP              # held grip, Head frame
    mg = Hk[kg] @ gl
    slide = lambda Hm: max(0.0, (Hm @ gl - mg).dot(-u))
    s_free = slide(Hk[kf])
    Lf = Hk[kf].inverted() @ Matrix.Translation(-u * s_free) @ P0
    x_tip = SW_GRIP + SW_GUARD + SW_BLADE
    stone = make_stone(P0 @ V((x_tip - s_free, 0, 0)), P0 @ V((x_tip, 0, 0)))
    print(f"PULLAXIS -u={tuple(round(c, 3) for c in -u)} s_free={s_free:.2f} kg={kg} kf={kf} kh={kh} "
          f"stone top={stone.data.vertices[4].co.z - G:.2f} tip={(P0 @ V((x_tip, 0, 0))).z - G:.2f}")

    def place(f):
        scene.frame_set(f)
        Hm = _head_world()
        if f < kg:
            W = P0
        elif f <= kf:
            W = Matrix.Translation(-u * min(slide(Hm), s_free)) @ P0
        elif f < kh:
            e = (f - kf) / (kh - kf)
            W = Hm @ _lerp_m(Lf, SWORD_HOLD_L, e * e * (3 - 2 * e))
        else:
            W = Hm @ SWORD_HOLD_L
        sword.matrix_world = W
        bpy.context.view_layer.update()
        gap = (W.to_translation() - Hm @ gl).length if f >= kg else float("nan")
        lo = min((sword.matrix_world @ V((x, 0, 0))).z for x in (-SW_GRIP - 0.22, x_tip)) - G
        print(f"PROP SwordPull f{f} grip-mouth={gap:.2f} sword lowest={lo:.2f}")
    return place

# Brush and sword held by the front right paw, preview mode only, like the sword above (export() deletes them). Brush:
# local frame X = handle, from the held end (origin, grip point) toward the tuft; length BRUSH_LEN. Held: in the
# BrushHold guard, grip point BRUSH_GRIP and handle BRUSH_DIR (armature frame); the brush is parented to the PAW_BONE
# bone keeping this transform, so it follows the paw in the other clips. Sword in the paw: point SWPAW_XH of the grip
# on the paw grip point (PAW_PT_L of PAW_BONE), blade SWPAW_DIR.
BRUSH_PROP_CLIPS = {"BrushHold", "BrushSwing", "Flinch", "Defeat", "BrushLayerSit"}
SWORD_PAW_CLIPS = {"SwordToPaw", "SwordPawHold"}

def make_brush():
    root = bpy.data.objects.new("PropBrush", None)
    scene.collection.objects.link(root)
    L = BRUSH_LEN
    _prop_obj("PropBrushShaft", *_prism(-0.15, L - 1.2, 0.12, 0.12), (0.45, 0.25, 0.1, 1), root)
    _prop_obj("PropBrushFerrule", *_prism(L - 1.2, L - 0.95, 0.17, 0.17), (0.75, 0.75, 0.78, 1), root)
    _prop_obj("PropBrushTuft", *_prism(L - 0.95, L, 0.36, 0.36, 0.08, 0.08), (0.75, 0.08, 0.06, 1), root)
    return root

def _paw_world():
    return arm.matrix_world @ arm.pose.bones[PAW_BONE].matrix

def _paw_pt(Pm=None):
    return (Pm if Pm is not None else _paw_world()) @ PAW_PT_L

def _paw_local_at(p, W):
    """Frame W (world) expressed in the PAW_BONE bone when the cat is in pose p (with grounding)."""
    apply_pose(p)
    return _paw_world().inverted() @ W, _paw_pt()

def setup_paw_props(name):
    first = 0 if name in SEAMLESS else 1
    if name in BRUSH_PROP_CLIPS:
        prop = make_brush()
        L, pp = _paw_local_at(BH0, Matrix.Translation(BRUSH_GRIP) @ _frame(BRUSH_DIR).to_4x4())
        tip = lambda: [prop.matrix_world @ V((x, 0, 0)) for x in (-0.15, BRUSH_LEN)]
        print(f"BRUSHHOLD paw point={tuple(round(c, 3) for c in pp)} BRUSH_GRIP={tuple(round(c, 3) for c in BRUSH_GRIP)} "
              f"gap={(pp - BRUSH_GRIP).length:.3f} dir={tuple(round(c, 3) for c in BRUSH_DIR)}")
    else:
        prop = make_sword()
        x_tip = SW_GRIP + SW_GUARD + SW_BLADE
        tip = lambda: [prop.matrix_world @ V((x, 0, 0)) for x in (-SW_GRIP - 0.22, x_tip)]

    def held(pp_, d, up):
        return Matrix.Translation(pp_ - SWPAW_XH * d) @ _frame(d, up).to_4x4()

    if name in SWORD_PAW_CLIPS:
        apply_pose(SWORD_PAW_HOLD)
        Pm = _paw_world()
        L_end = Pm.inverted() @ held(_paw_pt(Pm), SWPAW_DIR, V((0, -1, 0)))
        L = L_end
    scene.frame_set(first)
    bpy.context.view_layer.update()
    prop.parent, prop.parent_type, prop.parent_bone = arm, "BONE", PAW_BONE
    bpy.context.view_layer.update()
    prop.matrix_world = _paw_world() @ L
    bpy.context.view_layer.update()

    def report(f, extra=""):
        lo = min((c.matrix_world @ v.co).z for c in prop.children for v in c.data.vertices) - G
        gap =(prop.matrix_world.to_translation() - _paw_pt()).length if name in BRUSH_PROP_CLIPS else float("nan")
        print(f"PROP {name} f{f} grip-paw={gap:.3f} prop lowest={lo:.2f} "
              f"dir={tuple(round(c, 3) for c in prop.matrix_world.col[0].to_3d().normalized())}{extra}")

    if name in ("BrushHold", "BrushSwing", "Flinch", "BrushLayerSit", "SwordPawHold"):
        def place(f):
            scene.frame_set(f)
            bpy.context.view_layer.update()
            report(f)
        return place

    if name == "Defeat":
        kd = round(DEFEAT_T_DROP * FPS) + 1
        kl = kd + 9                                   # brush on the ground 9 frames (0.375 s) after the drop
        for k in range(first, kd + 1):
            scene.frame_set(k)
        W0 = _paw_world() @ L
        g0 = W0.to_translation()
        a = V((g0.x - 0.6, g0.y - 0.3, G + 0.15))      # held end on the ground, on the right outer side
        d = V((-0.8, -0.55, 0)).normalized()
        b = a + d * BRUSH_LEN
        b.z = G + 0.42
        # The tuft (half-height 0.36) rests on the ground.
        W1 = Matrix.Translation(a) @ _frame(b - a).to_4x4()
        print(f"DEFEATDROP kd={kd} kl={kl} grip={tuple(round(c, 2) for c in g0)}")
        def place(f):
            scene.frame_set(f)
            bpy.context.view_layer.update()
            if f <= kd:
                prop.parent = arm
                prop.parent_type, prop.parent_bone = "BONE", PAW_BONE
                bpy.context.view_layer.update()
                prop.matrix_world = _paw_world() @ L
            else:
                prop.parent = None
                e = min(1.0, (f - kd) / (kl - kd))
                prop.matrix_world = _lerp_m(W0, W1, e * e)
            bpy.context.view_layer.update()
            report(f, " (dropped)" if f > kd else "")
        return place

    # SwordToPaw: in the mouth until the grab (kg), then held by the paw; the local frame in the paw goes from the
    # grab's to that of the sword presented in front (kf, blade SWPAW_MID_DIR), then to SwordPawHold's (ke). Computed
    # frame by frame in order (rig cycle), like SwordPull.
    kg, kf, ke = (round(t * FPS) + 1 for t in (ST_T_GRAB, ST_T_FWD, ST_T_END))
    Hk, Pk = {}, {}
    for k in range(1, ke + 1):
        scene.frame_set(k)
        if k in (kg, kf):
            Hk[k], Pk[k] = _head_world().copy(), _paw_world().copy()
    W_grab = Hk[kg] @ SWORD_HOLD_L
    L_grab = Pk[kg].inverted() @ W_grab
    L_fwd = Pk[kf].inverted() @ held(_paw_pt(Pk[kf]), SWPAW_MID_DIR, V((0, 0, 1)))
    gp = W_grab @ V((SWPAW_XH, 0, 0))
    print(f"SWORDGRAB kg={kg} kf={kf} ke={ke} grip point={tuple(round(c, 3) for c in gp)} "
          f"paw point={tuple(round(c, 3) for c in _paw_pt(Pk[kg]))} gap={(gp - _paw_pt(Pk[kg])).length:.3f}")
    prop.parent = None
    def place(f):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        Pm = _paw_world()
        if f <= kg:
            W = _head_world() @ SWORD_HOLD_L
        elif f <= kf:
            e = (f - kg) / (kf - kg)
            W = Pm @ _lerp_m(L_grab, L_fwd, e * e * (3 - 2 * e))
        elif f < ke:
            e = (f - kf) / (ke - kf)
            W = Pm @ _lerp_m(L_fwd, L_end, e * e * (3 - 2 * e))
        else:
            W = Pm @ L_end
        if f > kg:  # the grip stays in the paw while the sword turns
            W = Matrix.Translation(_paw_pt(Pm) - W @ V((SWPAW_XH, 0, 0))) @ W
        prop.matrix_world = W
        bpy.context.view_layer.update()
        gap = (W @ V((SWPAW_XH, 0, 0)) - _paw_pt(Pm)).length if f > kg else float("nan")
        report(f, f" grip-paw={gap:.3f}")
    return place

# ------------------------------------------------------------------ control render
def make_camera(name, loc, target, ortho=None, lens=50):
    cam = bpy.data.cameras.new(name)
    if ortho:
        cam.type = "ORTHO"
        cam.ortho_scale = ortho
    cam.lens = lens
    cam.clip_end = 500
    o = bpy.data.objects.new(name, cam)
    scene.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o

VIEWS = {}
def setup_render(w=560, h=420):
    c = V((0, 0.5, 0.3))
    VIEWS["side"] = make_camera("CamSide", (40, 0.5, 0.3), c, ortho=14)
    VIEWS["front"] = make_camera("CamFront", (0, -40, 0.3), c, ortho=10)
    VIEWS["top"] = make_camera("CamTop", (0, 0.5, 40), c, ortho=14)
    VIEWS["persp"] = make_camera("CamPersp", (16, -20, 9), (0, 0.3, -0.5), lens=45)
    VIEWS["head"] = make_camera("CamHead", (4.5, -13, 4.2), (0, -3.7, 2.9), lens=85)
    VIEWS["headside"] = make_camera("CamHeadSide", (12, -3.7, 3.0), (0, -3.7, 2.9), lens=85)
    # View close to the in-game petting capture (back side, slightly in front, above).
    VIEWS["game"] = make_camera("CamGame", (14, -8, 7), (0, -1.0, 0.8), lens=50)
    # Wider profile centred higher, for tall poses whose side view cuts the head. Option only: --views sidewide.
    VIEWS["sidewide"] = make_camera("CamSideWide", (40, 0.5, 2.0), V((0, 0.5, 2.0)), ortho=18)
    # Right side of the cat (-X), where the front right paw holds the brush or sword; side, sidewide and persp show it
    # from the other side. Option: --views sider,perspr.
    VIEWS["sider"] = make_camera("CamSideR", (-40, 0.5, 2.0), V((0, 0.5, 2.0)), ortho=18)
    VIEWS["perspr"] = make_camera("CamPerspR", (-16, -20, 9), (0, 0.3, -0.5), lens=45)
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_object_outline = True
    sh.show_cavity = True
    sh.show_shadows = True
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, G))
    ground = bpy.context.active_object
    ground.name = "GroundPreview"
    mat = bpy.data.materials.new("ground")
    mat.diffuse_color = (0.55, 0.6, 0.5, 1)
    ground.data.materials.append(mat)

def render(tag, frame, views):
    os.makedirs(OUT, exist_ok=True)
    scene.frame_set(frame)
    for v in views:
        scene.camera = VIEWS[v]
        scene.render.filepath = os.path.join(OUT, f"{tag}_f{frame:03d}_{v}.png")
        bpy.ops.render.render(write_still=True)
    mz = mesh_min_z()
    feet = {n[:6] + n[-1]: round(arm.pose.bones[n].head.z - G, 2) for n in ("Foot_front_IK_L", "Foot_front_IK_R", "Foot_Back_IK_L", "Foot_Back_IK_R")}
    print(f"MEASURE {tag} f{frame} mesh_min_z-G={mz - G:.2f} feet={feet} hipJ={tuple(round(v, 2) for v in arm.pose.bones['Hip'].tail)} shoulder={tuple(round(v, 2) for v in arm.pose.bones['Thigh_front_L'].head)} root={tuple(round(v, 2) for v in arm.pose.bones['Root'].location)}")
    print(f"   HEADPITCH {head_pitch():.1f} HEADROLL {head_roll():.1f}")
    # Resulting joints (z above the ground): hind knee/hock, front elbow/wrist.
    j = lambda n, end: tuple(round(v - (G if i == 2 else 0), 2) for i, v in enumerate(getattr(arm.pose.bones[n], end)))
    print(f"   JOINTS knee={j('Thigh_Back_L', 'tail')} hock={j('Calf_back_L', 'tail')} ball={j('Foot_Back_L', 'tail')}"
          f" elbow={j('Thigh_front_L', 'tail')} wrist={j('Calf_Front_L', 'tail')} paw={j('Foot_front_L2', 'tail')}")
    far = [(pb.name, tuple(round(v, 1) for v in pb.head), round(pb.scale.length, 2)) for pb in arm.pose.bones if pb.head.length > 10 or abs(pb.scale.length - 3 ** 0.5) > 0.2]
    if far:
        print("   FAR", far)

def head_pitch():
    """Muzzle angle (°) from horizontal in the Y-Z plane: > 0 = muzzle down."""
    pb = arm.pose.bones["Head"]
    d = (pb.tail - pb.head).normalized()
    r = (REST["Head"][1] - REST["Head"][0]).normalized()
    a = math.degrees(math.atan2(-d.z, -d.y)) - math.degrees(math.atan2(-r.z, -r.y))
    return a

def head_roll():
    """Head roll (°) relative to the world: elevation of the local X axis of the Head bone (horizontal at rest),
    corrected by its rest value. 0 = straight head, ±90 = cheek on the ground."""
    pb = arm.pose.bones["Head"]
    x = pb.matrix.col[0].to_3d().normalized()
    x0 = arm.data.bones["Head"].matrix_local.col[0].to_3d().normalized()
    return math.degrees(math.asin(max(-1, min(1, x.z)))) - math.degrees(math.asin(max(-1, min(1, x0.z))))

# ------------------------------------------------------------------ export
def export(path):
    cat.name = "CatBody"
    bpy.data.objects["Sphere"].name = "EyeA"
    bpy.data.objects["Sphere.001"].name = "EyeB"
    def principled(name, image=None, color=(1, 1, 1, 1), rough=0.8):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        outn = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Base Color"].default_value = color
        nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
        if image is not None:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = image
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        return m
    skin_img = bpy.data.images["Untitled"]
    skin_img.name = "cat_skin"
    skin = principled("cat_skin", image=skin_img, rough=0.85)
    eye = principled("cat_eye", color=(0.35, 0.6, 0.2, 1), rough=0.15)
    cat.data.materials.clear()
    cat.data.materials.append(skin)
    for name in ("EyeA", "EyeB"):
        o = bpy.data.objects[name]
        o.data.materials.clear()
        o.data.materials.append(eye)
    arm.name = "CatArmature"
    ad = arm.animation_data
    ad.action = None
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for act in bpy.data.actions:
        if act.name in ("CameraAction", "Rest"):
            continue
        t = ad.nla_tracks.new()
        t.name = act.name
        t.strips.new(act.name, int(act.frame_range[0]), act)
    for o in list(bpy.data.objects):
        if o.name not in {"CatArmature", "CatBody", "EyeA", "EyeB"}:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_bake_animation=True, export_def_bones=False,
                              export_skins=True, export_morph=False, export_image_format="JPEG", export_jpeg_quality=85,
                              export_yup=True)
    print("EXPORTED", path, os.path.getsize(path), "bytes")

# ------------------------------------------------------------------ main
if ARGS and ARGS[0] == "info":
    print("G (ground) =", round(G, 3))
    for n in ("Thigh_front_L", "Neck", "Spine_controller_1", "Spine", "Hip", "Head_controller", "Tail_controller",
              "Foot_front_IK_L", "Foot_Back_IK_L", "Knee_front_IK_L", "Knee_back_IK_L"):
        h, t, _ = REST[n]
        print(f"REST {n:20s} head={tuple(round(v, 3) for v in h)} tail={tuple(round(v, 3) for v in t)}")
    print("CTRL", CTRL)
elif ARGS and ARGS[0] == "calib":
    for label, bodyk, Nn in (("SIT", SIT_BODY, SIT_N), ("LIE", dict(HJ_=P(0, 3.0, g + 1.5), H_=P(0, 2.2, g + 2.2), M0_=P(0, 1.1, g + 2.45), M1_=P(0, -0.2, g + 2.5), N_=LIE_N, S_=P(0, -2.3, g + 1.8)), LIE_N)):
        for dist in (2.25, 2.4):
            for pitch in (-20, -10, 0, 10, 20, 40, 60):
                p = pose(SIT if label == "SIT" else LIE, body(**bodyk, HD_=head_at(Nn, pitch=pitch, dist=dist)))
                apply_pose(p, ground=False)
                print(f"CALIB {label} dist={dist} pitch_in={pitch:4d} head_pitch={head_pitch():6.1f}")
elif ARGS and ARGS[0] == "preview":
    name = ARGS[1]
    frames = [int(a) for a in ARGS[2:] if a.isdigit()]
    views = ["side", "front", "persp"]
    if "--views" in ARGS:
        views = ARGS[ARGS.index("--views") + 1].split(",")
    # --prefix P: files named P<name>_fNNN_<view>.png (do not overwrite reference previews).
    prefix = ARGS[ARGS.index("--prefix") + 1] if "--prefix" in ARGS else ""
    setup_render()
    if name in PREVIEW_ONLY:  # control pose, never exported
        build_action(name, PREVIEW_ONLY[name])
    elif name not in ACTIONS:  # file action not rebuilt by this script
        use_action(bpy.data.actions[name])
        ik_mode(short=False)
    else:
        build_action(name, ACTIONS[name])
    # Preview sword (and stone) for sword clips: created here only, never on export.
    place = setup_props(name)
    # The stretchable spine IK depends on previous frames: play all frames in order (like the export) before each
    # render, otherwise an isolated frame can explode.
    done = 0
    for f in sorted(frames):
        for k in range(done + 1, f):
            scene.frame_set(k)
        done = f
        if place:
            place(f)
        render(prefix + name, f, views)
elif ARGS and ARGS[0] == "scan":
    # Diagnostic: -- scan front/rear/head[/u] ...; back pose (u: getting-up legs) turned by twisted(), grounded,
    # remaining dip and Root. Root at z > 1 reveals an exploding spine.
    ik_mode(short=True)
    for a in ARGS[1:]:
        v = a.split("/")
        lg = _PET_UP_LEGS if len(v) > 3 and v[3] == "u" else None
        if "--reset" in ARGS:
            apply_pose(REST_POSE)
        if a == "--reset":
            continue
        apply_pose(twisted(_pet_back_body(legs_=lg), float(v[0]), float(v[1]), head=float(v[2])))
        print(f"SCAN {a} min={mesh_min_z() - G:.2f} rootz={arm.pose.bones['Root'].location.z:.2f}")
elif ARGS and ARGS[0] == "sweep":
    # Diagnostic: -- sweep Name; all frames of the action in order, mesh dip and farthest bone (an exploding spine
    # gives bones tens of units away).
    act = build_action(ARGS[1], ACTIONS[ARGS[1]])
    for k in range(1, int(act.frame_range[1]) + 2):
        scene.frame_set(k)
        far = max(arm.pose.bones, key=lambda pb: pb.head.length)
        print(f"SWEEP {ARGS[1]} f{k} min={mesh_min_z() - G:.2f} far={far.name} {far.head.length:.1f}")
elif ARGS and ARGS[0] == "hump":
    # Diagnostic: -- hump [Name ...] [frames ...]; for each frame, fold of the spine bones (see below) and mesh hump.
    # 1 unit is about 8.6 cm in the game. HUMP_ALL=1: one line per frame; HUMP_PROFILE=1: profile and joints.
    # On the mesh: back profile (midline vertices |x| < 0.3, in Root frame, highest z per 0.25 y slice); hump =
    # largest gap of the profile above the withers (y = -1.5) to rump (y = 2.75) line.
    YS = [-1.5 + 0.25 * i for i in range(18)]   # -1.5 .. 2.75

    def mesh_hump():
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cat.evaluated_get(dg)
        m = ev.to_mesh()
        # Root displacement (pose x rest^-1, armature space): cancelled to return to the standing frame.
        delta = arm.pose.bones["Root"].matrix @ arm.data.bones["Root"].matrix_local.inverted()
        inv = delta.inverted() @ arm.matrix_world.inverted() @ ev.matrix_world
        top = {}
        for v in m.vertices:
            p = inv @ v.co
            if abs(p.x) < 0.3 and -1.625 <= p.y < 2.875:
                i = round((p.y + 1.5) / 0.25)
                if p.z > top.get(i, -99):
                    top[i] = p.z
        ev.to_mesh_clear()
        if os.environ.get("HUMP_PROFILE"):
            print("PROFILE", " ".join(f"{YS[i]:.2f}:{top[i] - G:.2f}" for i in sorted(top)))
        z0, z1 = top.get(0), top.get(len(YS) - 1)
        if z0 is None or z1 is None:
            return float("nan"), 0
        best = (-9.0, 0.0)
        for i, y in enumerate(YS):
            if i in top:
                best = max(best, (top[i] - (z0 + (z1 - z0) * i / (len(YS) - 1)), y))
        return best

    names = [a for a in ARGS[1:] if not a.isdigit()] or [n for n in ACTIONS if n != "Rest"]
    for name in names:
        act = build_action(name, ACTIONS[name])
        worst, mworst = (-9, 0), (-9, 0, 0)
        only = [int(a) for a in ARGS[1:] if a.isdigit()]
        for k in range(1, int(act.frame_range[1]) + 2):
            scene.frame_set(k)
            if only and k not in only:
                continue
            pb = arm.pose.bones
            # Spine fold: largest 3D gap of the Spine.002 to Spine.004 joints from the chord (head of Spine.001 to
            # tail of Spine.004). A compressed spine folds in a zigzag (hump).
            a, b = pb["Spine.001"].head.copy(), pb["Spine.004"].tail.copy()
            ab = (b - a).normalized()
            h = max(((pb[n].head - a) - ab * (pb[n].head - a).dot(ab)).length for n in ("Spine.002", "Spine.003", "Spine.004"))
            if os.environ.get("HUMP_PROFILE"):
                print(f"BONES {name} f{k}", " ".join(f"{n}:({pb[n].head.y:.2f},{pb[n].head.z - G:.2f},s{pb[n].scale.y:.2f})" for n in
                      ("Spine", "Spine.001", "Spine.002", "Spine.003", "Spine.004", "Neck", "Shoulder_front_L", "Thigh_front_L", "Hip")))
            mh, my = mesh_hump()
            if os.environ.get("HUMP_ALL"):
                print(f"HUMPF {name} f{k} {h:.2f} {mh:.2f} y={my:.2f}")
            worst = max(worst, (h, k))
            mworst = max(mworst, (mh, k, my))
        print(f"HUMP {name} bones max={worst[0]:.2f} f{worst[1]} ({(worst[1] - 1) / FPS:.2f} s)"
              f" | mesh max={mworst[0]:.2f} f{mworst[1]} ({(mworst[1] - 1) / FPS:.2f} s) y={mworst[2]:.2f}")
elif ARGS and ARGS[0] == "carry":
    # Diagnostic: -- carry [step]; Carried played in order, vertical distance (armature frame, z) from the nape point
    # to the lowest vertex, and its heaviest bone. Nape point: highest midline vertex above the head of Neck.001 at
    # rest. Blender mesh (subdivision after the armature): order of magnitude only, the GLB value is authoritative.
    def arm_verts():
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cat.evaluated_get(dg)
        m = ev.to_mesh()
        inv = arm.matrix_world.inverted() @ ev.matrix_world
        out = [inv @ v.co for v in m.vertices]
        ev.to_mesh_clear()
        return out
    apply_pose(REST_POSE)
    nh = arm.pose.bones["Neck.001"].head
    vs = arm_verts()
    nape = max((i for i, p in enumerate(vs) if abs(p.x) < 0.1 and abs(p.y - nh.y) < 0.15), key=lambda i: vs[i].z)
    step = int(ARGS[1]) if len(ARGS) > 1 else 6
    act = build_action("Carried", ACTIONS["Carried"])
    for k in range(1, int(act.frame_range[1]) + 2):
        scene.frame_set(k)
        if (k - 1) % step:
            continue
        vs = arm_verts()
        lo = min(range(len(vs)), key=lambda i: vs[i].z)
        print(f"CARRY f{k} nape->low {vs[nape].z - vs[lo].z:.2f} u (vertex {lo} at "
              f"{tuple(round(c, 2) for c in vs[lo])}, nape {tuple(round(c, 2) for c in vs[nape])})")
elif ARGS and ARGS[0] == "export":
    use_action(bpy.data.actions["run"])
    ik_mode(short=False)
    set_ears(None)  # ears keyed at rest in "run" too (see EAR_ROOTS)
    for n in EAR_ROOTS:
        arm.pose.bones[n].keyframe_insert("rotation_quaternion", frame=1)
    for name, keys in ACTIONS.items():
        if name != "Rest":
            build_action(name, keys)
    # The first baked clip (Carried) starts from the state left by the last built action (rig cycle). Restore the SIT
    # state (the end of Yawn): with SwordPull last (ends in SWORD_STANCE), Carried would shift by 6.4° on the tail.
    apply_pose(SIT)
    export(ARGS[1])
