# Proportions du visage du chat mesurées sur photos annotées (agent A3)

Mission chat_recherche, 2026-10-22. Rapport de mesures par script ; les proportions tirées de la littérature sont dans `proportions_litterature.md` (agent A2).

## 1. En bref

- Jeu de données exploitable **sans compte** : le *CAT Dataset* de Zhang, Sun et Tang (ECCV 2008), miroir archive.org. Téléchargé dans le scratchpad (2 zip, 2 165 286 837 octets ; MD5 identiques à ceux publiés par archive.org, `md5sum` dans `scripts/dl.sh`). Rien n'a été copié dans le dépôt.
- 9 997 têtes annotées lues, 9 points chacune : deux yeux, « bouche », trois points par oreille. Sous-ensemble « quasi de face » : 6 836 têtes (filtre décrit au § 3.3). Commande et sortie : § 3.4.
- Unité de tous les rapports : l'**écart des yeux** (centre à centre, noté IOD). Résultats principaux, sous-ensemble de face, n = 6 836 (sortie de `mesure_cat.py`, lignes 29-52 de `mesures.txt`) :
  - pointes des oreilles à **1,59 IOD** au-dessus de la ligne des yeux, écartées de **2,51 IOD** (médianes) ;
  - point « bouche » (en fait le bas de la truffe, voir § 3.2) à **0,785 IOD** sous la ligne des yeux (médiane) ;
  - les yeux sont aux **67 %** de la hauteur pointes d'oreilles → bas de la truffe (médiane 0,672, ET 0,034 : la mesure la plus stable du jeu) ;
  - oreille : hauteur **0,98 IOD**, largeur de base **0,83 IOD**, élancement hauteur/base **1,18**, axe incliné de **27°** vers l'extérieur (médianes) ;
  - bases externes des oreilles écartées de **2,28 IOD**, d'où écart des yeux / largeur du crâne au niveau des oreilles = **0,438** (médiane).
- Limites majeures : photos 2D (projection, pas de profondeur, donc rien sur la longueur du museau vu de profil), âges et races mélangés et non étiquetés (chatons présents), aucun repère pour la taille des yeux, les joues ou le menton (§ 6).

## 2. Jeux de données examinés

| Jeu | Adresse | Accès | Taille | Apport | Statut |
|---|---|---|---|---|---|
| CAT Dataset (Zhang, Sun, Tang 2008) | https://archive.org/details/CAT_DATASET (métadonnées lues par `curl https://archive.org/metadata/CAT_DATASET`) | libre, sans compte ; « only for research purposes » selon la description archive.org | 2 zip : 1 211 072 773 + 954 214 064 octets ; 10 165 + 9 836 entrées (champ `filecount` des métadonnées) | 9 points du visage (yeux, bouche, oreilles) sur ~10 000 photos Flickr | **téléchargé et mesuré** |
| CatFLW, Cat Facial Landmarks in the Wild (Martvel, Farhat, Shimshoni, Zamansky) | https://arxiv.org/abs/2305.04232 (résumé lu) | « The dataset is available on request » (résumé arXiv) : demande aux auteurs, donc envoi d'un e-mail, exclu par l'ordre de mission | 2 016 images, 48 repères (résumé arXiv) ; 2 091 images dans la version revue IJCV d'après un résumé de recherche web seulement (non lu) | repères choisis d'après la musculature : contour des yeux, truffe, bouche, joues ; donnerait la taille des yeux et la largeur du museau, absentes du CAT Dataset | **listé, non téléchargé** ; décision à l'utilisateur |

Aucun autre jeu n'a été lu ; la recherche web n'a pas trouvé d'autre jeu de repères faciaux de chat téléchargeable librement (recherche du 2026-10-22, requête citée dans la fiche de tâche).

## 3. Méthode

### 3.1 Données

- Format, d'après la description archive.org (lue) : un fichier `<image>.jpg.cat` par photo, contenant « (Number of points, default is 9), (Left Eye), (Right Eye), (Mouth), (Left Ear-1), (Left Ear-2), (Left Ear-3), (Right Ear-1), (Right Ear-2), and (Right Ear-3) ». Erratum publié au même endroit : remplacer `CAT_00/00000003_019.jpg.cat` par `00000003_015.jpg.cat` ; appliqué par le script (ligne 1 de `mesures.txt`).
- Article source (lu, texte extrait du PDF par `pypdf`, § 4.1 de l'article) : « 10,000 cat images mainly obtained from flickr.com », « Most of our own cat data are near frontal view », « Each cat head is manually labeled with 9 points, two for eyes, one for mouth, and six for ears ». La figure 6 (schéma des points) est une image non lue par l'extraction de texte.
- Le script lit les `.cat` directement dans les zip (pas d'extraction) : 9 997 fichiers lus, 0 illisible, 0 écarté (lignes 2-3 de `mesures.txt`). L'écart « ~10 000 » / 9 997 n'est pas expliqué par la source.

### 3.2 Signification des points, vérifiée sur images

Deux planches ont été dessinées par `dessine.py` (points numérotés sur la photo) et regardées : 6 premières images du zip 1 (`out/planche1/planche.png`), puis 9 têtes tirées au hasard, graine 1, recadrées (`out/planche_crop1/planche.png`, commande `dbg2.sh 1`). Sur ces 15 images :

- point 0 (« Left Eye ») = œil situé à gauche de l'image quand la tête est droite, donc l'**œil droit du chat** ; sur une tête renversée (chat la tête en bas), le point 0 reste sur le même œil du chat. Les points sont au centre de la pupille ;
- point 2 (« Mouth ») = **bas de la truffe**, à la naissance de la lèvre supérieure (philtrum), pas la commissure ni le menton. C'est donc la « hauteur du nez sous les yeux » demandée, au bas du nez ;
- oreille gauche de l'image : 3 = base externe, 4 = pointe, 5 = base interne ; oreille droite : 6 = base interne, 7 = pointe, 8 = base externe. Les bases externes sont posées là où le bord externe de l'oreille rejoint le contour de la tête, nettement plus bas que les bases internes.

Le script ne dépend pas de l'ordre interne/externe : il reclasse les deux bases de chaque oreille selon leur distance à l'axe médian (lignes 84-85 du script en annexe).

### 3.3 Normalisation et filtres

- Par image : origine au milieu des deux yeux, axe x le long de la ligne des yeux, axe y perpendiculaire vers le bas du visage, unité = écart des yeux (fonction `norm`, lignes 50-60 du script). Les rapports sont donc sans unité et indépendants de la rotation et de l'échelle de la photo.
- Sous-ensemble **FACE** (lignes 123-124 du script) : point « bouche » à moins de 0,10 IOD de l'axe médian, hauteurs des deux oreilles dans un rapport > 0,80, écart des yeux ≥ 20 px. Retient 6 836 têtes sur 9 997 (ligne 4 de `mesures.txt`). C'est un filtre heuristique de tête « de face », pas une mesure de l'angle de la tête.
- Écart des yeux en pixels sur l'ensemble : médiane 70,2, min 7,0, max 404,7 (ligne 5 de `mesures.txt`).

### 3.4 Commande

Depuis Windows (Git Bash) :

```
MSYS_NO_PATHCONV=1 wsl.exe -d Debian -- bash /mnt/c/Users/axfol/AppData/Local/Temp/claude/--wsl-localhost-Debian-home-Axou-Axou/4c6fedf9-cbec-4d42-9ac1-73a04a6e879f/scratchpad/a3/scripts/run.sh
```

qui lance (chemins abrégés ici ; texte complet de `run.sh` en annexe) :

```
venv/bin/python -I a3/scripts/mesure_cat.py a3/data/CAT_DATASET_01.zip a3/data/CAT_DATASET_02.zip --erratum a3/data/00000003_015.jpg.cat --csv a3/out/mesures.csv
```

Sortie complète : `scratchpad/a3/out/mesures.txt` (71 lignes par `wc -l`, MD5 8a562ca7a4fcbf06b1ced0253feeab9d par `md5sum`) ; une ligne par tête dans `scratchpad/a3/out/mesures.csv` (9 998 lignes avec l'en-tête, `wc -l`). Python 3.13 du venv du scratchpad, bibliothèque standard seulement (`zipfile`, `math`, `statistics`).

## 4. Résultats

Tous les chiffres de ce paragraphe sortent de la commande du § 3.4 (fichier `mesures.txt`, numéros de ligne indiqués). ET = écart-type (population) ; ES = erreur standard de la moyenne (ET/√n) ; Q1-Q3 = quartiles.

### 4.1 Tableau principal — sous-ensemble FACE (n = 6 836, lignes 29-45 de `mesures.txt`)

| Rapport (unité = écart des yeux) | Définition | n | Moyenne | Médiane | ET | Q1-Q3 | Ensemble (n = 9 997) : moyenne / médiane / ET (lignes 9-25) |
|---|---|---|---|---|---|---|---|
| Bas de la truffe sous les yeux | distance du point 2 à la ligne des yeux | 6 836 | 0,771 | 0,785 | 0,131 | 0,712-0,848 | 0,775 / 0,788 / 0,142 |
| Hauteur des pointes d'oreilles | moyenne des 2 pointes au-dessus de la ligne des yeux | 6 836 | 1,593 | 1,589 | 0,266 | 1,457-1,730 | 1,603 / 1,596 / 0,289 |
| Écart des pointes d'oreilles | pointe à pointe | 6 836 | 2,554 | 2,511 | 0,340 | 2,335-2,727 | 2,553 / 2,508 / 0,350 |
| Pointes → bas de la truffe | somme des deux hauteurs ci-dessus | 6 836 | 2,364 | 2,379 | 0,364 | 2,192-2,557 | 2,378 / 2,389 / 0,401 |
| Position des yeux (fraction) | hauteur des pointes / (pointes → truffe) | 6 830 | 0,674 | 0,672 | 0,034 | 0,654-0,692 | 0,674 / 0,672 / 0,034 (n = 9 988) |
| Hauteur d'une oreille | pointe → milieu de sa base, moyenne des 2 | 6 836 | 0,995 | 0,983 | 0,156 | 0,900-1,082 | 1,007 / 0,995 / 0,165 |
| Largeur de base d'une oreille | base interne → base externe, moyenne des 2 | 6 836 | 0,835 | 0,830 | 0,135 | 0,755-0,912 | 0,841 / 0,835 / 0,145 |
| Élancement de l'oreille | hauteur / largeur de base (par image) | 6 836 | 1,213 | 1,179 | 0,234 | 1,078-1,299 | 1,222 / 1,185 / 0,253 |
| Inclinaison de l'oreille (degrés) | axe base → pointe par rapport à la perpendiculaire aux yeux, > 0 vers l'extérieur | 6 836 | 28,1 | 26,8 | 9,0 | 22,8-31,8 | 27,7 / 26,4 / 9,7 |
| Écart des centres de base | milieu de base à milieu de base | 6 836 | 1,641 | 1,616 | 0,186 | 1,523-1,730 | 1,646 / 1,621 / 0,192 |
| Écart des bases internes | entre les deux oreilles, au sommet du crâne | 6 836 | 0,982 | 0,947 | 0,214 | 0,839-1,086 | 0,988 / 0,952 / 0,221 |
| Écart des bases externes | approximation de la largeur du crâne au niveau des oreilles | 6 836 | 2,302 | 2,281 | 0,239 | 2,164-2,422 | 2,306 / 2,288 / 0,250 |
| Écart des yeux / écart des bases externes | inverse du précédent, par image | 6 836 | 0,439 | 0,438 | 0,048 | 0,413-0,462 | 0,439 / 0,437 / 0,050 |
| Hauteur des bases externes | au-dessus de la ligne des yeux | 6 836 | 0,481 | 0,473 | 0,218 | 0,358-0,595 | 0,476 / 0,471 / 0,239 |
| Hauteur des bases internes | au-dessus de la ligne des yeux | 6 836 | 0,966 | 0,955 | 0,191 | 0,862-1,059 | 0,968 / 0,955 / 0,210 |

Erreurs standard de la moyenne, sous-ensemble FACE : 0,0004 à 0,0044 pour les rapports, 0,11° pour l'inclinaison (colonne ES, lignes 29-45). La dispersion entre chats (ET) est donc l'information utile ; l'incertitude sur la moyenne est négligeable devant elle.

### 4.2 Forme médiane de face (n = 6 836, lignes 47-52 de `mesures.txt`)

Coordonnées médianes des points, gauche et droite moyennés en miroir. Unité = écart des yeux ; origine = milieu des yeux ; y > 0 vers le bas ; |x| = distance à l'axe médian.

| Point | |x| médian (ET) | y médian (ET) |
|---|---|---|
| Œil (centre de la pupille) | 0,500 (0, par construction) | 0 (par construction) |
| Bas de la truffe | 0,000 (0,047) | +0,785 (0,131) |
| Base externe d'oreille | 1,140 (0,120) | −0,473 (0,218) |
| Pointe d'oreille | 1,255 (0,170) | −1,589 (0,266) |
| Base interne d'oreille | 0,473 (0,106) | −0,955 (0,191) |

Lecture : la base interne de chaque oreille est presque à l'aplomb du centre de l'œil (|x| 0,473 contre 0,500) ; la pointe est un peu plus en dehors que la base externe (1,255 contre 1,140). Ces coordonnées peuvent être superposées telles quelles à une vue de face du modèle, après mise à l'échelle par son écart des yeux.

### 4.3 Stabilité

- Médianes du sous-ensemble FACE dans chacun des 7 dossiers du jeu (CAT_00 à CAT_06, n = 513 à 1 231 par dossier, lignes 54-62 de `mesures.txt`) : bas de la truffe 0,777-0,791 ; écart des pointes 2,494-2,539 ; hauteur des pointes 1,559-1,608 ; hauteur d'oreille 0,958-1,006 ; base d'oreille 0,816-0,844 ; bases externes 2,248-2,294 ; inclinaison 26,3-27,1°. Les écarts entre dossiers sont faibles devant l'ET entre chats.
- Têtes de face avec écart des yeux ≥ 60 px (annotation moins sensible au pixel ; n = 4 183, lignes 64-71) : médianes 0,786 (truffe), 2,500 (pointes), 1,559 (hauteur des pointes), 0,975 (hauteur d'oreille), 0,815 (base d'oreille), 2,251 (bases externes), 27,2°. Différences de 0,03 IOD au plus avec le tableau principal (les plus grandes : hauteur des pointes et bases externes, −0,03 chacune).

## 5. Utilisation pour `reshape()` (tools/anim_cat.py)

`reshape()` (lignes 107-197 de `tools/anim_cat.py`, lu) règle : `EAR_SCALE` (oreilles ramenées vers leur base, 0,75), `CHEEK` (joues, 0,12), `MUZZLE`/`CHIN` (museau raccourci), `HEAD_SCALE` (crâne, 1,08), `EYE_SCALE` (yeux grossis, 1,35). Les rapports mesurés ici ne donnent pas directement ces coefficients : il faut d'abord mesurer les **mêmes rapports sur le modèle** vu de face (avant et après `reshape()`), puis choisir les coefficients qui les rapprochent des cibles. Cette mesure du modèle n'a pas été faite (hors mission, Blender non utilisé).

Cibles proposées (médianes FACE, § 4.1), avec la fourchette Q1-Q3 comme marge acceptable d'un chat réel :

| Paramètre de `reshape()` | Rapport cible à comparer sur le modèle | Médiane (Q1-Q3), n = 6 836 |
|---|---|---|
| `EAR_SCALE` (taille d'oreille) | hauteur d'une oreille / écart des yeux | 0,983 (0,900-1,082) |
| `EAR_SCALE` (taille d'oreille) | largeur de base / écart des yeux | 0,830 (0,755-0,912) |
| forme d'oreille (pas de paramètre actuel) | élancement hauteur/base ; inclinaison | 1,179 (1,078-1,299) ; 26,8° (22,8-31,8°) |
| position des oreilles (pas de paramètre actuel) | écart des pointes ; hauteur des pointes | 2,511 (2,335-2,727) ; 1,589 (1,457-1,730) |
| `MUZZLE`, `CHIN` (vue de face seulement) | bas de la truffe sous les yeux / écart des yeux | 0,785 (0,712-0,848) |
| `CHEEK`, `HEAD_SCALE` (approximation) | écart des yeux / écart des bases externes | 0,438 (0,413-0,462) |
| `EYE_SCALE` | aucun : la taille de l'œil n'est pas annotée | — |

Remarque de lecture (déduction, non mesurée sur le modèle) : pour un chat « mignon », grossir les yeux sans changer leur écart ne modifie aucun des rapports ci-dessus ; en revanche, rapprocher les yeux (écart plus petit) augmente tous les rapports exprimés en écart des yeux. Il faut donc mesurer l'écart des yeux du modèle **après** `reshape()`.

## Annexe A — script de mesure `mesure_cat.py`

Conservé dans `/mnt/c/Users/axfol/AppData/Local/Temp/claude/--wsl-localhost-Debian-home-Axou-Axou/4c6fedf9-cbec-4d42-9ac1-73a04a6e879f/scratchpad/a3/scripts/mesure_cat.py`. Copie intégrale :

```python
"""Mesures de proportions du visage sur le CAT Dataset (Zhang, Sun, Tang, ECCV 2008).

Usage (WSL) :
  venv/bin/python -I mesure_cat.py CAT_DATASET_01.zip CAT_DATASET_02.zip [--erratum 00000003_015.jpg.cat] [--csv sortie.csv]

Lit les fichiers .cat directement dans les zip (aucune extraction). Format d'un .cat :
  9 x1 y1 ... x9 y9, dans l'ordre : œil gauche, œil droit, bouche, oreille gauche 1, 2, 3,
  oreille droite 1, 2, 3 (description archive.org). Vu sur planches (15 images) : « gauche » =
  côté gauche de l'image pour une tête droite, soit l'œil droit du chat ; oreille gauche 1 = base
  externe, 2 = pointe, 3 = base interne ; oreille droite 1 = base interne, 2 = pointe, 3 = base
  externe. Le script ne dépend pas de cet ordre : bases interne / externe classées par distance
  à l'axe médian.

Repère normalisé par image : origine au milieu des yeux, axe x selon œil gauche -> œil droit,
axe y vers le bas (perpendiculaire), unité = écart des yeux (IOD, centre à centre).
"""
import sys, zipfile, math, statistics as st

args = sys.argv[1:]
erratum = None
csv_out = None
if "--erratum" in args:
    i = args.index("--erratum"); erratum = args[i + 1]; del args[i:i + 2]
if "--csv" in args:
    i = args.index("--csv"); csv_out = args[i + 1]; del args[i:i + 2]
zips = args

def load():
    recs, bad = {}, []
    for z in zips:
        with zipfile.ZipFile(z) as zf:
            for n in zf.namelist():
                if not n.endswith(".jpg.cat"):
                    continue
                try:
                    v = [float(t) for t in zf.read(n).decode("ascii").split()]
                except Exception:
                    bad.append(n); continue
                if len(v) < 19 or int(v[0]) != 9:
                    bad.append(n); continue
                recs[n] = [(v[1 + 2 * k], v[2 + 2 * k]) for k in range(9)]
    if erratum:
        v = [float(t) for t in open(erratum).read().split()]
        key = [n for n in recs if n.endswith("00000003_019.jpg.cat")]
        for k in key:
            recs[k] = [(v[1 + 2 * j], v[2 + 2 * j]) for j in range(9)]
        print(f"erratum appliqué à {key}")
    return recs, bad

def norm(pts):
    (lx, ly), (rx, ry) = pts[0], pts[1]
    cx, cy = (lx + rx) / 2, (ly + ry) / 2
    dx, dy = rx - lx, ry - ly
    iod = math.hypot(dx, dy)
    if iod < 1e-6:
        return None, 0
    ux, uy = dx / iod, dy / iod          # axe des yeux
    vx, vy = -uy, ux                      # perpendiculaire (vers le bas de l'image si yeux horizontaux)
    q = [(((x - cx) * ux + (y - cy) * uy) / iod, ((x - cx) * vx + (y - cy) * vy) / iod) for x, y in pts]
    return q, iod

def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])

def mid(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)

def measures(q):
    LE, RE, M, L1, L2, L3, R1, R2, R3 = q
    m = {}
    # bouche
    m["bouche_x_decalage"] = M[0]                       # 0 = sur l'axe médian (indice de face)
    m["bouche_sous_yeux"] = M[1]                        # hauteur bouche sous la ligne des yeux / IOD
    # pointes d'oreilles
    m["pointes_ecart"] = dist(L2, R2)
    m["pointes_hauteur"] = -(L2[1] + R2[1]) / 2         # au-dessus de la ligne des yeux / IOD
    # bases d'oreilles (points 1 et 3 de chaque oreille)
    m["base_oreille_largeur"] = (dist(L1, L3) + dist(R1, R3)) / 2
    lb, rb = mid(L1, L3), mid(R1, R3)
    m["oreille_hauteur"] = (dist(L2, lb) + dist(R2, rb)) / 2
    m["oreille_elancement"] = m["oreille_hauteur"] / m["base_oreille_largeur"] if m["base_oreille_largeur"] > 0 else float("nan")
    m["centres_base_ecart"] = dist(lb, rb)
    # bases interne / externe : on classe chaque point par distance à l'axe médian
    li, lo = sorted([L1, L3], key=lambda p: abs(p[0]))
    ri, ro = sorted([R1, R3], key=lambda p: abs(p[0]))
    m["bases_internes_ecart"] = dist(li, ri)
    m["bases_externes_ecart"] = dist(lo, ro)            # approximation de la largeur du crâne au niveau des oreilles
    m["iod_sur_bases_externes"] = 1 / m["bases_externes_ecart"] if m["bases_externes_ecart"] > 0 else float("nan")
    m["bases_externes_hauteur"] = -(lo[1] + ro[1]) / 2
    m["bases_internes_hauteur"] = -(li[1] + ri[1]) / 2
    # inclinaison de l'axe de l'oreille (base -> pointe) par rapport à la verticale, > 0 = vers l'extérieur
    def tilt(base, tip, side):
        ang = math.degrees(math.atan2(tip[0] - base[0], -(tip[1] - base[1])))
        return ang * side
    m["oreille_inclinaison_deg"] = (tilt(lb, L2, -1 if L2[0] < 0 else 1) + tilt(rb, R2, 1 if R2[0] > 0 else -1)) / 2
    # hauteur totale pointes -> bouche, et position relative de la ligne des yeux
    tot = m["bouche_sous_yeux"] + m["pointes_hauteur"]
    m["pointes_a_bouche"] = tot
    m["yeux_fraction_depuis_pointes"] = m["pointes_hauteur"] / tot if tot > 0 else float("nan")
    # symétrie : rapport des hauteurs d'oreille gauche/droite et des bases (indice de rotation de la tête)
    hl, hr = dist(L2, lb), dist(R2, rb)
    m["sym_oreilles"] = min(hl, hr) / max(hl, hr) if max(hl, hr) > 0 else float("nan")
    return m

def stats(vals):
    v = sorted(x for x in vals if not math.isnan(x))
    n = len(v)
    q = lambda p: v[min(n - 1, max(0, int(round(p * (n - 1)))))]
    return n, st.mean(v), st.median(v), st.pstdev(v), q(0.25), q(0.75), q(0.10), q(0.90)

def main():
    recs, bad = load()
    print(f"fichiers .cat lus : {len(recs)} ; illisibles ou incomplets : {len(bad)}")
    rows, skipped = {}, 0
    for n, pts in recs.items():
        q, iod = norm(pts)
        if q is None:
            skipped += 1; continue
        rows[n] = (iod, measures(q))
    print(f"mesurés : {len(rows)} ; écartés (yeux confondus) : {skipped}")
    # sous-ensemble « quasi de face » : bouche à moins de 0,10 IOD de l'axe médian, oreilles symétriques à 80 %,
    # écart des yeux >= 20 px (annotation moins bruitée)
    front = {n: r for n, r in rows.items()
             if abs(r[1]["bouche_x_decalage"]) < 0.10 and r[1]["sym_oreilles"] > 0.80 and r[0] >= 20}
    print(f"quasi de face : {len(front)}")
    iods = sorted(r[0] for r in rows.values())
    print(f"IOD en pixels : médiane {st.median(iods):.1f}, min {iods[0]:.1f}, max {iods[-1]:.1f}")
    keys = list(next(iter(rows.values()))[1].keys())
    for label, sub in (("TOUT", rows), ("FACE", front)):
        print(f"\n== {label} ==")
        print(f"{'mesure':32s} {'n':>5s} {'moy':>7s} {'med':>7s} {'ET':>7s} {'ES':>7s} {'Q1':>7s} {'Q3':>7s} {'P10':>7s} {'P90':>7s}")
        for k in keys:
            n, mu, med, sd, q1, q3, p10, p90 = stats([r[1][k] for r in sub.values()])
            print(f"{k:32s} {n:5d} {mu:7.3f} {med:7.3f} {sd:7.3f} {sd / math.sqrt(n):7.4f} {q1:7.3f} {q3:7.3f} {p10:7.3f} {p90:7.3f}")
    # forme médiane FACE : coordonnées normalisées (x vers l'œil 1, y vers le bas), côté image gauche
    # et droit moyennés en miroir ; les bases d'oreille sont reclassées interne / externe.
    print("\n== forme médiane FACE (unité = écart des yeux ; origine = milieu des yeux ; y > 0 vers le bas) ==")
    acc = {k: ([], []) for k in ("oeil", "bouche", "base_externe", "pointe", "base_interne")}
    for n, (iod, m) in front.items():
        q, _ = norm(recs[n])
        LE, RE, M, L1, L2, L3, R1, R2, R3 = q
        li, lo = sorted([L1, L3], key=lambda p: abs(p[0]))
        ri, ro = sorted([R1, R3], key=lambda p: abs(p[0]))
        for k, a, b in (("oeil", LE, RE), ("base_externe", lo, ro), ("pointe", L2, R2), ("base_interne", li, ri)):
            acc[k][0].append((abs(a[0]) + abs(b[0])) / 2)
            acc[k][1].append((a[1] + b[1]) / 2)
        acc["bouche"][0].append(M[0]); acc["bouche"][1].append(M[1])
    for k, (xs, ys) in acc.items():
        print(f"{k:14s} n {len(xs):5d}  |x| med {st.median(xs):6.3f} (ET {st.pstdev(xs):5.3f})  y med {st.median(ys):6.3f} (ET {st.pstdev(ys):5.3f})")
    # stabilité : médianes par dossier (CAT_00 ... CAT_06), sous-ensemble FACE
    print("\n== médianes FACE par dossier ==")
    cles = ["bouche_sous_yeux", "pointes_ecart", "pointes_hauteur", "oreille_hauteur",
            "base_oreille_largeur", "bases_externes_ecart", "oreille_inclinaison_deg"]
    print(f"{'dossier':8s} {'n':>5s} " + " ".join(f"{k[:12]:>12s}" for k in cles))
    for d in sorted({n.split('/')[0] for n in front}):
        sub = [r[1] for n, r in front.items() if n.startswith(d + "/")]
        print(f"{d:8s} {len(sub):5d} " + " ".join(f"{st.median([m[k] for m in sub]):12.3f}" for k in cles))
    # sensibilité à la taille de la tête : FACE avec IOD >= 60 px
    big = [r[1] for r in front.values() if r[0] >= 60]
    print(f"\n== FACE et IOD >= 60 px : n = {len(big)} ==")
    for k in cles:
        print(f"{k:32s} med {st.median([m[k] for m in big]):7.3f}  moy {st.mean([m[k] for m in big]):7.3f}")
    if csv_out:
        with open(csv_out, "w") as f:
            f.write("fichier,iod_px,face," + ",".join(keys) + "\n")
            for n, (iod, m) in rows.items():
                f.write(f"{n},{iod:.2f},{int(n in front)}," + ",".join(f"{m[k]:.4f}" for k in keys) + "\n")

main()
```

## Annexe B — lanceur `run.sh`

```bash
#!/bin/bash
# Lance la mesure sur les deux zip et dessine des planches de vérification.
set -e
P=/mnt/c/Users/axfol/AppData/Local/Temp/claude/--wsl-localhost-Debian-home-Axou-Axou/4c6fedf9-cbec-4d42-9ac1-73a04a6e879f/scratchpad
D=$P/a3/data
S=$P/a3/scripts
O=$P/a3/out
mkdir -p "$O"
PY="$P/venv/bin/python -I"
cd "$O"
$PY "$S/mesure_cat.py" "$D/CAT_DATASET_01.zip" "$D/CAT_DATASET_02.zip" --erratum "$D/00000003_015.jpg.cat" --csv "$O/mesures.csv" | tee "$O/mesures.txt"
# planche : 6 premières images du premier dossier
N=$($PY -c 'import sys,zipfile; n=[x for x in zipfile.ZipFile(sys.argv[1]).namelist() if x.endswith(".jpg")]; print(" ".join(sorted(n)[:6]))' "$D/CAT_DATASET_01.zip")
$PY "$S/dessine.py" "$O/planche1" "$D/CAT_DATASET_01.zip" $N
```

## 6. Non observé / non vérifié

- **Âge** : le jeu ne donne ni âge ni race. Des chatons figurent sur les planches regardées (au moins 3 sur 15 images, estimation visuelle) ; les rapports mélangent donc chatons et adultes. Aucun rapport spécifique au chat de ~2 ans n'est mesuré ici.
- **Projection 2D** : les oreilles tournées ou couchées, la tête inclinée vers le haut ou le bas et la perspective d'un appareil proche modifient les rapports. Le filtre FACE ne corrige que la rotation gauche-droite (et seulement approximativement) ; l'inclinaison haut-bas n'est pas contrôlée. Les rapports verticaux (truffe, pointes) sont les plus sensibles à cet effet, non quantifié.
- **Profondeur** : aucune longueur de museau de profil, aucune mesure 3D. La longueur du museau doit venir de la littérature (rapport A2).
- **Repères absents** : taille et forme de l'œil, largeur des joues, largeur du museau, menton, bouche réelle. `bases_externes_ecart` n'est **pas** la largeur maximale de la tête (joues), seulement la largeur au niveau de l'attache externe des oreilles.
- **Précision de l'annotation** : inconnue (aucune donnée de répétabilité dans les sources lues). Un seul annotateur ou plusieurs : non vérifié.
- **Signification des points** : vérifiée visuellement sur 15 images seulement (§ 3.2), toutes issues des dossiers CAT_00 à CAT_02 ; la figure 6 de l'article n'a pas été vue.
- **Licence** : la description archive.org dit « only for research purposes, we do not have any copyright of the images » ; les images ne sont pas réutilisables et n'ont pas été copiées dans le dépôt. Les rapports chiffrés seuls sont repris ici.
- **CatFLW** : non téléchargé (sur demande) ; l'effectif 2 091 de la version IJCV vient d'un résumé de recherche web, page non lue.
- **Modèle 3D** : aucune mesure des mêmes rapports sur `public/models/cat.glb` ou `assets/sources/cat.blend` ; la comparaison reste à faire en mission B.
- Écart entre « 10,000 images » (article) et 9 997 annotations lues : non expliqué.

## 7. Sources

- Zhang W., Sun J., Tang X., « Cat Head Detection – How to Effectively Exploit Shape and Texture Features », ECCV 2008, LNCS 5305, p. 802-816, DOI 10.1007/978-3-540-88693-8_59. PDF lu (texte extrait par `pypdf`, 14 pages) : https://mmlab.ie.cuhk.edu.hk/2008/ECCV08_CatDetection.pdf. Références bibliographiques (DOI, pages) d'après le résultat de recherche web citant https://mlanthology.org/eccv/2008/zhang2008eccv-cat/ (page non ouverte).
- CAT Dataset, miroir Internet Archive, item `CAT_DATASET` : https://archive.org/details/CAT_DATASET ; métadonnées lues par https://archive.org/metadata/CAT_DATASET (description, format d'annotation, erratum, tailles, MD5). Téléchargement : https://archive.org/download/CAT_DATASET/ (fichiers `CAT_DATASET_01.zip`, `CAT_DATASET_02.zip`, `00000003_015.jpg.cat`). Page d'origine (lien mort selon archive.org) : http://137.189.35.203/WebUI/CatDatabase/catData.html, non lue (la copie Wayback n'a pas pu être ouverte par l'outil de lecture web).
- Martvel G., Farhat N., Shimshoni I., Zamansky A., « CatFLW: Cat Facial Landmarks in the Wild Dataset », arXiv:2305.04232 : https://arxiv.org/abs/2305.04232 (résumé lu).
- `tools/anim_cat.py` du projet (lu, lignes 107-197) pour les paramètres de `reshape()`.
- Mesures : `mesure_cat.py` (annexe A), lancé par `run.sh` (annexe B) ; sortie `mesures.txt`, 9 997 têtes, sous-ensemble FACE 6 836.
