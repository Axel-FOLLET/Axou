# Mouvement de chats réels : relevés image par image

Agent A5, mission chat_recherche, 2026-10-22. Objet : relever sur des vidéos de chats réels la durée, l'ordre des appuis, les angles approximatifs et le port de tête et de queue de huit gestes, puis les comparer aux clips décrits dans `tools/anim_cat.py`.

## 1. Méthode

- Vidéos YouTube trouvées par recherche `yt-dlp "ytsearchN:…"`, téléchargées sans cookies ni compte (`--no-cookies`, au plus 720p, vidéo seule, 180 premières secondes) dans le scratchpad de l'agent, jamais dans le dépôt. Le champ `license` des métadonnées vaut `None` pour toutes : licence YouTube standard, usage limité à l'observation, aucune image reproduite ici.
- Outils observés : yt-dlp 2026.10.21, ffmpeg 7.1.5, Python 3.13.5 (numpy, Pillow).
- Planches horodatées : ffmpeg `fps`, `scale`, `drawtext` du temps source (`%{pts\:flt}`), `tile`. Tous les temps cités sont des temps de la vidéo source, en secondes.
- Appuis de la marche : kymogramme (pour chaque image, maximum de luminosité sur une bande horizontale au ras du sol, lignes empilées) puis composantes connexes au-dessus d'un seuil (script `stance.py`, 8-voisinage). Un pied posé trace une diagonale régulière parce que la caméra suit le chat.
- Angles : images agrandies avec une grille de 50 et 100 px source ; angle du membre entier (épaule ou hanche estimée → pied) par rapport à la verticale. Le centre articulaire est deviné sous le pelage : incertitude d'au moins ±10°.
- Âge : aucune vidéo ne donne l'âge exact. Seule la description de XnOiGb59kS8 dit « a young tomcat ». L'âge « environ 2 ans » demandé n'est vérifié pour aucun chat.
- Vitesse : aucune vidéo retenue n'atteste qu'elle est en temps réel. Les rapports (phase, facteur d'appui) sont plus sûrs que les durées absolues.

Vidéos écartées après visionnage : j7tRtmSfRKQ et jtPAy3yXeCo (cheval ou poney), n73I5g09F84 (animation), M38eRQ7h0Rs (description : « Created in Adobe Animate »), tmMdjyPMqAw (description : « A hand drawn cat »), pJkQpag4g9c (caméra trop agitée sur 0–24 s, planche à 1 i/s).

## 2. Marche vue de profil (qHexBb35ens)

Chat tigré et blanc réel, profil, caméra qui le suit, fond noir quadrillé ; 14 s, 24 i/s, 640×480 (métadonnées yt-dlp).

### Durée et ordre des appuis

Commande `stance.sh qHexBb35ens 2.5 4.5 372 386 35 4` (108 images à 24 i/s, bande y 372–386, seuil 35) :

| Appui (pose → lever, s) | Durée d'appui (s) | Pied (interprétation) |
| --- | --- | --- |
| 2,708 → 3,958 | 1,250 | arrière côté opposé |
| 3,000 → 4,375 | 1,375 | avant côté opposé |
| 3,625 → 5,000 | 1,375 | arrière côté caméra (pose vue sur l'image 3,625) |
| 3,958 → 5,458 | 1,500 | avant côté caméra |
| 4,750 → 6,000 | 1,250 | arrière côté opposé, cycle suivant |
| 5,042 → 6,375 | 1,333 | avant côté opposé, cycle suivant |

- Cycle : 2,04 s. Chaque série se répète 2,042 s plus tard dans le tableau ci-dessus ; vérification sur tout le clip par `stance.sh qHexBb35ens 0.5 13.4 376 390 45 6` : poses à 0,958, 3,042, 5,083, 7,125, 9,167, 11,208 et 13,25 s, soit 6 périodes en 12,29 s (2,05 s par cycle).
- Ordre : arrière opposé (2,708) → avant opposé (+0,292 s) → arrière côté caméra (+0,625 s) → avant côté caméra (+0,333 s) → arrière opposé (+0,792 s). C'est un pas latéral (lateral sequence), comme le clip Walk.
- Décalage arrière → avant du même côté : 0,292/2,042 = 0,14 et 0,333/2,042 = 0,16 cycle (même commande).
- Décalage entre les deux arrière : 0,917 s = 0,45 cycle et 1,125 s = 0,55 cycle (même commande).
- Facteur d'appui : 1,25 à 1,50 s sur 2,042 s, soit 0,61 à 0,73 (même commande ; la valeur haute de l'avant côté caméra peut venir d'une fusion de composantes).
- La durée réelle du cycle n'est pas vérifiée : 2,04 s est lent pour un chat qui marche, la vidéo peut être ralentie ou le chat marcher lentement.

### Angles approximatifs (membre entier, par rapport à la verticale, ±10° au moins)

Relevés sur les images agrandies de qHexBb35ens à 3,625, 3,958 et 4,333 s (grille 50 px) :

| Instant | Membre | Angle estimé |
| --- | --- | --- |
| pose de l'arrière (3,625 s) | arrière | 25–30° vers l'avant |
| lever de l'arrière (3,958 s) | arrière | 30–40° vers l'arrière |
| pose de l'avant (3,958 s) | avant | 30–40° vers l'avant |
| juste avant le lever de l'avant (4,333 s) | avant | 40–50° vers l'arrière, poignet qui commence à plier |

- Au lever, la patte avant se replie au poignet (flexion visible vers 2,6 s et 4,6–4,7 s sur la planche 12 i/s de qHexBb35ens).

### Port de tête et de queue

- Tête (image 3,958 s, px source) : haut du crâne vers y≈173, ligne du dos vers y≈170, museau vers y≈237 : tête portée à hauteur du garrot, nez un peu vers le bas.
- Queue (même image) : base vers (133, 187), bout vers (117, 60) : dressée presque verticale, bout légèrement recourbé. Même port sur tout le clip (planches 0–14 s).
- Corps : dos presque horizontal, aucun balancement vertical mesuré (non quantifié).

### Comparaison avec Walk (anim_cat.py)

- `anim_cat.py` lignes 500–502 : cycle de 24 images à 24 i/s (1 s, joué ×WALK_RATE dans Cat.js), facteur d'appui 0,6. Le réel observé donne 0,61–0,73 : 0,6 est à la limite basse.
- `anim_cat.py` lignes 513–532 : avant décalé de 0,25 cycle après l'arrière du même côté, côtés décalés de 0,5. Le réel donne 0,14–0,16 et 0,45–0,55 : l'ordre est le bon, mais l'avant suit l'arrière plus vite chez le chat filmé.
- `anim_cat.py` ligne 532 : queue au point de repos T relevé du rebond (queue dressée), tête à pitch 6 ± 2°. Queue dressée cohérente avec ce chat ; elle ne l'est pas avec la queue basse de la marche de traque Stray (README §8.3) : les deux ports existent selon le contexte.

## 3. Trot (HYsGEFpRZlA, planches de Muybridge)

- Vidéo de 21 s (métadonnées yt-dlp) qui fait défiler des planches photographiques de Muybridge ; la description annonce « images 1–10 trotting, 11–24 changing to gallop ». La vidéo ne montre pas les planches dans l'ordre ni à vitesse réelle : sur la planche à 3 i/s de 0–8 s, on lit les numéros 2, 4, 7, 10, 12, 15, 18, 20, 23 en boucle.
- Observé sur les planches 2 et 10 (t = 0,0 et 1,0 s) : deux pieds au sol, un avant et un arrière, compatibles avec un appui diagonal ; le côté de chaque pied n'est pas identifiable sur ces vignettes.
- Port : dos horizontal, tête dans l'axe du dos portée vers l'avant, queue basse qui descend de la croupe puis remonte au bout (planches 2 à 15).
- Durée, facteur d'appui, angles : non mesurés. L'intervalle de 0,035 s entre images vient de la description YouTube seulement.
- Comparaison : `anim_cat.py` lignes 536–551 ne définissent aucun clip de trot (actions Rest, Idle, Walk, Sit, Lie, Pet, Sleep, Wake, Stretch, Groom).

## 4. Assis (ghl7LEAqT7A, PErrvYtVzbk)

- ghl7LEAqT7A (24 s, 60 i/s, chaîne « Animation Reference Videos », vidéo republiée : « Credits to the rightful owner ») : chat blanc et tigré assis, vue de trois quarts face, tout le clip (planche 1 i/s, 0–23 s). Pattes avant verticales et rapprochées, queue posée au sol le long du corps. Tête droite entre les coups de langue, ramenée vers la patte pendant la toilette.
- PErrvYtVzbk (34 s, 60 i/s) : passage assis → couché en boule (« loaf »). Planche 6 i/s de 0–4 s : départ assis à 0,0 s ; une patte avant avance vers 1,17–1,5 s ; le poitrail descend de 1,83 à 2,5 s ; les pattes avant piétinent jusqu'à 3,5 s ; posé vers 3,67 s. Transition ≈ 2,5 s, avec des pas des pattes avant.
- Angle du buste assis : non mesuré (aucune vue de profil d'un chat assis).
- Comparaison : `anim_cat.py` ligne 540, Sit passe du repos à assis en 1,2 s ; lignes 405–408, queue au sol (T_=P(1.6, 1.6, g + 0.3)), cohérente avec ghl7LEAqT7A. La transition inverse observée (assis → couché, 2,5 s) est plus longue que celle de Lie (0,9 s, ligne 541).

## 5. Couché en sphinx (EODBr20FiRA, PErrvYtVzbk)

- EODBr20FiRA (15 s, 30 i/s, chat blanc) : départ à demi assis, hanches déjà sur le côté. Planche 6 i/s de 1,5–5,5 s : la tête tourne vers 2,0 s ; les pattes avant glissent vers l'avant de 2,5 à 3,2 s ; le poitrail est au sol vers 3,5 s ; la tête se stabilise vers 4,5 s. Descente ≈ 1,5 s, tête posée ≈ 1 s après.
- Pose finale (planche 2 i/s, 5–14 s) : hanches roulées sur le côté, pattes avant allongées vers l'avant (non repliées), queue allongée au sol derrière, tête droite, yeux mi-clos. Ce n'est pas le sphinx pattes repliées.
- PErrvYtVzbk : la « boule » pattes avant repliées sous le poitrail n'est complète qu'à 8 s (planche 1 i/s), soit plusieurs secondes après le contact du poitrail (3,67 s).
- Comparaison : `anim_cat.py` lignes 412–421, LIE a les pattes avant repliées sous le poitrail (ligne 417) et la queue au sol (ligne 415). Ligne 541 : SIT → LIE en 0,9 s. Le réel observé descend en ≈ 1,5 s et ne replie les pattes que bien plus tard ; le pliage en deux temps (assis puis couché) correspond à PErrvYtVzbk.

## 6. Roulade sur le dos avec caresses (XnOiGb59kS8, cW98mPYEUTc)

- XnOiGb59kS8 (142 s, 48 i/s, tigré « young tomcat » selon la description) : sur le dos ou le flanc de 0 à ≈ 19,5 s (planche 0,25 i/s puis 2 i/s), tête à l'envers posée au sol, menton en l'air, pattes avant repliées, pattes arrière allongées, queue à plat derrière.
- Bascule de la tête (planche 8 i/s, 19,5–21 s) : face vers le sol à 20,25 s, face en l'air à 20,625 s, soit ≈ 0,4 s. La tête tourne plus vite et plus loin que le tronc.
- Retour sur le ventre (planche 8 i/s, 26–27,5 s) : couché sur le flanc à 26,75 s, redressé en sphinx à 27,125 s, soit ≈ 0,4 s.
- cW98mPYEUTc (35 s, 30 i/s) : sur le dos de 0 à ≈ 18 s (planche 0,5 i/s), pattes avant pliées aux poignets, pattes arrière écartées ; vers 20–22 s, le chat se tourne et mord la main.
- Comparaison : `anim_cat.py` ligne 542, Pet met 0,8 s pour passer de LIE à SIDE puis 0,8 s de SIDE à BACK, et revient par les mêmes paliers (fin à 9,0 s). Lignes 444–456 : pédalage alterné des pattes avant toutes les 0,35 s. Le réel bascule en ≈ 0,4 s et reste immobile sur le dos ≈ 19 s ; aucun pédalage observé dans ces deux vidéos.

## 7. Toilette (ghl7LEAqT7A, B0QVStRfSEo)

- ghl7LEAqT7A, planche recadrée sur la tête à 12 i/s de 13–15 s : langue visible à 13,17, 13,58–13,67, 14,08–14,17 et 14,75 s, soit un coup de langue toutes les ≈ 0,45–0,5 s (n = 4 intervalles, échantillonnage 12 i/s). Patte avant levée à hauteur du menton, yeux mi-clos, tête inclinée vers la patte.
- B0QVStRfSEo (138 s, 60 i/s, chat roux, gros plan) : couché, léchage de la patte puis du poitrail et des flancs, tête très baissée de 28 à 64 s ; patte relevée vers la face vers 108–116 s (planche 0,25 i/s). Lécher le flanc se fait en position couchée, pas assise.
- Comparaison : `anim_cat.py` lignes 485–493 et 548–550 : assis, patte gauche levée, tête tournée de 22°, alternance GROOM0/GROOM1 toutes les 0,3 s de 1,4 à 3,5 s. Le rythme réel (≈ 0,45–0,5 s) est plus lent ; la posture assise patte levée correspond.

## 8. Étirement (MlOeB-3p2WU)

- MlOeB-3p2WU (22 s, 30 i/s, compilation ; la description dit avoir été générée avec ChatGPT) : chat tigré et blanc, vue de trois quarts, étirement en marchant sur des lattes de bambou. Planche 6 i/s de 6,5–11 s : les pattes avant s'allongent de 7,5 à 7,83 s, la pose tient de 7,83 à 9,17 s, une patte avant revient vers 9,33–9,67 s. Total ≈ 2,2 s : allonger ≈ 0,3–0,5 s, tenir ≈ 1,3 s, revenir ≈ 0,3–0,5 s.
- Pose (image 8,0 s) : pattes avant tendues à ≈ 30° de l'horizontale (estimation sur vignette, vue de trois quarts), poitrail bas, pattes arrière presque verticales, croupe haute, tête basse dans l'axe du cou, queue tenue derrière à peu près horizontale (images 9,5–10 s).
- Comparaison : `anim_cat.py` ligne 547 : REST → STRETCH en 0,9 s, tenue jusqu'à 2,2 s, retour à 3,2 s (total 3,2 s). Lignes 474–477 : queue dressée (T_ z = g + 9,0). Le réel est plus vif à l'entrée et au retour, et la queue n'est pas dressée sur ce clip.

## 9. Réveil (DoHi6k2omt8)

- DoHi6k2omt8 (27 s, 25 i/s) : chat tigré roulé en boule de 0 à 11 s (planche 1 i/s ; zoom de caméra et image floue vers 7 s).
- Planche 6 i/s de 10,5–15,5 s : tête rentrée à 11,5 s, relevée yeux ouverts à 12,17 s, soit ≈ 0,7 s. Bâillement de 13,67 à 15,0 s (≈ 1,3 s, bouche la plus ouverte vers 14,67 s).
- Planche 4 i/s de 16,5–21,5 s : le chat roule sur le flanc de 17,0 à 17,5 s, étire les pattes avant, doigts écartés, de 18 à 20,25 s, puis se remet en boule vers 20,5 s. Il ne se lève pas.
- Comparaison : `anim_cat.py` ligne 546 : Wake passe CURL → SIDE (1,0 s) → LIE (2,0 s) → debout (3,0 s), sans bâillement ni étirement. Le réveil observé commence par la tête (0,7 s) et ajoute un bâillement d'≈ 1,3 s.

## 10. Synthèse des écarts

| Geste | anim_cat.py (ligne) | Réel observé (source) |
| --- | --- | --- |
| Marche, facteur d'appui | 0,6 (502) | 0,61–0,73 (qHexBb35ens, stance.sh) |
| Marche, avant après arrière | 0,25 cycle (513–532) | 0,14–0,16 cycle (qHexBb35ens, stance.sh) |
| Marche, queue | dressée (532) | dressée (qHexBb35ens 3,958 s) |
| Trot | absent (536–551) | appui diagonal probable, non mesuré (HYsGEFpRZlA) |
| Assis → couché | 0,9 s (541) | ≈ 1,5 s (EODBr20FiRA 2,0–3,5 s) ; ≈ 2,5 s (PErrvYtVzbk 1,0–3,67 s) |
| Sur le dos, bascule | 0,8 s par palier (542) | ≈ 0,4 s (XnOiGb59kS8 20,25–20,625 s) |
| Sur le dos, pédalage | toutes les 0,35 s (542–544) | non observé ; immobile ≈ 19 s (XnOiGb59kS8 0–19,5 s) |
| Toilette, coup de langue | 0,3 s (548–550) | ≈ 0,45–0,5 s (ghl7LEAqT7A 13–15 s) |
| Étirement | 0,9 / 1,3 / 1,0 s (547) | ≈ 0,4 / 1,3 / 0,4 s (MlOeB-3p2WU 7,5–9,67 s) |
| Étirement, queue | dressée (477) | à peu près horizontale (MlOeB-3p2WU 9,5–10 s) |
| Réveil | 3 s jusqu'à debout (546) | tête 0,7 s puis bâillement 1,3 s, reste couché (DoHi6k2omt8 11,5–15 s) |

## Non observé / non vérifié

- Âge des chats : non vérifié pour toutes les vidéos (seule XnOiGb59kS8 dit « young tomcat »).
- Vitesse réelle : aucune vidéo retenue n'est attestée en temps réel ; durées absolues à confirmer. Le cycle de marche de 2,04 s est probablement ralenti ou lent.
- Angles : estimés à l'œil sur grille, centre articulaire deviné, ±10° au moins ; aucun angle articulaire détaillé (coude, genou, jarret) mesuré.
- Trot : ordre des appuis, durée, facteur d'appui non mesurés ; l'intervalle de 0,035 s entre images de Muybridge vient de la seule description YouTube.
- Angle du buste assis, sphinx pattes repliées vu de profil : non observés.
- Pédalage sur le dos : non observé dans les deux vidéos retenues.
- Course (M2ORiMUKUOc, Falkingham) et marche de face (6BSCDiGZTpc) : téléchargées, non analysées.
- Licence : champ `license` = None pour toutes les vidéos ; licence YouTube standard supposée, aucune licence libre vérifiée.
- Aucune source bibliographique ni page web n'a été lue pour ce rapport : aucune valeur de la littérature n'est citée.

## Sources

Vidéos YouTube, consultées le 2026-10-22, pour observation seulement. Identifiant, chaîne, date de mise en ligne (métadonnées yt-dlp) :

- qHexBb35ens, mendy9000, 2011-04-11, « Cat Walk Profile.mov ».
- HYsGEFpRZlA, planches de Muybridge, « cat in trot changing to gallop » (chaîne non relevée).
- ROTxFZ2GMZA, Furry Historian, 2021-10-03, « Eadweard Muybridge Cat 1887 » (galop, non exploité).
- ghl7LEAqT7A, Animation Reference Videos, 2022-09-11, « Cat sitting idle / licking paws ».
- PErrvYtVzbk, ZGN, 2025-01-23, « I instructed my cat to make a proper loaf position. »
- EODBr20FiRA, Pushkin the white cat, 2024-11-28, « White cat changes position from sitting to lying down ».
- XnOiGb59kS8, Sweet Street Cats, 2023-08-01, « Happy tabby cat rolling on his back for some petting and belly rubs. »
- cW98mPYEUTc, Cat Purrfection, 2022-09-11, « Cat likes belly rub then bite ».
- B0QVStRfSEo, MB vids, 2019-10-04, « Cat Cleaning Itself (Close Up) ».
- MlOeB-3p2WU, KeshavPets, 2023-07-27, « Cute Cat Stretching After Waking Up! »
- DoHi6k2omt8, IrrelevantOwl, 2013-06-07, « Sleepy Cute Cat Having a Yawn and Stretch ».
- Téléchargées mais non analysées : M2ORiMUKUOc (Peter Falkingham), 6BSCDiGZTpc (Tom & Mimi Extras), 5no0VfXDj4s (Animation Reference, compilation), H_0CxD25pd4 (Harriet Murray).

Code comparé : `Lost/tools/anim_cat.py` (lecture seule ; numéros de ligne de ce seul fichier).
