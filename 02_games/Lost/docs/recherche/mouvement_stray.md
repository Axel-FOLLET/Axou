# Mouvement du chat de *Stray* : mesures image par image

Agent A4, mission `chat_recherche` (2026-10-22). Ce rapport complète les § 8.3 et 8.4 de `Lost/README.md` (lignes 194-220 de ce fichier) avec des mesures nouvelles : durées, cadences, ordre des appuis quand il est lisible, port de tête et de queue, angles estimés. Il ne refait pas les sources écrites du § 8.2.

## 1. Méthode

- Vidéos YouTube retéléchargées le 2026-10-22 dans le scratchpad de la session (sous-dossier `a4/vid/`), en 720p, vidéo seule, avec yt-dlp 2026.10.21 (venv du scratchpad) dans WSL Debian. Rien n'a été copié dans le dépôt.
- Format réglé par `-f 'bv*[height<=720][ext=mp4]/bv*[height<=720]'` ; extraits partiels avec `--download-sections "*0-720"` (2YeUJJ4xAC4) et `"*0-360"` (Sk6r51LNFos).
- Caractéristiques lues avec ffprobe : toutes en 1280x720 ; 59,94 i/s (4uP2MyUL49s, Sk6r51LNFos, kJawWyRUOBM), 60 i/s (8R-splyERsI, 2YeUJJ4xAC4), 29,97 i/s (u84hRUQlaio).
- Planches-contact générées par ffmpeg, avec l'instant source (secondes.centièmes) incrusté sur chaque vignette. Commande type (script `crop.sh`) :

```
ffmpeg -ss <début> -t <durée> -i <id>.mp4 -an -vf "fps=<i/s>,crop=<w>:<h>:<x>:<y>,scale=<l>:-2,drawtext=...text='%{eif:t+<début>:d}.%{eif:mod((t+<début>)*100,100):d:2}'...,tile=<CxL>" -frames:v 1 <nom>.jpg
```

- Repérage à 0,5 i/s, puis séquences recadrées à 5, 10, 15, 20 ou 30 i/s sur les gestes retenus. Les images ont été regardées une à une.
- **Précision des instants.** Elle vaut le pas d'échantillonnage : 0,03 s à 30 i/s, 0,05 s à 20 i/s, 0,07 s à 15 i/s, 0,1 s à 10 i/s et 0,2 s à 5 i/s. Un instant de début ou de fin de geste est lu à ± 1 pas.
- **Angles.** Ils sont estimés à l'œil sur les vignettes, à ± 15° environ, sans grille ni outil de mesure. Ils sont marqués « estimé ».
- **Limite générale.** Ce sont des bandes-annonces et des séquences de jeu filmées. Le montage, d'éventuels ralentis et le recadrage de la caméra du jeu ne sont pas connus. Une durée mesurée est donc celle de l'image affichée. Elle ne garantit pas la vitesse de l'animation en jeu (non vérifié).

Notation : `id @ t` désigne l'instant `t` (en secondes) de la vidéo `id`.

## 2. Mesures par geste

### 2.1 Marche de jeu, de côté (8R-splyERsI @ 88,90-91,55, 20 i/s)

| Mesure | Valeur | Source |
| --- | --- | --- |
| Postérieurs en écart maximal (un devant, un derrière) | 89,00 ; 89,40-89,45 ; 89,80 ; 90,20 ; 90,60 ; 91,00 ; 91,40-91,45 | 8R-splyERsI @ 89,00-91,45 |
| Demi-cycle (écart à écart, côté non distingué) | ≈ 0,40 s | idem |
| Cycle complet (deux demi-cycles) | ≈ 0,8 s, soit ≈ 1,25 cycle/s (déduit, approximatif) | idem |
| Port de tête | haute, cou dans le prolongement du dos ou un peu au-dessus, oreilles dressées, sur toute la séquence | 8R-splyERsI @ 88,90-91,55 |
| Queue | part vers le bas et l'arrière (estimé 30-45° sous l'horizontale à la base), puis courbe légère, bout relevé | 8R-splyERsI @ 89,40-90,65 |
| Queue en fin de plan | plus haute, en arc au-dessus de la ligne du dos (estimé) | 8R-splyERsI @ 91,20-91,55 |

- Le chat est en silhouette sombre et la caméra le suit. La vitesse au sol ne peut donc pas être mesurée.
- À 20 i/s, la résolution ne permet pas de distinguer la patte gauche de la droite. L'ordre des quatre appuis n'est pas établi sur ce plan.

### 2.2 Marche « à l'affût » vers un objet (Sk6r51LNFos @ 236,0-238,6, 15 i/s, gros plan de côté)

| Mesure | Valeur | Source |
| --- | --- | --- |
| Oscillation de l'antérieur proche | levé à 236,86-236,93, posé ≈ 237,20 : ≈ 0,33 s | Sk6r51LNFos @ 236,86-237,20 |
| Oscillation d'un postérieur (côté non vérifié) | ≈ 237,33 à ≈ 238,1 : ≈ 0,8 s | Sk6r51LNFos @ 237,33-238,1 |
| Avancée de l'antérieur éloigné | 237,60 à 237,80 | Sk6r51LNFos @ 237,60-237,80 |
| Tête | au niveau du dos à 236,8, puis sous la ligne du dos à 238,33, museau vers le drone | Sk6r51LNFos @ 236,8 et 238,33 |
| Corps | coudes de plus en plus fléchis : le corps descend au fil des pas | Sk6r51LNFos @ 236,0-238,5 |
| Queue | basse depuis la base, bout relevé en « J » | Sk6r51LNFos @ 236,0-238,5 |

Suite du même plan (Sk6r51LNFos, 15 i/s) :

| Instant | Geste |
| --- | --- |
| 238,6-239,3 | accroupi très bas, tête vers le drone |
| 239,4-240,0 | se relève |
| 240,60 | une patte avant s'allonge |
| 240,73-241,53 | la patte reste tendue et tapote (≈ 0,8 s) |

L'ordre observé (antérieur proche, postérieur, antérieur éloigné) est compatible avec une marche latérale (patte avant puis patte arrière du même côté). Comme le côté du postérieur n'est pas vérifié, ce point est non vérifié.

### 2.3 Course (4uP2MyUL49s @ 19,05-20,31, 30 i/s, lumière rouge)

| Mesure | Valeur | Source |
| --- | --- | --- |
| Silhouette étendue (antérieurs devant, postérieurs derrière) | 19,35-19,38 ; 19,75-19,78 ; 20,15-20,18 | 4uP2MyUL49s @ 19,35-20,18 |
| Silhouette groupée (pattes sous le corps) | 19,15-19,18 ; 19,55-19,58 ; 19,95-19,98 | 4uP2MyUL49s @ 19,15-19,98 |
| Période de foulée | ≈ 0,40 s, soit ≈ 2,5 foulées/s (trois cycles concordants) | 4uP2MyUL49s @ 19,15-20,18 |
| Tête | tendue vers l'avant, à peu près à la hauteur du dos | 4uP2MyUL49s @ 19,05-20,31 |
| Queue | presque horizontale derrière le corps (estimé ± 15°), bout un peu relevé, sans grand battement | 4uP2MyUL49s @ 19,05-20,31 |

- La mesure à 20 i/s (launch_run_20, 4uP2MyUL49s @ 19,05-20,70) donnait déjà la même période.
- Le même plan se trouve dans kJawWyRUOBM vers 64 s (repérage à 0,5 i/s seulement).
- À cause du flou de bougé, on ne peut pas dire si la foulée est un galop transverse ou rotatoire, ni si la silhouette étendue est en suspension.

### 2.4 Marche, arrêt, assise puis couché sphinx (4uP2MyUL49s @ 29,60-32,33, 15 i/s, trois quarts face)

| Phase | Instants | Durée | Description |
| --- | --- | --- | --- |
| Marche vers la caméra | 29,60-30,46 | - | tête un peu basse, regard vers la caméra |
| Assise | 30,53-31,00 | ≈ 0,47 s | l'arrière-train descend, les pattes avant restent tendues |
| Assis, antérieurs tendus | 31,00-31,40 | ≈ 0,4 s | tête un peu baissée vers 31,00-31,20, puis relevée |
| Coucher | 31,46-31,86 | ≈ 0,4 s | les antérieurs se plient et glissent vers l'avant, le poitrail descend |
| Installation | 31,93-32,13 | ≈ 0,2 s | une patte arrière s'allonge sur le côté (visible à gauche de l'image) |
| Maintien | 32,13 jusqu'à ≈ 36,6 | ≈ 4,5 s | la fin a été lue à 5 i/s seulement |

- Du début de l'assise à la fin de l'installation : ≈ 1,6 s (30,53 → 32,13).
- Le § 8.3 donne « assise en ~0,4 s, sphinx en ~1 s ». La mesure à 15 i/s découpe le geste plus finement : assise ≈ 0,47 s, pause assis ≈ 0,4 s, coucher ≈ 0,4 s, installation ≈ 0,2 s (4uP2MyUL49s @ 30,53-32,13).

### 2.5 Étirement : dos rond puis étirement avant (2YeUJJ4xAC4 @ 150,00-153,90, 10 i/s, silhouette de côté)

| Phase | Instants | Durée | Description |
| --- | --- | --- | --- |
| Accroupi, renifle | 150,00-150,40 | - | queue posée au sol vers l'arrière |
| Se relève | 150,50-150,69 | ≈ 0,2 s | - |
| Dos rond debout | 150,80-151,40 | ≈ 0,6 s | dos arqué ; les antérieurs avancent pas à pas ; queue relevée en crochet derrière |
| Bascule vers l'avant | 151,50-151,60 | ≈ 0,1-0,2 s | - |
| Étirement avant | 151,60-153,00 | ≈ 1,4 s | antérieurs allongés à plat, poitrail au sol, croupe haute ; ligne croupe-épaules descendant vers l'avant (estimé 30-35° sous l'horizontale) |
| Se relève, repart | 153,10-153,40 | ≈ 0,3 s | marche ensuite (153,40-153,90) |

- La queue n'est pas visible pendant l'étirement avant : elle sort du cadre à gauche.
- Le § 8.3 indique un étirement avant « tenu 2,5-3 s ». Sur ce plan, le maintien mesuré n'est que de ≈ 1,4 s (2YeUJJ4xAC4 @ 151,60-153,00). La séquence complète, du dos rond à la reprise de la marche, dure ≈ 2,6 s (150,80 → 153,40). L'écart s'explique probablement ainsi.
- La même scène se trouve dans Sk6r51LNFos vers 106-116, repérée à 0,5 i/s seulement.

### 2.6 Dos rond défensif (Sk6r51LNFos @ 174,20-178,00, 5 i/s, de face, trois quarts)

| Phase | Instants | Durée | Description |
| --- | --- | --- | --- |
| Debout | 174,20-174,80 | - | tête haute, regard droit |
| Montée du dos rond | 175,00-175,80 | ≈ 0,8 s | la tête descend, le dos monte, le corps se met de profil |
| Dos rond tenu | 175,80 jusqu'à au moins 178,00 | ≥ 2,2 s | dos en U renversé, tête basse ; queue partant vers le haut puis retombant en crochet (« S »), non hérissée |

La fin de l'extraction (178,00) coupe le maintien. Le hérissement du poil et la position des oreilles ne sont pas lisibles à cette taille.

### 2.7 Réveil (2YeUJJ4xAC4 @ 120-140, 5 i/s)

| Phase | Instants | Durée |
| --- | --- | --- |
| En boule, immobile | 120,0-136,6 | ≈ 16,6 s (aucun mouvement visible à 5 i/s) |
| Le papillon se pose | ≈ 129,2 | - |
| La tête se lève | 136,8-137,4 | ≈ 0,6 s |
| Regard alentour | 137,4-139,8 | ≈ 2,4 s |

Le § 8.3 indique « ~1 s » pour le lever de tête : la mesure ici donne ≈ 0,6 s, à ± 0,2 s. La même scène se trouve dans Sk6r51LNFos vers 82-104.

### 2.8 Toilette (2YeUJJ4xAC4 @ 163,80-166,10, 10 i/s, de dos)

| Phase | Instants | Durée | Description |
| --- | --- | --- | --- |
| Tête vers l'épaule | 163,80-164,00 | - | assis ; tête tournée vers l'épaule droite (de dos) |
| Tête baissée | 164,10-165,40 | ≈ 1,3 s | tête penchée vers le poitrail ou une patte avant ; le léchage lui-même est caché par le corps |
| Se lève et part | 165,50-166,10 | ≈ 0,6 s | la queue traîne au sol puis se soulève |

- Pendant la toilette, la queue est posée à plat au sol, vers l'arrière et le côté.
- La « patte arrière levée à la verticale » du § 8.3 n'est pas visible sur ce passage. De 160 à 163,8, le chat est trop petit à 5 i/s pour la vérifier.

### 2.9 Dressé sur les pattes arrière (2YeUJJ4xAC4 @ 69,40-70,90, 10 i/s)

| Phase | Instants | Durée | Description |
| --- | --- | --- | --- |
| Accroupi | 69,40-69,60 | - | - |
| Montée | 69,70-69,90 | ≈ 0,2 s | - |
| Dressé | 69,90-70,30 | ≈ 0,4 s | tronc presque vertical (estimé 75-90°) ; antérieurs levés au-dessus de la tête, en coups de patte dans le vide |
| Redescente | 70,40-70,50 | ≈ 0,1-0,2 s | face à l'autre chat |

- Queue pendant la phase dressée : basse vers l'arrière, avec une courbe (2YeUJJ4xAC4 @ 70,10-70,30).
- Le § 8.3 donne 1,4 s pour les coups de patte dressés ; cet extrait n'en montre qu'un épisode de ≈ 0,6 s (2YeUJJ4xAC4 @ 69,70-70,30). D'autres épisodes vers 66,8 (repérage à 5 i/s) n'ont pas été recadrés.

### 2.10 Bagarre de jeu et roulade (2YeUJJ4xAC4 @ 72,40-74,30, 10 i/s)

| Phase | Instants | Durée | Description |
| --- | --- | --- | --- |
| Sur le dos | 72,40-73,10 | ≥ 0,7 s (déjà sur le dos au début de l'extrait) | antérieurs qui battent vers le chat debout |
| Retournement | 73,10-73,30 | ≈ 0,2 s | passe sur le flanc et le ventre |
| Allongé bas | 73,30-74,30 | ≈ 1 s | corps étiré au ras du sol ; un antérieur tendu tape vers l'autre chat |

Le chat debout garde la queue horizontale, bout relevé (2YeUJJ4xAC4 @ 72,80-74,30).

### 2.11 Sauts

| Saut | Instants | Durée | Observation |
| --- | --- | --- | --- |
| Descente sur un rebord, vue de dos et d'en haut (20 i/s) | 350,75-351,00 | ≈ 0,25 s | corps étiré tête en avant |
| Reprise de la marche | 351,10-351,29 | - | aucun temps d'arrêt visible après la réception |
| Nouveau départ | 351,35-351,95 | - | se redresse vers le tuyau puis disparaît de l'autre côté |
| Saut sur une rambarde (5 i/s) | 339,4-339,8 | ≈ 0,4 s, ± 0,2 s | - |

Toutes les mesures de ce tableau viennent de 2YeUJJ4xAC4. Le chat est petit et vu de dos : l'ordre d'appel et de réception des pattes n'est pas lisible.

## 3. Compléments au § 8.3 du README

1. **Cadences.**
   - Marche de jeu : demi-cycle ≈ 0,40 s, soit un cycle d'environ 0,8 s (8R-splyERsI @ 89,00-91,45).
   - Course : foulée ≈ 0,40 s, soit ≈ 2,5 foulées/s (4uP2MyUL49s @ 19,15-20,18, 30 i/s).
   - Marche à l'affût : l'oscillation d'un antérieur dure ≈ 0,33 s ; celle d'un postérieur, ≈ 0,8 s (Sk6r51LNFos @ 236,86-238,1).
2. **Transitions découpées plus finement.** Le coucher du Launch Trailer comprend quatre temps : assise 0,47 s, pause 0,4 s, coucher 0,4 s, installation 0,2 s (4uP2MyUL49s @ 30,53-32,13). L'étirement enchaîne dos rond 0,6 s, étirement avant 1,4 s et reprise 0,3 s (2YeUJJ4xAC4 @ 150,80-153,40).
3. **Durées corrigées ou nuancées par rapport au § 8.3** :

   | Geste | § 8.3 | Mesure | Source |
   | --- | --- | --- | --- |
   | Étirement avant tenu | « 2,5-3 s » | ≈ 1,4 s (séquence entière ≈ 2,6 s) | 2YeUJJ4xAC4 @ 151,60-153,00 |
   | Lever de tête au réveil | « ~1 s » | ≈ 0,6 s | 2YeUJJ4xAC4 @ 136,8-137,4 |
   | Coups de patte dressés | « 1,4 s » | un épisode de ≈ 0,6 s | 2YeUJJ4xAC4 @ 69,70-70,30 |

4. **Port de queue selon l'allure.**

   | Allure ou geste | Port de queue | Source |
   | --- | --- | --- |
   | Marche normale | base basse (estimé 30-45° sous l'horizontale), bout relevé | 8R-splyERsI @ 89,40-90,65 |
   | Affût | basse, en « J » | Sk6r51LNFos @ 236-238,5 |
   | Course | presque horizontale | 4uP2MyUL49s @ 19,05-20,31 |
   | Dos rond (étirement) | relevée en crochet | 2YeUJJ4xAC4 @ 150,80-151,40 |
   | Dos rond défensif | en S, non hérissée | Sk6r51LNFos @ 175,8-178,0 |
   | Assis en toilette | à plat au sol | 2YeUJJ4xAC4 @ 163,8-165,4 |

5. **Port de tête.**

   | Allure ou geste | Port de tête | Source |
   | --- | --- | --- |
   | Marche normale | haute | 8R-splyERsI @ 88,9-91,55 |
   | Affût | descend progressivement sous la ligne du dos | Sk6r51LNFos @ 236,8-238,33 |
   | Course | tendue, au niveau du dos | 4uP2MyUL49s @ 19,05-20,31 |
   | Dos rond défensif | basse | Sk6r51LNFos @ 175,0-178,0 |

6. **Réception de saut sans arrêt.** Après une descente, la marche reprend dans les ≈ 0,1-0,3 s (2YeUJJ4xAC4 @ 351,00-351,29).

## 4. Compléments au tableau du § 8.4 (écarts avec notre prototype)

Ces lignes indiquent ce qu'il faudrait viser pour se rapprocher de *Stray*. L'état de notre chat n'a pas été relu dans le code pour ce rapport : la colonne de droite reprend la formulation du § 8.4 ou reste vide.

| Stray (mesure, source) | Notre chat | Cible proposée |
| --- | --- | --- |
| Coucher en 4 temps : 0,47 / 0,4 / 0,4 / 0,2 s (4uP2MyUL49s @ 30,53-32,13) | bascule directe (§ 8.4) | clips séparés « assise » ≈ 0,5 s et « sphinx » ≈ 0,4 s, une pause de ≈ 0,4 s entre les deux, puis une patte arrière qui glisse |
| Marche de jeu : cycle ≈ 0,8 s, tête haute, queue basse au bout relevé (8R-splyERsI @ 89,0-91,45) | non relu | régler la vitesse du clip de marche pour un cycle d'environ 0,8 s ; la queue n'est pas verticale |
| Course : foulée ≈ 0,40 s, queue horizontale (4uP2MyUL49s @ 19,15-20,18) | non relu | clip de course à ≈ 2,5 foulées/s ; queue à l'horizontale |
| Affût : corps et tête qui descendent progressivement, antérieur ≈ 0,33 s (Sk6r51LNFos @ 236-238,5) | non relu | variante lente de la marche, coudes fléchis, tête sous le dos |
| Étirement : dos rond 0,6 s, étirement avant 1,4 s (2YeUJJ4xAC4 @ 150,8-153,4) | aucun filler (§ 8.4) | filler d'inactivité d'environ 2,5 s au total |
| Réveil : tête levée en ≈ 0,6 s, regard alentour ≈ 2,4 s (2YeUJJ4xAC4 @ 136,8-139,8) | non relu | transition du sommeil vers l'état éveillé |

## 5. Non observé / non vérifié

- **Trot.** Il n'a été identifié sur aucun plan regardé.
- **Ordre complet des quatre appuis.** Il n'est établi pour aucune allure : en marche de jeu, la gauche et la droite ne se distinguent pas (8R-splyERsI @ 88,9-91,55) ; à l'affût, le côté du postérieur n'est pas vérifié (Sk6r51LNFos @ 237,33-238,1).
- **Type de galop** (transverse ou rotatoire) et phase de suspension en course : non déterminés à cause du flou (4uP2MyUL49s @ 19,05-20,31).
- **Vitesse réelle en jeu.** Les vidéos peuvent être montées ou ralenties ; aucune mesure ici ne garantit la vitesse de l'animation en jeu.
- **Angles.** Ce sont des estimations à l'œil (± 15° environ), sans grille ni mesure de pixels.
- **Toilette avec la patte arrière levée** (§ 8.3) : non revue. La séquence regardée (2YeUJJ4xAC4 @ 163,8-166,1) ne la montre pas.
- **Roulade, durée totale sur le dos.** Le chat est déjà sur le dos au début de l'extrait (72,40) ; seul le minimum de 0,7 s est connu.
- **Plans non retravaillés au-delà du repérage à 0,5 i/s ou 5 i/s** :
  - assise du teaser (u84hRUQlaio vers 80-86) ;
  - marche puis assise dans kJawWyRUOBM vers 30-32 ;
  - marche de côté 2YeUJJ4xAC4 vers 284-290 ;
  - plan 2YeUJJ4xAC4 @ 216,4-218,8, inutilisable (chats coupés en bas de l'image).
- **Fin des maintiens** : sphinx jusqu'à ≈ 36,6 (lu à 5 i/s seulement) ; dos rond défensif au-delà de 178,0 (non extrait).
- **Respiration pendant le sommeil** : aucun mouvement visible à 5 i/s (2YeUJJ4xAC4 @ 120-136,6). Une respiration plus fine n'est pas exclue.
- **Nom de la chaîne de 2YeUJJ4xAC4** (MKIceAndFire selon le README) : non vérifié.
- **Son** : aucune piste audio n'a été téléchargée.
- **État actuel de notre chat** (`src/cat/`, `tools/anim_cat.py`) : non relu pour ce rapport.

## 6. Sources

Vidéos YouTube regardées (titres lus dans les métadonnées de yt-dlp) :

| Identifiant | Titre | Partie téléchargée |
| --- | --- | --- |
| `4uP2MyUL49s` | « STRAY \| Launch Trailer » | entière, 46,80 s |
| `u84hRUQlaio` | « Stray - Teaser Trailer \| PS5 » | entière, 111,98 s ; repérage seulement |
| `8R-splyERsI` | « STRAY \| Gameplay Walkthrough » | entière, 269,73 s |
| `2YeUJJ4xAC4` | « STRAY Gameplay Walkthrough Part 1 FULL GAME [4K 60FPS PS5] - No Commentary » | 0-720 s |
| `Sk6r51LNFos` | « Stray - ALL CUTE CAT MOMENTS - Everyone Loves the Stray Cat! » | 0-360 s |
| `kJawWyRUOBM` | « Stray Gameplay Trailer \| Sony State of Play June 2022 » | entière, 94,49 s ; repérage seulement |

Adresse de chaque vidéo : `https://www.youtube.com/watch?v=<identifiant>`.

- Document interne : `Lost/README.md`, § 8.1-8.4 (lignes 164-220), lecture seule.
- Aucune source web écrite n'a été consultée pour ce rapport.
