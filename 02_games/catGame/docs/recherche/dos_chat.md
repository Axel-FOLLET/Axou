# Le chat sur le dos pour les papouilles : observations et clés pour `Pet`

Agent R, mission 2026-10-25_catgame_jeu, phase 1 (le dos). Document de recherche pour refaire l'animation `Pet` de `tools/anim_cat.py`. L'affût et le bond (phase 2) ne sont pas traités ici.

Légende :

- **[observé]** : vu sur une capture de ce lot ; la vidéo, l'instant et la capture sont indiqués ;
- **[source unique]** : un seul chat ou un seul texte le montre ;
- **[déduit]** : raisonnement à partir des observations, non vu tel quel ;
- **[non vérifié]** : ni observé ni sourcé.

Les angles et les durées viennent de planches prises tous les 0,125 s à 1,5 s. Une durée vaut donc ± un pas de planche. Les angles sont estimés à l'œil, à ± 20° environ. Les caméras sont tenues à la main et bougent.

## 1. Sources

### 1.1 Vidéos observées image par image (Playwright, 2026-10-25 soir)

Chaque planche est une mosaïque d'images de la vidéo. L'instant exact est écrit en jaune sur chaque vignette. Toutes les planches sont dans `catGame/.shots/recherche_dos/`.

| Code | Vidéo | Chat, cadrage | Planches |
|---|---|---|---|
| XnOi | YouTube XnOiGb59kS8, Sweet Street Cats, 2023-08-01, « Happy tabby cat rolling on his back for some petting and belly rubs. », 141,9 s, 720p | tigré, sur un banc en pierre, caméra de côté | `XnOi_planche_0-140s_pas7s.png`, `XnOi_planche_0-22s_pas1s.png`, `XnOi_planche_1.25-3.75s_pas0.125s.png`, `XnOi_planche_35-57s_pas1s.png`, `XnOi_planche_35.5-38s_pas0.125s.png`, `XnOi_planche_49.5-52s_pas0.125s.png` |
| cW98 | YouTube cW98mPYEUTc, Cat Purrfection, 2022-09-11, « Cat likes belly rub then bite », 35,2 s, 720p | tigré, sur un lit, caméra au-dessus | `cW98_planche_0-35s_pas1.5s.png` |
| GMlC | YouTube GMlCew1Fx1c, The Apartment Cat, 2022-08-09 (date de la page), « Cat Flops For Belly Rubs », 33,6 s, 720p | tigré et blanc, sur une table, caméra au-dessus et de trois quarts | `GMlC_planche_0-34s_pas1.5s.png`, `GMlC_planche_4.5-7.4s_pas0.125s.png`, `GMlC_planche_7.5-10.4s_pas0.125s.png` |
| Tonk | Wikimedia Commons, « Tonkinese cat rolling around - Japan - 2025 mar 22.webm », auteur Nesnad, 22 mars 2025, GFDL, 31,7 s, 1920 × 1080 | tonkinois qui se roule seul, sans caresse, au sol | `Tonk_planche_0-32s_pas1.5s.png`, `Tonk_planche_0-5.75s_pas0.25s.png`, `Tonk_planche_5.5-11.25s_pas0.25s.png` |

Quatre chats en tout, dont trois caressés (XnOi, cW98, GMlC). Tonk se roule seul : ses observations servent pour la mécanique, pas pour le contexte des papouilles.

### 1.2 Textes ouverts et lus

```
K1  Khoddami S., Kiser M. C., Moody C. M., « US and Canadian cat caregiver's ratings of cat-cat
    interactions: A video-based survey », Animal Welfare (Cambridge), matériel supplémentaire,
    Table S1 (éthogramme). PDF :
    https://static.cambridge.org/content/id/urn%3Acambridge.org%3Aid%3Aarticle%3AS0962728624000587/resource/name/S0962728624000587sup001.pdf
    Entrée « Rolling onto back » (valence +), d'après West M. 1974, « Social play in the domestic
    cat », American Zoologist 14: 427-436 :
    « Cat lies on back, belly up, all four limbs held in a semi-vertical position, tail moves back
    and forth, and body rolls side to side. Negative vocalisations such as hissing and growling are
    absent »
K2  WikiVet, « Feline Communication Behaviour » (https://en.wikivet.net/Special:MobileDiff/165159) :
    « The roll does not carry the same meaning in cats » ; « when in this position a cat is better
    able to use claws and teeth, and is not attempting to appease or diffuse conflict ».
    La page ne décrit pas la position des pattes.
K3  Université de Yamaguchi, actualité sur Higurashi Y. et al., « Torsional flexibility of the
    thoracic spine is superior to that of the lumbar spine in cats: Implications for the falling
    cat problem », Anat Rec, 2026-02-24, DOI 10.1002/ar.70165
    (https://ds0n.cc.yamaguchi-u.ac.jp/~celldesign/en_news/260430en/) : les vertèbres thoraciques
    du chat tournent très facilement sur elles-mêmes.
K4  JST Science Japan sur la même étude (https://sj.jst.go.jp/news/202606/n0623-01p.html) : « rotation
    of its upper body was completed before the rotation of its lower body » ; colonne thoracique :
    zone neutre jusqu'à 47° de chaque côté, rupture vers 171° ; colonne lombaire : presque pas de
    zone neutre, limite vers 57°. Spécimens de 5 chats, vidéos de 2 chats vivants. L'étude porte sur
    le redressement en chute, pas sur la roulade sociale : son application à Pet est déduite.
```

À lire aussi dans le dépôt :

- `docs/recherche/mouvement_reels.md` § 5 et § 6 : observations antérieures de l'agent A5 sur XnOi et cW98 ;
- `docs/recherche/comportement.md` : sens de la roulade, ventre à éviter, signaux de confort.

Non lus :

- l'éthogramme Springer (BMC Biol, DOI 10.1186/s12915-022-01369-1), qui demande une connexion ;
- Macpherson et Ye 1998, dont la page PubMed est restée bloquée sur une demande de cookies ;
- le chiffre de 72 à 94 ms de décalage entre l'avant et l'arrière du corps, vu seulement dans des résultats de recherche.

## 2. Observations

### 2.1 Côté de la roulade

- **[non vérifié]** Le côté (flanc gauche ou droit au sol) n'est déterminé sur aucune vidéo. XnOi est filmé de face, cW98 et GMlC du dessus, et Tonk bouge trop vite.

### 2.2 Descente jusqu'au flanc

- **[observé, source unique pour la descente depuis debout]** GMlC, `GMlC_planche_4.5-7.4s_pas0.125s.png` :
  - 5,5 s : debout, tête baissée vers la table ;
  - 5,625 à 5,875 s : la tête descend et la joue va vers la table ;
  - 6,0 s : l'épaule est déjà sur la table ;
  - 6,125 à 6,25 s : couché sur le flanc, pattes avant allongées vers l'avant, tête posée sur la joue.
  - Durées : la tête mène pendant ≈ 0,4 s, puis le corps « tombe » sur le flanc en ≈ 0,125 à 0,25 s. De debout au flanc : ≈ 0,75 s, sans passer par assis ni par le sphinx.
- **[observé]** Tonk, `Tonk_planche_5.5-11.25s_pas0.25s.png` : debout à 5,5 s, couché à 5,75 s. Une chute aussi rapide se voit sur un deuxième chat, mais l'image est floue et la caméra bouge.
- **[observé]** XnOi, `XnOi_planche_35.5-38s_pas0.125s.png` : départ du sphinx en boule à 35,5 s. La roulade part donc aussi du sphinx (même chat qu'en 2.3).

### 2.3 Du flanc (ou du sphinx) au dos : ordre et délais

- **[observé, 3 séquences sur 2 chats]** La tête tourne d'abord, seule, presque jusqu'à l'envers. Le tronc suit ensuite.
  - GMlC, `GMlC_planche_7.5-10.4s_pas0.125s.png` :
    - 7,5 à 8,25 s : sur le flanc, pattes avant allongées, joue au sol ;
    - 8,375 à 8,625 s : la face tourne vers le haut ;
    - 8,625 à 8,875 s : les pattes avant se replient sur le poitrail et le poitrail passe vers le haut ;
    - 9,0 s : position tenue.
    - Durées : tête ≈ 0,25 s, puis épaules ≈ 0,25 s ; du flanc au dos ≈ 0,5 s.
  - XnOi, `XnOi_planche_35.5-38s_pas0.125s.png` :
    - 35,5 → 36,0 s : depuis le sphinx, la tête passe de la face vers le bas à l'envers, menton en l'air, en ≈ 0,5 s, alors que le dos garde sa forme de boule ;
    - 36,125 → 36,5 s : le tronc se couche ensuite sur le flanc et la gorge claire apparaît.
  - XnOi, `XnOi_planche_1.25-3.75s_pas0.125s.png` : la tête passe de la face vers le sol (1,5 s) à l'envers (1,875 s) en ≈ 0,375 s, sans que le corps, couché sur le flanc, bouge.
- **[observé, déjà noté par A5]** XnOi, 20,25 → 20,625 s : rotation de la tête en ≈ 0,4 s (`mouvement_reels.md` § 6). Mes planches concordent.
- **[déduit]** L'ordre tête, puis épaules, puis bassin est le même que dans le redressement en chute (K4 : le haut du corps finit de tourner avant le bas). La colonne thoracique du chat tourne facilement, la lombaire peu (K3, K4). Cela explique que le bassin reste en arrière, mais aucune mesure ne porte sur la roulade sociale.

### 2.4 Position tenue

**Tronc et bassin**

- **[observé, 3 chats sur 4]** Le chat n'est pas à plat sur le dos : le poitrail est tourné vers le haut, mais le bassin reste sur le côté.
  - XnOi 0,5 à 19,5 s (`XnOi_planche_0-22s_pas1s.png`) : le corps est couché sur le flanc et allongé ; seule la tête est à l'envers.
  - GMlC 9,0 à 10,375 s : poitrail et ventre blancs vers le haut, pattes arrière allongées vers le bas de l'image, bassin de côté.
  - Tonk 1,0 à 3,25 s : sur le flanc, tête à l'envers.
- **[observé, source unique]** cW98, 2,0 à 18,5 s (`cW98_planche_0-35s_pas1.5s.png`) : vraiment sur le dos, ventre en l'air, pattes arrière écartées.
- **[source unique : K1]** L'éthogramme dit « on back, belly up ».
- **[déduit]** Angle de roulis estimé :
  - épaules entre ≈ 120° et 150° ;
  - bassin entre ≈ 80° et 100° (sur le flanc) ;
  - torsion entre les deux de ≈ 40° à 60°.
- **[non vérifié]** Courbure du dos en C : non mesurable sur ces cadrages.

**Tête**

- **[observé, 3 chats]** À l'envers, menton en l'air, dessus du crâne ou joue au sol :
  - XnOi 1,875 à 19,5 s ;
  - GMlC 8,75 à 10,375 s, avec la tête un peu penchée ;
  - Tonk 1,5 à 3,25 s.
- **[observé, source unique]** cW98 : tête rejetée en arrière, au bout du corps.

**Pattes avant**

- **[observé]** GMlC 8,75 à 10,375 s : repliées sur le poitrail, poignets fléchis, pieds recourbés près du menton, coudes serrés contre les côtes.
- **[observé]** cW98 : asymétriques. Une patte est repliée au poignet ; l'autre est tendue vers l'avant, au-delà de la tête (2,0 à 18,5 s).
- **[observé]** Tonk 1,0 à 3,25 s, et GMlC sur le flanc (6,25 à 8,25 s) : pattes allongées vers l'avant. Elles se replient au moment de passer sur le dos (GMlC 8,625 à 8,875 s).

**Pattes arrière**

- **[observé]** XnOi : allongées vers la queue, l'une sur l'autre (0,5 à 19,5 s).
- **[observé]** GMlC : allongées vers l'arrière, un peu écartées ; une patte tendue sur le côté à 12,25 s.
- **[observé, source unique]** cW98 : écartées, l'une repliée genou plié, pied en l'air.
- **[source unique : K1]** « all four limbs held in a semi-vertical position ».
- **[déduit]** Avec le bassin sur le flanc, les pattes arrière restent allongées et superposées. Elles ne se dressent que si le bassin passe vraiment sur le dos (cW98).

**Queue**

- **[observé]** XnOi : à plat derrière le corps.
- **[observé]** cW98 : entre les pattes arrière (3,5 à 9,5 s).
- **[source unique : K1]** « tail moves back and forth ».
- **[non vérifié]** Queue de GMlC : hors du cadre.

### 2.5 Micro-mouvements pendant la position tenue

- **[observé]** XnOi et cW98 : corps presque immobile ; seule la main bouge. Durées : ≈ 18 s pour XnOi (0,5 à 19,5 s) et ≈ 16 s pour cW98 (2 à 18,5 s).
- **[observé, source unique : XnOi]** La tête se remet plusieurs fois face vers le sol, puis de nouveau à l'envers, pendant la caresse :
  - 1,5 → 1,875 s ;
  - 20,5 s, puis 22,5 s ;
  - 43,5 s (face vers le bas) → 44,5 s (à l'envers).
  - Le tronc ne bouge pas pendant ces retournements.
- **[source unique : K1]** « body rolls side to side », « tail moves back and forth ». Ni l'amplitude ni la période ne sont données.
- **[observé]** Pas de pédalage des pattes avant sur les quatre vidéos, comme A5 l'avait déjà noté.
- **[observé, source unique : cW98]** Fin de la caresse vers 20 à 22 s : la tête se relève vers la main, puis le chat mord en restant sur le dos (contexte, pas pour Pet).

### 2.6 Se relever

- **[observé]** XnOi, `XnOi_planche_49.5-52s_pas0.125s.png` :
  - 49,5 s : tête à l'envers ;
  - 49,75 s : tête remise face vers le bas, oreilles dressées, en ≈ 0,25 s ;
  - 50,375 à 50,75 s : l'avant se redresse et le corps pivote ;
  - 51,0 s : sphinx.
  - Durée totale ≈ 1,5 s, la tête d'abord.
- **[observé]** Tonk, `Tonk_planche_0-5.75s_pas0.25s.png` :
  - 3,25 s : sur le flanc, tête à l'envers ;
  - 3,5 à 4,0 s : les pattes avant se replient et la tête tourne ;
  - 4,25 s : tête à l'endroit ;
  - 4,5 s : sphinx ;
  - 5,0 s : debout.
  - Durée totale ≈ 1,75 s, la tête d'abord.
- **[observé, déjà noté par A5]** XnOi, 26,75 → 27,125 s : du flanc au sphinx en ≈ 0,4 s.
- **[déduit]** Pour se relever, l'ordre est le même que pour descendre : tête, puis épaules et pattes avant, puis bassin. Le relevé n'est donc pas la descente jouée à l'envers.

### 2.7 Sens de la roulade

- **[source unique : K2]** Ce n'est pas un signal de soumission : sur le dos, le chat peut se servir des griffes et des dents.
- **[observé, source unique : cW98]** Le chat mord à la fin.
- **[source unique : K1]** Valence positive, sans grondement.
- Voir aussi `comportement.md` : le ventre est une zone à éviter.

## 3. Écarts avec `Pet` actuel

Comparaison avec :

- les aperçus Blender `catGame/.shots/blender/Pet_f056_persp.png`, `Pet_f063_persp.png`, `Pet_f068_front.png`, `Pet_f073_front.png`, `Pet_f073_persp.png` et `Pet_f097_persp.png` (ouverts) ;
- les captures du navigateur `catGame/.shots/2026-10-25_pw_pet_2.55.png`, `_4.50.png` et `_7.60.png` (ouvertes).

Le code cité est celui de `tools/anim_cat.py`, lignes 483 à 557 et ligne 681.

| # | Actuel | Réel | Statut |
|---|---|---|---|
| E1 | Descente REST → SIT (0,5 s) → LIE (1,5 s) → LIE_SETTLE (2,0 s), puis roulade | Depuis debout : tête vers le sol, puis chute sur le flanc en ≈ 0,75 s (GMlC). Depuis le sphinx : la tête tourne d'abord (XnOi). | observé ; le chemin par le sphinx existe aussi, donc E1 est un choix de jeu plutôt qu'une faute |
| E2 | `BACK_FRONT, BACK_REAR = 175, 155` (ligne 512). Sur f073 et f097 persp : chat à plat sur le dos, symétrique, pattes vers le ciel (« insecte mort ») | Épaules ≈ 120-150°, bassin ≈ 80-100°, sur le flanc (XnOi, GMlC, Tonk). Seul cW98 est à plat. | observé (3 chats sur 4) |
| E3 | `_legs_back` met les pattes droites en miroir des gauches (ligne 519) : avant et arrière symétriques | Asymétrie : cW98 (une patte avant repliée, l'autre tendue) ; GMlC 12,25 s (une patte arrière tendue sur le côté). Avec le bassin sur le flanc, les pattes arrière sont superposées (XnOi). | observé ; l'asymétrie exacte varie selon le chat |
| E4 | f073 et f097 persp : avant-bras dressés à la verticale, pieds au niveau du menton mais loin du poitrail | GMlC 8,75-10,375 s : avant-bras couchés sur le poitrail, poignets fléchis, coudes serrés | observé (GMlC), concordant avec l'observation de cW98 par A5 |
| E5 | Avance de la tête sur les épaules : +20 à +25° (PET_LEAN 50/25/70, PET_SIDE 100/75/120, PET_OVER 150/130/175, lignes 554-556) | La tête finit (≈ 180°) avant que le tronc ait vraiment tourné (XnOi 36,0 s ; GMlC 8,625 s ; XnOi 1,875 s) | observé (2 chats) |
| E6 | De LIE_SETTLE (2,0 s) à BACK (3,0 s) : 1,0 s en 4 clés | Du flanc au dos ≈ 0,5 s (GMlC) ; tête seule ≈ 0,25 à 0,5 s | observé (GMlC pour le tronc, source unique) |
| E7 | Position tenue de 3,0 à 7,0 s : `calm(stretch, rub)`, avec pattes avant tendues toutes les secondes (clés à 4,0, 5,0 et 6,0 s) | Immobile (XnOi, cW98) ; tête qui se retourne de temps en temps (XnOi) ; queue qui balaie et corps qui se balance d'un côté à l'autre (K1). Aucune patte qui se tend de façon régulière. | observé ; K1 en source unique |
| E8 | Relevé de 7,0 à 8,0 s : PET_OVER, PET_SIDE, PET_LEAN, soit la descente à l'envers. Dans PET_OVER (150/130/175), la tête revient en dernier. | La tête se remet à l'endroit d'abord (XnOi 49,5-49,75 s ; Tonk 3,5-4,25 s), puis l'avant, puis le bassin ; ≈ 1,5 s jusqu'au sphinx | observé (2 chats) |
| E9 | f073 persp : tête à l'envers, menton en l'air | Pareil (XnOi, GMlC, Tonk) | conforme |
| E10 | Dans le navigateur, la capture nommée 2,55 s montre déjà le chat sur le dos, pattes avant levées, alors que Blender montre le flanc (PET_SIDE) à 2,6 s. La capture nommée 7,60 s montre le chat debout. | Sans objet (écart interne au jeu) | observé sur les captures ; cause non vérifiée (décalage `PET_FROM` dans `Brain.js` ou nom des captures ?) |
| E11 | Queue : `T_` à (0,6 ± 0,4·rub, 6,3, g + 1,2) | À plat derrière (XnOi) ; balaie (K1) | proche ; balayage à garder lent |

## 4. Clés proposées pour `Pet`

### 4.1 Conventions

- Repère de l'armature : −Y vers le museau, +Z vers le haut, +X vers le côté gauche du chat ; le chat mesure ≈ 10 unités.
- Les poses restent écrites **avant roulis**, dans le repère de `TUCK`, puis tournées par `twisted(p, front, rear, head)`.
- `+90°` met le côté gauche (+X) au sol, ventre vers −X (rotation autour de Y : x' = x·cos θ + z·sin θ, z' = −x·sin θ + z·cos θ).
- Les valeurs absolues de repos (G, S, HJ, FL, FR, BL, BR, WL, WR, KL, KR) ne sont écrites nulle part : **à relever par A** avec `-- info`. Les décalages ci-dessous sont donc relatifs à `TUCK_BODY`, `TUCK_LEGS` et `BACK_LEGS` (lignes 485-490 et 525) ou aux points de repos nommés.
- Coudes et jarrets : cibles **toujours** calculées par `pole()` (ligne 426), donc du même côté qu'au repos, derrière le pied. Ne jamais placer `wl`, `wr`, `kl` ou `kr` à la main (journal du 2026-10-25, cause n° 1).
- Les fenêtres JS restent valables : la position tenue garde 3,0 à 7,0 s, donc `PET_PADDLE` (3,0 à 7,0 s) et les deux valeurs de `PET_FROM` (0,9 et 2,0 s) ne bougent pas.

### 4.2 Calendrier proposé

| t (s) | Image | Clé | front | rear | head | Justification |
|---|---|---|---|---|---|---|
| 0 → 2,0 | 1 → 49 | inchangé : REST, SIT, LIE, LIE_SETTLE | 0 | 0 | 0 | XnOi part du sphinx (E1 : choix de jeu) |
| 2,25 | 55 | `PET_HEAD1` : tête sur la joue | 10 | 0 | 90 | GMlC 5,625-5,875 s ; XnOi 35,625-35,875 s |
| 2,5 | 61 | `PET_HEAD2` : tête à l'envers, tronc encore couché | 30 | 10 | 180 | XnOi 36,0 s ; GMlC 8,625 s ; tête en ≈ 0,4 à 0,5 s |
| 2,75 | 67 | `PET_SHOULDER` : épaules qui passent, pattes avant à mi-repli | 90 | 55 | 185 | GMlC 8,625-8,75 s |
| 3,0 | 73 | `BACK2` : poitrail en l'air, bassin sur le flanc | 140 | 90 | 185 | GMlC 8,875-9,0 s ; XnOi 36,5 s |
| 3,0 → 7,0 | 73 → 169 | `hold(phase)` : balancement lent | 140 ± 10 | 90 ± 5 | 185 ± 5 | K1 « body rolls side to side » ; amplitude et période non sourcées |
| ≈ 5,0 (option) | ≈ 121 | retournement de la tête : 185 → 100 → 185 en ≈ 0,75 s | 140 | 90 | 100 | XnOi 20,5-22,5 s et 43,5-44,5 s (source unique) |
| 7,0 | 169 | `BACK2` | 140 | 90 | 185 | — |
| 7,25 | 175 | `UP_HEAD` : tête remise à l'endroit d'abord | 125 | 90 | 30 | XnOi 49,5-49,75 s (≈ 0,25 s) |
| 7,6 | 183 | `UP_FRONT` : l'avant se redresse, pattes avant repliées sous le poitrail | 50 | 60 | 10 | XnOi 50,375-50,75 s ; Tonk 3,5-4,25 s |
| 8,0 | 193 | LIE (sphinx) | 0 | 0 | 0 | XnOi 51,0 s ; Tonk 4,5 s ; ≈ 1 s depuis le dos |
| 9,0 | 217 | REST (inchangé) | 0 | 0 | 0 | Tonk 4,5 → 5,0 s (sphinx → debout ≈ 0,5 s) ; 1 s gardée pour le jeu |

Notes sur les angles :

- **[déduit]** La torsion épaules-bassin atteint 50° (140 contre 90). C'est sous la limite lombaire de ≈ 57° (K4), mais cette limite vient d'un autre mouvement. Si le maillage se déchire (journal 2026-10-25, f66-67), descendre `front` à 120 avant de toucher `rear`.
- **[déduit]** Tête à 185 : 45° de plus que les épaules, ce qui est à peu près ce que montrent XnOi et GMlC (tête à l'envers, poitrail de trois quarts). Garder `head_at(TUCK_N, pitch=20, yaw=BACK_YAW)` avec `BACK_YAW = −30` (tête sur la joue), conforme à E9.
- **[déduit]** Pendant `PET_HEAD1` et `PET_HEAD2`, seule la tête bouge vraiment. `Spine` et `Root` prennent la moyenne front/rear (ligne 421), donc ils restent bas : c'est voulu.

### 4.3 Pattes de `BACK2` (repère avant roulis)

Les valeurs ci-dessous sont un point de départ **[déduit]**, à régler par A sur les aperçus front et persp.

**Pattes avant**, repliées sur le poitrail, poignets fléchis (GMlC 8,75-10,375 s) :

- `fl` (patte du côté sol, épaules à 140°) = `BACK_LEGS["fl"] + (−0,2, −0,3, +0,3)`, soit ≈ (0,6, −3,0, g + 1,3). Pied plus près du poitrail et à hauteur du menton.
- `fr` (patte du dessus) = `BACK_LEGS["fr"] + (+0,1, +0,1, +0,4)`, soit ≈ (−0,7, −2,6, g + 1,4). Repliée plus serrée que `fl` : asymétrie (cW98, GMlC).
- `faim` inchangé (0, 0,4, 0,9) : doigts recourbés vers le corps.
- Contrôle visuel : sur l'aperçu persp de f073, l'avant-bras doit être couché contre le poitrail, pas dressé (E4). Le coude doit rester en arrière du pied, le long des côtes.
- Coudes : `wl = pole(_S_T, fl, S, FL, WL)` et `wr = pole(_S_T, fr, S, FR, WR)`, sans `out`.

**Pattes arrière**, allongées vers la queue et superposées, bassin sur le flanc (XnOi 0,5-19,5 s ; GMlC 9,0-10,375 s) :

- Avec `rear = 90`, un point voulu après roulis à (x', z'rel) s'écrit avant roulis x = −z'rel et z = ZC + x' (z'rel = z' − ZC).
- `bl` (patte du dessous) : voulu au sol, à ≈ 0,8 côté ventre et ≈ 2 unités derrière HJ. Après roulis : x' ≈ −0,8, z' ≈ g + PAW. Avant roulis : `bl` ≈ (+2,3, `_HJ_T`.y + 2,0, g + 1,8) = (2,3, 5,2, g + 1,8).
- `br` (patte du dessus) : posée sur la patte du dessous, un peu en avant. Après roulis : z' ≈ g + 1,1. Avant roulis : `br` ≈ (+1,5, 4,9, g + 1,6). Pour des pattes superposées, x reste positif : la patte droite « tombe » vers le sol.
- `baim` inchangé (0,2, 0,8, −0,5).
- Jarrets : `kl` et `kr` par `pole(_HJ_T, b?, _HJ_R, B?, K?, 0,4)` comme aujourd'hui. Avec `br` à x > 0, vérifier que le signe de `out` (ligne 435 : il suit le signe de `foot.x`) n'envoie pas le jarret droit du mauvais côté. Sinon, passer `out = −0,4` pour `kr`. **[non vérifié]**
- Contrôle visuel : sur f073 persp, les deux pieds arrière doivent être près du sol derrière le bassin, pas dressés vers le ciel (E2, E3).

**Queue** : `T_` à (0,6 + 0,4·sin(phase), 6,3, g + 1,2). Balayage lent (K1), pas plus d'une oscillation toutes les ≈ 2 s **[non vérifié]**.

### 4.4 Clés de passage

- `PET_HEAD1` et `PET_HEAD2` : pattes de `_TUCK_LEGS_P`, inchangées (ligne 548).
- `PET_SHOULDER` : pattes avant à mi-chemin entre `_TUCK_LEGS_P` et `BACK2`, recalculées par `_legs_back()` comme `_HALF_LEGS` (ligne 553), pour garder les cibles du bon côté. Pattes arrière encore celles de `_TUCK_LEGS_P` : le bassin n'a pas encore tourné.
- `UP_HEAD` : pattes de `BACK2`.
- `UP_FRONT` : pattes avant `TUCK_LEGS["fl"]` et `["fr"]` (repliées sous le poitrail, comme le sphinx), pattes arrière `_HALF_LEGS`.

### 4.5 Position tenue

```
hold(phase) = twisted(pose_BACK2_avec_queue(phase), 140 + 10·sin(phase), 90 + 5·sin(phase), head=185 + 5·sin(phase))
```

- Clés à 4,0 s, 5,0 s et 6,0 s avec `phase` = +π/2, −π/2, +π/2 (même rythme que les clés `calm` actuelles).
- Supprimer l'étirement régulier des pattes avant de `calm()` : non observé (E7).
- Amplitude et période : **[non vérifié]**, à régler. K1 ne donne aucun chiffre ; XnOi et cW98 montrent surtout l'immobilité.

## 5. Ce qui reste non vérifié

- Côté de la roulade sur toutes les vidéos.
- Courbure latérale du dos (C) pendant la position tenue.
- Amplitude et période du balancement (K1 sans chiffres).
- Angles d'articulation chiffrés (épaule, coude, poignet, hanche, genou, jarret) : les cadrages ne permettent que les positions qualitatives ci-dessus.
- Valeurs absolues de repos des points nommés : à relever par A.
- Cause de l'écart entre le navigateur et Blender (E10).
- Comportement de `pole()` avec `out` quand `br` passe à x > 0.
- Toutes les clés de § 4 : non essayées dans Blender par R (seul A lance Blender).

## 6. Dos du chat au repos (debout, assis, couché)

Ajout de l'agent A, mission 2026-10-26_catgame_monde. Retour de l'utilisateur : « chat en général trop bossu par moment ».

Sources lues :

- J. M. Macpherson et Y. Ye, « The cat vertebral column: stance configuration and range of motion », *Experimental Brain Research* 119, p. 324-332, 1998, DOI 10.1007/s002210050348. PDF lu dans sa notice et dans un résumé de recherche : `https://gwern.net/doc/cat/biology/1998-macpherson.pdf`. Le texte intégral n'a pas été lu (PDF illisible ici). **[source unique]**
- Chewy, « How High Can Cats Jump, And How Do They Do It? » : `https://www.chewy.com/education/cat/general/how-high-can-cats-jump`. **[source unique, vulgarisation]**

Ce qu'on en retient :

- Debout, la colonne du chat n'est pas l'arc régulier des atlas. Selon le résumé de Macpherson et Ye, elle présente plusieurs courbures : une légère flexion dorsale au bas des lombaires, une flexion ventrale marquée au bas du thorax et en haut des lombaires, puis une forte flexion dorsale en haut du thorax et au cou. **[source unique]**
- Conséquence pour le jeu **[déduit]** : au repos, le dos peut être légèrement convexe au milieu, mais sans pli localisé. La bosse vient d'un **pli** entre deux os voisins, pas de la courbure d'ensemble. Le mode `hump` de `tools/anim_cat.py` mesure ce pli.
- Assis, l'arc convexe régulier du dos est naturel ; couché en boule (`Sleep`), la boule est voulue. **[déduit, jugé sur les aperçus Blender]**

## 7. Saut sur un muret (clips `Jump` et `JumpDown`)

Ajout de l'agent A, mission 2026-10-26_catgame_monde. Le muret mesure de 0,3 à 0,5 m, pour un chat de 0,8 m.

Sources lues :

- Chewy (voir § 6) : le chat s'accroupit avant de sauter (« Before a cat jumps, you'll often see them crouch down ») ; la poussée vient des pattes arrière, la colonne souple corrige la posture en l'air, et la queue sert de contrepoids à la réception. **[source unique, vulgarisation]**
- Fil de forum Homemadetools, « How to solve pets jumping fences? » : `https://www.homemadetools.net/forum/coyote-roller-containing-fence-hopping-pets-videos-photo-63393`. Il décrit un enchaînement « jump-grab-climb » (sauter, s'accrocher, grimper) pour les clôtures hautes. **[source unique, non scientifique]**
- Atterrissage : Vet Med (Czech) 64(11), 2019, « The loading characteristics of landing in cats with different body weights » : `https://vetmed.agriculturejournals.cz/artkey/vet-201911-0005_the-loading-characteristics-of-landing-in-cats-with-different-body-weights.php`. Lors d'un saut depuis une table de 1 m, la force verticale maximale et l'impulsion verticale sont plus grandes sur les pattes avant que sur les pattes arrière. **[source unique]**
- Aucune étude cinématique du décollage chez le chat n'a été trouvée. **[non vérifié]**

Phases retenues pour `Jump`, sur place (la racine est déplacée en JS) :

1. **Préparation** : accroupi, regard vers le haut du mur, arrière-train ramassé (source : Chewy, crouch).
2. **Poussée** : extension des pattes arrière, corps cabré (source : Chewy, poussée arrière).
3. **En l'air** : corps allongé, pattes avant tendues vers le dessus du mur, pattes arrière qui suivent **[déduit]**.
4. **Pattes avant sur le dessus** : les pattes avant se posent les premières **[déduit de « grab » et de la réception avant-d'abord]**.
5. **Arrière ramenées** : les pattes arrière se replient sous le corps. Pour un muret de 0,5 m au plus, pas de grimper à la force des pattes avant **[déduit]**.
6. **Réception, puis debout.**

Pour `JumpDown` : regard vers le bas, bascule vers l'avant, pattes avant au sol les premières (Vet Med 2019), puis arrière, puis debout. Les durées et les angles sont réglés au jugé sur les aperçus Blender. **[non vérifié]**
