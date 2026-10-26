# Proportions du chat domestique jeune adulte : ce que dit la littérature

Rapport A2 de la mission chat_recherche (2026-10-22). Objet : donner des **rapports sans unité** utilisables pour régler `reshape()` et les poses de tools/anim_cat.py (mission B), à partir de publications vétérinaires et morphométriques lues. Le chat visé a environ 2 ans.

Conventions :
- chaque chiffre cite sa source par un code entre crochets ([P24], [T09]…) renvoyant à la section « Sources » ; l'effectif mesuré (n) est donné dans la même ligne ;
- « dérivé » = rapport calculé par l'agent à partir de moyennes publiées, avec le script cité en annexe (commande : `python3 -I ratios.py`, lancé dans le sous-dossier a2 du scratchpad, sortie recopiée telle quelle) ; un rapport de deux moyennes n'est pas la moyenne des rapports individuels : la dispersion individuelle n'est pas connue ;
- « croisé » = rapport entre deux études différentes (populations, âges, méthodes différents) : ordre de grandeur seulement ;
- les valeurs passent par l'outil WebFetch, qui extrait le texte de la page par un modèle ; les contrôles de cohérence faits sont indiqués (§ 6).

## 1. Tableau des rapports (synthèse)

Notation : L = longueur, l = largeur. « Garrot » = hauteur au garrot (sol → sommet de l'omoplate). « Tête-corps » = museau → base de la queue.

### 1.1 Corps et membres

| Rapport | Valeur | Source et effectif | Nature |
|---|---|---|---|
| Hauteur au garrot (référence) | 25,98 ± 2,57 cm (F 24,68 ; M 27,09) | [P24], n = 37 (17 F, 20 M), 3-5 ans, type européen à poil court | mesuré (toise zoométrique) |
| Humérus / garrot | 0,387 | [P24], n = 37 | dérivé (10,06 / 25,98 cm) |
| Radius / garrot | 0,375 | [P24], n = 36 | dérivé (9,74 / 25,98) |
| Ulna / garrot | 0,440 | [P24], n = 36 | dérivé (11,43 / 25,98) ; l'ulna inclut l'olécrâne, saillie du coude |
| Os coxal / garrot | 0,324 | [P24], n = 36 | dérivé (8,43 / 25,98) |
| Fémur / garrot | 0,416 | [P24], n = 36 | dérivé (10,81 / 25,98) |
| Tibia / garrot | 0,438 | [P24], n = 36 | dérivé (11,38 / 25,98) |
| Calcanéus / garrot | 0,110 | [P24], n = 37 | dérivé (2,87 / 25,98) ; donne la saillie du talon (jarret) |
| Radius / humérus (indice brachial) | 0,968 ; publié 96,65 ± 3,54 | dérivé de [P24] (n = 36) ; publié par [K26], n = 55 (33 M, 22 F) | concordant |
| Tibia / fémur (indice crural) | 1,053 ; publié 106,55 ± 6,63 | dérivé de [P24] ; publié par [K26], n = 55 | concordant |
| Humérus / fémur | 0,931 ; publié 94,42 ± 5,46 | dérivé de [P24] ; publié par [K26], n = 55 | concordant |
| (Humérus + radius) / (fémur + tibia) (indice intermembral) | 0,892 ; publié 89,83 ± 3,22 | dérivé de [P24] ; publié par [K26], n = 55 | concordant |
| Garrot / longueur de l'humérus (« facteur ») | 2,59 ± 0,24 | [P24], n = 37 | publié |
| Tête-corps / garrot | ≈ 2,04 | croisé : 530 mm (moyenne pondérée rural + urbain de [F20], n = 546) / 259,8 mm [P24] | croisé |
| Tête-corps / garrot (orientation) | 1,84-2,0 (46 cm pour 23-25 cm) | [WP], sans effectif | Wikipedia, orientation seulement |
| Queue / tête-corps | 0,54 (M : 288 / 530 mm) ; 0,55 (F : 267 / 483 mm) | [J-A], chats harets du sud-est de l'Australie, effectif non lu | **connu seulement par un résumé de recherche** (document non téléchargeable) |
| Queue / tête-corps (orientation) | 0,65 (30 / 46 cm) | [WP], sans effectif | Wikipedia, orientation seulement |

Lecture pour le modèle : la patte avant (humérus + radius) mesure ≈ 0,76 du garrot et la patte arrière osseuse (fémur + tibia) ≈ 0,85 du garrot (dérivés de [P24]) ; les métapodes et doigts, non publiés en accès libre (§ 4), complètent la hauteur. Chez le chat, l'avant et l'arrière ne sont donc pas de même longueur osseuse : l'arrière est ≈ 12 % plus long (indice intermembral 0,89, [P24] et [K26]) ; au repos debout, cet excédent est sans doute absorbé par l'angle plus fermé du genou et du jarret (hypothèse de l'agent, non sourcée ; les angles sont l'objet des rapports mouvement_*.md).

### 1.2 Tête (vivant, tissus mous compris)

| Rapport | Valeur | Source et effectif | Nature |
|---|---|---|---|
| Largeur de tête (bizygomatique, sur l'animal) | 62 mm (asymptote adulte) | [T09], courbes sur 16 chatons, intervalle adulte sur 9 à 12 adultes (> 52 semaines) ; chats domestiques à poil court | mesuré |
| Écart des pupilles / largeur de tête | 0,544 (33,6 / 62) | [T09], mêmes effectifs | dérivé |
| Hauteur du pavillon (face externe : pointe → peau du crâne) / largeur de tête | 0,781 (48,4 / 62) | [T09] | dérivé |
| Hauteur du pavillon (face interne) / largeur de tête | 0,679 (42,1 / 62) | [T09] | dérivé |
| Largeur de l'ouverture du pavillon (à mi-hauteur) / largeur de tête | 0,403 (25,0 / 62) | [T09] | dérivé |
| Largeur / hauteur du pavillon | 0,517 (25,0 / 48,4) | [T09] | dérivé |
| Longueur de tête / tête-corps | 0,203 (M : 112 / 551 mm) ; 0,204 (F : 103 / 504 mm) | [F20], n = 288 et 299 (M), 235 et 247 (F) ; chats errants et harets d'Australie occidentale, âge moyen 2,4 (M) et 3,2 ans (F) ; mètre ruban à 0,5 cm | dérivé |
| Largeur de tête / longueur de tête | ≈ 0,58 (62 / 107,1 mm) | croisé : [T09] / [F20] (moyenne pondérée, n = 523) ; la « longueur de tête » de [F20] n'est pas définie (§ 4) | croisé |
| Largeur de tête / garrot | ≈ 0,24 (62 / 259,8 mm) | croisé : [T09] / [P24] | croisé |
| Longueur de tête / garrot | ≈ 0,41 (107,1 / 259,8 mm) | croisé : [F20] / [P24] | croisé |
| Hauteur du pavillon (externe) / longueur de tête | ≈ 0,45 (48,4 / 107,1 mm) | croisé : [T09] / [F20] | croisé |
| Longueur axiale du globe oculaire | 19,75 ± 1,59 mm | [K12], n = 98 chats (chatons ≤ 4 mois et adultes > 1 an mélangés) | mesuré (échographie A) |
| Globe oculaire / largeur de tête | ≈ 0,32 (19,75 / 62) | croisé : [K12] / [T09] | croisé |
| Fente palpébrale (longueur de l'ouverture des paupières) | 2,0 ± 0,2 cm | [O23], n = 53 adultes de 5 races (British Shorthair, Burmese, Devon Rex, Scottish Fold, Sphynx), aucun chat de gouttière | mesuré, résumé seul lu |
| Fente palpébrale / largeur de tête | ≈ 0,32 (20 / 62) | croisé : [O23] / [T09] | croisé |

### 1.3 Crâne osseux (proportions du squelette de la tête)

| Rapport | Valeur | Source et effectif | Nature |
|---|---|---|---|
| Largeur bizygomatique / longueur du crâne (inion → prosthion), « indice du crâne » | 0,723 (72,26 ± 2,27) | [S21], n = 10 chats domestiques à poil court, 8 mois à 15 ans | publié |
| Largeur / longueur du crâne | 0,681 (67,8 / 99,5 mm) | [D21], n = 36 mésaticéphales, âge moyen de l'ensemble 15,5 ans ; « largeur du crâne » non définie dans ce qui a été lu | dérivé |
| Longueur faciale (nasion → prosthion) / longueur du crâne | 0,387 | dérivé de [S21] : indice du crâne / indice facial (72,26 / 186,64), car la largeur est la même (zygion à zygion) dans les deux indices | dérivé |
| Longueur faciale / largeur bizygomatique | 0,536 (100 / 186,64) | [S21], n = 10 | dérivé |
| Largeur du neurocrâne (euryon) / longueur du neurocrâne (inion → nasion), « indice crânien » | 0,615 (61,48 ± 2,73) | [S21], n = 10 | publié |
| Largeur du neurocrâne / longueur « crânienne » (protubérance occipitale → limite caudale des os nasaux) | 0,522 (52,18 ± 3,75 %) | [R21], n = 37 européens à poil court (19 F, 18 M), 1-17 ans (moyenne 8,3) | publié ; la longueur n'a pas la même définition qu'en [S21] |
| Longueur externe de la boîte crânienne / longueur du crâne | 0,707 (70,70 ± 1,72 %) | [R21], n = 37 | publié |
| Hauteur externe / longueur externe de la boîte crânienne | 0,531 (53,06 ± 2,07 %) | [R21], n = 37 | publié |
| Angle craniofacial (axe basilaire / axe facial) | 20,27° ± 2,28° | [S21], n = 10 | publié |

Les deux indices crâniens (0,615 en [S21], 0,522 en [R21]) divergent parce que la longueur de référence n'est pas la même (inion → nasion contre protubérance occipitale → os nasaux) : ils ne sont pas comparables entre eux.

## 2. Chaton et adulte

Seule source lue qui suit les mêmes chats de la naissance à l'âge adulte avec des mesures de tête : [T09] (16 chatons de 1,3 semaine à 16-20 semaines, chats domestiques à poil court). Modèle publié : y = y0 + a(1 − e^(−b·x)), x en semaines.

| Grandeur [T09] | Naissance (extrapolée) | Adulte (asymptote) | Croissance | Âge à 90 % |
|---|---|---|---|---|
| Largeur de tête | 28,6 mm | 62 mm | × 2,17 | 23 semaines |
| Pavillon, hauteur externe | 14,6 mm | 48,4 mm | × 3,31 | 16 semaines |
| Pavillon, hauteur interne | 9,8 mm | 42,1 mm | × 4,3 | 18 semaines |
| Pavillon, largeur | 5,9 mm | 25,0 mm | × 4,23 | 14 semaines |
| Écart des pupilles | 13,3 mm | 33,6 mm | × 2,53 | 21 semaines (équation publiée : 13,3 + 20,4(1 − e^(−0,11x)), R² = 0,83, n = 16) |
| Masse corporelle | 0,2 ± 0,06 kg à ~1,5 semaine | 2,6 ± 1,1 kg vers ~18 semaines | — | — |

Rapports reconstruits par l'agent à partir de ces valeurs (dérivé ; hypothèse de calcul : « 90 % » = 90 % de l'accroissement a, donc b = ln 10 / âge à 90 % ; cette lecture redonne bien 21 semaines pour l'écart des pupilles avec b = 0,11 publié, et le rapport des vitesses pavillon / tête de 1,44 à 1,64 concorde avec « 30 à 70 % plus rapide » écrit par [T09]) :

| Âge | Pavillon ext. / largeur tête | Largeur pavillon / largeur tête | Écart pupilles / largeur tête |
|---|---|---|---|
| 4 semaines | 0,74 | 0,38 | 0,52 |
| 8 semaines | 0,80 | 0,42 | 0,54 |
| 12 semaines | 0,82 | 0,43 | 0,54 |
| 16 semaines | 0,82 | 0,43 | 0,55 |
| 26 semaines | 0,80 | 0,42 | 0,55 |
| adulte | 0,78 | 0,40 | 0,54 |

Ce que cela dit : entre 2 et 6 mois, les oreilles sont relativement un peu plus grandes que chez l'adulte (+ 3 à 5 % rapportées à la largeur de tête), puis la tête finit sa croissance après elles ; l'écart des yeux rapporté à la largeur de tête change peu après 4 semaines. À 2 ans, toutes les grandeurs de [T09] sont à leur valeur adulte (90 % atteints avant 23 semaines). La largeur de tête ne double qu'environ (× 2,17) alors que la masse est multipliée par ≈ 13 (0,2 → 2,6 kg, [T09]) : la tête du chaton est donc grande par rapport au corps, mais aucune source lue ne donne le rapport tête / corps du chaton en longueur (§ 4).

Le crâne osseux continue d'évoluer après 1 an : [R21] trouve des différences selon le sexe (mâles plus grands) sur une population de 1 à 17 ans, sans courbe d'âge lue ; [Sa08] (87 British Shorthair et Exotic Shorthair suivis jusqu'à la fin de croissance) publie des asymptotes et des âges à 95-98 % de la taille finale, mais seulement dans des tableaux non accessibles (résumé seul lu).

## 3. Le modèle statistique SMAL

- Article lu [Z17] (Zuffi et al., CVPR 2017, version ar5iv) : modèle appris sur des scans de **figurines jouets**, pas d'animaux réels ; l'article donne « 4141 scans » puis des effectifs par espèce dont la somme vaut 451 (dont 11 pour « cat », 55 guépards, 88 lions, 77 tigres) et « 41 scans » pour le modèle final : incohérence interne relevée, non résolue. L'échelle est normalisée entre fabricants (« scaling factor »), pas métrique. Des formes moyennes par famille existent (figure 8 de l'article) mais leur distribution sous forme de fichier n'est pas décrite.
- Site officiel (lu le 2026-10-22) : la page d'accueil affiche « Register » et « Sign In » ; la page de téléchargement répond **HTTP 502** (WebFetch et curl, script smal_check.sh du sous-dossier a2 du scratchpad, lancé par wsl.exe -d Debian -- bash suivi du chemin complet du script, sortie : « HTTP/1.1 502 Bad Gateway » pour download.php, « 404 » pour /downloads, « 200 » pour l'accueil). Il n'a donc pas été possible de vérifier si un compte est exigé ; aucun compte n'a été créé.
- Licence lue : usage non commercial seulement, interdiction de copier, partager ou redistribuer le logiciel sans accord écrit du Max-Planck. Même obtenu, le modèle ne pourrait pas être embarqué dans le portfolio public sans cet accord.
- Conclusion : SMAL n'est **pas exploitable** dans cette mission ; et la « forme moyenne du chat » qu'il fournirait serait celle d'une figurine (11 scans de chat au mieux, mêlés aux grands félins dans la famille), moins fiable pour les proportions que les mesures vétérinaires ci-dessus.

## 4. Ce que la littérature (lue) ne donne pas

- **Longueur du museau sur l'animal vivant** (truffe → stop ou truffe → coin de l'œil) : aucune source lue. Seul substitut : la longueur faciale osseuse (nasion → prosthion) = 0,387 du crâne ([S21], n = 10, dérivé). La « longueur nasale » de [R21] (0,73 cm, définie comme crâne moins boîte crânienne) mesure autre chose et ne doit pas servir au museau.
- **Écart des yeux mesuré sur des photos ou sur le crâne en grand nombre** : seule mesure lue, écart des pupilles sur l'animal vivant [T09] (≈ 12 adultes). Le rapport A3 (proportions_mesures.md) mesure ce point sur un jeu de photos.
- **Position des oreilles** (écart entre les bases, angle d'implantation) et **épaisseur** du pavillon : non trouvées.
- **Diamètre visible de l'œil** (iris) : non trouvé ; seuls le globe (≈ 20 mm, [K12]) et la fente palpébrale (≈ 20 mm, [O23], races non représentatives d'un chat de gouttière) sont publiés.
- **Longueur de la queue avec effectif lu** : seules sources : Wikipedia [WP] (sans effectif) et un chapitre australien [J-A] connu par résumé de recherche. Daniels et al. 1998 [Da98] (333 chats sauvages d'Écosse) a ces mesures mais derrière un accès payant (résumé seul lu).
- **Métacarpes, métatarses et doigts** : publiés pour 40 chats domestiques à poil court par Choi et al. 2021 [C21] (rapports radius / métacarpe et tibia / métatarse), mais le résumé ne donne aucune valeur et l'article est payant. Le modèle « moyen » de membre postérieur de Valero-Cuevas et al. 2015 [V15] (3 chats) donne ses longueurs seulement dans une figure non lue.
- **Omoplate, épaisseur des membres (tissus mous), largeur du thorax, longueur du cou** : non trouvées avec effectif.
- **Rapport tête / corps du chaton en longueur** à un âge donné : non trouvé ([Sa08] contient sans doute ces données, tableaux non lus).
- **Âge des sujets** : seules [P24] (3-5 ans) et [T09] (adultes > 52 semaines) sont proches du chat de 2 ans ; [R21], [D21], [S21] mélangent des âges jusqu'à 15-23 ans.

## 5. Usage prévu pour `reshape()` (mission B)

tools/anim_cat.py (lu, lignes 117 à 130 de ce fichier) règle à la main : EAR_SCALE = 0.75 (oreilles), LEG_THICK (épaisseur des pattes), CHEEK = 0.12 (joues), MUZZLE = 0.3 et CHIN = 0.6 (museau, menton), HEAD_SCALE = 1.08 (crâne), EYE_SCALE = 1.35 (yeux). Correspondances proposées (proposition, pas un fait vérifié sur le modèle : aucune mesure du modèle n'a été faite dans ce rapport) :

| Paramètre | Rapport cible à mesurer sur le modèle puis comparer | Valeur de référence |
|---|---|---|
| EAR_SCALE | hauteur externe du pavillon / largeur bizygomatique ; largeur / hauteur du pavillon | 0,78 ; 0,52 [T09] |
| EYE_SCALE | écart des pupilles / largeur de tête ; fente palpébrale / largeur de tête | 0,54 [T09] ; ≈ 0,32 croisé [O23]/[T09] |
| MUZZLE, CHIN | longueur faciale / longueur du crâne (os) | 0,39 [S21] (substitut, § 4) |
| CHEEK, HEAD_SCALE | largeur de tête / longueur de tête ; longueur de tête / tête-corps | ≈ 0,58 croisé ; 0,20 [F20] |
| proportions des pattes (os, pas LEG_THICK) | segments / garrot ; indices brachial, crural, intermembral | § 1.1 [P24], [K26] |
| queue | queue / tête-corps | 0,54-0,65 (sources de second rang) |

## 6. Contrôles de cohérence faits

- Les quatre indices publiés par [K26] (n = 55) concordent à moins de 0,02 près avec ceux recalculés sur les moyennes de [P24] (n = 36-37), recalculé / publié : 0,968 / 0,967 ; 1,053 / 1,066 ; 0,931 / 0,944 ; 0,892 / 0,898 (sortie de `python3 -I ratios.py`). Les définitions standard des indices (brachial = radius / humérus, etc.) ne sont pas écrites dans le résumé de [K26] lu : la concordance numérique est l'indice qu'elles s'appliquent.
- [P24] : facteur × longueur ≈ garrot (2,59 × 10,06 = 26,06 cm pour 25,98 publiés).
- [T09] : l'équation publiée de l'écart des pupilles tend vers 13,3 + 20,4 = 33,7 mm pour une asymptote annoncée de 33,6 mm.
- Défauts relevés dans les sources : [P24] tableau 4 (valeurs « radiogrammétriques » identiques d'un os à l'autre, total du radius imprimé « 2.59 ± 2.48 ») ; [T09] nombre d'adultes 9 ou 12 selon le passage ; [D21] effectifs par sexe incohérents (18 + 28 pour 42 chats) ; [Z17] nombre de scans incohérent.

## 7. Annexe : script de calcul (scratchpad a2, ratios.py)

Commande (sortie observée le 2026-10-22, reprise dans les tableaux ci-dessus) :

```
wsl.exe -d Debian -- bash -c "cd /mnt/c/Users/axfol/AppData/Local/Temp/claude/--wsl-localhost-Debian-home-Axou-Axou/4c6fedf9-cbec-4d42-9ac1-73a04a6e879f/scratchpad/a2 && python3 -I ratios.py"
```

```python
"""Calcul des rapports sans unité du rapport A2 (proportions_litterature.md).
Toutes les valeurs d'entrée sont recopiées des sources lues (voir le rapport, section Sources).
Lancement : python3 -I ratios.py
"""
import math

# Poradowski et al. 2024 (Vet Sci 11:522), n = 37 (36 pour certains os), moyennes totales, cm
withers, humerus, radius, ulna = 25.98, 10.06, 9.74, 11.43
coxae, femur, tibia, calcaneus = 8.43, 10.81, 11.38, 2.87
print("== Poradowski 2024")
for name, v in [("humerus", humerus), ("radius", radius), ("ulna", ulna), ("os coxae", coxae),
                ("femur", femur), ("tibia", tibia), ("calcaneus", calcaneus)]:
    print(f"{name}/garrot = {v / withers:.3f}")
print(f"radius/humerus = {radius / humerus:.3f}")
print(f"tibia/femur = {tibia / femur:.3f}")
print(f"humerus/femur = {humerus / femur:.3f}")
print(f"(humerus+radius)/(femur+tibia) = {(humerus + radius) / (femur + tibia):.3f}")

# Fleming et al. 2020 (Animals 10:707), mm
print("== Fleming 2020")
for lab, head, hb in [("males", 112, 551), ("femelles", 103, 504), ("rural", 106, 527), ("urbain", 110, 538)]:
    print(f"tête/tête-corps {lab} = {head / hb:.3f}")
hb_all = (527 * 398 + 538 * 148) / (398 + 148)
print(f"tête-corps pondéré rural+urbain = {hb_all:.1f} mm ; / garrot Poradowski (259.8 mm) = {hb_all / 259.8:.2f}")
print(f"tête (106*375+110*148)/523 = {(106*375+110*148)/523:.1f} mm ; / garrot = {((106*375+110*148)/523)/259.8:.3f}")

# Tollin & Koka 2009 (JASA 125:980), mm, asymptotes adultes et valeurs à la naissance extrapolées
print("== Tollin & Koka 2009")
dims = {  # nom: (y0 naissance, adulte, âge en semaines à 90 % de la croissance)
    "tete": (28.6, 62.0, 23),
    "pav_ext": (14.6, 48.4, 16),
    "pav_int": (9.8, 42.1, 18),
    "pav_larg": (5.9, 25.0, 14),
    "yeux": (13.3, 33.6, None),  # équation publiée : 13.3 + 20.4(1 - exp(-0.11 x))
}
def val(n, t):
    y0, ya, t90 = dims[n]
    b = 0.11 if n == "yeux" else math.log(10) / t90
    a = 20.4 if n == "yeux" else ya - y0
    return y0 + a * (1 - math.exp(-b * t))
for t in (0, 4, 8, 12, 16, 26, 1e6):
    h = val("tete", t)
    print(f"t={t:>7} sem : tête {h:5.1f} ; pav_ext/tête {val('pav_ext', t)/h:.3f} ; "
          f"pav_larg/tête {val('pav_larg', t)/h:.3f} ; yeux/tête {val('yeux', t)/h:.3f} ; "
          f"pav_larg/pav_ext {val('pav_larg', t)/val('pav_ext', t):.3f}")
print(f"adulte : pav_int/tête {42.1/62:.3f}")

# Croisements entre études (populations différentes : à signaler)
print("== croisés")
print(f"globe axial Konrade 2012 / largeur tête Tollin = {19.75 / 62:.3f}")
print(f"fente palpébrale Oksa-Minalto 2023 / largeur tête Tollin = {20 / 62:.3f}")
print(f"largeur tête Tollin / longueur tête Fleming (107.1) = {62 / 107.1:.3f}")
print(f"largeur tête Tollin / garrot Poradowski = {62 / 259.8:.3f}")
print(f"pavillon ext Tollin / longueur tête Fleming = {48.4 / 107.1:.3f}")

# Sieslack et al. 2021 (PLoS One e0254420), DSH n = 10 : indices largeur/longueur
fi, si, ci = 186.64, 72.26, 61.48
print("== Sieslack 2021")
print(f"longueur faciale / longueur du crâne = SI/FI = {si / fi:.3f}")
print(f"longueur faciale / largeur bizygomatique = 100/FI = {100 / fi:.3f}")
print(f"largeur bizygomatique / longueur du crâne = {si / 100:.3f}")
# Davis 2021 (Front Vet Sci 7:619248), mésaticéphales n = 36
print(f"Davis 2021 largeur/longueur du crâne = {67.8 / 99.5:.3f}")
# Ramos 2021 (Vet Sci 8:161), n = 37
print(f"Ramos 2021 CW/SL = {4.28 / 8.94:.3f} ; ELC/SL = {6.32 / 8.94:.3f}")
# Queue (sources de second rang)
print(f"queue/tête-corps Wikipedia = {30 / 46:.3f}")
print(f"queue/tête-corps Jones (résumé) m {288 / 530:.3f} f {267 / 483:.3f}")
print(f"garrot Wikipedia 23-25 / 46 = {23/46:.3f}-{25/46:.3f}")
```

## Non observé / non vérifié

- Valeurs individuelles et dispersion des rapports dérivés : seuls des rapports de moyennes ont été calculés ; leur écart-type n'est pas connu.
- [J-A] (queue, oreille, chats harets d'Australie) : document PDF jamais obtenu (WebFetch : délai dépassé deux fois ; `curl` dans WSL : erreur HTTP/2 puis délai dépassé ; `curl.exe` sous Windows : délai dépassé) ; chiffres connus **seulement par le résumé du moteur de recherche** ; effectif et auteur original non vus.
- Thèse de K. Moik (LMU Munich) : PDF obtenu par WebFetch mais illisible (texte compressé ; rendu des pages impossible, pdftoppm absent ; copie vers le scratchpad refusée par le contrôle d'écriture). Son contenu n'est pas connu.
- [C21], [V15], [Sa08], [Da98] : seuls des résumés ou légendes ont été lus ; leurs valeurs ne sont pas connues.
- [O23] et [K12] : seuls les résumés ont été lus (pas de tableau par race ni par âge).
- [F20] et [T09] : WebFetch n'a lu que les 100 000 premiers caractères de chaque page ; la fin (discussion, références) n'a pas été lue.
- Définition exacte de la « longueur de tête » de [F20] (non écrite dans l'article) et de la « largeur du crâne » de [D21].
- SMAL : exigence ou non d'un compte (page de téléchargement en erreur 502) ; contenu des fichiers du modèle.
- Aucune mesure du modèle 3D actuel : la comparaison modèle / littérature reste à faire en mission B.
- Les valeurs transitent par l'outil WebFetch, qui reformule la page par un modèle ; les contrôles du § 6 réduisent ce risque sans l'exclure.

## Sources

Toutes consultées le 2026-10-22. « Lu » = contenu de la page lu par l'agent avec WebFetch ; « résumé lu » = seul le résumé de l'article ; « résumé de recherche » = connu seulement par le résumé du moteur de recherche.

- [P24] Poradowski D., Mutlu Z., Altundağ Y., Chrószcz A., Sarıtaş Ö., Wolińska J., Onar V. (2024). Estimation of Height at Withers Based on Long Bone Measurements of Living Cats. Veterinary Sciences 11(11):522. doi:10.3390/vetsci11110522. https://pmc.ncbi.nlm.nih.gov/articles/PMC11598937/ — lu (tableaux 1 à 5). La version MDPI a répondu 403.
- [K26] Kartal M., Sefergil Ş., Sabancı S. S., Poradowski D., Düzgün O., Chrószcz A., Onar V. (2026). Long Bone Ratios in the Thoracic and Pelvic Limbs of Domestic Cats (Felis catus). Medycyna Weterynaryjna 82(02):78-83. doi:10.21521/mw.7104. https://www.medycynawet.edu.pl/archives/summary/995-summary-2026/996-summary-022026/7104-summary-med-weter-82-02-78-83-2026 — résumé lu.
- [F20] Fleming P. A., Crawford H. M., Auckland C. H., Calver M. C. (2020). Body Size and Bite Force of Stray and Feral Cats—Are Bigger or Older Cats Taking the Largest or More Difficult-to-Handle Prey? Animals 10(4):707. doi:10.3390/ani10040707. https://pmc.ncbi.nlm.nih.gov/articles/PMC7222765/ — lu (tableau 1, méthodes ; 100 000 premiers caractères).
- [T09] Tollin D. J., Koka K. (2009). Postnatal development of sound pressure transformations by the head and pinnae of the cat: Monaural characteristics. Journal of the Acoustical Society of America 125(2):980-994. doi:10.1121/1.3058630. https://pmc.ncbi.nlm.nih.gov/articles/PMC2736725/ — lu (méthodes, résultats, légende de la figure 1 ; 100 000 premiers caractères ; paramètres des courbes affichés dans la figure seulement, non lus).
- [S21] Sieslack J., Farke D., Failing K., Kramer M., Schmidt M. J. (2021). Correlation of brachycephaly grade with level of exophthalmos, reduced airway passages and degree of dental malalignment in Persian cats. PLoS One 16(7):e0254420. https://pmc.ncbi.nlm.nih.gov/articles/PMC8294563/ — lu (définitions, tableau 1).
- [R21] Ramos J., Viegas I., Pereira H., Requicha J. F. (2021). Morphometrical Study of the European Shorthair Cat Skull Using Computed Tomography. Veterinary Sciences 8(8):161. https://pmc.ncbi.nlm.nih.gov/articles/PMC8402625/ — lu.
- [D21] Davis L. V., Hoyer N. K., Boscan P., Rao S., Rawlinson J. E. (2021). Computed Tomography Analysis of the Feline Infraorbital Foramen and Canal. Frontiers in Veterinary Science 7:619248. https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2020.619248/full — lu (tableau 2).
- [K12] Konrade K. A., Hoffman A. R., Ramey K. L., Goldenberg R. B., Lehenbauer T. W. (2012). Refractive states of eyes and associations between ametropia and age, breed, and axial globe length in domestic cats. American Journal of Veterinary Research 73(2):279-284. PMID 22280390. Notice Europe PMC : https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:22280390%20AND%20SRC:MED&resultType=core&format=json — résumé lu.
- [O23] Oksa-Minaļto J., Maggs D. J., Akimova J., Ilgaža A., Sebbag L. (2023). Ocular surface physiology and aqueous tear secretion in cats of diverse cephalic conformations. Veterinary Ophthalmology 26(S1):109-118. https://cris.huji.ac.il/en/publications/ocular-surface-physiology-and-aqueous-tear-secretion-in-cats-of-d/ — résumé lu.
- [Z17] Zuffi S., Kanazawa A., Jacobs D., Black M. J. (2017). 3D Menagerie: Modeling the 3D Shape and Pose of Animals. CVPR 2017. https://ar5iv.arxiv.org/html/1611.07700 — lu. Site https://smal.is.tue.mpg.de/ et licence https://smal.is.tue.mpg.de/license.html — lus ; page de téléchargement https://smal.is.tue.mpg.de/download.php — erreur 502.
- [WP] Wikipedia, article « Cat », section taille (renvoie à Sunquist et Sunquist, Wild Cats of the World, 2002, non lu). https://en.wikipedia.org/wiki/Cat — lu ; orientation seulement.
- [J-A] Jones E., chapitre « 55. Felidae », Fauna of Australia (gouvernement australien). https://www.dcceew.gov.au/sites/default/files/env/pages/a117ced5-9a94-4586-afdb-1f333618e1e3/files/55-ind.pdf — **résumé de recherche seulement** (téléchargement impossible).
- [Da98] Daniels M. J., Balharry D., Hirst D., Kitchener A. C., Aspinall R. J. (1998). Morphological and pelage characteristics of wild living cats in Scotland: implications for defining the 'wildcat'. Journal of Zoology 244:231-. https://www.cambridge.org/core/journals/journal-of-zoology/article/morphological-and-pelage-characteristics-of-wild-living-cats-in-scotland-implications-for-defining-the-wildcat/1FE90061986A81C72701784EB099814F — résumé lu, aucun chiffre utilisé.
- [C21] Choi Y., Pilton J., Foo T., Malik R., Haase B. (2021). Feline Skeletal Reference Guide: A Cadaveric Radiographic Measurement on Lower Limb Extremities. Veterinary and Comparative Orthopaedics and Traumatology 34(6):401-410. doi:10.1055/s-0041-1735289. Notice Europe PMC : https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%2210.1055/s-0041-1735289%22&resultType=core&format=json — résumé lu, aucun chiffre de longueur.
- [V15] Valero-Cuevas F. J., Cohn B. A., Ingvason H. F., Lawrence E. L. (2015). Exploring the high-dimensional structure of muscle redundancy via subject-specific and generic musculoskeletal models. Journal of Biomechanics 48(11):2887-2896. https://pmc.ncbi.nlm.nih.gov/articles/PMC5540666/ — lu ; longueurs dans une figure non lue.
- [Sa08] Salomon F.-V., Flügge A.-K., Hartmann J., Schulze A. (2008). Das postnatale Wachstum des Skeletts und der Körpermasse von Hauskatzen. Kleintierpraxis 53:677-686. https://www.vetline.de/node/3235 — résumé lu, aucun chiffre utilisé.
- [KM11] Kienzle E., Moik K. (2011). A pilot study of the body weight of pure-bred client-owned adult cats. British Journal of Nutrition 106:S113-S115. doi:10.1017/S0007114511001802 — lu en entier (PDF) ; masses seulement (européen sans pedigree, BCS 5 : M 4,3 ± 0,77 kg, n = 20 ; F 3,4 ± 0,55 kg, n = 21), aucune proportion ; cité pour situer le gabarit.
