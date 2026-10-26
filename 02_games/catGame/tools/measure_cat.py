"""Mesure des proportions du chat (maillage au repos) et comparaison aux rapports de recherche.

Usage (Windows, Git Bash, depuis la racine de catGame ; ~20 s par lancement) :
  B="/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"
  "$B" -b assets/sources/cat.blend --python tools/measure_cat.py -- [--raw]

Un seul lancement mesure les deux états : le script importe tools/anim_cat.py avec l'argument
`--raw` (prep() exécuté, reshape() non), mesure le maillage brut, appelle anim_cat.reshape(),
mesure à nouveau et imprime un tableau Markdown « brut / remodelé / cible (source) / écart ».
Avec `--raw`, seul l'état brut est mesuré. Rien n'est enregistré : ni le .blend, ni un fichier.
`--set NOM=VALEUR` (répétable) remplace une constante du bloc remodelage d'anim_cat.py pour un
essai, sans modifier le fichier (ex. `--set EAR_SCALE=0.85`).

Cibles : docs/recherche/proportions_mesures.md (§ 4.1 médianes FACE, n = 6 836 ; § 4.2 forme
médiane) et docs/recherche/proportions_litterature.md (§ 1.1 membres [P24]/[K26], § 1.2 tête
vivante [T09], § 1.3 crâne [S21]). Chaque ligne du tableau cite son rapport et sa section.

Repérage des points sur le modèle (espace monde = espace armature : -Y museau, +Z haut, +X gauche
du chat ; les matrices monde de `Armature` et `Cat` sont l'identité, vérifié le 2026-10-22) :
  - yeux : centres des objets `Sphere` (+X) et `Sphere.001` (-X), moyenne de leurs sommets ;
    l'écart des yeux (IOD, centre à centre) est l'unité des rapports « de face » ;
  - repère « de face » : origine au milieu des yeux, axe x = X monde, axe « haut » u perpendiculaire
    à la direction de l'os `Nose` (museau) dans le plan Y-Z ; c'est le plan image d'une photo prise
    dans l'axe du museau (l'os `Nose` est presque horizontal au repos, la projection est donc
    quasi identique à celle de la caméra `front` de anim_cat.py, plan X-Z) ;
  - oreilles : sommets du maillage `Cat` dont la somme des poids sur les os d'oreille
    (anim_cat.EAR_BONES) est >= 0,5 (EAR_W), côté +X et côté -X ; pointe = apex, le sommet le plus
    haut de l'oreille dans le repère de face (le sommet le plus éloigné de la base osseuse serait,
    après remodelage, un sommet du bord externe, les joues élargies poussant ce bord vers
    l'extérieur) ; bases interne / externe = sommets de la bande des 30 % les plus bas le long de
    l'axe osseux base -> pointe (tête de `Ear` / `Ear.006` -> queue de `Ear.002` / `Ear.004`), de
    |x| minimal / maximal ; milieu de base = milieu de ces deux points. Hauteur, largeur de base,
    inclinaison, écarts : distances 2D dans le repère de face, comme sur les photos
    (proportions_mesures.md § 3.3) ;
  - bas de la truffe : sommets médians (|x| < 0,10 unité) à moins de 0,12 unité en arrière du point
    le plus avancé du maillage (bout du nez) ; on prend le plus bas (u minimal) ;
  - largeur de tête : étendue en x des sommets de la tête (y < tête de l'os `Head`, hors oreilles) ;
    approximation de la largeur bizygomatique « sur l'animal » de [T09] (tissus mous compris) ;
  - profil : « prosthion » = bout du nez (sommet le plus avancé), « nasion » = sommet médian le plus
    avancé à hauteur des yeux (|u| < 0,2 IOD), « inion » = tête de l'os `Head` (jonction crâne-cou) ;
    longueur faciale = nez -> nasion, longueur du crâne = nez -> inion (substitut osseux,
    proportions_litterature.md § 4) ;
  - membres : longueurs des os au repos (`Thigh_front_L` = humérus, `Calf_Front_L` = radius,
    `Thigh_Back_L` = fémur, `Calf_back_L` = tibia), identiques avant et après remodelage ; hauteur
    au garrot = sommet du maillage au-dessus de la base du cou (|y - y(Neck.head)| < 0,3) moins le
    point le plus bas du maillage ;
  - queue : somme des longueurs des os `Tail` à `Tail.007` ; tête-croupe = distance en y du bout du
    nez à la tête de l'os `Tail`.
Limites : maillage de 1 417 sommets (19 par oreille au-dessus du seuil) ; les points « base
d'oreille » et « nasion » sont donc approchés au sommet près ; aucune mesure de l'ouverture des
paupières (on donne le diamètre du globe / largeur de tête, à comparer à ~0,32 croisé [K12]/[T09]).
"""
import bpy, sys, os, math
from mathutils import Vector

MY_ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RAW_ONLY = "--raw" in MY_ARGS
# Essais sans modifier anim_cat.py : `--set EAR_SCALE=0.9 --set CHEEK=0.1` remplace une constante du
# bloc remodelage avant l'appel de reshape() (constantes scalaires seulement ; SKULL : `--set SKULL=0,-3.7,3`).
OVERRIDES = {}
for i, a in enumerate(MY_ARGS):
    if a == "--set" and i + 1 < len(MY_ARGS):
        k, v = MY_ARGS[i + 1].split("=", 1)
        OVERRIDES[k] = v

# anim_cat.py lit sys.argv à l'import et exécute prep() puis reshape() sauf « --raw » : on lui passe
# « --raw » pour obtenir le maillage brut, puis on appelle reshape() nous-mêmes.
_saved = sys.argv
sys.argv = [sys.argv[0], "--", "--raw"]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.getcwd(), "tools"))
import jeux.catGame.tools.anim_cat as A
sys.argv = _saved

arm, cat = A.arm, A.cat
EAR_W = 0.5       # seuil de poids d'oreille
BAND = 0.30       # fraction basse de l'oreille (le long de l'axe osseux) où l'on cherche les bases
MID_X = 0.10      # demi-largeur de la bande médiane (unités Blender)
NOSE_DY = 0.12    # profondeur de la truffe derrière le bout du nez (unités Blender)


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
    """Relève les repères et les rapports sur l'état courant du maillage. Renvoie (rapports, repères)."""
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

    L = {}  # repères (monde)
    R = {}  # rapports
    L["IOD"] = IOD
    L["nose_pitch_deg"] = pitch
    L["eye_L"], L["eye_R"], L["eye_r"] = cL, cR, (rL + rR) / 2

    # --- truffe, nez, nasion
    head_y = bone("Head")[0].y
    mid = [p for p in P if abs(p.x) < MID_X and p.y < head_y]
    nose_tip = min(mid, key=lambda p: p.y)
    pad = [p for p in mid if p.y < nose_tip.y + NOSE_DY]
    nose_bottom = min(pad, key=lambda p: face(p)[1])
    L["nose_tip"], L["nose_bottom"], L["nose_pad_n"] = nose_tip, nose_bottom, len(pad)
    R["truffe_sous_yeux"] = -face(nose_bottom)[1]
    at_eye = [p for p in mid if abs(face(p)[1]) < 0.2 and p.y < O.y + 0.6]
    nasion = min(at_eye, key=lambda p: p.y)
    L["nasion"] = nasion
    inion = bone("Head")[0]
    L["inion"] = inion
    facial = (nose_tip - nasion).length
    skull = (nose_tip - inion).length
    R["facial_sur_crane"] = facial / skull
    L["facial"], L["skull"] = facial, skull

    # --- largeur de tête (hors oreilles)
    head = [p for p, we in zip(P, WE) if p.y < head_y and we < 0.01]
    HW = max(p.x for p in head) - min(p.x for p in head)
    L["head_width"] = HW
    R["iod_sur_largeur_tete"] = IOD / HW
    R["globe_sur_largeur_tete"] = 2 * L["eye_r"] / HW

    # --- oreilles
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
    R["oreille_hauteur"] = (e1["height"] + e2["height"]) / 2
    R["oreille_base"] = (e1["base"] + e2["base"]) / 2
    R["oreille_elancement"] = R["oreille_hauteur"] / R["oreille_base"]
    R["oreille_inclinaison_deg"] = (e1["tilt"] + e2["tilt"]) / 2
    R["pointes_ecart"] = d2(e1["t2"], e2["t2"])
    R["pointes_hauteur"] = (e1["t2"][1] + e2["t2"][1]) / 2
    R["bases_externes_ecart"] = d2(e1["o2"], e2["o2"])
    R["bases_internes_ecart"] = d2(e1["i2"], e2["i2"])
    R["iod_sur_bases_externes"] = 1 / R["bases_externes_ecart"]
    R["bases_externes_hauteur"] = (e1["o2"][1] + e2["o2"][1]) / 2
    R["bases_internes_hauteur"] = (e1["i2"][1] + e2["i2"][1]) / 2
    R["pointe_x"] = (abs(e1["t2"][0]) + abs(e2["t2"][0])) / 2
    R["base_externe_x"] = (abs(e1["o2"][0]) + abs(e2["o2"][0])) / 2
    R["base_interne_x"] = (abs(e1["i2"][0]) + abs(e2["i2"][0])) / 2
    tot = R["truffe_sous_yeux"] + R["pointes_hauteur"]
    R["yeux_fraction"] = R["pointes_hauteur"] / tot
    R["pavillon_sur_largeur_tete"] = (e1["h3d"] + e2["h3d"]) / 2 / HW

    # --- membres et garrot
    ground = min(p.z for p in P)
    ny = bone("Neck")[0].y
    withers = max(p.z for p, we in zip(P, WE) if abs(p.y - ny) < 0.3 and we < 0.01) - ground
    L["ground"], L["withers"] = ground, withers
    seg = {k: (bone(k)[1] - bone(k)[0]).length for k in ("Thigh_front_L", "Calf_Front_L", "Foot_front_L2", "Thigh_Back_L", "Calf_back_L", "Foot_Back_L")}
    L["segments"] = seg
    R["humerus_sur_garrot"] = seg["Thigh_front_L"] / withers
    R["radius_sur_garrot"] = seg["Calf_Front_L"] / withers
    R["femur_sur_garrot"] = seg["Thigh_Back_L"] / withers
    R["tibia_sur_garrot"] = seg["Calf_back_L"] / withers
    R["intermembral"] = (seg["Thigh_front_L"] + seg["Calf_Front_L"]) / (seg["Thigh_Back_L"] + seg["Calf_back_L"])
    R["radius_sur_humerus"] = seg["Calf_Front_L"] / seg["Thigh_front_L"]
    R["tibia_sur_femur"] = seg["Calf_back_L"] / seg["Thigh_Back_L"]

    # --- queue
    tail = sum((bone(n)[1] - bone(n)[0]).length for n in ("Tail", "Tail.001", "Tail.002", "Tail.003", "Tail.004", "Tail.005", "Tail.006", "Tail.007"))
    hb = bone("Tail")[0].y - nose_tip.y
    L["tail"], L["head_body"] = tail, hb
    R["queue_sur_tete_corps"] = tail / hb
    R["tete_sur_tete_corps"] = skull / hb
    R["largeur_tete_sur_garrot"] = HW / withers
    return R, L


# (clé, libellé, cible, source)
ROWS = [
    ("truffe_sous_yeux", "Bas de la truffe sous la ligne des yeux", 0.785, "proportions_mesures.md § 4.1 (Q1-Q3 0,712-0,848)"),
    ("pointes_hauteur", "Hauteur des pointes d'oreilles au-dessus des yeux", 1.589, "proportions_mesures.md § 4.1 (1,457-1,730)"),
    ("pointes_ecart", "Écart des pointes d'oreilles", 2.511, "proportions_mesures.md § 4.1 (2,335-2,727)"),
    ("yeux_fraction", "Position des yeux : pointes / (pointes -> truffe)", 0.672, "proportions_mesures.md § 4.1 (0,654-0,692)"),
    ("oreille_hauteur", "Hauteur d'une oreille (pointe -> milieu de base)", 0.983, "proportions_mesures.md § 4.1 (0,900-1,082)"),
    ("oreille_base", "Largeur de base d'une oreille", 0.830, "proportions_mesures.md § 4.1 (0,755-0,912)"),
    ("oreille_elancement", "Élancement de l'oreille (hauteur / base)", 1.179, "proportions_mesures.md § 4.1 (1,078-1,299)"),
    ("oreille_inclinaison_deg", "Inclinaison de l'oreille (degrés, > 0 vers l'extérieur)", 26.8, "proportions_mesures.md § 4.1 (22,8-31,8)"),
    ("bases_externes_ecart", "Écart des bases externes d'oreilles", 2.281, "proportions_mesures.md § 4.1 (2,164-2,422)"),
    ("bases_internes_ecart", "Écart des bases internes d'oreilles", 0.947, "proportions_mesures.md § 4.1 (0,839-1,086)"),
    ("iod_sur_bases_externes", "Écart des yeux / écart des bases externes", 0.438, "proportions_mesures.md § 4.1 (0,413-0,462)"),
    ("bases_externes_hauteur", "Hauteur des bases externes au-dessus des yeux", 0.473, "proportions_mesures.md § 4.1 (0,358-0,595)"),
    ("bases_internes_hauteur", "Hauteur des bases internes au-dessus des yeux", 0.955, "proportions_mesures.md § 4.1 (0,862-1,059)"),
    ("pointe_x", "|x| de la pointe d'oreille", 1.255, "proportions_mesures.md § 4.2"),
    ("base_externe_x", "|x| de la base externe d'oreille", 1.140, "proportions_mesures.md § 4.2"),
    ("base_interne_x", "|x| de la base interne d'oreille", 0.473, "proportions_mesures.md § 4.2"),
    ("iod_sur_largeur_tete", "Écart des yeux / largeur de tête", 0.544, "proportions_litterature.md § 1.2 [T09]"),
    ("pavillon_sur_largeur_tete", "Hauteur du pavillon (3D) / largeur de tête", 0.781, "proportions_litterature.md § 1.2 [T09]"),
    ("globe_sur_largeur_tete", "Diamètre du globe oculaire / largeur de tête", 0.32, "proportions_litterature.md § 1.2 (croisé [K12]/[T09])"),
    ("facial_sur_crane", "Profil : longueur faciale / longueur du crâne", 0.387, "proportions_litterature.md § 1.3 [S21] (substitut, § 4)"),
    ("humerus_sur_garrot", "Humérus / hauteur au garrot", 0.387, "proportions_litterature.md § 1.1 [P24]"),
    ("radius_sur_garrot", "Radius / hauteur au garrot", 0.375, "proportions_litterature.md § 1.1 [P24]"),
    ("femur_sur_garrot", "Fémur / hauteur au garrot", 0.416, "proportions_litterature.md § 1.1 [P24]"),
    ("tibia_sur_garrot", "Tibia / hauteur au garrot", 0.438, "proportions_litterature.md § 1.1 [P24]"),
    ("intermembral", "Indice intermembral (hum.+rad.) / (fém.+tib.)", 0.892, "proportions_litterature.md § 1.1 [P24]/[K26]"),
    ("radius_sur_humerus", "Indice brachial radius / humérus", 0.968, "proportions_litterature.md § 1.1 [P24]/[K26]"),
    ("tibia_sur_femur", "Indice crural tibia / fémur", 1.053, "proportions_litterature.md § 1.1 [P24]/[K26]"),
    ("queue_sur_tete_corps", "Queue / tête-croupe", 0.54, "proportions_litterature.md § 1.1 [J-A] (0,54-0,65 avec [WP])"),
    ("tete_sur_tete_corps", "Longueur de tête (nez -> inion) / tête-croupe", 0.203, "proportions_litterature.md § 1.2 [F20] (longueur non définie)"),
    ("largeur_tete_sur_garrot", "Largeur de tête / hauteur au garrot", 0.24, "proportions_litterature.md § 1.2 (croisé [T09]/[P24])"),
]


def fmt(v, key):
    return f"{v:.1f}" if key.endswith("_deg") else f"{v:.3f}"


def print_landmarks(tag, L):
    r = lambda v: tuple(round(x, 3) for x in v)
    print(f"LANDMARKS {tag}: IOD={L['IOD']:.3f} yeux={r(L['eye_L'])}/{r(L['eye_R'])} rayon_globe={L['eye_r']:.3f} "
          f"pente_nez={L['nose_pitch_deg']:.1f}deg nez={r(L['nose_tip'])} bas_truffe={r(L['nose_bottom'])} (n_pad={L['nose_pad_n']}) "
          f"nasion={r(L['nasion'])} inion={r(L['inion'])} facial={L['facial']:.3f} crane={L['skull']:.3f} largeur_tete={L['head_width']:.3f}")
    for s, e in L["ears"].items():
        print(f"   EAR {'+x' if s > 0 else '-x'} n={e['n']} bande={e['band']} pointe={r(e['tip'])} base_int={r(e['inner'])} base_ext={r(e['outer'])} "
              f"(repère de face : pointe={tuple(round(v, 3) for v in e['t2'])} base_int={tuple(round(v, 3) for v in e['i2'])} base_ext={tuple(round(v, 3) for v in e['o2'])})")
    seg = {k: round(v, 3) for k, v in L["segments"].items()}
    print(f"   BODY sol={L['ground']:.3f} garrot={L['withers']:.3f} segments={seg} queue={L['tail']:.3f} tete_croupe={L['head_body']:.3f}")


def print_table(raw, shaped):
    cols = "| Rapport | brut | remodelé | cible | écart (remodelé − cible) | source |" if shaped else "| Rapport | brut | cible | écart (brut − cible) | source |"
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
print_landmarks("brut", raw_L)
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
    print_landmarks("remodelé", sh_L)
    print_table(raw_R, sh_R)
