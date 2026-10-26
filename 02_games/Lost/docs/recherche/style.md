# Direction artistique : « dessin animé doux », cosy et mignon

Mission `2026-10-25_catgame_style`, agent S, 2026-10-25. Code associé : `src/style/palette.js` (couleurs et réglages partagés).

## 1. Demande et constat

Retours de l'utilisateur (recopiés) :
- « le style graphqiue général est vraiement laid et ne donne pas envie » ; choix : « Dessin animé doux » (ombrage en aplats, couleurs pastel, herbe en touffes stylisées, ciel peint).
- « je veux que ça soit mignon hein, le style doit être vraiment cosy mignon » : **critère premier**. Rendu chaleureux, rond, doux, attendrissant ; tout ce qui est froid, anguleux, réaliste ou sombre est écarté.
- « l'herbe c'est cata » ; défaut : « Laide, aspect de pics ».

Constat sur les captures « avant » du jeu réel (`.shots/2026-10-25_style_avant_{depart,lointaine,papouilles,papillon,pelote}.png`, prises par le chef, ouvertes par S) :
- herbe : brins en lame terminés par une pointe unique (`Grass.js`, `bladeGeometry` : un seul sommet au sommet), larges au premier plan : on voit des pics et des « crocs » verts ; teintes olive, kaki et paille (`GREENS`, `STRAW`) qui donnent une prairie sèche et terne ; pied des brins assombri à 0,32 ;
- sol olive sombre (`#55632f` au bord) ;
- ciel uni bleu gris `0xc9dcec`, brouillard de la même couleur : l'horizon est une ligne nette sans chaleur ;
- ombre portée du chat gris-vert foncé (capture papillon) ;
- papillons et pelote saturés (orange monarque à bord noir, rouge `0xe8344e`) qui jurent avec le reste ;
- HUD : bandeau blanc rectangulaire, texte bleu nuit, police système 13 px : utilitaire, pas mignon ;
- chat : noir lisible, mais sa silhouette se perd sur l'herbe sombre au pied.

## 2. Références

Ouvertes (lecture effective de la page, 2026-10-25) :

| Réf. | Source | Ce qu'on en retient |
|---|---|---|
| [R1] | [three.js, MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html) | `gradientMap` = rampe des paliers ; « It's required to set Texture#minFilter and Texture#magFilter to NearestFilter » ; la rampe est une donnée (`NoColorSpace`). |
| [R2] | [three.js, exemple webgl_materials_toon (source)](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_toon.html) | Rampe créée en mémoire : `DataTexture(colors, n, 1, RedFormat)`, 2 à 7 paliers ; contours par `OutlineEffect` (rendu de toute la scène une seconde fois). |
| [R3] | [three.js, exemple webgl_lights_hemisphere (source)](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_lights_hemisphere.html) | Ciel = sphère `BackSide` avec `ShaderMaterial` : `mix(bottomColor, topColor, pow(max(h, 0), exponent))` ; brouillard de la couleur du bas du ciel ; HemisphereLight au sol chaud. |
| [R4] | [Roystan, Toon Shader](https://roystan.net/articles/toon-shader/) | « Breath of the Wild divides surfaces into two bands of lightness, adding rim and specular on top » ; lumière ambiante ajoutée pour que le côté sombre ne soit pas noir ; liseré limité au côté éclairé. |
| [R5] | [Wikipedia, Cel shading](https://en.wikipedia.org/wiki/Cel_shading) | Éclairage « quantized to a small number of discrete shades » ; contour par coque inversée (faces arrière agrandies le long des normales, dessinées d'une couleur unie). |
| [R6] | [Trung Duy Nguyen, Blender anime foliage pipeline](https://trungduyng.substack.com/p/tutorial-blender-anime-foliage-pipeline) | Feuillage en cartes groupées, **normales transférées depuis une sphère** puis buisson « gonflé », cel shader : la touffe s'ombre comme une boule douce et non brin par brin. |
| [R7] | [PlayStation Blog, A Short Hike (Adam Robinson-Yu)](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/) | « flat cohesive shading » ; « I added a soft outline effect to objects to help them stand out » ; peu de détails, l'imagination complète. |
| [R8] | [Godot Asset Store, Stylized Procedural Sky (emace-art)](https://store.godotengine.org/asset/emace-art/stylized-procedural-sky/) | Ciel stylisé = dégradé horizon → zénith + disque solaire avec halo + nuages en paliers ; préréglage « warm dusk ». Référence de conception seulement (asset propriétaire, rien n'est repris). |
| [R9] | [three.js forum, SkyShader : changer les couleurs](https://discourse.threejs.org/t/skyshader-example-how-to-change-colors/7907) | Le `Sky` de three.js « is calculating light ABSORPTION from the atmosphere, not the RGB value of the light » : couleurs réglables seulement par essais sur des constantes physiques. |
| [R10] | [three.js, Fog](https://threejs.org/docs/pages/Fog.html) | Brouillard linéaire `color`, `near`, `far`. |
| [R11] | [Khronos, PBR Neutral tone mapping](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md) | « For all input colors, there are no hue shifts » ; couleur de base reproduite à l'identique entre 0,08 et 0,8. |
| [R12] | [three.js forum, Simple instanced grass example](https://discourse.threejs.org/t/simple-instanced-grass-example/26694) | Herbe instanciée + vent au vertex shader (la page ne donne pas de valeurs ; c'est déjà la technique de `Grass.js`). |

Sources locales lues (paquet `three` 0.186.1 de `node_modules`, version lue dans son `package.json`) :
- `src/renderers/shaders/ShaderChunk/gradientmap_pars_fragment.glsl.js` : coordonnée de rampe `dotNL * 0.5 + 0.5` ; sans `gradientMap`, deux paliers fixes 0,7 / 1,0. Avec une rampe de n texels, l'axe −1…1 de `dotNL` est coupé en n parts égales.
- `lights_toon_pars_fragment.glsl.js` et `lights_fragment_begin.glsl.js` : seule la lumière directe passe par la rampe ; la HemisphereLight s'ajoute en continu (c'est elle qui colore les ombres).
- `fog_fragment.glsl.js` : `fogFactor = smoothstep(fogNear, fogFar, vFogDepth)`.
- `constants.js` : `NeutralToneMapping = 7`, `AgXToneMapping = 6`, `ACESFilmicToneMapping = 4`.
- `examples/jsm/effects/OutlineEffect.js` : contour noir par défaut (`defaultColor [0, 0, 0]`), épaisseur 0,003, rendu de la scène en seconde passe.
- `ShaderLib/meshbasic.glsl.js` : `objectNormal` n'existe qu'avec envMap ou skinning (d'où l'usage de `normal` dans `outlineMaterial`).

Connues seulement par un résultat de recherche (page non ouverte ou refusée, HTTP 403) :
- [S1] Codrops, « How to Make The Fluffiest Grass With Three.js » (`https://tympanus.net/codrops/?p=83092`, 403) : cartes d'herbe à alpha, deux couleurs mélangées sur la hauteur, vent sinus + bruit.
- [S2] Polycount, fils sur le feuillage « soft normal » et Breath of the Wild (`https://polycount.com/discussion/comment/2717475`, 403) : normales éditées pour éviter des changements brusques d'ombrage selon l'orientation des cartes.
- [S3] Inasa Fujio, « Stylized Tree tutorial » (Patreon) : normales sphériques mélangées à ~0,8.
- [S4] criticalvideogamestudies.com sur A Short Hike : rendu basse résolution, palette « warm tones » prélevée sur des photos d'automne.

## 3. Principes retenus

1. **Aplats doux** : `MeshToonMaterial` à 3 paliers (rampe `toonGradient(3)` = 0,5 / 0,78 / 1,0 de la lumière du soleil) [R1][R2][R4][R5]. Les ombres ne descendent jamais au noir : la HemisphereLight (ciel bleu clair, sol doré) remplit le côté ombré en continu, donc une face à l'ombre garde sa couleur, en plus doux.
2. **Formes rondes** : pas de pointe, pas d'arête vive dans le décor. Herbe en touffes arrondies (§ 5), fleurs à pétales ronds, pelote sans fil saillant, papillons à ailes arrondies.
3. **Lumière dorée** de fin d'après-midi : soleil pêche-doré, contre-jour chaud (plus de bleu froid), horizon pêche.
4. **Peu de détail, grandes masses** [R7] : moins de variation de teinte par brin (±4 à 6 %), dégradés réguliers. Le bruit fin (stries, paille aléatoire) disparaît.
5. **Pastel mais pas délavé** : saturation moyenne, luminosité haute ; les couleurs vives restent pour les centres d'intérêt (pelote, papillons, yeux du chat).
6. **Matériaux simples** (rendu logiciel à 1-2 i/s dans le navigateur de test) : toon ou basic, aucun post-traitement, pas d'`OutlineEffect` global (il redessine toute la scène, herbe comprise) [R2].

## 4. Palette (hexadécimal sRGB, valeurs exportées par `palette.js`)

| Usage | Nom dans `palette.js` | Hex |
|---|---|---|
| Ciel, zénith | `SKY.top` | `#8ec5ee` |
| Ciel, mi-hauteur | `SKY.mid` | `#cfe7f7` (correction 1 ; `#c4e2f5` avant) |
| Ciel, rose pêche au-dessus de l'horizon | `SKY.blush` | `#ffe2d8` (ajouté, correction 1) |
| Ciel, horizon (pêche) | `SKY.horizon` | `#ffe9cc` |
| Halo du soleil | `SKY.sunGlow` | `#fff3c4` |
| Brouillard (8 → 34 m) | `FOG.color` = `SKY.horizon` | `#ffe9cc` (correction 1 ; `#f6e6cc` avant) |
| Fond de page | `RENDER.background` | `#ffe9cc` |
| Soleil (intensité 2,2) | `LIGHT.sun.color` | `#ffe0b0` |
| Ambiance, ciel (1,1) | `LIGHT.hemiSky` | `#d8e9ff` |
| Ambiance, sol | `LIGHT.hemiGround` | `#e0c48e` |
| Contre-jour (0,5) | `LIGHT.rim.color` | `#ffd6a8` |
| Ombre portée, teinte de référence | `SHADOW.tint` | `#8a7fae` (mauve doux, jamais noir ; intensité 0,55) |
| Sol, centre (clairière) | `GROUND.center` | `#b7d97a` |
| Sol, bord | `GROUND.edge` | `#93c066` |
| Herbe, pied | `GRASS.base` | `#6fae5c` |
| Herbe, milieu | `GRASS.mid` | `#96cc68` |
| Herbe, pointe | `GRASS.tip` / `GRASS.tips` | `#c9e47e` / `#c4e584`, `#cfeb94`, `#b2dc7e` (correction 1, moins jaunes ; avant `#c9e47e`, `#d8ea8c`, `#b9dc78`) |
| Herbe, pointe claire (rare) | `GRASS.warmTip` | `#e3eaa2` (correction 1 ; `#eee39a` avant) |
| Tige / feuille | `FLOWERS.stem` / `.leaf` | `#7fb562` / `#8cc46e` |
| Marguerite, pétales / cœur | `FLOWERS.daisyPetal` / `.daisyHeart` | `#fffaf0` / `#ffcf5a` |
| Coquelicot (corail) / cœur | `FLOWERS.poppy` / `.poppyHeart` | `#ff9e8a` / `#7a5a52` |
| Bleuet (pervenche) / bouton | `FLOWERS.cornflower` / `.cornflowerBud` | `#9fb6ff` / `#8fae7a` |
| Bouton d'or / cœur | `FLOWERS.buttercup` / `.buttercupHeart` | `#ffe27a` / `#f2c25a` |
| Lavande / clair | `FLOWERS.lavender` / `.lavenderLight` | `#c8a8ec` / `#dcc4f4` |
| Trèfle rose (option) | `FLOWERS.clover` | `#ffb6cc` |
| Papillon monarque, base / bord | `BUTTERFLIES.monarque` | `#ffb27a` / `#e2846a` |
| Papillon citron | `BUTTERFLIES.citron` | `#fff08e` / `#ffc860` |
| Papillon azuré | `BUTTERFLIES['azuré']` | `#a9d8ff` / `#7ea8e6` |
| Papillon piéride rose | `BUTTERFLIES['piéride rose']` | `#ffe6ef` / `#ff9fc2` |
| Papillon, corps / antennes | `BUTTERFLIES.body` / `.antenna` | `#6e584a` / `#5a463a` |
| Pelote, base / clair / foncé | `YARN.base` / `.light` / `.dark` | `#ff8fa6` / `#ffc4cf` / `#e0687f` |
| Fil de la pelote | `YARN.trail` | `#e9768d` |
| Chat, robe (noir chaud) | `CAT.coat` | `#2a2320` |
| Chat, pointes des poils | `CAT.tip` | `#5c4536` |
| Chat, liseré de contre-jour (force 0,38) | `CAT.sheen` | `#ffd9a8` |
| Yeux, iris centre / bord / cercle | `CAT.eyeIrisIn` / `.eyeIrisOut` / `.eyeRing` | `#eef27e` / `#7cc24e` / `#3b2a1e` |
| Contour (coque inversée, 4 mm) | `OUTLINE.color` | `#5a4436` |
| HUD, fond | `HUD.background` | `rgba(255, 248, 236, 0.9)` |
| HUD, texte | `HUD.text` | `#5a4335` |
| HUD, accent (bouton) | `HUD.accent` | `#ff9f7a` |
| HUD, bordure | `HUD.border` | `#f2d6b8` |

## 5. Règles par sujet

### Ombrage
- Décor : `toonMaterial(hex, { vertexColors, side, steps })` ; 3 paliers par défaut, 2 pour les très petits objets (papillons) si le dessin est plus lisible.
- Pas de `roughness` / `metalness` (le toon n'en a pas) ; pas de `MeshStandardMaterial` dans le décor.
- Ombres portées : seulement celles du chat et de la pelote sur le sol et la couche d'herbe proche (déjà le cas) ; ombre douce et claire grâce à l'ambiance forte. Pas de noir pur nulle part (`0x000000` interdit, minimum `#2a2320` pour le chat).
- Tone mapping : `THREE.NeutralToneMapping`, exposition 1,0 [R11] (préserve la teinte des pastels). Hypothèse non mesurée : l'ACES actuel ternit et décale les pastels ; à juger sur capture avant/après.

### Ciel (phase 2, S, `World.js`)
- Sphère intérieure (rayon ~150 m, sous le `far` 200 de la caméra), `ShaderMaterial` `BackSide`, `fog: false`, `depthWrite: false`, centrée sur la caméra chaque image [R3].
- Quatre arrêts depuis la correction 1 : `SKY.horizon` (h ≤ 0,02) → `SKY.blush` (h ≈ 0,16) → `SKY.mid` (h ≈ 0,38) → `SKY.top` (h ≈ 0,95), transitions lisses. Le mélange direct pêche → bleu passait par un gris beige terne (capture « lointaine » du chef). Le ciel n'est pas soumis au tone mapping : dans three 0.186, le brouillard est mélangé après le tone mapping et la conversion sRGB (ordre `tonemapping_fragment`, `colorspace_fragment`, `fog_fragment` dans les shaders Lambert, toon et physique), donc l'horizon tone-mappé ne donnait pas le même pixel que le brouillard : ligne nette. Halo `SKY.sunGlow` autour de la direction du soleil (pow du cosinus, large et pâle). Pas de disque net, pas de nuages en phase 2 (option : 2-3 nuages ronds en aplats si le temps le permet).
- Le `Sky` physique de three.js est écarté [R9].

### Brouillard
- `THREE.Fog(FOG.color, 8, 34)` : couleur identique à `SKY.horizon` (correction 1), donc l'herbe lointaine se fond dans le bas du ciel sans ligne de coupure [R3][R10].

### Lumière
- `DirectionalLight(LIGHT.sun.color, 2.2)` à `(4, 5, 3)` du chat (inchangé en direction) ; `HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, 1.1)` ; contre-jour `LIGHT.rim` chaud à 0,5 au lieu du bleu `0xbfd4ff`.
- Valeurs de départ : à ajuster sur captures (l'équilibre soleil / ambiance décide si les aplats se lisent).
- Appliqué en phase 2 (`World.js`) : ombre du soleil `shadow.intensity = SHADOW.intensity` (0,55) et `shadow.radius = 4` (bord flou du filtre PCF, 5 échantillons dans three 0.186). La teinte des ombres vient de l'hémisphère (seule lumière dans l'ombre) ; `SHADOW.tint` n'est pas appliqué par un shader dédié. Sol : `MeshLambertMaterial` mat avec dégradé `GROUND.center` → `GROUND.edge` (pas de toon : un sol plat n'a qu'une valeur de `dotNL`, la rampe n'y changerait rien).

### Chat (phase 2, S, `Fur.js` et `Eyes.js`)
- Reste noir, lisible et doux : robe `CAT.coat`, pointes `CAT.tip`, liseré `CAT.sheen` (doré) à 0,38 au lieu du gris 0,3 actuel : la silhouette se détache de l'herbe verte.
- Yeux : iris plus lumineux (`eyeIrisIn`, `eyeIrisOut`), cercle et coin d'œil bruns (`eyeRing`) au lieu de presque noir ; reflets inchangés (ils font « attendrissant »).
- Le chat garde `MeshStandardMaterial` (fourrure en coques, déjà réglée) : pas de toon sur la fourrure.
- Correction 2 (2026-10-26, captures « final » : silhouette noir brun uniforme, bord bruité) : lumière de pelage ajoutée en émissif sur la peau de base et sur toutes les coques (`Fur.js`, `coatLight`). Elle comprend un aplat gris-brun `CAT.coatLit` × 0,45 côté soleil, plus marqué sur le dos et la tête, et un liseré pêche `CAT.sheen` × 0,6 sur les contours (fort côté soleil, à 30 % à l'ombre). Les poils sont moins effilés et leurs hauteurs moins dispersées (`HEIGHT_MIN` 0,7, `TIP_TAPER` 0,7), pour que les coques extérieures ne fassent plus de points épars. Le chat reste noir.
- Yeux mi-clos (phase 2) : le rig n'a pas d'os de paupière ; `Eyes.setLid(t)` (0 ouvert, 1 fermé) fait descendre devant le globe une paupière procédurale couleur `CAT.coat`, mate, au bord en arc et liseré brun, sans reflet ; pour les papouilles (« contentement »), environ 0,5-0,7.

### Interface (phase 2, S, `index.html`)
- Pastilles arrondies (`HUD.radius` 18 px), fond crème, texte brun chaud, police arrondie système (`HUD.font`, aucune police téléchargée), ombre douce ; bouton pelote en `HUD.accent` arrondi.
- Fond de page `RENDER.background`.
- Appliqué en phase 2 : le HUD de `main.js` est une seule longue ligne ; il passe à la ligne dans une largeur bornée (360 px au plus) en haut à gauche, pour laisser le centre (le chat) libre. Bouton pelote : pêche clair `#ffc9a8`, texte `HUD.text`, en pilule ; écart à `HUD.accent` / `HUD.accentText` parce que le blanc sur `#ff9f7a` ne contraste qu'environ 2,0:1, contre environ 6,2:1 pour `#5a4335` sur `#ffc9a8` (formule de luminance relative WCAG calculée à la main, sans outil). Il est créé par `main.js` avec un style en ligne : `index.html` le restyle par `body > button` avec `!important`.

## 6. Consignes pour B (herbe et fleurs, `src/world/`)

But : **plus aucun pic**. L'herbe devient une moquette de touffes rondes et moelleuses, comme dans un dessin animé.

1. **Forme d'une touffe** (remplace le brin à pointe unique de `bladeGeometry`) : une touffe = 3 à 5 « feuilles » larges disposées en éventail autour d'un pied commun, chacune **à bout arrondi** (le sommet unique est remplacé par un arc de 3 à 5 sommets, demi-cercle ou ogive très ronde) et nettement plus large que les brins actuels (rapport largeur/hauteur ≥ 0,35 au milieu). Les feuilles s'écartent vers l'extérieur et retombent un peu (courbure), ce qui arrondit la silhouette de la touffe. Variante acceptable : carte en forme de « nuage » (contour festonné de 3 lobes ronds), une par touffe, deux plans croisés.
2. **Normales arrondies** [R6][S2][S3] : normale de chaque sommet = mélange (~0,7) de la direction du centre de la touffe (légèrement sous le sol) vers le sommet, et de la verticale. La touffe s'ombre alors comme une boule (côté soleil clair, côté opposé en palier moyen), au lieu de faces qui clignotent selon leur angle.
3. **Couleurs** : dégradé par sommet `GRASS.base` (pied) → `GRASS.mid` (40 %) → pointe tirée dans `GRASS.tips` ; 1 touffe sur 8 environ à `GRASS.warmTip` (remplace `STRAW`). Variation par touffe `jitter(hex, 0.05, rand)`, pas plus. Pied à 0,32 de luminosité supprimé : le pied est `GRASS.base`, déjà assez soutenu pour donner de la profondeur.
4. **Matériau** : `toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide })` ; les `onBeforeCompile` actuels (vent, couloir, cuvette, normale non inversée) restent valables (mêmes morceaux de shader dans le toon).
5. **Échelle et jeu inchangés** : herbe plus haute que le chat loin de lui, clairière au départ, cuvette du chat, couloir caméra → chat, vent, crans de qualité. Moins d'instances acceptées si chaque touffe couvre plus (viser au plus le nombre de triangles actuel, ≈ 430 000, et le noter dans la fiche B).
6. **Sol** : la couleur au pied des touffes doit raccorder au sol `GROUND` (S règle le sol dans `World.js` en phase 2 ; B n'y touche pas).
7. **Fleurs** (`Flowers.js`) : mêmes formes, couleurs de `FLOWERS` (coquelicot corail, bleuet pervenche, cœurs bruns doux au lieu de `#2b2420`), pétales plus ronds si possible, `toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide })`.

Fonctions à importer : `import { GRASS, FLOWERS, toonMaterial, color, jitter, mix } from '../style/palette.js';`

## 7. Consignes pour C (papillons et pelote, `src/critters/`)

1. **Papillons** (`Butterfly.js`) : couleurs `BUTTERFLIES[species.name]` (`base`, `edge`) à la place de `SPECIES[].base/edge` ; plus de bord noir (`0x1c0c04`) ; racine d'aile = `base` éclaircie plutôt qu'assombrie (`mix(base, 0xffffff, 0.2)` au lieu de `×0,55`). Corps `BUTTERFLIES.body`, antennes `BUTTERFLIES.antenna`. Matériau des ailes : `toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide, steps: 2, emissive: base, emissiveIntensity: 0.15 })` (léger éclat pour rester lisibles sur l'herbe). Ailes au contour arrondi (les points de `FORE` / `HIND` peuvent être arrondis aux angles).
2. **Pelote** (`Yarn.js`) : couleur par défaut `YARN.base`, tours de fil `YARN.light` / `YARN.base` / `YARN.dark`, fil `YARN.trail`. Matériau `toonMaterial(0xffffff, { vertexColors: true })`. Tours de fil un peu plus épais (rayon du tube ≥ 0,09 × rayon) pour un aspect moelleux. Option : contour `outlineMaterial()` sur une copie du maillage de la pelote (petit objet, coût faible) ; le juger sur capture et le retirer s'il durcit le rendu.

Fonctions à importer : `import { BUTTERFLIES, YARN, toonMaterial, outlineMaterial, mix, color } from '../style/palette.js';`

## 8. Écarté, et pourquoi

| Écarté | Raison |
|---|---|
| Brins en lame à pointe unique, paille, olive | Défaut nommé par l'utilisateur (« aspect de pics ») ; teintes sèches = pas cosy. |
| `Sky` physique de three.js | Couleurs issues d'un calcul d'absorption, réglables seulement par essais [R9] ; rendu réaliste, contraire au choix. |
| `OutlineEffect` sur toute la scène | Seconde passe de toute la scène (herbe comprise) [R2] : coût double en rendu logiciel ; contour noir par défaut, trop dur. Contour limité aux petits objets, brun chaud. |
| Rendu pixelisé à la *A Short Hike* | Il sert la lisibilité à basse résolution [R7] ; ici le chat à fourrure fine en souffrirait. On garde de ce jeu l'ombrage plat cohérent et la palette chaude [S4]. |
| Noir pur, ombres gris-vert foncé, contre-jour bleu froid | Contraire au critère « cosy mignon » ; ombres colorées par l'ambiance chaude à la place. |
| Post-traitement (bloom, flou, grain) | Coût en rendu logiciel ; non nécessaire pour l'effet voulu. |
| Polices ou textures téléchargées | Interdit par l'ordre de mission (aucun téléchargement, aucune dépendance). |
| Toon sur la fourrure du chat | Les coques de fourrure reposent sur `MeshStandardMaterial` et un liseré réglé avec l'utilisateur ; le passer en toon casserait le volume. On ne change que ses couleurs. |

## 9. Limites

- Aucune de ces valeurs n'a encore été vue dans le jeu : elles sont un point de départ à juger sur les captures « après » du chef (Playwright, rendu SwiftShader).
- Les intensités de lumière et les paliers de la rampe dépendent du tone mapping choisi ; ils seront retouchés en phase 2 au vu des captures.

## 10. Tiny Glade (mission catgame_monde, 2026-10-26, agent S)

But : en s'inspirant de Tiny Glade (Pounce Light, sorti le 23/09/2024), guider l'herbe, la pierre, les murs, les collines et les montagnes. Rien n'est copié : pas d'asset, pas de texture, pas de modèle, et le jeu installé n'a pas été lu. Le critère premier reste le « dessin animé doux », cosy et mignon (§ 1 et § 3).

### Sources

Vidéos publiques regardées image par image dans Playwright. Les captures sont dans /home/Axou/Axou/02_games/Lost/.shots/refs_tinyglade/ (nom `tg_<source>_<mm>m<ss>.png`).

| Code | Source | Lien |
|---|---|---|
| V1 | Tomasz Stachowiak (développeur), « Rendering Tiny Glades With Entirely Too Much Ray Marching », Graphics Programming Conference 2024, 59:20 | https://www.youtube.com/watch?v=jusWW2pPnA0 |
| V2 | Digital Foundry, « Tiny Glade PC - Beautiful RT Visuals - 60FPS on a GTX 1060! », 12:46 | https://www.youtube.com/watch?v=cvswAg5Lrtw |
| V3 | Ana & Tom (les créateurs), « Tiny Glade dev plays Tiny Glade Demo », 32:20 | https://www.youtube.com/watch?v=y579pGbhf-s |
| V4 | Ana & Tom, « Tiny Glade - Game Announcement Trailer », 0:56 | https://www.youtube.com/watch?v=E2429O4h4Fk |
| V5 | GameTrailers, « Tiny Glade - Official Trailer \| gamescom 2023 », 1:10 | https://www.youtube.com/watch?v=QAUSBxxgIbQ |
| A1 | 80.lv, entretien avec Anastasia Opara et Tomasz Stachowiak, 30/05/2024 | https://80.lv/articles/exclusive-tiny-glade-developers-discuss-bevy-proceduralism-publishers-cozy-games |

Teintes relevées : couleurs dominantes des captures, comptées par PowerShell System.Drawing (un pixel sur 6, regroupement par 16 niveaux par canal). Ce sont des images vidéo compressées, souvent en contre-jour : elles sont plus sombres et plus ternes que le jeu. Elles donnent des familles de teintes, pas des valeurs à reprendre telles quelles.

### Herbe

- **V3 08:30** (`tg_dev_08m30.png`), vue de dessus : prairie dense de brins fins. Les dessus au soleil sont jaune-vert clair (relevé : #879866, #768959). Les ombres sont bleu-vert doux, jamais noires (#3a4746, #47544a). Les touffes forment une « moquette » à mèches orientées.
- **V2 00:20** (`tg_df_00m20.png`), au ras du sol : à droite, longs brins fins couleur paille ; au premier plan, lavande.
- **V2 02:30** (`tg_df_02m30.png`) et **V5 00:12** (`tg_gamescom_00m12.png`) : herbe courte et fine au pied du mur. Le long du mur, l'herbe est plus dense et un peu plus haute.
- **V2 04:30** (`tg_df_04m30.png`), automne en contre-jour : touffes de brins courbes, pointes dorées lumineuses, longues ombres douces.
- **V5 00:33** (`tg_gamescom_00m33.png`) : touffes hirsutes à pointes claires.
- **V4 00:06** (`tg_annonce_00m06.png`) : herbe verte « duveteuse » à dessus clairs (relevé : #789856, #87a35d, #8aa663 ; ombre #385629).
- **V4 00:30** (`tg_annonce_00m30.png`), heure dorée : pointes vert-jaune dorées (#978745, #a78747), ombres vert olive.
- Constat : au moins trois silhouettes cohabitent, à savoir brins fins de prairie, touffes en mèches et herbe courte le long des murs. La pointe est toujours plus claire que le pied.

### Pierre et murs

- **V4 00:06** (`tg_annonce_00m06.png`), muret de référence : blocs de tailles variées aux bords arrondis. Ils sont surtout crème et beige, avec quelques blocs terre cuite et rose. Les joints sont de simples creux d'ombre, sans mortier visible. Le sommet est cassé et irrégulier, du lierre grimpe, et le muret bas suit la courbe du sol.
- **V4 00:16** (`tg_annonce_00m16.png`) : arche percée dans le mur, chemin, clôture.
- **V2 02:30** (`tg_df_02m30.png`), gros plan : blocs beige sable biseautés (relevé : #e6c588, #d7b878, #f7d9a9 au soleil, #c7aa68 dans les creux).
- **V2 04:30** (`tg_df_04m30.png`) : gros rochers gris lisses à la base du mur, pierres d'angle de teintes pastel (rose, jaune-vert, beige), lierre.
- **V3 09:35** (`tg_dev_09m35.png`) : murets en ruine avec arches, sommets en gradins, gros rochers gris, bordure basse courbe d'un massif.
- **V5 00:33** (`tg_gamescom_00m33.png`) : le sélecteur de couleur de pierre du jeu propose crème, ocre, gris, gris-vert, terre cuite, jaune ocre, bleu-vert et gris foncé.
- **V5 00:50** (`tg_gamescom_00m50.png`), ruine d'église : fenêtres en ogive, nef sans toit, pignon cassé, sommets en gradins, lierre.
- **A1** : « the original design was that everything would just stick to the terrain » ; « something slightly enchanting about those procedural walls that would just rearrange themselves » ; « The feeling that they gave you was very warm and sweet ».
- **V1 21:00** (`tg_gpc_21m00.png`), diapositive : « Mostly flat terrain, no complex buildings, just some ruins ».

### Collines

- **V3 09:35** : colline d'herbe en ondulations douces, chemin de terre qui suit le relief.
- **V2 09:05** (`tg_df_09m05.png`), vue aérienne : falaise couleur sable chaud à grandes facettes (#d9a779, #e8b787), étang.
- **V5 00:33** : falaises grises à facettes.
- Constat : le relief est fait de grandes formes simples et arrondies. Le détail vient de l'herbe, pas du sol.

### Montagnes lointaines

- **Aucune montagne n'a été observée** dans les images regardées. Le fond est fait de masses de forêt (arbres en boules duveteuses) fondues dans une brume colorée : dorée en journée (**V4 00:30**), rose et mauve au couchant (**V2 07:00**, `tg_df_07m00.png`).
- Hypothèse, non tirée de Tiny Glade : nos montagnes suivent la même perspective atmosphérique. Plus elles sont loin, plus elles sont claires, moins elles sont saturées et plus elles tirent vers la couleur du brouillard (FOG.color = SKY.horizon), sans détail ni contour.

### Lumière et ciel

- **V2 00:20** et **V2 09:05** : ciel bleu lavande (relevé : #b7a8d7, #aaa1d6), gros cumulus blancs ronds.
- **V1 21:00** : ciel mauve et rose avec nuages ronds.
- **V4 00:30** : heure dorée. Ombres vert olive, brume dorée chaude au fond.
- **V5 00:50** : lumière rasante de couchant rose orangé, ombres mauves.
- **V1 41:30** (`tg_gpc_41m30.png`), diapositive « Artistic direction » : « Treating the frame like a painting », « Studio Ghibli a huge inspiration », « Not meant to be realistic », « Huge win of optical take: tilt shift », « Cute aggression / squee-driven-development ».
- **V1 51:20** (`tg_gpc_51m20.png`) : « Rendering is an art medium », « just make conscious choices, not accidental ones ».
- **V1 52:30** (`tg_gpc_52m30.png`), « Tony Glade » : tone mapping Tony McMapface, une LUT 3D appliquée sur Reinhard, avec un passage naturel au blanc (« path to white »). Le slide précise qu'il est subjectif et limité au SDR, et conseille « otherwise try AgX ».
- **V1 00:40** (`tg_gpc_00m40.png`) : village d'automne, arbres en boules duveteuses orange pêche, herbe paille, pierre crème.

### Ce qu'on reprend

| Reprise | Pourquoi (critère « dessin animé doux ») | Où |
|---|---|---|
| Pierre crème et beige chaude, avec quelques blocs rosés ou terre cuite, tirés au hasard par bloc | Chaleur et douceur ; la variété casse l'aplat sans bruit | `STONE.blocks` (R) |
| Blocs aux bords arrondis, joints en creux d'ombre, sommet de ruine en gradins, lierre | Formes rondes = mignon ; pas de mortier blanc qui ferait « propre » et dur | R |
| Ombres de pierre beige mauve, jamais grises ni noires | Règle déjà posée au § 3 ; confirmée par V5 00:50 | `STONE.shade`, `STONE.joint` |
| Plusieurs familles d'herbe (brins fins, touffes, épillets, herbe courte au pied des murs), pointes plus claires que les pieds | Richesse vue en V3 08:30, V2 02:30 et V5 00:33 ; garde des formes douces | `GRASS_KINDS` (G) |
| Herbe plus dense le long des murs | Pose les murs dans le sol (V5 00:12) | G et R |
| Relief en grandes formes arrondies, creux plus frais et bosses plus claires | Lisible et doux ; le détail vient de l'herbe | `TERRAIN` (T, G) |
| Fond fondu dans une brume colorée (perspective atmosphérique) | Profondeur sans détail coûteux ; ambiance chaude | `MOUNTAIN`, `haze()` (T) |
| « Choix conscients » : chaque couleur vient de la palette | V1 51:20 ; c'est déjà la règle de `palette.js` | tous |

### Ce qu'on écarte

| Écarté | Raison |
|---|---|
| GI par ray marching, éclairage global, ombres de contact | Cœur technique de Tiny Glade (V1) ; impossible en rendu logiciel et contraire au toon à 3 paliers. Les ombres colorées s'obtiennent par la palette. |
| Flou tilt-shift et profondeur de champ (V1 41:30, V3 16:00) | Post-traitement coûteux (déjà écarté au § 8) ; il rendrait le chat flou selon l'angle. |
| Tone mapping par LUT 3D (Tony McMapface) | Demande une texture 3D extérieure (téléchargement interdit) ; NeutralToneMapping garde déjà les teintes. AgX reste une piste à juger sur capture, non retenue ici. |
| Herbe paille, automne orange, couchant rose saturé comme ambiance de base | Teintes sèches ou dramatiques, contraires au choix vert tendre du § 4 (correction 1 de GRASS). Possible plus tard comme variante d'heure, pas par défaut. |
| Nuit | Hors sujet, et le chat doit rester lisible. |
| Ombres bleu-vert foncé de la prairie (V3 08:30) | Trop sombres pour notre rampe toon ; on garde des ombres claires et chaudes (§ 3). |
| Pierre grise froide, gris foncé et bleu-vert du sélecteur | Froid, pas cosy. |
| Copie d'une silhouette de bâtiment (église de V5 00:50) | On s'inspire de l'idée de ruine (arche, gradins, lierre), pas d'un modèle. |

### Ciel, lumière et sky.js

Aucun changement. Le ciel lavande à cumulus de Tiny Glade est proche de notre dégradé bleu, rose et crème. Le brouillard crème rejoint déjà sa brume dorée de journée, et les ombres colorées sont déjà dans `SHADOW.tint`. Les vidéos ne justifient donc pas de toucher à `SKY`, `LIGHT`, `SHADOW` ou sky.js. Les cumulus ronds sont une proposition pour plus tard, non faite ici.

### Limites de ce paragraphe

- Les valeurs ajoutées à `palette.js` (STONE, MOSS, MOUNTAIN, GRASS_KINDS, TERRAIN) n'ont pas encore été vues dans le jeu ; elles se jugeront sur les captures « après ».
- MOUNTAIN est une déduction : Tiny Glade ne montre pas de montagnes dans les images regardées.
- Les teintes relevées sur les captures sont faussées par la compression vidéo et l'éclairage de chaque scène.
