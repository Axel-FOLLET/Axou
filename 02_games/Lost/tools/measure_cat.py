"""Measures the cat's proportions (rest mesh) and compares them with the reference studies (docs/research/).

Usage (Windows, Git Bash, from the project root; about 20 s per run):
  B="/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"
  "$B" -b assets/sources/cat.blend --python tools/measure_cat.py -- [--raw]

One run measures both states: the script imports tools/anim_cat.py with `--raw` (prep() runs, reshape() does not), measures
the raw mesh, calls anim_cat.reshape(), measures again and prints a Markdown table (raw / reshaped / target (source) /
deviation). With `--raw`, only the raw state is measured. Nothing is saved: neither the .blend nor any file.
`--set NAME=VALUE` (repeatable) overrides a constant of the reshape block of anim_cat.py for a trial, without editing the
file (e.g. `--set EAR_SCALE=0.85`).

Landmarks on the model (world space = armature space: -Y muzzle, +Z up, +X cat's left):
  - eyes: centres of objects `Sphere` (+X) and `Sphere.001` (-X), mean of their vertices. The interocular distance (IOD,
    centre to centre) is the unit of the frontal ratios.
  - frontal frame: origin between the eyes, x axis = world X, "up" axis u perpendicular to the `Nose` bone in the Y-Z plane,
    matching a photo taken along the muzzle axis.
  - ears: vertices of `Cat` whose weight sum on the ear bones (anim_cat.EAR_BONES) is >= 0.5 (EAR_W), on each side. Tip =
    highest vertex in the frontal frame. Inner / outer bases = vertices of the lowest 30% band along the bone axis, of
    minimal / maximal |x|. Height, base width, tilt and gaps are 2D distances in the frontal frame, as on photos.
  - nose pad bottom: midline vertices (|x| < 0.10) less than 0.12 behind the most forward vertex; the lowest is taken.
  - head width: x extent of the head vertices (y < head of the `Head` bone, ears excluded).
  - profile: prosthion = nose tip, nasion = most forward midline vertex at eye height (|u| < 0.2 IOD), inion = head of the
    `Head` bone. Facial length = nose to nasion, skull length = nose to inion.
  - limbs: rest lengths of the bones (`Thigh_front_L` = humerus, `Calf_Front_L` = radius, `Thigh_Back_L` = femur,
    `Calf_back_L` = tibia). Withers height = mesh top above the neck base (|y - y(Neck.head)| < 0.3) minus the lowest point.
  - tail: sum of the lengths of `Tail` to `Tail.007`. Head-body = y distance from the nose tip to the head of the `Tail` bone.
Limits: 1,417 vertices (19 per ear above the threshold), so ear bases and nasion are only accurate to one vertex. Eyelid
opening is not measured (eyeball diameter / head width is given, to compare with about 0.32).
"""
import bpy, sys, os, math
from mathutils import Vector

MY_ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RAW_ONLY = "--raw" in MY_ARGS
# Trials without editing anim_cat.py: `--set EAR_SCALE=0.9 --set CHEEK=0.1` replaces a constant of the reshape block before
# reshape() is called (scalar constants only; SKULL: `--set SKULL=0,-3.7,3`).
OVERRIDES = {}
for i, a in enumerate(MY_ARGS):
    if a == "--set" and i + 1 < len(MY_ARGS):
        k, v = MY_ARGS[i + 1].split("=", 1)
        OVERRIDES[k] = v

# anim_cat.py reads sys.argv on import and runs prep() then reshape() unless `--raw`: it is given `--raw` to get the raw
# mesh, then reshape() is called here.
_saved = sys.argv
sys.argv = [sys.argv[0], "--", "--raw"]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.getcwd(), "tools"))
import anim_cat as A
sys.argv = _saved

arm, cat = A.arm, A.cat
EAR_W = 0.5       # ear weight threshold
BAND = 0.30       # lower fraction of the ear (along the bone axis) searched for the bases
MID_X = 0.10      # half-width of the midline band (Blender units)
NOSE_DY = 0.12    # depth of the nose pad behind the nose tip (Blender units)


def bone(n):
    b = arm.data.bones[n]
    return arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local


def eye_centers():
    out = []
    for n in ("Sphere", "Sphere.001"):
        o = bpy.data.objects[n]
        ws = [o.matrix_world @ v.co for v in o.data.vertices]
        c = sum(ws, Vector()) / len(ws)
        out.append((c, max((w - c).length for w in ws)))
    return out


def measure():
    """Measures the landmarks and ratios on the current state of the mesh. Returns (ratios, landmarks)."""
    mw = cat.matrix_world
    P = [mw @ v.co for v in cat.data.vertices]
    W = [A._real_weights(cat, v) for v in cat.data.vertices]
    WE = [sum(w.get(n, 0) for n in A.EAR_BONES) for w in W]
    (cL, rL), (cR, rR) = eye_centers()
    O = (cL + cR) / 2
    IOD = (cL - cR).length
    nh, nt = bone("Nose")
    F = (nt - nh)
    F = Vector((0, F.y, F.z)).normalized()
    U = Vector((0, -F.z, F.y))
    if U.z < 0:
        U = -U
    pitch = math.degrees(math.atan2(-F.z, -F.y))

    def face(p):
        d = p - O
        return (d.x / IOD, d.dot(U) / IOD)

    def d2(a, b):
        return math.hypot(a[0] - b[0], a[1] - b[1])

    L = {}  # landmarks (world)
    R = {}  # ratios
    L["IOD"] = IOD
    L["nose_pitch_deg"] = pitch
    L["eye_L"], L["eye_R"], L["eye_r"] = cL, cR, (rL + rR) / 2

    # --- nose pad, nose, nasion
    head_y = bone("Head")[0].y
    mid = [p for p in P if abs(p.x) < MID_X and p.y < head_y]
    nose_tip = min(mid, key=lambda p: p.y)
    pad = [p for p in mid if p.y < nose_tip.y + NOSE_DY]
    nose_bottom = min(pad, key=lambda p: face(p)[1])
    L["nose_tip"], L["nose_bottom"], L["nose_pad_n"] = nose_tip, nose_bottom, len(pad)
    R["nose_below_eyes"] = -face(nose_bottom)[1]
    at_eye = [p for p in mid if abs(face(p)[1]) < 0.2 and p.y < O.y + 0.6]
    nasion = min(at_eye, key=lambda p: p.y)
    L["nasion"] = nasion
    inion = bone("Head")[0]
    L["inion"] = inion
    facial = (nose_tip - nasion).length
    skull = (nose_tip - inion).length
    R["facial_over_skull"] = facial / skull
    L["facial"], L["skull"] = facial, skull

    # --- head width (ears excluded)
    head = [p for p, we in zip(P, WE) if p.y < head_y and we < 0.01]
    HW = max(p.x for p in head) - min(p.x for p in head)
    L["head_width"] = HW
    R["iod_over_head_width"] = IOD / HW
    R["eyeball_over_head_width"] = 2 * L["eye_r"] / HW

    # --- ears
    ears = {}
    for s, base_n, tip_n in ((1, "Ear", "Ear.002"), (-1, "Ear.006", "Ear.004")):
        E = [p for p, we in zip(P, WE) if we >= EAR_W and p.x * s > 0]
        B = bone(base_n)[0]
        d = (bone(tip_n)[1] - B).normalized()
        tip = max(E, key=lambda p: face(p)[1])
        proj = [(p - B).dot(d) for p in E]
        lo, hi = min(proj), max(proj)
        band = [p for p, t in zip(E, proj) if t <= lo + BAND * (hi - lo)]
        inner = min(band, key=lambda p: abs(p.x))
        outer = max(band, key=lambda p: abs(p.x))
        t2, i2, o2 = face(tip), face(inner), face(outer)
        bc = ((i2[0] + o2[0]) / 2, (i2[1] + o2[1]) / 2)
        ears[s] = dict(n=len(E), band=len(band), tip=tip, inner=inner, outer=outer, t2=t2, i2=i2, o2=o2, bc=bc,
                       height=d2(t2, bc), base=d2(i2, o2),
                       tilt=math.degrees(math.atan2((t2[0] - bc[0]) * s, t2[1] - bc[1])),
                       h3d=(tip - (inner + outer) / 2).length)
    L["ears"] = ears
    e1, e2 = ears[1], ears[-1]
    R["ear_height"] = (e1["height"] + e2["height"]) / 2
    R["ear_base"] = (e1["base"] + e2["base"]) / 2
    R["ear_slenderness"] = R["ear_height"] / R["ear_base"]
    R["ear_tilt_deg"] = (e1["tilt"] + e2["tilt"]) / 2
    R["tips_gap"] = d2(e1["t2"], e2["t2"])
    R["tips_height"] = (e1["t2"][1] + e2["t2"][1]) / 2
    R["outer_bases_gap"] = d2(e1["o2"], e2["o2"])
    R["inner_bases_gap"] = d2(e1["i2"], e2["i2"])
    R["iod_over_outer_bases"] = 1 / R["outer_bases_gap"]
    R["outer_bases_height"] = (e1["o2"][1] + e2["o2"][1]) / 2
    R["inner_bases_height"] = (e1["i2"][1] + e2["i2"][1]) / 2
    R["tip_x"] = (abs(e1["t2"][0]) + abs(e2["t2"][0])) / 2
    R["outer_base_x"] = (abs(e1["o2"][0]) + abs(e2["o2"][0])) / 2
    R["inner_base_x"] = (abs(e1["i2"][0]) + abs(e2["i2"][0])) / 2
    tot = R["nose_below_eyes"] + R["tips_height"]
    R["eyes_fraction"] = R["tips_height"] / tot
    R["pinna_over_head_width"] = (e1["h3d"] + e2["h3d"]) / 2 / HW

    # --- limbs and withers
    ground = min(p.z for p in P)
    ny = bone("Neck")[0].y
    withers = max(p.z for p, we in zip(P, WE) if abs(p.y - ny) < 0.3 and we < 0.01) - ground
    L["ground"], L["withers"] = ground, withers
    seg = {k: (bone(k)[1] - bone(k)[0]).length for k in ("Thigh_front_L", "Calf_Front_L", "Foot_front_L2", "Thigh_Back_L", "Calf_back_L", "Foot_Back_L")}
    L["segments"] = seg
    R["humerus_over_withers"] = seg["Thigh_front_L"] / withers
    R["radius_over_withers"] = seg["Calf_Front_L"] / withers
    R["femur_over_withers"] = seg["Thigh_Back_L"] / withers
    R["tibia_over_withers"] = seg["Calf_back_L"] / withers
    R["intermembral"] = (seg["Thigh_front_L"] + seg["Calf_Front_L"]) / (seg["Thigh_Back_L"] + seg["Calf_back_L"])
    R["radius_over_humerus"] = seg["Calf_Front_L"] / seg["Thigh_front_L"]
    R["tibia_over_femur"] = seg["Calf_back_L"] / seg["Thigh_Back_L"]

    # --- tail
    tail = sum((bone(n)[1] - bone(n)[0]).length for n in ("Tail", "Tail.001", "Tail.002", "Tail.003", "Tail.004", "Tail.005", "Tail.006", "Tail.007"))
    hb = bone("Tail")[0].y - nose_tip.y
    L["tail"], L["head_body"] = tail, hb
    R["tail_over_head_body"] = tail / hb
    R["head_over_head_body"] = skull / hb
    R["head_width_over_withers"] = HW / withers
    return R, L


# (key, label, target, source)
ROWS = [
    ("nose_below_eyes", "Nose pad bottom below the eye line", 0.785, "photo study (Q1-Q3 0.712-0.848)"),
    ("tips_height", "Ear tips height above the eyes", 1.589, "photo study (1.457-1.730)"),
    ("tips_gap", "Ear tips gap", 2.511, "photo study (2.335-2.727)"),
    ("eyes_fraction", "Eye position: tips / (tips -> nose pad)", 0.672, "photo study (0.654-0.692)"),
    ("ear_height", "Ear height (tip -> mid-base)", 0.983, "photo study (0.900-1.082)"),
    ("ear_base", "Ear base width", 0.830, "photo study (0.755-0.912)"),
    ("ear_slenderness", "Ear slenderness (height / base)", 1.179, "photo study (1.078-1.299)"),
    ("ear_tilt_deg", "Ear tilt (degrees, > 0 outwards)", 26.8, "photo study (22.8-31.8)"),
    ("outer_bases_gap", "Outer ear bases gap", 2.281, "photo study (2.164-2.422)"),
    ("inner_bases_gap", "Inner ear bases gap", 0.947, "photo study (0.839-1.086)"),
    ("iod_over_outer_bases", "Eye gap / outer ear bases gap", 0.438, "photo study (0.413-0.462)"),
    ("outer_bases_height", "Outer ear bases height above the eyes", 0.473, "photo study (0.358-0.595)"),
    ("inner_bases_height", "Inner ear bases height above the eyes", 0.955, "photo study (0.862-1.059)"),
    ("tip_x", "|x| of the ear tip", 1.255, "photo study"),
    ("outer_base_x", "|x| of the outer ear base", 1.140, "photo study"),
    ("inner_base_x", "|x| of the inner ear base", 0.473, "photo study"),
    ("iod_over_head_width", "Eye gap / head width", 0.544, "literature study [T09]"),
    ("pinna_over_head_width", "Ear pinna height (3D) / head width", 0.781, "literature study [T09]"),
    ("eyeball_over_head_width", "Eyeball diameter / head width", 0.32, "literature study (cross-checked [K12]/[T09])"),
    ("facial_over_skull", "Profile: facial length / skull length", 0.387, "literature study [S21] (substitute, § 4)"),
    ("humerus_over_withers", "Humerus / withers height", 0.387, "literature study [P24]"),
    ("radius_over_withers", "Radius / withers height", 0.375, "literature study [P24]"),
    ("femur_over_withers", "Femur / withers height", 0.416, "literature study [P24]"),
    ("tibia_over_withers", "Tibia / withers height", 0.438, "literature study [P24]"),
    ("intermembral", "Intermembral index (hum.+rad.) / (fem.+tib.)", 0.892, "literature study [P24]/[K26]"),
    ("radius_over_humerus", "Brachial index radius / humerus", 0.968, "literature study [P24]/[K26]"),
    ("tibia_over_femur", "Crural index tibia / femur", 1.053, "literature study [P24]/[K26]"),
    ("tail_over_head_body", "Tail / head-body", 0.54, "literature study [J-A] (0.54-0.65 with [WP])"),
    ("head_over_head_body", "Head length (nose -> inion) / head-body", 0.203, "literature study [F20] (length not defined)"),
    ("head_width_over_withers", "Head width / withers height", 0.24, "literature study (cross-checked [T09]/[P24])"),
]


def fmt(v, key):
    return f"{v:.1f}" if key.endswith("_deg") else f"{v:.3f}"


def print_landmarks(tag, L):
    r = lambda v: tuple(round(x, 3) for x in v)
    print(f"LANDMARKS {tag}: IOD={L['IOD']:.3f} eyes={r(L['eye_L'])}/{r(L['eye_R'])} eyeball_r={L['eye_r']:.3f} "
          f"nose_pitch={L['nose_pitch_deg']:.1f}deg nose={r(L['nose_tip'])} pad_bottom={r(L['nose_bottom'])} (n_pad={L['nose_pad_n']}) "
          f"nasion={r(L['nasion'])} inion={r(L['inion'])} facial={L['facial']:.3f} skull={L['skull']:.3f} head_width={L['head_width']:.3f}")
    for s, e in L["ears"].items():
        print(f"   EAR {'+x' if s > 0 else '-x'} n={e['n']} band={e['band']} tip={r(e['tip'])} base_in={r(e['inner'])} base_out={r(e['outer'])} "
              f"(frontal frame: tip={tuple(round(v, 3) for v in e['t2'])} base_in={tuple(round(v, 3) for v in e['i2'])} base_out={tuple(round(v, 3) for v in e['o2'])})")
    seg = {k: round(v, 3) for k, v in L["segments"].items()}
    print(f"   BODY ground={L['ground']:.3f} withers={L['withers']:.3f} segments={seg} tail={L['tail']:.3f} head_body={L['head_body']:.3f}")


def print_table(raw, shaped):
    cols = "| Ratio | raw | reshaped | target | deviation (reshaped − target) | source |" if shaped else "| Ratio | raw | target | deviation (raw − target) | source |"
    print()
    print(cols)
    print("|" + "---|" * (6 if shaped else 5))
    for key, label, target, src in ROWS:
        a = fmt(raw[key], key)
        if shaped:
            b = fmt(shaped[key], key)
            e = fmt(shaped[key] - target, key)
            print(f"| {label} | {a} | {b} | {fmt(target, key)} | {e} | {src} |")
        else:
            e = fmt(raw[key] - target, key)
            print(f"| {label} | {a} | {fmt(target, key)} | {e} | {src} |")


raw_R, raw_L = measure()
print_landmarks("raw", raw_L)
if RAW_ONLY:
    print_table(raw_R, None)
else:
    for k, v in OVERRIDES.items():
        setattr(A, k, Vector([float(x) for x in v.split(",")]) if "," in v else float(v))
        print(f"OVERRIDE {k}={getattr(A, k)}")
    A.reshape()
    print(f"RESHAPE params: EAR_SCALE={A.EAR_SCALE} CHEEK={A.CHEEK} MUZZLE_Y={A.MUZZLE_Y} MUZZLE={A.MUZZLE} CHIN={A.CHIN} "
          f"SKULL={tuple(A.SKULL)} HEAD_SCALE={A.HEAD_SCALE} EYE_SCALE={A.EYE_SCALE} EYE_R1={A.EYE_R1} EYE_R2={A.EYE_R2}")
    sh_R, sh_L = measure()
    print_landmarks("reshaped", sh_L)
    print_table(raw_R, sh_R)
