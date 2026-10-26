# Recherche : le chat de référence (mission chat_recherche, 2026-10-22)

Index écrit par le chef de projet après vérification des cinq rapports. Les chiffres ci-dessous sont repris des rapports, qui citent chacun sa source ; ce fichier ne contient aucun chiffre nouveau.

## Rapports

| Fichier | Agent | Contenu |
| --- | --- | --- |
| comportement.md | A1 | Revue de littérature en éthologie féline : développement, jeu, signaux (queue, oreilles, pupilles, moustaches), contact humain et zones de caresse, séquences typiques. |
| proportions_litterature.md | A2 | Rapports sans unité tirés de publications vétérinaires (membres, tête vivante, crâne), chaton / adulte, SMAL (non exploitable), ce que la littérature ne donne pas. |
| proportions_mesures.md | A3 | Mesures par script sur le CAT Dataset (9 997 têtes, 6 836 de face) : yeux, truffe, oreilles, en unités d'écart des yeux ; script en annexe. |
| mouvement_stray.md | A4 | Le chat de *Stray* image par image : marche, course, assise, sphinx, étirement, réveil, toilette, sauts ; compléments aux § 8.3-8.4 du README du projet. |
| mouvement_reels.md | A5 | Vrais chats filmés : appuis de la marche, assise, sphinx, roulade, toilette, étirement, réveil ; comparaison ligne à ligne avec les clips de tools/anim_cat.py. |

## Ce que la mission B devra corriger en priorité

Synthèse du chef (sélection et ordre de priorité = proposition ; les valeurs et leurs limites sont dans les sections citées).

1. **Mesurer d'abord le modèle.** Aucun rapport n'a mesuré le modèle 3D : chaque comparaison commence par relever les mêmes rapports sur le modèle, avant et après `reshape()` (proportions_mesures.md § 5 ; proportions_litterature.md § 5).
2. **Oreilles (`EAR_SCALE`, position).** Cibles de face en écart des yeux : hauteur d'oreille 0,983, base 0,830, pointes écartées de 2,511 et à 1,589 au-dessus des yeux, inclinaison 26,8° (proportions_mesures.md § 4.1-4.2) ; pavillon externe / largeur de tête 0,78 (proportions_litterature.md § 1.2).
3. **Yeux (`EYE_SCALE`).** Écart des pupilles / largeur de tête 0,54 (proportions_litterature.md § 1.2) ; la taille de l'œil n'a pas de mesure directe sur photos (proportions_mesures.md § 6) : grossir l'œil reste un choix de style, à mesurer après `reshape()` (proportions_mesures.md § 5).
4. **Museau et bas de la face (`MUZZLE`, `CHIN`).** Bas de la truffe à 0,785 écart des yeux sous la ligne des yeux, de face (proportions_mesures.md § 4.1) ; de profil, seul substitut osseux : longueur faciale / crâne 0,387 (proportions_litterature.md § 1.3 et § 4).
5. **Membres.** L'arrière osseux est ≈ 12 % plus long que l'avant (indice intermembral 0,89) ; rapports segment / garrot au § 1.1 de proportions_litterature.md.
6. **Coucher.** Notre Lie (0,9 s) est plus court que le réel (≈ 1,5 à 2,5 s, mouvement_reels.md § 4-5) ; *Stray* découpe en quatre temps 0,47 / 0,4 / 0,4 / 0,2 s (mouvement_stray.md § 2.4 et § 4).
7. **Marche.** Ordre latéral correct, mais l'avant suit l'arrière du même côté à 0,14-0,16 cycle au lieu de 0,25, facteur d'appui réel 0,61-0,73 contre 0,6 (mouvement_reels.md § 2 et § 10) ; cycle *Stray* ≈ 0,8 s, queue basse au bout relevé en marche de jeu, dressée chez le chat réel filmé (mouvement_stray.md § 2.1 ; mouvement_reels.md § 2).
8. **Roulade et caresses.** Bascule réelle ≈ 0,4 s contre 0,8 s par palier, pas de pédalage observé (mouvement_reels.md § 6 et § 10) ; ventre et base de la queue sont des zones à éviter, tête et joues des zones positives, signaux de gêne listés (comportement.md § 4.2 et § 4.4).
9. **Toilette.** Coup de langue réel ≈ 0,45-0,5 s contre 0,3 s (mouvement_reels.md § 7) ; une toilette brève pendant une caresse se lit comme un signal de gêne (comportement.md § 4.4).
10. **Étirement et réveil.** Étirement réel plus vif à l'entrée et au retour, queue non dressée (mouvement_reels.md § 8) ; *Stray* : dos rond 0,6 s puis étirement avant 1,4 s (mouvement_stray.md § 2.5) ; réveil par la tête (≈ 0,6-0,7 s) puis bâillement, sans se lever aussitôt (mouvement_reels.md § 9 ; mouvement_stray.md § 2.7).
11. **Trot.** Aucun clip ni aucune mesure de trot dans les rapports (mouvement_reels.md § 3 ; mouvement_stray.md § 5).

## Limites communes

- Âge des sujets rarement à ~2 ans (proportions_litterature.md § 4 ; proportions_mesures.md § 6 ; mouvement_reels.md § 1).
- Vitesse réelle des vidéos non attestée : préférer les rapports de phase aux durées absolues (mouvement_reels.md § 1 ; mouvement_stray.md § 1).
- Angles estimés à l'œil, ± 10 à 15° (mouvement_reels.md § 1 ; mouvement_stray.md § 1).
- Plusieurs sources lues en résumé seulement ; chaque rapport le signale dans sa section « Sources ».
