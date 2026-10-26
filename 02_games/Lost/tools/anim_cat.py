"""Animation du chat BlendSwap dans Blender (headless), par contrôleurs IK du rig d'origine.

Les poses sont décrites par la position absolue (espace armature) des contrôleurs IK ; l'IK du
rig fait le reste. Un os `Root` ajouté au-dessus de tous les os racines porte le roulis (flanc,
dos) et la translation globale. Chaque pose est remise au sol automatiquement (sommet le plus bas
du maillage évalué). Les clips sont cuits os par os dans le GLB (tous les os, contrôleurs compris).

Usage (Windows, Git Bash, depuis la racine de Lost ; ~20 s par lancement) :
  B="/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- preview <action> <frame>... [--views side,front,top,persp]
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- export public/models/cat.glb
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- info
  "$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- calib
Les aperçus PNG vont dans .shots/blender/ (gitignoré) ; chaque rendu imprime une ligne MEASURE
(distance maillage-sol, hauteur des pieds, hanche, épaule) et HEADPITCH (museau, > 0 = bas).

Repère armature : -Y = museau, +Y = queue, +Z = haut, +X = gauche du chat. Le chat fait ~10 unités.

Pièges (mesurés, 2026-10-20) :
  - les IK à chain_count = 0 (Spine, Spine.002, Spine.004) remontent jusqu'à la racine : avec Root
    en plus, la chaîne changeait et la pose de repos montait de 0,65 ; prep() fige la longueur ;
  - l'IK du cou (Neck.002 → Head_controller, chaîne 3) prime sur les Copy Rotation de Neck.002 :
    l'orientation de la tête dépend de la direction base-du-cou → contrôleur et du repli de la
    chaîne, pas de la rotation du contrôleur. head_at() place le contrôleur à distance 2,4 (cou
    quasi tendu, longueur 2,46) avec un décalage calibré de 21,3° (mode `calib`).
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

# ------------------------------------------------------------------ préparation du rig
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
    # Les IK « chain_count = 0 » remontaient jusqu'à l'ancienne racine ; avec Root elles l'incluraient.
    # On fige la longueur d'origine (nombre d'os jusqu'à l'ancienne racine incluse).
    for pb in arm.pose.bones:
        for c in pb.constraints:
            if c.type == "IK" and c.chain_count == 0:
                n, b = 0, pb
                while b is not None and b.name != "Root":
                    n += 1
                    b = b.parent
                c.chain_count = n
                print(f"IKCHAIN {pb.name} -> {n}")
    # Pattes arrière : l'IK du pied (chaîne 3 : métatarse, tibia, cuisse) prime sur celle du jarret
    # (chaîne 2) et replie la patte quand le jarret doit toucher le sol (assis : genou à 2,5 unités
    # du sol, plus haut que la hanche, jarret jamais posé ; mesuré 2026-10-22). « IK1 » ne fait
    # tourner que le métatarse : la cuisse et le tibia suivent alors la cible du jarret. Les poses de
    # ce script utilisent IK1 ; la marche et la course d'origine, faites pour l'IK sur 3 os, gardent
    # « IK » (influences clées dans chaque action, voir ik_mode()).
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
    """Choisit l'IK des pieds arrière pour l'action active et clé les influences (valeur constante)."""
    for n in ("Foot_Back_L", "Foot_Back_R"):
        cs = arm.pose.bones[n].constraints
        cs["IK"].influence, cs["IK1"].influence = (0.0, 1.0) if short else (1.0, 0.0)
        cs["IK"].keyframe_insert("influence", frame=frame)
        cs["IK1"].keyframe_insert("influence", frame=frame)

def use_action(act):
    """Action active (Blender 4.4+ : sans slot, l'action n'anime rien ; l'aperçu de Walk restait au repos)."""
    arm.animation_data_create()
    arm.animation_data.action = act
    if getattr(act, "slots", None) and arm.animation_data.action_slot is None:
        arm.animation_data.action_slot = act.slots[0]

# ------------------------------------------------------------------ remodelage « mignon » (2026-10-22)
# Le modèle d'origine est un chat adulte réaliste (museau de renard, petits yeux, grandes oreilles,
# pattes fines). On déforme le maillage au repos, avant toute pose : les os ne bougent pas, la peau
# suit donc toujours le squelette. Chaque déformation est lisse (pas d'arête) :
#   - oreilles ramenées vers leur base (selon les poids des os d'oreille) ;
#   - pattes épaissies autour de leurs os (selon les poids des os de patte) ;
#   - joues élargies, museau raccourci, crâne un peu grossi, puis « loupe » sur chaque œil : le globe
#     et l'ouverture des paupières grossissent ensemble (déformations spatiales, appliquées aussi aux
#     globes oculaires).
# Les clés de forme (shape keys) du maillage reçoivent la même déformation.
# 0,75 -> 0,85 (A1, 2026-10-22, tools/measure_cat.py) : à 0,75 les pointes d'oreilles n'étaient qu'à
# 1,35 écart des yeux au-dessus des yeux, hors de la plage réelle (médiane 1,589, Q1-Q3 1,457-1,730,
# docs/recherche/proportions_mesures.md § 4.1). À 0,85 : pointes à 1,49 (≈ Q1 : « petites oreilles »
# assumé), écart des pointes 2,49 (cible 2,511), base 0,81 (cible 0,830), inclinaison 26,9° (cible
# 26,8°). Reste hors cible, non corrigeable par une échelle uniforme : hauteur d'oreille 0,63 (cible
# 0,983) et élancement 0,78 (cible 1,179), bases trop hautes et trop écartées (maillage d'origine).
# Tête F (validée par l'utilisateur le 2026-10-23 sur rendus comparatifs) : en plus de EAR_SCALE,
# chaque oreille est étirée de EAR_STRETCH le long de son axe base -> pointe (tête de Ear / Ear.006
# -> queue de Ear.002 / Ear.004), au prorata du poids d'oreille : vise l'écart de hauteur
# d'oreille (0,63 contre 0,983) et d'élancement (0,78 contre 1,179) qu'une échelle uniforme ne
# corrigeait pas.
EAR_SCALE, EAR_STRETCH = 0.85, 1.45
EAR_BONES = {"Ear", "Ear.001", "Ear.002", "Ear.006", "Ear.003", "Ear.004"}
LEG_THICK = {"Thigh_front_L": 1.12, "Thigh_front_R": 1.12, "Calf_Front_L": 1.3, "Calf_Front_R": 1.3,
             "Foot_front_L2": 1.25, "Foot_front_L2.002": 1.25, "Foot_front_L": 1.2, "Foot_front_R": 1.2,
             "Thigh_Back_L": 1.12, "Thigh_Back_R": 1.12, "Calf_back_L": 1.3, "Calf_back_R": 1.3,
             "Foot_Back_L": 1.25, "Foot_Back_R": 1.25, "Foot_Back_L2": 1.2, "Foot_Back_L2.002": 1.2}
CHEEK = 0.18                    # élargissement des joues (0,12 avant la tête F)
# Devant le plan y = MUZZLE_Y, MUZZLE raccourcit le museau et CHIN recule le bas de la face, sous
# la bouche (z < ~2,4). Historique : 50 % donnait une face plate et un menton saillant (2026-10-22),
# puis 0,3 / 0,6 ; la tête F (2026-10-23) reprend le profil du modèle d'origine : 0 / 0.
MUZZLE_Y, MUZZLE, CHIN = -4.0, 0.0, 0.0
SKULL, HEAD_SCALE = Vector((0, -3.7, 3.0)), 1.12        # 1,08 avant la tête F
EYE_SCALE, EYE_R1, EYE_R2 = 1.45, 0.2, 0.65              # 1,35 avant la tête F

def _smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def _magnify(p, c, k, r1, r2):
    """Grossit de k autour de c jusqu'à r1, sans effet au-delà de r2."""
    d = (p - c).length
    return c + (p - c) * (1 + (k - 1) * (1 - _smooth(r1, r2, d)))

def _perp(p, a, b):
    """Écart de p au segment [a, b], perpendiculaire à l'os."""
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
    """Poids normalisés sur les seuls groupes qui portent le nom d'un os (les « Bone.0xx » n'en ont pas)."""
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
    print("RESHAPE ok, yeux", [tuple(round(x, 3) for x in c) for c in centers])

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
G = mesh_min_z()  # niveau du sol = point le plus bas du maillage au repos

# ------------------------------------------------------------------ pose par points
def set_bone(name, pos=None, rot=None, aim=None, pre=None, off=Vector((0, 0, 0))):
    """Place un contrôleur (enfant direct de Root) en espace armature.
    pos : Vector ; aim : direction voulue de l'os ; rot : Euler degrés (X,Y,Z) appliqué ensuite ;
    pre : Matrix 3x3 appliquée en dernier (roulis global)."""
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

# Oreilles (2026-10-26, mission catgame_monde, agent A). Cause de la « corne » des papouilles (mesurée,
# voir la fiche 04) : l'oreille n'est ni étirée ni déformée (0,135 m constant dans le jeu, Procedural
# actif ou non) ; longue (EAR_STRETCH, tête F validée) et, au tour 2, mesurée vue DE FACE (et non par
# la tranche comme supposé au tour 1) par sa face extérieure sombre quand le chat est sur le flanc :
# grand triangle plat, d'où la corne (voir PET_EARS et la fiche 04, « Tour 2 »). "_ears" = (dehors, arrière, ouverture) en degrés,
# rotation de Ear / Ear.006 dans le repère de repos de l'armature : pointe vers l'extérieur (autour de
# Y), vers l'arrière (autour de X), ouverture tournée vers le côté (autour de Z). Les deux os sont
# clés dans TOUTES les actions (rotation nulle par défaut) : un os non clé garderait à l'export la
# valeur de l'action précédente (comme le Pivot).
EAR_ROOTS = {"Ear": 1, "Ear.006": -1}

def set_ears(spec=None):
    out, back, opn = spec or (0, 0, 0)
    for n, s in EAR_ROOTS.items():
        Ra = (Matrix.Rotation(math.radians(s * out), 3, "Y") @ Matrix.Rotation(math.radians(-back), 3, "X")
              @ Matrix.Rotation(math.radians(s * opn), 3, "Z"))
        M = REST[n][2].to_3x3()
        arm.pose.bones[n].rotation_quaternion = (M.inverted() @ Ra @ M).to_quaternion()

def apply_pose(pose, ground=True):
    """pose : dict nom -> dict(pos=, rot=, aim=, pre=) ; 'Root' -> dict(pos=, rot=|quat=).
    Avec ground=True, tout est remonté pour que le maillage affleure le sol G."""
    set_ears(pose.get("_ears"))
    _apply(pose, Vector((0, 0, 0)))
    off = 0.0
    if ground:
        for _ in range(3):
            dz = G - mesh_min_z()
            if abs(dz) < 0.01:
                break
            off += dz
            _apply(pose, Vector((0, 0, off)))
    # "_air" (Pounce, phase en l'air) : hauteur ajoutée après la mise au sol. Clé ignorée par _apply.
    if pose.get("_air"):
        _apply(pose, Vector((0, 0, off + pose["_air"])))

_LAST_Q = {}

def key_all(frame):
    for name in EAR_ROOTS:
        arm.pose.bones[name].keyframe_insert("rotation_quaternion", frame=frame)
    for name in CTRL + ["Root"]:
        pb = arm.pose.bones[name]
        # Continuité de signe des quaternions : `pb.matrix = …` canonise le signe (w >= 0), si bien
        # qu'entre deux clés q et -q (même rotation) l'interpolation passe par zéro et le maillage
        # explose sur une image (observé : Pet f67, maillage à -82 unités). q et -q sont équivalents :
        # on choisit celui du même hémisphère que la clé précédente de l'os.
        q = pb.rotation_quaternion.copy()
        prev = _LAST_Q.get(name)
        if prev is not None and q.dot(prev) < 0:
            q.negate()
            pb.rotation_quaternion = q
        _LAST_Q[name] = q
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("rotation_quaternion", frame=frame)

RESET_KEYS = {"Pet", "Sleep"}
PIVOT_OFF = {"Pet"}
def build_action(name, keys, interpolation="BEZIER"):
    """keys : liste de (temps_s, pose). Crée l'action et la rend active.
    Le rig a un cycle de dépendance (contrainte Pivot de Spine vers son enfant Spine.001 : « Dependency
    cycle detected ») : l'évaluation garde un état d'une évaluation à l'autre. Entre deux clés éloignées,
    la colonne pouvait exploser (Pet refait : Root à z = 54 puis 73 000 aux clés 4,0 et 6,0 s ; mode
    `scan`, 2026-10-25 nuit). Pour RESET_KEYS, chaque clé part de la pose de repos ; les mêmes poses
    sont alors toutes stables (mode `scan --reset`)."""
    if name in bpy.data.actions:  # remplace l'action d'origine du même nom (Walk)
        bpy.data.actions.remove(bpy.data.actions[name])
    if name in LOOP_FRAMES:
        interpolation = "LINEAR"  # une clé par image : pas de tangente plate à la boucle
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    ik_mode(short=True)
    # Contrainte Pivot de Spine (cible : son enfant Spine.001, source du cycle) : coupée dans les
    # actions de PIVOT_OFF, clée à 1 ailleurs (une valeur non clée resterait celle de l'action
    # précédente à l'export). Mesure (mode `sweep`, 2026-10-25 nuit) : avec le Pivot, Pet parcouru
    # dans l'ordre explose f91-f107 et f155-f163 (os jusqu'à 1 378 unités, ×1,45 par image).
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
        key_all(round(t * FPS) + 1)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = interpolation
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
    act.frame_range = (1, round(keys[-1][0] * FPS) + 1)
    if name in LOOP_FRAMES:
        # L'export cuit une image de plus que la plage (clips à 1,04 s, 2,04 s… mesuré dans
        # pose_preview) : pour une boucle sans à-coup, la plage s'arrête une image avant la clé finale.
        act.frame_range = (1, LOOP_FRAMES[name])
    return act

# ------------------------------------------------------------------ vocabulaire
V = Vector
def P(x, y, z): return V((x, y, z))

# Points de repos (espace armature)
S = REST["Thigh_front_L"][0]        # épaule (origine des deux pattes avant)
N = REST["Neck"][0]                 # base du cou
M1 = REST["Spine_controller_1"][0]  # milieu de la colonne
M0 = REST["Spine"][0]               # arrière de la colonne
H = REST["Hip"][0]                  # tête de l'os Hip
HJ = REST["Hip"][1]                 # articulation de la hanche
HD = REST["Head_controller"][0]     # base de la tête
T = REST["Tail_controller"][0]      # bout de la queue
FL, FR = REST["Foot_front_IK_L"][0], REST["Foot_front_IK_R"][0]
BL, BR = REST["Foot_Back_IK_L"][0], REST["Foot_Back_IK_R"][0]
WL, WR = REST["Knee_front_IK_L"][0], REST["Knee_front_IK_R"][0]   # poignets (cibles « genou » avant)
KL, KR = REST["Knee_back_IK_L"][0], REST["Knee_back_IK_R"][0]     # jarrets
PAW = 0.27  # hauteur de la cible IK d'un pied posé au-dessus du sol (mesurée au repos)
NECK_ELEV = math.degrees(math.atan2((HD - N).z, -(HD - N).y))  # ≈ 38° : élévation cou→tête au repos, museau horizontal

def head_at(N_, pitch=0, yaw=0, dist=2.4):
    """Position du contrôleur de tête : l'IK du cou (3 os) prime sur la copie de rotation, donc
    l'orientation de la tête suit la direction base du cou -> contrôleur. On garde la chaîne presque
    tendue (dist 2.4 sur 2.46) pour éviter le repli en zigzag. pitch>0 = museau vers le bas, yaw>0 = vers +X.
    Calibration mesurée (mode calib) : museau réel = consigne - 21.3° à dist 2.4, - 36.2° à dist 2.25,
    linéaire pour consigne >= 0 (en dessous l'IK replie le cou dans l'autre sens : à éviter)."""
    off = 21.3 + (2.4 - dist) * 99.3
    e = math.radians(NECK_ELEV - (pitch + off))
    y = math.radians(yaw)
    d = V((math.sin(y) * math.cos(e), -math.cos(y) * math.cos(e), math.sin(e)))
    return Vector(N_) + dist * d

def body(S_=S, N_=N, M1_=M1, M0_=M0, H_=H, HJ_=HJ, HD_=HD, head_rot=(0, 0, 0), T_=T, tail_aim=None):
    """Colonne, cou, tête et queue par points."""
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
    """Pattes : position des pieds (cibles IK) et des poignets/jarrets (par défaut : décalage de repos)."""
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
    """Copie de la pose tournée de deg° autour de l'axe Y (long du corps) passant par pivot.
    axis="X" : tangage (deg < 0 : museau vers le haut), utilisé par Jump et JumpDown."""
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

# 2026-10-25 (« ça va pas du tout […] roulage et pattes ») : roulade en torsion. rolled() tourne tout
# d'un bloc (bûche) ; ici l'avant (épaules, pattes avant), la tête et l'arrière (bassin, pattes
# arrière, queue) ont chacun leur angle, le milieu de la colonne et Root la moyenne. La tête mène
# (mouvement_reels.md § 6 : « la tête tourne plus vite et plus loin que le tronc »).
FRONT_CTRL = {"Neck", "Spine_controller_2", "Shoulder_front_L", "Thigh_front_L", "Thigh_front_R",
              "Foot_front_IK_L", "Foot_front_IK_R", "Knee_front_IK_L", "Knee_front_IK_R"}
# "Spine" (racine sans parent des IK étirables de la colonne) reste à l'angle moyen : à l'angle du
# bassin, maillage déchiré à Pet f67-68 (-4,72 unités, aperçu Blender du 2026-10-25 soir).
REAR_CTRL = {"Hip", "Tail", "Tail_controller", "Foot_Back_IK_L", "Foot_Back_IK_R",
             "Knee_back_IK_L", "Knee_back_IK_R", "Spine"}
# 2026-10-25 nuit (Pet refait, torsion 120/90) : "Spine" passe à l'angle du bassin. À l'angle moyen,
# la colonne explosait d'image en image pendant la tenue (aperçus évalués dans l'ordre, f77 -16 unités,
# f121 -1,9e11) ; à l'angle du bassin, aucun os aberrant de f63 à f187 (front 120).

def twisted(p, front, rear, head=None, pivot=None):
    """Comme rolled(), avec un angle par partie du corps (degrés autour de Y)."""
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
    """Cible de coude/jarret : le décalage de repos (cible - milieu racine-pied), tourné dans le plan
    Y-Z comme la patte. La cible reste du même côté de la patte qu'au repos : l'IK ne plie jamais
    l'articulation à l'envers (BACK_LEGS du 2026-10-25 matin avait ses cibles devant les pieds)."""
    d0, d1 = rest_foot - rest_root, foot - root
    a = math.atan2(d1.z, d1.y) - math.atan2(d0.z, d0.y)
    o = rest_pole - (rest_root + rest_foot) / 2
    c, s = math.cos(a), math.sin(a)
    m = (root + foot) / 2
    return P(foot.x + out * (1 if foot.x >= 0 else -1), m.y + c * o.y - s * o.z, m.z + s * o.y + c * o.z)

g = G
REST_POSE = pose(body(), legs())

# --- Assis : croupe au sol, buste incliné, pattes avant verticales (comme au repos), pattes arrière
# repliées, queue au sol. Le tronc est celui du repos basculé d'un bloc de SIT_TILT° autour de
# l'épaule : l'épaule ne bouge pas, la hanche descend au sol (l'ancienne pose écrasait l'épaule et
# bombait le dos : pattes avant pliées, effet kangourou).
# 28° : la croupe touche le sol en même temps que les quatre pieds (balayage 26-32° : pose remontée
# de -0,05 / 0,05 / 0,18 / 0,31 unité par la mise au sol, mesuré 2026-10-22). Jarret posé juste
# derrière la hanche, métatarse à plat vers l'avant (longueur 1,87), genou devant et bas.
SIT_TILT = 28
def _tilt(p, deg=SIT_TILT, pivot=S, dz=0.0):
    """Point de repos tourné de deg° (croupe vers le bas) autour de l'axe X passant par pivot."""
    return pivot + Matrix.Rotation(math.radians(-deg), 3, "X") @ (Vector(p) - pivot) + V((0, 0, dz))
# 2026-10-26 (mode `hump`) : colonne droite assise (pli 0,00) ; le dos forme un arc convexe régulier
# (flèche 0,58 unité à y = 0,25). Milieu abaissé de 0,15 ou 0,3 : flèche 0,61 à 0,67, pas mieux : inchangé.
SIT_BODY = dict(HJ_=_tilt(HJ), H_=_tilt(H), M0_=_tilt(M0, dz=0.15), M1_=_tilt(M1, dz=0.1),
                N_=_tilt(N, dz=0.95), S_=S.copy())  # cou relevé : tête au-dessus des épaules
SIT_N = SIT_BODY["N_"]
_hock = SIT_BODY["HJ_"].y + 0.25
SIT_HIND = dict(bl=P(0.8, _hock - 1.85, g + PAW), br=P(-0.8, _hock - 1.85, g + PAW), baim=(0, -1, 0.05),
                kl=P(0.8, _hock, g + 0.5), kr=P(-0.8, _hock, g + 0.5))
SIT = pose(
    body(**SIT_BODY, HD_=head_at(SIT_N, pitch=4), T_=P(1.6, 1.6, g + 0.3)),
    legs(**SIT_HIND),
)

# --- Sphinx : ventre au sol, pattes avant allongées, arrière replié.
LIE_N = P(0, -1.4, g + 2.9)
# 2026-10-26 (mission catgame_monde, agent A ; « chat en général trop bossu par moment ») : le milieu
# M1_ -> arrière M0_ de la colonne faisait 1,30 unité contre 1,63 au repos : la chaîne IK Spine.001-
# Spine.004, comprimée, se pliait en zigzag (pli 0,47 contre 0,11 au repos, mode `hump`) et le dos
# prenait une bosse de chameau. Tout l'arrière (M0_, hanche, pattes arrière, queue) recule de LIE_DY.
LIE_DY = 0.35
LIE = pose(
    body(HJ_=P(0, 3.0 + LIE_DY, g + 1.5), H_=P(0, 2.2 + LIE_DY, g + 2.2), M0_=P(0, 1.1 + LIE_DY, g + 2.45),
         M1_=P(0, -0.2, g + 2.5), N_=LIE_N, S_=P(0, -2.3, g + 1.8), HD_=head_at(LIE_N, pitch=8),
         T_=P(1.2, 5.8 + LIE_DY, g + 0.3)),
    # Pattes avant repliées sous le poitrail (poignets à -4,0 avant : avant-bras démesurés).
    legs(fl=P(0.65, -3.5, g + PAW), fr=P(-0.65, -3.5, g + PAW), faim=(0, -1, -0.1),
         wl=P(0.75, -2.8, g + 0.45), wr=P(-0.75, -2.8, g + 0.45),
         bl=P(0.95, 1.5 + LIE_DY, g + PAW), br=P(-0.95, 1.5 + LIE_DY, g + PAW), baim=(0, -1, 0.05),
         kl=P(0.95, 3.3 + LIE_DY, g + 0.6), kr=P(-0.95, 3.3 + LIE_DY, g + 0.6)),
)
# Installation après le sphinx : une patte arrière glisse sur le côté (mouvement_stray.md § 2.4 et § 4).
# Décalage de 0,7 en x : au jugé.
LIE_SETTLE = pose(LIE, {
    "Foot_Back_IK_L": dict(pos=P(1.65, 1.6 + LIE_DY, g + PAW), aim=(0, -1, 0.05)),
    "Knee_back_IK_L": dict(pos=P(1.55, 3.3 + LIE_DY, g + 0.6)),
})

# --- Corps « ramassé » (pattes repliées sans appui) : base des poses sur le flanc et sur le dos.
# Roulis de +90° autour de Y : le côté +X (gauche du chat) va vers le sol, le ventre (z < ZC) vers -X.
ZC = g + 2.6  # axe de la colonne, pivot du roulis
TUCK_N = P(0, -1.2, ZC)
# 2026-10-26 : M1_ -> M0_ 1,20 unité (repos 1,63) : colonne en zigzag (pli 0,58 à Pet f83, torse en S
# vu de dessus). L'arrière recule de TUCK_DY, comme LIE_DY.
TUCK_DY = 0.4
TUCK_BODY = dict(HJ_=P(0, 3.2 + TUCK_DY, g + 2.1), H_=P(0, 2.3 + TUCK_DY, ZC), M0_=P(0, 1.2 + TUCK_DY, ZC + 0.1),
                 M1_=P(0, 0.0, ZC + 0.1), N_=TUCK_N, S_=P(0, -2.1, g + 2.0))
TUCK_LEGS = dict(fl=P(0.7, -3.0, g + 1.1), fr=P(-0.7, -3.0, g + 1.1), faim=(0, -0.6, -0.8),
                 wl=P(0.8, -2.6, g + 1.7), wr=P(-0.8, -2.6, g + 1.7),
                 bl=P(0.8, 1.9 + TUCK_DY, g + 0.9), br=P(-0.8, 1.9 + TUCK_DY, g + 0.9), baim=(0, -0.8, -0.6),
                 kl=P(0.8, 3.2 + TUCK_DY, g + 1.0), kr=P(-0.8, 3.2 + TUCK_DY, g + 1.0))
TUCK = pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=10), T_=P(0.6, 6.3 + TUCK_DY, g + 1.2)), legs(**TUCK_LEGS))
PIVOT = (0, 0.5, ZC)
SIDE = rolled(TUCK, 90, PIVOT)      # sur le flanc, tête posée
# sur le dos : tête à l'envers, menton en l'air (mouvement_reels.md § 6), un peu relevée (pitch négatif
# dans le repère debout). Yaw 20 → 0 : creux du maillage entre flanc et dos -0,56 → -0,20 unité
# (balayage image par image de Pet, 2026-10-23, fiche 03 de la mission chat_correction).
BACK_YAW = -30  # 2026-10-25 : tête posée sur la joue (0 : à l'envers, oreilles plantées dans le sol)
# Pattes sur le dos (2026-10-24, « papouille cata au niveau des pattes ») : avec TUCK_LEGS elles restaient
# plaquées sur le ventre et le poitrail. Ici, avant le roulis de 180° (z plus bas = plus haut après) :
# pattes avant levées, coudes écartés, poignets qui retombent vers le poitrail ; pattes arrière écartées
# en grenouille, genoux dehors. Valeurs au jugé, variante « c » choisie sur des aperçus du scratchpad
# (pieds avant 3,5-3,8 et arrière 4,0 unités au-dessus du sol, contre 2,2-2,6 avant).
# 2026-10-25 (« les papouilles c'est affreux ») : la variante « c » faisait un insecte mort (pattes
# avant tendues vers le ciel, pattes arrière pliées à la verticale, corps à plat). Refait d'après
# mouvement_reels.md § 6 : pattes avant repliées aux poignets, pattes molles qui retombent vers le
# poitrail ; pattes arrière allongées vers la queue, écartées, genoux dehors ; corps roulé de
# BACK_ROLL seulement (un peu sur le côté). Valeurs au jugé sur les aperçus Blender.
# 2026-10-25 soir (« ça va pas du tout ») : les cibles wl/kl ci-dessus étaient DEVANT les pieds
# (au repos elles sont derrière) : coudes et jarrets pliés à l'envers, retournement brutal pendant
# la bascule. Cibles calculées par pole(). Sur le dos, épaules à BACK_FRONT°, bassin à BACK_REAR° :
# hanches restées un peu sur le côté (comme le sphinx réel, mouvement_reels.md § 5). Valeurs au jugé.
BACK_FRONT, BACK_REAR = 175, 155
BACK_ROLL = BACK_FRONT
_S_T, _HJ_T = TUCK_BODY["S_"], TUCK_BODY["HJ_"]
_HJ_R = REST["Hip"][1]

def _legs_back(fl, bl):
    """Pieds gauches fl (avant) et bl (arrière) ; côté droit en miroir ; cibles par pole()."""
    fr, br = P(-fl.x, fl.y, fl.z), P(-bl.x, bl.y, bl.z)
    return dict(fl=fl, fr=fr, bl=bl, br=br, faim=(0, 0.4, 0.9), baim=(0.2, 0.8, -0.5),
                wl=pole(_S_T, fl, S, FL, WL), wr=pole(_S_T, fr, S, FR, WR),
                kl=pole(_HJ_T, bl, _HJ_R, BL, KL, 0.4), kr=pole(_HJ_T, br, _HJ_R, BR, KR, 0.4))

# pattes avant repliées sur le poitrail, poignets cassés ; pattes arrière allongées vers la queue, écartées
BACK_LEGS = _legs_back(P(0.8, -2.7, g + 1.0), P(1.5, 5.6, g + 0.6))

def calm(stretch, rub):
    """Sur le dos, phase calme (remplace le pédalage, non observé : mouvement_reels.md § 10) :
    pattes avant qui se tendent ensemble vers le haut et l'avant (stretch 0..1), tête qui se frotte
    au sol (rub -1..1 : yaw BACK_YAW ± 8°), queue lente. Amplitudes au jugé."""
    stretch_v = V((0, -0.6 * stretch, -0.3 * stretch))
    p = pose(
        body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=20, yaw=BACK_YAW + 8 * rub),
             T_=P(0.6 + 0.4 * rub, 6.3, g + 1.2)),
        legs(**{**BACK_LEGS, "fl": BACK_LEGS["fl"] + stretch_v, "fr": BACK_LEGS["fr"] + stretch_v}),
    )
    return twisted(p, BACK_FRONT, BACK_REAR, head=BACK_FRONT + 10)

BACK = calm(0, 0)
# Bascules : entre deux clés, la position de l'os Root est interpolée en ligne droite alors que sa
# rotation suit l'arc, et le corps plongeait sous le sol (creux -0,63 unité à Pet f66-67 et f175-176,
# mesuré dans Blender le 2026-10-24). Deux clés intermédiaires, à 45° (couché -> flanc) et à 135°
# (flanc -> dos), ramènent le pire creux du clip à -0,20 unité (f60 et f182, balayage f0-216). L'IK
# de la colonne reste stable (aucun os aberrant sur les aperçus f55-f186). Non mesuré dans le navigateur.
ROLL45 = rolled(TUCK, 45, PIVOT)   # gardé pour Sleep (à revoir)
# Pet (2026-10-25 soir) : bascule en torsion, la tête d'abord, puis les épaules, le bassin en dernier.
# Angles au jugé. Les pattes passent de TUCK_LEGS à BACK_LEGS entre le flanc et le dos.
_TUCK_LEGS_P = _legs_back(TUCK_LEGS["fl"], TUCK_LEGS["bl"])
_TUCK_LEGS_P.update(faim=TUCK_LEGS["faim"], baim=TUCK_LEGS["baim"])
_PET_TUCK = pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=15), T_=P(0.6, 6.3, g + 1.2)), legs(**_TUCK_LEGS_P))
# À mi-bascule, pieds à mi-chemin et cibles recalculées par pole() : moyennées, elles croisaient la
# patte (patte arrière dressée à la verticale, creux -0,63 à Pet f66).
_HALF_LEGS = _legs_back((V(TUCK_LEGS["fl"]) + BACK_LEGS["fl"]) / 2, (V(TUCK_LEGS["bl"]) + BACK_LEGS["bl"]) / 2)
PET_LEAN = twisted(_PET_TUCK, 50, 25, head=70)              # l'avant se couche le premier
PET_SIDE = twisted(_PET_TUCK, 100, 75, head=120)            # sur le flanc, la tête déjà tournée
PET_OVER = twisted(pose(_PET_TUCK, legs(**_HALF_LEGS)), 150, 130, head=175)
ROLL135 = PET_OVER
# (PET_LEAN, PET_SIDE, PET_OVER, calm() et BACK ne servent plus à Pet depuis le 2026-10-25 nuit :
# gardés pour comparaison, voir les clés PET_* ci-dessous.)

# --- Pet refait d'après docs/recherche/dos_chat.md § 4 seulement (2026-10-25 nuit, mission
# catgame_jeu, agent A). Chaque clé cite la section et la ligne de dos_chat.md qui la justifie.
# Poses écrites avant roulis dans le repère de TUCK, puis tournées par twisted() (§ 4.1 l. 211).
# Coudes et jarrets toujours par pole() (§ 4.1 l. 214).
def _legs_pet(fl, fr, bl, br, faim=(0, 0.4, 0.9), baim=(0.2, 0.8, -0.5), kr_out=0.4):
    """Pattes sans miroir (asymétrie, dos_chat.md § 3 E3) ; cibles de coude et de jarret par pole()."""
    return dict(fl=fl, fr=fr, bl=bl, br=br, faim=faim, baim=baim,
                wl=pole(_S_T, fl, S, FL, WL), wr=pole(_S_T, fr, S, FR, WR),            # § 4.3 l. 250
                kl=pole(_HJ_T, bl, _HJ_R, BL, KL, 0.4), kr=pole(_HJ_T, br, _HJ_R, BR, KR, kr_out))  # § 4.3 l. 258

_BACK_FR0 = P(-BACK_LEGS["fl"].x, BACK_LEGS["fl"].y, BACK_LEGS["fl"].z)  # = BACK_LEGS["fr"]
PET_BACK_LEGS = _legs_pet(
    BACK_LEGS["fl"] + V((-0.2, -0.3, 0.3)),   # § 4.3 l. 246 : patte avant du côté sol, près du poitrail
    _BACK_FR0 + V((0.1, 0.1, 0.4)),           # § 4.3 l. 247 : patte avant du dessus, repliée plus serrée
    P(2.3, 5.2, g + 1.8),                     # § 4.3 l. 255 : patte arrière du dessous, au sol derrière le bassin
    P(1.5, 4.9, g + 1.6))                     # § 4.3 l. 256 : patte arrière du dessus, superposée (x > 0)

def _pet_back_body(phase=0.0, head_pitch=20, head_yaw=BACK_YAW, legs_=None):
    """Corps ramassé de TUCK_BODY, tête sur la joue (§ 4.2 l. 237), queue qui balaie (§ 4.3 l. 261)."""
    return pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=head_pitch, yaw=head_yaw),
                     T_=P(0.6 + 0.4 * math.sin(phase), 6.3, g + 1.2)),
                legs(**(legs_ or PET_BACK_LEGS)))

def pet_hold(phase):
    """Position tenue, balancement lent (§ 4.5 l. 273 ; amplitude non sourcée, § 4.5 l. 278)."""
    s = math.sin(phase)
    return twisted(_pet_back_body(phase), PET_FRONT + 10 * s, 90 + 5 * s, head=185 + 5 * s)

# Épaules sur le dos : 140 dans dos_chat.md § 4.2 l. 225 ; « si le maillage se déchire, descendre
# front à 120 avant de toucher rear » (§ 4.2 l. 236).
PET_FRONT = 120

_PET_TUCK_LEGS = dict(_TUCK_LEGS_P)  # § 4.4 l. 265 : pattes de _TUCK_LEGS_P pour HEAD1 et HEAD2
_PET_HALF_FRONT = _legs_pet((V(TUCK_LEGS["fl"]) + PET_BACK_LEGS["fl"]) / 2,          # § 4.4 l. 266 : pattes avant
                            (V(TUCK_LEGS["fr"]) + PET_BACK_LEGS["fr"]) / 2,          # à mi-chemin, pole()
                            TUCK_LEGS["bl"], TUCK_LEGS["br"], baim=TUCK_LEGS["baim"])  # arrière encore TUCK
_PET_UP_LEGS = _legs_pet(TUCK_LEGS["fl"], TUCK_LEGS["fr"],                           # § 4.4 l. 268 : avant repliées
                         _HALF_LEGS["bl"], _HALF_LEGS["br"],                           # sous le poitrail, arrière
                         faim=TUCK_LEGS["faim"], baim=_HALF_LEGS["baim"])              # _HALF_LEGS

PET_HEAD1 = twisted(_pet_back_body(legs_=_PET_TUCK_LEGS), 10, 0, head=90)      # § 4.2 l. 222 : tête sur la joue
PET_HEAD2 = twisted(_pet_back_body(legs_=_PET_TUCK_LEGS), 30, 10, head=180)    # § 4.2 l. 223 : tête à l'envers
PET_SHOULDER = twisted(_pet_back_body(legs_=_PET_HALF_FRONT), 90, 55, head=185)  # § 4.2 l. 224 : épaules qui passent
PET_BACK2 = pet_hold(0.0)                                                       # § 4.2 l. 225 et l. 228 : 140/90/185
PET_UP_HEAD = twisted(_pet_back_body(), 125, 90, head=30)                       # § 4.2 l. 229 + § 4.4 l. 267
PET_UP_FRONT = twisted(_pet_back_body(legs_=_PET_UP_LEGS), 50, 60, head=10)     # § 4.2 l. 230 + § 4.4 l. 268
# Clé de passage hors dos_chat.md (au jugé) : entre PET_UP_FRONT (7,6 s) et LIE (8,0 s), le maillage
# plongeait de -0,50 unité (f188, mode `sweep`) et le jeu le relevait de 0,044 (pose_preview, 7,85 s).
PET_UP_MID = twisted(LIE, 20, 25, head=5)
# (PET_HEAD1 … PET_UP_MID ne servent plus à Pet depuis la mission catgame_style : gardés pour le mode
# `scan` et pour comparaison.)

# --- Pet « version simple » (2026-10-25, mission catgame_style, agent A ; retour de l'utilisateur :
# « le mode papouille est vraiment affreux », choix « Version simple d'abord » : pas de dos). Le chat se
# couche sur le FLANC seulement, comme Sleep (SLEEP_HEAD / SLEEP_ROLL / SIDE, poses stables) : roulis
# FLANK_FRONT / FLANK_REAR < 90°, appuyé sur l'épaule et la hanche ; jamais au-delà de 90°.
# Pose d'après dos_chat.md § 2.2 (l. 80 : « couché sur le flanc, pattes avant allongées vers l'avant,
# tête posée sur la joue ») et § 2.4 (l. 129 : pattes avant allongées sur le flanc ; l. 133 : pattes
# arrière allongées vers la queue, l'une sur l'autre ; l. 141 : queue à plat). Repère avant roulis =
# celui de TUCK (roulis +θ autour de Y : x avant roulis devient la hauteur, z devient l'horizontale) ;
# pattes du dessous côté +X, pattes du dessus au-dessus d'elles (x plus petit), cibles par pole().
# (Tour 2 : tout ce bloc est multiplié par PET_SIDE = -1 ; les pattes du dessous sont donc côté -X et
# les roulis sont négatifs, voir PET_SIDE plus bas.)
# Tête : roulée un peu plus que le corps (joue vers le sol), menton un peu rentré. Valeurs au jugé,
# choisies sur les aperçus Blender S_* (side, front, persp).
# Correction 1 (captures du jeu réel, chef de projet : « masse noire plate », visage caché, frottement
# invisible) : tête RELEVÉE et inclinée (roulis de tête FLANK_HEAD bien inférieur à celui du corps :
# visage tourné vers le haut au lieu d'être posé sur la joue), pattes avant repliées (« patounes »,
# position de TUCK_LEGS), queue ramenée vers le ventre, frottement et respiration plus amples.
# Correction 2 (captures du jeu réel, chef de projet : tête inclinée « d'environ 90° », une oreille en
# pointe, yeux en fentes obliques ; le relever sphinx est jugé mignon) : corps toujours sur le flanc,
# tête presque droite comme au relever : roulis de tête 12 ± 8° (HEADROLL mesuré : le roulis réel suit
# celui du contrôleur, 37,4° pour 38 avant correction), yaw ± 9°, menton 2° à 10° (posé ou un peu levé).
FLANK_FRONT, FLANK_REAR, FLANK_HEAD = 80, 76, 12
# (Essai 2026-10-26, W_essaih_Pet_f083 : FLANK_FRONT 68 ne change pas le repli clair au garrot vu en
# vue « game » ; ce repli ne vient donc pas de l'écart avant 80 / tête 12. Cause non établie.)
# Tour 2 (2026-10-26, mission catgame_monde, agent A) : côté de la bascule inversé. Mesuré dans le jeu
# (Playwright, caméra du chef chat + (0,95 ; 0,5 ; 1,0), cap 0, même côté que la caméra de départ de
# World.js (1,45 ; 0,42 ; 2,05)) : avec la bascule +θ, le ventre et les quatre pattes sont du côté
# opposé à la caméra (capture sans herbe : aucune patte ; capture du côté -x : ventre, pattes et visage
# visibles). PET_SIDE = -1 : roulis négatifs, pattes du dessous côté -X avant roulis (miroir des
# anciennes : la droite est dessous). Sleep garde son côté.
PET_SIDE = -1
def _px(x):
    return PET_SIDE * x
FLANK_LEGS = _legs_pet(
    P(_px(0.35), -3.0, g + 1.35),     # avant du dessus (gauche) : repliée, posée un peu en retrait
    P(_px(0.95), -3.2, g + 1.0),      # avant du dessous (droite) : repliée sous le menton (patoune)
    P(_px(0.6), 4.8 + TUCK_DY, g + 1.3),   # arrière du dessus (gauche) : superposée
    P(_px(1.2), 5.0 + TUCK_DY, g + 1.0),   # arrière du dessous (droite) : allongée vers la queue (§ 2.4 l. 133)
    faim=(0, -0.6, -0.8), baim=(_px(0.1), 0.8, -0.55))

def flank_body(rub=0.0, sway=0.0, legs_=None):
    """Corps ramassé de TUCK_BODY, pattes FLANK_LEGS. rub -1..1 : tête qui se frotte (yaw ± 9° ;
    menton de 2° à 10°, levé quand rub > 0) ; sway -1..1 : bout de queue qui balaie, ramené vers le ventre."""
    return pose(body(**TUCK_BODY, HD_=head_at(TUCK_N, pitch=6 - 4 * rub, yaw=_px(-9 * rub)),
                     T_=P(_px(1.0), 5.4 + TUCK_DY, g + 0.7 + 0.5 * sway)),
                legs(**(legs_ or FLANK_LEGS)))

def pet_flank(t):
    """Tenue sur le flanc à l'instant t (s, depuis l'installation) : respiration lente (période 2 s,
    l'épaule du dessus se soulève de ± 4°, le bassin de ± 1,5°), frottement de tête (période 4 s :
    roulis de tête ± 8°, yaw ± 9°, menton qui monte et descend), queue lente. Périodes et amplitudes
    au jugé ; t = 0 et t = 4 donnent la même pose (prolongation par Brain sans à-coup)."""
    b = math.sin(2 * math.pi * t / 2.0)
    r = math.sin(2 * math.pi * t / 4.0)
    return twisted(flank_body(rub=r, sway=r), _px(FLANK_FRONT + 4 * b), _px(FLANK_REAR + 1.5 * b),
                   head=_px(FLANK_HEAD + 8 * r))

# la tête mène, joue vers le sol (§ 2.2 l. 78) ; pattes encore repliées (TUCK_LEGS, comme SLEEP_HEAD) :
# avec FLANK_LEGS dès cette clé, creux du maillage -0,52 unité entre LIE_SETTLE et PET_CHEEK (balayage).
# Menton de TUCK (pitch 10) et non de flank_body (16) pendant la bascule : creux -0,25 avec 16.
# Correction 2 : roulis de tête de la bascule ramenés à 12-15° (22 / 31 / 40 avant), la tête reste droite.
PET_CHEEK = twisted(TUCK, _px(10), 0, head=_px(12))
# l'épaule se pose (§ 2.2 l. 79), pattes toujours repliées : elles ne s'allongent qu'une fois le corps
# presque sur le flanc (PET_FLANK). Allongées dès PET_SHOULDER_DOWN : creux -0,84 unité (balayage).
PET_SHOULDER_DOWN = twisted(TUCK, _px(60), _px(40), head=_px(15))

def lifted(p, dz):
    """Copie de la pose montée de dz (tous les contrôleurs et Root)."""
    out = {}
    for name, spec in p.items():
        s = dict(spec)
        s["pos"] = Vector(s["pos"]) + Vector((0, 0, dz))
        out[name] = s
    return out

# Correction 1 : clé de mi-bascule (2,3 s) montée de 0,2 : le maillage descendait de 0,22 sous le sol
# entre PET_CHEEK et PET_SHOULDER_DOWN (balayage f56-f57).
PET_HALF_ROLL = lifted(twisted(TUCK, _px(35), _px(20), head=_px(14)), 0.2)
PET_FLANK = pet_flank(0.0)                            # couché sur le flanc, installé
PET_RISE_HEAD = twisted(flank_body(), _px(66), _px(68), head=_px(10))  # relever : tête droite (34 avant la Correction 2)
PET_RISE = twisted(LIE, _px(22), _px(24), head=_px(6))              # presque sphinx (comme PET_UP_MID)

# Oreilles détendues pendant les papouilles (dehors, arrière, ouverture vers le côté ; degrés ; voir
# EAR_ROOTS). k : fraction, pour entrer et sortir en douceur. Choisi le 2026-10-26 sur la vue « game »
# (proche de la capture du jeu) parmi 7 essais W_essai*_Pet_f083 : 35/15/35 et 50/20/50 = oreilles
# en avion vues de face ; 10/40/45 = point jaune du globe oculaire visible au front (la peau du front
# suit Ear) ; 15/20/60 = oreille du fond lue comme une oreille (face large), front sans défaut.
# Tour 2 : 15/20/60 se lisait dans le jeu comme une corne. Mesure Playwright à Pet 3,55 s (caméra du
# chef) : oreille proche vue DE FACE (|normale·rayon| 0,95, et non par la tranche), face extérieure
# sombre, axe à 20° au-dessus de l'horizontale et dans le plan de l'écran (70° au rayon), 74° de l'axe
# du crâne : un grand triangle plat horizontal. Remplacé par des oreilles écartées sur les côtés,
# sans recul ni rotation du pavillon.
PET_EARS = (30, 0, 0)
def _relaxed(p, k=1.0):
    return dict(p, _ears=tuple(k * a for a in PET_EARS))

# --- Sleep : même passage tête d'abord que Pet (dos_chat.md § 2.6 l. 174 et § 3 E5 l. 198), jusqu'au
# flanc seulement (SIDE = TUCK roulé de 90°). Deux clés intermédiaires remplacent la bascule d'un bloc
# LIE_SETTLE -> SIDE (creux -0,51 unité à Sleep f55, aperçu Blender du 2026-10-25 nuit). Angles au jugé.
SLEEP_HEAD = twisted(TUCK, 10, 0, head=50)
SLEEP_ROLL = twisted(TUCK, 60, 40, head=85)

# --- Boule de sommeil : décrite debout avec la colonne qui plonge vers le ventre (plan Y-Z), puis
# roulée de 90° : la courbure se retrouve dans le plan du sol, tête vers les pattes arrière.
# Boule affinée (README § 7 « encore grossière ») : colonne en C plus fermée (croupe et épaules
# rentrées vers le ventre), tête plus rentrée, pattes ramassées, bout de queue ramené vers la tête.
# Valeurs au jugé, choisies sur les aperçus A4 (essais v1, v2 dans le scratchpad du lot 4).
# curl_up() sert aussi au réveil : après le roulis, yaw < 0 relève la tête, pitch la fait tourner
# à l'horizontale (regard alentour).
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

# --- Réveil : la boule reste, seule la tête se relève puis regarde alentour (mouvement_reels.md § 9 ;
# mouvement_stray.md § 2.7). Pas de bâillement : le maillage n'a que la clé de forme Basis et l'os
# Mouth n'est pas clé (mesuré par A4, voir la fiche 04). Positions de tête au jugé, vues sur les aperçus.
WAKE_N = P(0, -1.2, ZC - 0.5)
CURL_HEAD = rolled(curl_up(n=WAKE_N, pitch=15, yaw=-45), 90, PIVOT)   # tête levée
CURL_LOOK1 = rolled(curl_up(n=WAKE_N, pitch=0, yaw=-40), 90, PIVOT)   # regard d'un côté
CURL_LOOK2 = rolled(curl_up(n=WAKE_N, pitch=40, yaw=-45), 90, PIVOT)  # regard de l'autre côté

# --- Étirement : pattes avant allongées, poitrail bas, croupe haute.
# Poitrail un peu plus bas (cou g+2.9 -> g+2.6, épaule g+2.2 -> g+2.0) : consigne hanche -> épaule
# ≈ 30° sous l'horizontale (mouvement_stray.md § 2.5 : 30-35°). Milieu du dos abaissé avec le poitrail
# (M0_ g+4.4 -> g+4.3, M1_ g+3.7 -> g+3.5) : au jugé, sur les aperçus du lot 4 (fiche 04 : positions de
# pose choisies sur les variantes v1-v3, aucune mesure). Queue tenue derrière à peu près
# horizontale au lieu de dressée (mouvement_reels.md § 8) ; bout de queue au jugé (longueur 4,0 mesurée).
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
# Dos rond debout avant l'étirement (variante Stray, mouvement_stray.md § 2.5) : milieu du dos
# monté, tête basse, antérieurs avancés d'un pas, queue relevée en crochet. Valeurs au jugé (aperçus A4).
ARCH_N = N - V((0, 0, 0.3))
ARCH = pose(
    body(N_=ARCH_N, M1_=M1 + V((0, 0, 0.9)), M0_=M0 + V((0, 0, 0.9)), H_=H + V((0, 0, 0.2)),
         HD_=head_at(ARCH_N, pitch=30), T_=P(0, 5.0, g + 7.6)),
    legs(fl=FL + V((0, -0.5, 0)), fr=FR + V((0, -0.5, 0))),
)

# --- Toilette : assis, patte avant gauche levée, tête vers la patte.
# Patte montée à hauteur du menton (mouvement_reels.md § 7), un peu écartée pour rester visible
# derrière la tête ; tête moins tournée (22° -> 15°). Valeurs au jugé (essais v1-v3 du lot 4).
def groom(lick):
    """lick dans [0,1] : 0 tête vers la patte, 1 tête un peu relevée (coup de langue)."""
    return pose(
        body(**SIT_BODY, HD_=head_at(SIT_N, pitch=35 - 10 * lick, yaw=15), T_=P(1.6, 1.6, g + 0.3)),
        legs(fl=P(1.0, -2.7, g + 2.8), fr=P(-0.6, -2.0, g + PAW), fl_aim=(0.3, -0.5, 0.8),
             wl=P(1.0, -2.0, g + 2.2), **SIT_HIND),
    )

GROOM0, GROOM1 = groom(0), groom(1)

# --- Marche (remplace le cycle d'origine du fichier, une marche de traque : épaule 1,3 unité sous
# le repos, croupe haute, patte avant tendue loin et bas ; mesuré 2026-10-22). Pas latéral du chat :
# arrière G, avant G (0,15 cycle après), arrière D (0,5), avant D (0,65). Chaque pied reste posé
# WALK_DUTY du cycle et recule à vitesse constante (le sol défile sous le chat : clip sur place), puis
# revient en l'air. Corps à hauteur de repos ; la mise au sol de chaque image donne le léger rebond.
# Queue gardée dressée (T) : port du chat réel filmé en marche (docs/recherche/mouvement_reels.md § 2).
WALK_FRAMES = 24          # un cycle = 1 s à 24 i/s ; joué ×1,25 dans Cat.js (WALK_RATE) = 0,8 s
WALK_STRIDE = 3.2         # recul d'un pied posé pendant son appui (unités) ; le sol défile donc de
                          # WALK_STRIDE / WALK_DUTY par cycle, valeur reprise dans Cat.js
WALK_DUTY = 0.67          # facteur d'appui : milieu de 0,61-0,73 (mouvement_reels.md § 2 ; était 0,6)

def _foot_track(phase, center, lift, stride=WALK_STRIDE, duty=WALK_DUTY):
    """Décalage (dy, dz) d'un pied pour sa phase dans [0,1) : 0 = pose au sol en avant."""
    half = stride / 2
    if phase < duty:
        return center - half + stride * phase / duty, 0.0
    s = (phase - duty) / (1 - duty)
    e = s * s * (3 - 2 * s)
    return center + half - stride * e, lift * math.sin(math.pi * s)

def walk_pose(t):
    """t dans [0,1) : instant du cycle."""
    f = {}
    for side, x in (("L", 1), ("R", -1)):
        off = 0.0 if side == "L" else 0.5
        # Arrière : boule du pied et jarret gardent leur écart de repos, le jarret monte plus.
        dy, dz = _foot_track((t + off) % 1, -0.2, 0.7)
        b, k = (BL, KL) if side == "L" else (BR, KR)
        f["b" + side] = b + V((0, dy, dz))
        f["k" + side] = k + V((0, dy + 0.4 * dz, 1.3 * dz))
        # Avant, 0,15 cycle après l'arrière du même côté (0,14-0,16 mesuré, mouvement_reels.md § 2 ;
        # était 0,25) : le poignet mène, la patte se plie.
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

# --- Affût (Stalk) et bond (Pounce) : d'après la fiche 01b de l'agent R (mission 2026-10-25_catgame_jeu,
# taches/01b_affut_bond.md, § 1, § 2 et § 3). Chaque valeur cite sa ligne de 01b (« 01b § 3 Stalk/Pounce »
# = tableau des clés proposées ; vidéos : 4atB, UYSo, ZGGR, ldZC). Valeurs au jugé, réglées sur aperçus Blender.
def _spine(n_z, h_z, s_z, dx=0.0, stretch=0.0):
    """Colonne déplacée : base du cou N_ et bassin H_ à n_z / h_z au-dessus du sol, épaule à s_z.
    M1_/M0_ gardent leur écart de repos à la ligne cou-bassin (01b § 3 Stalk « interpolées, pas de dos
    rond ») ; HJ_ suit le bassin. dx décale le bassin en x (dandinement), stretch allonge le corps."""
    dn, dh = g + n_z - N.z, g + h_z - H.z
    def sh(p):
        w = min(1.0, max(0.0, (p.y - N.y) / (H.y - N.y)))
        return p + V((dx * w, stretch * (w - 0.5), dn + (dh - dn) * w))
    return dict(N_=sh(N), M1_=sh(M1), M0_=sh(M0), H_=sh(H), HJ_=sh(HJ), S_=P(0, S.y - stretch / 2, g + s_z))

def _hind(bl, br, hj, baim=None, hock_up=0.0):
    """Pieds arrière ; jarrets par pole() (côté repos, 01b § 3 « même logique de pôle »), remontés de
    hock_up : sans cela, à l'affût, le métatarse se couchait au sol et soulevait les pieds (Stalk f1 :
    pieds à 0,62-0,90 au-dessus du sol au lieu de PAW, aperçu Blender M_Stalk_f001_side)."""
    up = V((0, 0, hock_up))
    return dict(bl=bl, br=br, baim=baim, kl=pole(hj, bl, HJ, BL, KL) + up, kr=pole(hj, br, HJ, BR, KR) + up)

STALK_FRAMES = 48                   # 01b § 3 Stalk : « cycle proposé 2,0 s » (48 images à 24 i/s)
STALK_STRIDE = 0.6 * WALK_STRIDE    # 01b § 3 Stalk Pas : « longueur ≈ 0,6 × WALK_STRIDE »
STALK_DUTY = 0.8                    # 01b § 3 Stalk Pas : « duty ≈ 0,8 (pied longtemps au sol) »
STALK_LIFT = 0.4                    # 01b § 3 Stalk Pas : « lever ≈ 0,4 »
# 01b § 3 Stalk : S_ ≈ g+2,0 à 2,3, N_ ≈ g+3,0 (01b § 1 « ventre presque au sol », ldZC 2,5-8,25 s).
# Bassin : 01b propose z -0,8 à -1,0 sous le repos (g+4,4), mais aussi « dos à peu près horizontal,
# croupe un peu au-dessus des épaules » : g+4,4 ferait monter le dos de 1,4 du cou au bassin. Pris
# g+4,1 (montée 1,1, contre 0,62 au repos ; g+3,8 couchait le métatarse au sol) : au jugé, sur aperçus.
STALK_BODY = _spine(3.0, 4.1, 2.2)
STALK_HEAD = head_at(STALK_BODY["N_"], pitch=18)   # 01b § 3 Stalk Tête : pitch ≈ 15-20, yaw 0 (4atB 26-32,75 s)
# 01b § 3 Stalk Queue « T + (0,0,-1,5 à -2,0) » laisserait le bout plus haut que le dos (T est à g+9,1) :
# bout placé derrière le bassin, à peu près à sa hauteur, pour « horizontale et raide » (01b § 1, 4atB 27,25-32,75 s).
STALK_TAIL = P(0, 6.6, g + 3.3)

def stalk_pose(t):
    """t dans [0,1) : instant du cycle d'affût. Même pas latéral que la marche (01b § 3 Stalk Pas :
    arrière G 0, avant G 0,15, arrière D 0,5, avant D 0,65), pas de rebond (01b § 3 Stalk Rebond ≈ 0)."""
    f = {}
    for side, x in (("L", 1), ("R", -1)):
        off = 0.0 if side == "L" else 0.5
        dy, dz = _foot_track((t + off) % 1, -0.2, STALK_LIFT, STALK_STRIDE, STALK_DUTY)
        b = BL if side == "L" else BR
        f["b" + side] = b + V((0, dy, dz))
        dy, dz = _foot_track((t + off - 0.15) % 1, -0.4, STALK_LIFT, STALK_STRIDE, STALK_DUTY)
        fo, w = (FL, WL) if side == "L" else (FR, WR)
        f["f" + side] = fo + V((0, dy + 0.3 * dz, dz))
        # 01b § 3 Stalk Poignets : « + x 0,3 côté extérieur (coudes en dehors, 4atB) »
        f["w" + side] = f["f" + side] + (w - fo) + V((0.3 * x, 0, 0))
    return pose(
        body(**STALK_BODY, HD_=STALK_HEAD, T_=STALK_TAIL),
        legs(fl=f["fL"], fr=f["fR"], wl=f["wL"], wr=f["wR"],
             **_hind(f["bL"], f["bR"], STALK_BODY["HJ_"], hock_up=0.8)),
    )

# Pounce : 01b § 3 Pounce (2,5 s, préparation raccourcie à 1,2 s ; Brain peut tenir CROUCH avant).
# Pattes avant à plat le long du sol tendues vers l'avant, coudes bas (01b § 2 « Pose accroupie »,
# UYSo 26,9-30,5 s) : pieds et poignets repris de LIE (pose stable) au lieu de « FL + (0,-0,8,0) ».
_PO_FRONT = dict(fl=P(0.65, -3.3, g + PAW), fr=P(-0.65, -3.3, g + PAW), faim=(0, -1, -0.1),
                 wl=P(0.75, -2.6, g + 0.45), wr=P(-0.75, -2.6, g + 0.45))
_PO_HIND_F = (P(0.75, 2.4, g + PAW), P(-0.75, 2.4, g + PAW))   # 01b § 3 CROUCH : BL/BR sous le bassin
# 01b § 3 CROUCH : S_ ≈ g+1,8, N_ z -2,0 ; bassin : 01b dit z -1,0 (g+4,3) ; pris g+3,9 pour que la
# croupe parte « à peu près au niveau des épaules » (01b § 2 Croupe, UYSo 26,9 s) puis monte au dandinement.
_PO_CROUCH_B = _spine(2.7, 3.9, 1.9)
PO_PITCH, PO_PIN_PITCH = 25, 30   # 01b § 3 CROUCH : pitch ≈ 25 ; PIN : pitch ≈ 30
# Jarrets remontés (_hind, hock_up) : sans cela le métatarse couché au sol soulevait les quatre pieds de
# 0,31 (aperçu M_Pounce_f011, pieds à 0,58 au lieu de PAW ; essai tête à 15/20 sans effet).
PO_HOCK = 0.8
POUNCE_CROUCH = pose(
    body(**_PO_CROUCH_B, HD_=head_at(_PO_CROUCH_B["N_"], pitch=PO_PITCH),   # 01b § 3 CROUCH (voir PO_PITCH)
         T_=P(0.8, 6.4, g + 0.6)),                                   # 01b § 2 Queue : basse au départ
    legs(**_PO_FRONT, **_hind(*_PO_HIND_F, _PO_CROUCH_B["HJ_"], hock_up=PO_HOCK)))

def pounce_wiggle(t):
    """0,4 -> 1,6 s : dandinement (01b § 3 WIGGLE : 3 Hz, bassin x ± 0,15, croupe +0,3 à +0,6 ;
    pieds arrière qui alternent un lever de 0,1 ; queue en crochet, bout qui bat ; UYSo 110,2-111,6 s)."""
    u = (t - 0.4) / 1.2
    s = math.sin(2 * math.pi * 3 * (t - 0.4))
    b = _spine(2.7, 3.9 + 0.5 * u, 1.9, dx=0.15 * s)
    bl, br = _PO_HIND_F
    bl, br = bl + V((0, 0, 0.1 * max(s, 0))), br + V((0, 0, 0.1 * max(-s, 0)))
    return pose(
        body(**b, HD_=head_at(b["N_"], pitch=PO_PITCH),
             T_=P(0.4 * s, 6.0, g + 0.6 + 2.0 * min(1.0, 3 * u))),   # 01b § 2 Queue : crochet vers le haut (UYSo 27,43 s)
        legs(**_PO_FRONT, **_hind(bl, br, b["HJ_"], hock_up=PO_HOCK)))

# 01b § 3 PAS + ABAISSEMENT (1,65 s) : S_ z -0,2, un pied avant avance de -0,4 en y (UYSo 111,6-111,67 s).
_PO_STEP_B = _spine(2.5, 4.4, 1.7)
POUNCE_STEP = pose(
    body(**_PO_STEP_B, HD_=head_at(_PO_STEP_B["N_"], pitch=PO_PITCH), T_=P(0, 6.0, g + 2.6)),
    legs(**{**_PO_FRONT, "fl": P(0.65, -3.7, g + PAW), "wl": P(0.75, -3.0, g + 0.45)},
         **_hind(*_PO_HIND_F, _PO_STEP_B["HJ_"], hock_up=PO_HOCK)))

# 01b § 3 LAUNCH (1,75 s) : corps horizontal et allongé, monté ; FL/FR tendus vers l'avant, BL/BR tendus
# vers l'arrière (01b § 2 Détente, UYSo 30,734-30,93 s). Pieds arrière encore au sol (poussée) : pas de "_air".
_PO_LAUNCH_B = _spine(4.0, 4.3, 3.4, stretch=1.0)
POUNCE_LAUNCH = pose(
    body(**_PO_LAUNCH_B, HD_=head_at(_PO_LAUNCH_B["N_"], pitch=3), T_=P(0, 7.4, g + 4.0)),   # pitch 0-5
    legs(fl=P(0.6, -5.0, g + 1.3), fr=P(-0.6, -5.0, g + 1.3), faim=(0, -1, -0.15),
         **_hind(P(0.75, 6.4, g + 0.8), P(-0.75, 6.4, g + 0.8), _PO_LAUNCH_B["HJ_"], baim=(0, 0.6, -0.8))))
# 01b § 3 AIR (1,95 s) : hauteur max ≈ +1,0 (bond bas et rasant, 01b § 2 Hauteur, UYSo 30,8-30,93 s),
# pitch ≈ 10, antérieurs qui descendent. Clip sur place : l'avancée est laissée à Cat.js.
_PO_AIR_B = _spine(4.0, 4.3, 3.4, stretch=0.8)
POUNCE_AIR = pose(
    body(**_PO_AIR_B, HD_=head_at(_PO_AIR_B["N_"], pitch=10), T_=P(0, 7.2, g + 4.2)),
    legs(fl=P(0.6, -4.6, g + 0.6), fr=P(-0.6, -4.6, g + 0.6), faim=(0, -1, -0.3),
         **_hind(P(0.75, 5.8, g + 1.4), P(-0.75, 5.8, g + 1.4), _PO_AIR_B["HJ_"], baim=(0, 0.6, -0.8))))
POUNCE_AIR["_air"] = 1.0
# Clés de passage hors 01b (au jugé) : entre STEP (1,65 s) et LAUNCH (1,75 s), le maillage plongeait
# de -0,65 unité (f42, mode `sweep`) ; entre LAND (2,1 s) et PIN (2,5 s), il flottait jusqu'à +0,19
# (f56). Poses intermédiaires remises au sol par apply_pose.
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
# 01b § 3 LAND (2,1 s) : antérieurs au sol devant, bassin encore haut, pitch ≈ 20, BL/BR qui se ramènent.
_PO_LAND_B = _spine(3.2, 4.6, 2.6, stretch=0.5)
POUNCE_LAND = pose(
    body(**_PO_LAND_B, HD_=head_at(_PO_LAND_B["N_"], pitch=20), T_=P(0, 6.8, g + 4.0)),
    legs(fl=P(0.65, -4.0, g + PAW), fr=P(-0.65, -4.0, g + PAW), faim=(0, -1, -0.1),
         **_hind(P(0.75, 4.2, g + 1.4), P(-0.75, 4.2, g + 1.4), _PO_LAND_B["HJ_"])))
# 01b § 3 PIN (2,5 s) : accroupi, épaules basses, pitch ≈ 30 (museau vers les pattes), FL/FR posés, BL/BR
# sous le bassin. Retour au repos géré par Brain (01b § 3).
_PO_PIN_B = _spine(2.6, 3.9, 1.8)
POUNCE_PIN = pose(
    body(**_PO_PIN_B, HD_=head_at(_PO_PIN_B["N_"], pitch=PO_PIN_PITCH), T_=P(0.8, 6.4, g + 0.8)),
    legs(**{**_PO_FRONT, "fl": P(0.65, -3.6, g + PAW), "fr": P(-0.65, -3.6, g + PAW),
            "wl": P(0.75, -2.9, g + 0.45), "wr": P(-0.75, -2.9, g + 0.45)},
         **_hind(*_PO_HIND_F, _PO_PIN_B["HJ_"], hock_up=PO_HOCK)))

# --- Jump / JumpDown (2026-10-26, mission catgame_monde, agent A) : saut sur un muret de 0,3 à 0,5 m
# (3,5 à 5,8 unités ; chat de 0,8 m) et descente. Clips SUR PLACE : la racine (avancée et hauteur)
# est déplacée en JS par l'agent D ; chaque clé est remise au sol (point le plus bas du maillage au
# niveau de la racine). Poses écrites debout puis basculées en tangage (pitched, deg > 0 : museau
# vers le haut). Phases d'après docs/recherche/dos_chat.md § 7 (saut sur un muret) ; positions et
# durées au jugé, réglées sur les aperçus W_Jump_* et W_JumpDown_*.
def pitched(p, deg, pivot):
    return rolled(p, -deg, pivot, axis="X")

def _jbody(n_z, h_z, s_z, stretch=0.0, pitch=0, tail=None):
    b = _spine(n_z, h_z, s_z, stretch=stretch)
    return body(**b, HD_=head_at(b["N_"], pitch=pitch), T_=tail if tail is not None else P(0, 6.6, g + 3.0)), b

def _jlegs(fy, fz, by, bz, hj, faim=(0, -1, -0.1), baim=None, hock_up=0.0, fx=0.65, bx=0.75):
    """Pieds avant à (±fx, fy, g+fz), arrière à (±bx, by, g+bz) ; coudes au décalage de repos, jarrets par pole()."""
    return legs(fl=P(fx, fy, g + fz), fr=P(-fx, fy, g + fz), faim=faim,
                **_hind(P(bx, by, g + bz), P(-bx, by, g + bz), hj, baim=baim, hock_up=hock_up))

def _jpose(spine, leg, deg=0, pivot=(0, 0, 0)):
    (bd, b) = spine
    p = pose(bd, leg(b["HJ_"]))
    return pitched(p, deg, P(*pivot)) if deg else p

# Accroupi, arrière chargé (jarrets pliés, pieds arrière avancés sous le ventre), regard vers le dessus
# du mur (museau horizontal, corps un peu cabré) : dos_chat.md § 7 « préparation ».
JUMP_CROUCH = _jpose(_jbody(2.8, 3.4, 2.0, pitch=0, tail=P(0, 6.4, g + 1.0)),
                     lambda hj: _jlegs(-3.2, PAW, 2.0, PAW, hj, hock_up=0.8))
# Détente : arrière qui se déplie (pieds encore au sol, en arrière), avant repliées contre le poitrail,
# corps cabré de 30° (pivot : pieds arrière).
JUMP_PUSH = _jpose(_jbody(4.4, 4.4, 3.6, stretch=0.8, pitch=0, tail=P(0, 7.4, g + 3.4)),
                   lambda hj: _jlegs(-3.4, 2.2, 5.4, PAW, hj, faim=(0, -0.3, -0.95), baim=(0, 0.6, -0.8)),
                   22, (0, 5.4, g))
# En l'air : corps étiré, pattes avant tendues vers l'avant et le haut (vers le dessus du mur),
# arrière traînantes, queue en balancier.
JUMP_AIR = _jpose(_jbody(4.2, 4.3, 3.6, stretch=1.0, pitch=0, tail=P(0, 7.6, g + 3.6)),
                  lambda hj: _jlegs(-5.4, 2.4, 7.8, 3.8, hj, faim=(0, -1, 0.1), baim=(0, 1, 0)),
                  18, (0, 0.5, g + 4))
# Pattes avant posées sur le dessus (elles sont plus haut que les pieds arrière, encore pendants).
JUMP_REACH = _jpose(_jbody(3.8, 4.3, 3.0, stretch=0.8, pitch=10, tail=P(0, 7.2, g + 3.0)),
                    lambda hj: _jlegs(-4.8, PAW, 4.4, 1.8, hj),
                    12, (0, -4.8, g))
# Arrière ramenées sous le ventre (traction), corps qui se remet à plat.
JUMP_PULL = _jpose(_jbody(3.2, 4.2, 2.4, stretch=0.2, pitch=15, tail=P(0, 6.8, g + 2.6)),
                   lambda hj: _jlegs(-4.0, PAW, 2.6, 1.4, hj, hock_up=0.8),
                   4, (0, -4.0, g))
# Réception souple sur le dessus : quatre pieds posés, accroupi, puis retour debout.
JUMP_LAND = _jpose(_jbody(2.9, 3.9, 2.2, pitch=20, tail=P(0.4, 6.6, g + 2.0)),
                   lambda hj: _jlegs(-3.6, PAW, 2.8, PAW, hj, hock_up=0.8))

# JumpDown : regard vers le bas, avant qui s'avancent, poussée, pattes avant tendues vers le sol
# (corps plongeant), réception avant puis arrière, amorti.
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

LOOP_FRAMES = {"Walk": WALK_FRAMES, "Stalk": STALK_FRAMES}

ACTIONS = {
    "Rest": [(0, REST_POSE), (1, REST_POSE)],
    "Idle": [(0, REST_POSE), (2, REST_POSE)],
    "Walk": [(i / FPS, walk_pose(i / WALK_FRAMES)) for i in range(WALK_FRAMES + 1)],
    "Sit": [(0, REST_POSE), (1.2, SIT), (3, SIT)],
    # Lie : assise 0,5 s, pause 0,4 s (mouvement_stray.md § 4), descente 0,6 s (au jugé, entre 0,4 s
    # de Stray et ≈ 1,5 s du réel, mouvement_reels.md § 5), installation 0,5 s (au jugé) : 2,0 s au
    # total (réel 1,5 à 2,5 s, mouvement_reels.md § 4-5). Cat.js CLIPS.Lie.hold = 2.0.
    "Lie": [(0, REST_POSE), (0.5, SIT), (0.9, SIT), (1.5, LIE), (2.0, LIE_SETTLE), (3, LIE_SETTLE)],
    # Pet « version simple » (mission catgame_style) : couché sur le flanc, jamais sur le dos. Mêmes
    # repères que l'ancien clip : assis 0,9 s et couché 2,0 s (Brain.js PET_FROM), flanc installé 3,0 s,
    # tenue (respiration, frottement de tête) 3,0 -> 7,0 s (Brain.js PET_PADDLE), relever dès 7,0 s,
    # sphinx 8,0 s, debout 9,0 s. Une clé toutes les 0,5 s pendant la tenue (quarts de respiration).
    # Oreilles détendues (_relaxed, voir EAR_ROOTS) de 2,2 à 7,35 s, dressées dès le sphinx de 7,7 s.
    "Pet": [(0, REST_POSE), (0.5, SIT), (0.9, SIT), (1.5, LIE), (2.0, LIE_SETTLE),
            (2.2, _relaxed(PET_CHEEK, 0.5)), (2.3, _relaxed(PET_HALF_ROLL, 0.8)), (2.4, _relaxed(PET_SHOULDER_DOWN)),
            (3.0, _relaxed(PET_FLANK))]
           + [(3.0 + 0.5 * k, _relaxed(pet_flank(0.5 * k))) for k in range(1, 9)]
           + [(7.35, _relaxed(PET_RISE_HEAD, 0.5)), (7.7, PET_RISE), (8.0, LIE), (9.0, REST_POSE)],
    # Sleep : même coucher que Lie jusqu'à 2,0 s, flanc à 2,6 s comme Pet, boule à 3,8 s (1,2 s comme
    # avant, au jugé), tenue jusqu'à 6 s. Cat.js CLIPS.Sleep.hold = 3.8 (instant où CURL est atteint).
    # Passage au flanc tête d'abord (SLEEP_HEAD 2,2 s, SLEEP_ROLL 2,4 s) : voir SLEEP_HEAD.
    "Sleep": [(0, REST_POSE), (0.5, SIT), (0.9, SIT), (1.5, LIE), (2.0, LIE_SETTLE), (2.2, SLEEP_HEAD),
              (2.4, SLEEP_ROLL), (2.6, SIDE), (3.8, CURL), (6, CURL)],
    # Wake : part de CURL (fin de Sleep) ; tête levée en 0,7 s (mouvement_reels.md § 9 ; 0,6 ± 0,2 s,
    # mouvement_stray.md § 2.7), regard alentour 2,4 s (0,7-3,1 s, mouvement_stray.md § 2.7), sans
    # bâillement (aucune clé de forme). Ne se lève pas aussitôt : sphinx à 4,3 s tenu 1 s, debout à
    # 6,2 s (durées au jugé ; le réel reste couché, mouvement_reels.md § 9, mais Brain enchaîne debout).
    "Wake": [(0, CURL), (0.7, CURL_HEAD), (1.5, CURL_LOOK1), (2.3, CURL_LOOK2), (3.1, CURL_HEAD),
             (4.3, LIE), (5.3, LIE), (6.2, REST_POSE)],
    # Stretch (variante Stray, mouvement_stray.md § 2.5) : dos rond en 0,4 s, tenu 0,6 s ; étirement
    # avant atteint en 0,4 s, tenu 1,4 s ; retour en 0,4 s (entrée et retour 0,3-0,5 s,
    # mouvement_reels.md § 8). Total 3,2 s.
    "Stretch": [(0, REST_POSE), (0.4, ARCH), (1.0, ARCH), (1.4, STRETCH), (2.8, STRETCH), (3.2, REST_POSE)],
    # Groom : un coup de langue (tête relevée, GROOM1) toutes les 0,5 s (≈ 0,45-0,5 s,
    # mouvement_reels.md § 7 ; 0,5 s = 12 images exactes), cinq coups de 1,65 à 3,65 s. Fin décalée
    # avec la dernière clé (3,9 s au lieu de 3,5 s) : assis à 4,5 s, debout à 5,3 s (était 4,2 / 5,0 ;
    # retour debout toujours 0,8 s). Durées au jugé : aucun rapport ne les donne (fiche 04).
    "Groom": [(0, REST_POSE), (0.8, SIT), (1.4, GROOM0)]
             + [(1.4 + 0.25 * i, GROOM1 if i % 2 else GROOM0) for i in range(1, 11)]
             + [(4.5, SIT), (5.3, REST_POSE)],
    # Stalk : boucle de 2,0 s (01b § 3 Stalk), une clé par image comme Walk ; arrêts figés gérés par Brain.
    "Stalk": [(i / FPS, stalk_pose(i / STALK_FRAMES)) for i in range(STALK_FRAMES + 1)],
    # Pounce : calendrier de 01b § 3 Pounce ; dandinement échantillonné toutes les 2 images (3 Hz).
    "Pounce": [(0, REST_POSE), (0.4, POUNCE_CROUCH)]
              + [(0.4 + k / 12, pounce_wiggle(0.4 + k / 12)) for k in range(1, 14)]
              + [(1.6, pounce_wiggle(1.6)), (1.65, POUNCE_STEP),
                 (1.7, POUNCE_PUSH),                # hors 01b : anti-creux (voir POUNCE_PUSH)
                 (1.75, POUNCE_LAUNCH), (1.95, POUNCE_AIR), (2.1, POUNCE_LAND),
                 (2.3, POUNCE_SETTLE),              # hors 01b : anti-flottement (voir POUNCE_PUSH)
                 (2.5, POUNCE_PIN)],
    # Jump (sur place, voir JUMP_CROUCH) : accroupi 0,3 s tenu jusqu'à 0,45 s, détente 0,6 s (les pieds
    # arrière quittent le sol), en l'air 0,75 s, pattes avant sur le dessus 0,9 s, arrière ramenées
    # 1,05 s, réception 1,25 s, debout 1,6 s. Durées au jugé (dos_chat.md § 7).
    "Jump": [(0, REST_POSE), (0.3, JUMP_CROUCH), (0.45, JUMP_CROUCH), (0.6, JUMP_PUSH), (0.75, JUMP_AIR),
             (0.9, JUMP_REACH), (1.05, JUMP_PULL), (1.25, JUMP_LAND), (1.6, REST_POSE)],
    # JumpDown : regard vers le bas 0,3 s, poussée et vol 0,5 s, pattes avant au sol 0,7 s, arrière 0,85 s,
    # debout 1,25 s.
    "JumpDown": [(0, REST_POSE), (0.3, JDOWN_LOOK), (0.5, JDOWN_AIR), (0.7, JDOWN_FRONT), (0.85, JDOWN_LAND),
                 (1.25, REST_POSE)],
}

# ------------------------------------------------------------------ rendu de contrôle
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
    # 2026-10-26 : vue proche de la capture du jeu des papouilles (côté dos, un peu devant, au-dessus).
    VIEWS["game"] = make_camera("CamGame", (14, -8, 7), (0, -1.0, 0.8), lens=50)
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
    # Articulations obtenues (z au-dessus du sol) : genou/jarret arrière, coude/poignet avant.
    j = lambda n, end: tuple(round(v - (G if i == 2 else 0), 2) for i, v in enumerate(getattr(arm.pose.bones[n], end)))
    print(f"   JOINTS knee={j('Thigh_Back_L', 'tail')} hock={j('Calf_back_L', 'tail')} ball={j('Foot_Back_L', 'tail')}"
          f" elbow={j('Thigh_front_L', 'tail')} wrist={j('Calf_Front_L', 'tail')} paw={j('Foot_front_L2', 'tail')}")
    far = [(pb.name, tuple(round(v, 1) for v in pb.head), round(pb.scale.length, 2)) for pb in arm.pose.bones if pb.head.length > 10 or abs(pb.scale.length - 3 ** 0.5) > 0.2]
    if far:
        print("   FAR", far)

def head_pitch():
    """Angle (°) du museau par rapport à l'horizontale, dans le plan Y-Z : >0 = museau vers le bas."""
    pb = arm.pose.bones["Head"]
    d = (pb.tail - pb.head).normalized()
    r = (REST["Head"][1] - REST["Head"][0]).normalized()
    a = math.degrees(math.atan2(-d.z, -d.y)) - math.degrees(math.atan2(-r.z, -r.y))
    return a

def head_roll():
    """Roulis (°) de la tête par rapport au monde : élévation de l'axe X local de l'os Head
    (horizontal au repos), corrigée de sa valeur de repos. 0 = tête droite, ±90 = joue au sol."""
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
    print("G (sol) =", round(G, 3))
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
    # --prefix P : fichiers P<nom>_fNNN_<vue>.png (ne pas écraser les aperçus de référence).
    prefix = ARGS[ARGS.index("--prefix") + 1] if "--prefix" in ARGS else ""
    setup_render()
    if name == "run":
        use_action(bpy.data.actions[name])
        ik_mode(short=False)
    else:
        build_action(name, ACTIONS[name])
    # L'IK étirable de la colonne dépend des images précédentes : on parcourt toutes les images dans
    # l'ordre (comme l'export) avant chaque rendu, sinon une image isolée peut exploser (Pet f67).
    done = 0
    for f in sorted(frames):
        for k in range(done + 1, f):
            scene.frame_set(k)
        done = f
        render(prefix + name, f, views)
elif ARGS and ARGS[0] == "scan":
    # Diagnostic : -- scan avant/arrière/tête[/u] ... ; pose sur le dos (u : pattes de relevé) tournée
    # par twisted(), mise au sol, creux restant et Root. Un Root à z > 1 trahit une colonne qui explose.
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
    # Diagnostic : -- sweep Nom ; toutes les images de l'action dans l'ordre, creux du maillage et
    # os le plus éloigné (une colonne qui explose donne des os à des dizaines d'unités).
    act = build_action(ARGS[1], ACTIONS[ARGS[1]])
    for k in range(1, int(act.frame_range[1]) + 2):
        scene.frame_set(k)
        far = max(arm.pose.bones, key=lambda pb: pb.head.length)
        print(f"SWEEP {ARGS[1]} f{k} min={mesh_min_z() - G:.2f} far={far.name} {far.head.length:.1f}")
elif ARGS and ARGS[0] == "hump":
    # Diagnostic (2026-10-26, mission catgame_monde, agent A) : -- hump [Nom ...] [images ...] ; pour
    # chaque image, pli des os de la colonne (voir plus bas) et bosse du maillage. 1 unité ≈ 8,6 cm
    # dans le jeu. HUMP_ALL=1 : une ligne par image ; HUMP_PROFILE=1 : profil et articulations.
    # Mesure sur le maillage : profil du dos (sommets de la ligne médiane |x| < 0,3, dans le
    # repère de Root, plus haut z par tranche de y de 0,25) ; bosse = plus grand écart du profil
    # au-dessus de la droite garrot (y = -1,5) - croupe (y = 2,75). Au repos : voir la sortie (Idle f1).
    YS = [-1.5 + 0.25 * i for i in range(18)]   # -1,5 .. 2,75

    def mesh_hump():
        dg = bpy.context.evaluated_depsgraph_get()
        ev = cat.evaluated_get(dg)
        m = ev.to_mesh()
        # déplacement de Root (pose x repos^-1, espace armature) : on l'annule pour revenir au repère debout
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
            # Pli de la colonne : plus grand écart (3D) des articulations Spine.002 à Spine.004 à la corde
            # tête de Spine.001 - queue de Spine.004. Une colonne comprimée se plie en zigzag (bosse).
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
        print(f"HUMP {name} os max={worst[0]:.2f} f{worst[1]} ({(worst[1] - 1) / FPS:.2f} s)"
              f" | maillage max={mworst[0]:.2f} f{mworst[1]} ({(mworst[1] - 1) / FPS:.2f} s) y={mworst[2]:.2f}")
elif ARGS and ARGS[0] == "export":
    use_action(bpy.data.actions["run"])
    ik_mode(short=False)
    set_ears(None)  # oreilles clées au repos dans « run » aussi (voir EAR_ROOTS)
    for n in EAR_ROOTS:
        arm.pose.bones[n].keyframe_insert("rotation_quaternion", frame=1)
    for name, keys in ACTIONS.items():
        if name != "Rest":
            build_action(name, keys)
    export(ARGS[1])
