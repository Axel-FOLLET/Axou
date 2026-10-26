import * as THREE from 'three';

/**
 * Direction artistique « dessin animé doux » (mission catgame_style, 2026-10-25).
 * Source et justification : docs/recherche/style.md.
 *
 * Critère premier (l'utilisateur) : « cosy mignon » : couleurs tendres, lumière dorée, ombres
 * colorées et claires, jamais de noir pur ni de teinte froide dominante.
 *
 * Conventions :
 * - Toutes les couleurs sont des nombres hexadécimaux sRGB (comme dans un logiciel de dessin).
 *   `new THREE.Color(hex)` ou `color(hex)` les convertit dans l'espace de travail de three.js.
 *   Pour une couleur par sommet, passer par `color(hex)` puis écrire `.r .g .b` (valeurs linéaires),
 *   comme le fait déjà `Grass.js`.
 * - Les matériaux de décor utilisent `toonMaterial()` : MeshToonMaterial (aplats, moins coûteux
 *   que MeshStandardMaterial) avec une rampe partagée de 3 paliers.
 * - Import : `import { GRASS, toonMaterial } from '../style/palette.js';`
 */

// ---------------------------------------------------------------- ciel, brouillard, rendu

/**
 * Ciel peint : dégradé vertical à quatre arrêts + halo doré côté soleil. Correction 1 (2026-10-26,
 * captures du chef) : arrêt `blush` (rose pêche très clair) entre l'horizon pêche et le bleu, car
 * le mélange direct pêche → bleu passait par un gris beige terne ; `mid` un peu plus clair.
 */
export const SKY = {
  top: 0x8ec5ee,      // bleu tendre au zénith
  mid: 0xcfe7f7,      // bleu pâle à mi-hauteur (0xc4e2f5 avant la correction 1)
  blush: 0xffe2d8,    // rose pêche très clair juste au-dessus de l'horizon
  horizon: 0xffe9cc,  // pêche clair à l'horizon (lumière de fin d'après-midi)
  sunGlow: 0xfff3c4,  // halo autour du soleil
};

/**
 * Brouillard linéaire exactement de la couleur de l'horizon (correction 1 : 0xf6e6cc avant, d'où
 * une ligne visible) : l'herbe et le sol lointains se fondent dans le bas du ciel. Le ciel n'est pas
 * soumis au tone mapping (sky.js), comme la couleur du brouillard dans three : même pixel final.
 * `near` / `far` en mètres (THREE.Fog).
 */
export const FOG = { color: SKY.horizon, near: 8, far: 34 };

/**
 * Rendu : tone mapping « Neutral » (Khronos PBR Neutral, sans décalage de teinte) pour garder les
 * pastels tels quels ; exposition 1. `background` = couleur de la page (index.html) = horizon.
 */
export const RENDER = {
  toneMapping: THREE.NeutralToneMapping,
  exposure: 1.0,
  background: SKY.horizon,
};

// ---------------------------------------------------------------- lumières

/**
 * Soleil chaud et bas (fin d'après-midi), ciel d'ambiance clair et sol qui renvoie une lumière
 * dorée : les faces à l'ombre restent claires et chaudes.
 */
export const LIGHT = {
  sun: { color: 0xffe0b0, intensity: 2.2, offset: [4, 5, 3] },
  hemiSky: 0xd8e9ff,
  hemiGround: 0xe0c48e,
  hemiIntensity: 1.1,
  // Contre-jour doux (détache la silhouette noire du chat), chaud et non plus bleu.
  rim: { color: 0xffd6a8, intensity: 0.5 },
};

/** Ombre portée : intensité de l'ombre du soleil (0 = aucune, 1 = pleine). */
export const SHADOW = { intensity: 0.55, tint: 0x8a7fae };

// ---------------------------------------------------------------- sol et herbe

/** Sol : vert tendre et lumineux, plus clair au centre (clairière). */
export const GROUND = { center: 0xb7d97a, edge: 0x93c066 };

/**
 * Herbe en touffes : dégradé du pied à la pointe sur chaque touffe, plus des variantes de pointe
 * tirées par touffe. `base` n'est jamais sombre : l'ombre entre les touffes est une couleur.
 */
export const GRASS = {
  base: 0x6fae5c,     // pied (vert sauge soutenu, pas olive)
  mid: 0x96cc68,      // milieu
  tip: 0xc9e47e,      // pointe (vert tilleul)
  // Correction 1 (2026-10-26) : pointes plus fraîches, moins jaunes (captures du chef : touffes
  // jaune orangé sous le soleil doré). Avant : [0xc9e47e, 0xd8ea8c, 0xb9dc78] et warmTip 0xeee39a.
  tips: [0xc4e584, 0xcfeb94, 0xb2dc7e],  // variantes de pointe, une par touffe
  warmTip: 0xe3eaa2,  // pointe crème-tilleul, rare (≈ 1 touffe sur 8), remplace la paille
};

// ---------------------------------------------------------------- fleurs

export const FLOWERS = {
  stem: 0x7fb562,
  leaf: 0x8cc46e,
  daisyPetal: 0xfffaf0,     // marguerite
  daisyHeart: 0xffcf5a,
  poppy: 0xff9e8a,          // coquelicot pastel (corail)
  poppyHeart: 0x7a5a52,     // cœur brun doux, pas noir
  cornflower: 0x9fb6ff,     // bleuet pervenche
  cornflowerBud: 0x8fae7a,
  buttercup: 0xffe27a,      // bouton d'or
  buttercupHeart: 0xf2c25a,
  lavender: 0xc8a8ec,
  lavenderLight: 0xdcc4f4,
  clover: 0xffb6cc,         // trèfle rose (si B ajoute une espèce)
};

// ---------------------------------------------------------------- bestioles

/**
 * Papillons : mêmes noms d'espèces que `Butterfly.js` (SPECIES), bords adoucis (plus de noir).
 */
export const BUTTERFLIES = {
  monarque: { base: 0xffb27a, edge: 0xe2846a },
  citron: { base: 0xfff08e, edge: 0xffc860 },
  'azuré': { base: 0xa9d8ff, edge: 0x7ea8e6 },
  'piéride rose': { base: 0xffe6ef, edge: 0xff9fc2 },
  body: 0x6e584a,      // corps brun doux
  antenna: 0x5a463a,
};

/** Pelote : rose framboise tendre, trois tons pour les tours de fil, fil traînant. */
export const YARN = { base: 0xff8fa6, light: 0xffc4cf, dark: 0xe0687f, trail: 0xe9768d };

// ---------------------------------------------------------------- chat

/**
 * Chat noir, lisible et doux : noir chaud (jamais 0x000000), pointes un peu caramel, liseré de
 * contre-jour doré qui dessine le volume, yeux vert-jaune lumineux.
 */
export const CAT = {
  coat: 0x2a2320,
  tip: 0x5c4536,
  sheen: 0xffd9a8,          // couleur du liseré de contre-jour (Fur.js, COAT_LIGHT)
  // Correction 2 (2026-10-26, captures « final » : silhouette noir brun uniforme, sans liseré) :
  // 0,38 -> 0,6, et le liseré n'est plus réservé aux coques extérieures (voir Fur.js).
  sheenStrength: 0.6,
  // Correction 2 : aplat de lumière côté soleil, plus marqué sur le dos et la tête (Fur.js) :
  // gris-brun très sombre ajouté en émissif × coatLitStrength, pour un noir moins absolu.
  coatLit: 0x7a685c,
  coatLitStrength: 0.45,
  eyeIrisIn: 0xeef27e,
  eyeIrisOut: 0x7cc24e,
  eyeRing: 0x3b2a1e,        // bord de l'iris et coin de l'œil : brun, pas noir
};

// ---------------------------------------------------------------- contour, interface

/** Contour en coque inversée (`outlineMaterial`) : brun chaud, fin. Épaisseur en mètres. */
export const OUTLINE = { color: 0x5a4436, thickness: 0.004 };

/** HUD (chaînes CSS, utilisées par index.html et main.js). */
export const HUD = {
  background: 'rgba(255, 248, 236, 0.9)',
  text: '#5a4335',
  accent: '#ff9f7a',
  accentText: '#ffffff',
  border: '#f2d6b8',
  shadow: '0 4px 14px rgba(150, 100, 60, 0.18)',
  radius: '18px',
  font: '600 14px/1.45 ui-rounded, "SF Pro Rounded", "Segoe UI Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif',
};

// ---------------------------------------------------------------- monde : inspiration Tiny Glade
// Ajouts 2026-10-26 (mission catgame_monde, agent S). Source : docs/recherche/style.md § 10.
// On s'inspire seulement : teintes relevées sur des captures vidéo publiques puis éclaircies et
// adoucies vers notre « dessin animé doux ». Aucune couleur ne sert à l'herbe ou au ciel existants :
// GROUND, GRASS, SKY, LIGHT et SHADOW restent inchangés.

/**
 * Pierre des murets et ruines : blocs chauds variés (une teinte tirée par bloc, puis `jitter`),
 * jamais de gris froid. Ombres chaudes mauves, joints en creux d'ombre (pas de mortier blanc).
 */
export const STONE = {
  blocks: [
    0xf1dcb2,  // crème (majorité)
    0xe8c78f,  // beige sable
    0xdcb582,  // beige chaud plus soutenu
    0xeab39a,  // terre cuite rosée (rare, ≈ 1 bloc sur 8)
    0xf2cdbf,  // rose pâle (rare)
    0xdcc38e,  // ocre doux
    0xcdc2b0,  // gris chaud (pierres d'angle, soubassement)
  ],
  base: 0xe8c78f,      // teinte par défaut si une seule couleur
  sun: 0xfde9c4,       // face éclairée en plein soleil (palier clair du toon)
  shade: 0xb89c8c,     // face à l'ombre : beige mauve, jamais noir
  joint: 0x9e8270,     // creux entre les blocs (bande sombre fine ou face en retrait)
  boulder: 0xc2bbae,   // gros rochers arrondis au pied des murs (gris chaud)
  boulderShade: 0x968e92, // ombre des rochers, légèrement mauve
};

/** Mousse et lierre sur les pierres : verts doux, un ton plus frais que l'herbe. */
export const MOSS = {
  base: 0x86a95c,      // mousse sur le dessus des pierres
  light: 0xb1cb72,     // mousse au soleil
  ivy: 0x5f9454,       // feuilles de lierre (masse)
  ivyLight: 0x92c46c,  // feuilles de lierre éclairées
};

/**
 * Montagnes de fond (Tiny Glade n'en montre pas : déduction par perspective atmosphérique).
 * Plus c'est loin, plus la couleur part vers FOG.color ; utiliser `haze(hex, t)` ci-dessous.
 */
export const MOUNTAIN = {
  near: 0x8fae7e,      // flanc proche couvert d'herbe (vert gris doux)
  nearRock: 0xc2ad9c,  // roche proche (beige rosé, famille STONE)
  far: 0xb7b9d6,       // chaîne lointaine (lavande bleutée)
  farther: 0xd2cfe2,   // dernière chaîne, presque le ciel
  snow: 0xfff7ee,      // neige éventuelle (blanc crème, jamais blanc pur)
  snowShade: 0xd8d4ec, // neige à l'ombre (lavande)
  haze: FOG.color,     // couleur de fondu = brouillard = SKY.horizon
  hazeNear: 0.25,      // part de brume conseillée pour la chaîne proche
  hazeFar: 0.6,        // pour la chaîne lointaine
};

/**
 * Familles d'herbe (au moins 3 silhouettes différentes). Chaque famille a un pied (base) et une
 * pointe (tip) ; les ombres restent vert olive ou bleu-vert, jamais noires.
 */
export const GRASS_KINDS = {
  fine: { base: 0x5f9e5a, tip: 0xbfe07e },                    // brins fins de prairie, longs et souples
  tuft: { base: 0x6aa85a, tip: 0xcde88a, warmTip: 0xe6e7a0 }, // touffes hirsutes en mèches, pointes claires
  seed: { base: 0x77a95e, stem: 0xa9c873, head: 0xe9dca0 },   // tiges à épillets (tête crème-paille)
  short: { base: 0x6fae5c, tip: 0xa8d474 },                   // herbe courte et dense au pied des murs
};

/** Relief : le sol en creux est plus frais et sombre, la bosse plus claire et chaude. */
export const TERRAIN = {
  hollow: 0x8db96a,    // fond de creux (à mélanger avec GROUND)
  bump: 0xc8e088,      // sommet de bosse au soleil
  path: 0xe4c391,      // chemin de terre chaude
  pathEdge: 0xcaa67a,  // bord de chemin, terre plus foncée
};

// ---------------------------------------------------------------- fonctions

/**
 * Perspective atmosphérique : mélange une couleur vers FOG.color (t de 0 à 1). Renvoie une
 * THREE.Color (comme `mix`). Exemple : haze(MOUNTAIN.far, MOUNTAIN.hazeFar).
 */
export function haze(hex, t) {
  return mix(hex, FOG.color, t);
}

/** Couleur three.js (espace de travail) depuis un hex sRGB. Nouvelle instance à chaque appel. */
export function color(hex) {
  return new THREE.Color(hex);
}

/**
 * Mélange de deux hex sRGB (t de 0 à 1), résultat en THREE.Color. Le mélange se fait en espace
 * linéaire : à t = 0,5 entre noir et blanc on obtient #bcbcbc (plus clair qu'un mélange sRGB).
 */
export function mix(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

/**
 * Variante légère d'une couleur pour casser l'uniformité (luminosité ± amount, teinte ± amount/4).
 * @param {number} hex
 * @param {number} amount  0,04 à 0,08 conseillé (au-delà, l'aplat devient bruité)
 * @param {() => number} rand  générateur [0, 1), par ex. le `rng` de Grass.js
 */
export function jitter(hex, amount, rand = Math.random) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.h = (hsl.h + (rand() * 2 - 1) * amount * 0.25 + 1) % 1;
  hsl.l = THREE.MathUtils.clamp(hsl.l + (rand() * 2 - 1) * amount, 0, 1);
  return c.setHSL(hsl.h, hsl.s, hsl.l);
}

/** Paliers par défaut : ombre claire, demi-teinte, plein jour (multiplient la lumière du soleil). */
const LEVELS = {
  2: [0.55, 1.0],
  3: [0.5, 0.78, 1.0],
  4: [0.45, 0.65, 0.85, 1.0],
};
const _gradients = new Map();

/**
 * Rampe de dégradé pour MeshToonMaterial (`gradientMap`) : texture 1 pixel de haut, un texel par
 * palier, filtre « plus proche » (exigé par la doc three.js), espace NoColorSpace (donnée, pas
 * couleur). Mise en cache : un même réglage renvoie la même texture (partagée par tous les
 * matériaux).
 * @param {number|number[]} steps  2, 3 ou 4 paliers prédéfinis, ou liste de niveaux 0-1 croissants
 * @returns {THREE.DataTexture}
 */
export function toonGradient(steps = 3) {
  const levels = Array.isArray(steps) ? steps : (LEVELS[steps] ?? LEVELS[3]);
  const key = levels.join(',');
  let tex = _gradients.get(key);
  if (!tex) {
    const data = new Uint8Array(levels.map((v) => Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255)));
    tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _gradients.set(key, tex);
  }
  return tex;
}

/**
 * Matériau toon du décor (herbe, fleurs, papillons, pelote, sol).
 * @param {number|THREE.Color} [hex=0xffffff]  couleur ; laisser blanc avec `vertexColors: true`
 * @param {object} [opts]  `steps` (rampe, défaut 3) + toute option de MeshToonMaterial
 *   (vertexColors, side, map, emissive, emissiveIntensity, transparent…)
 * @returns {THREE.MeshToonMaterial}
 *
 * Les `onBeforeCompile` existants (vent de l'herbe et des fleurs) restent utilisables : le vertex
 * shader toon contient les mêmes morceaux (`beginnormal_vertex`, `begin_vertex`, `color_vertex`)
 * que MeshStandardMaterial.
 */
export function toonMaterial(hex = 0xffffff, opts = {}) {
  const { steps = 3, ...rest } = opts;
  return new THREE.MeshToonMaterial({ color: hex, gradientMap: toonGradient(steps), ...rest });
}

/**
 * Contour par coque inversée : matériau à poser sur une COPIE du maillage (même géométrie),
 * ajoutée comme enfant de l'original. Seules les faces arrière sont dessinées, poussées le long de
 * la normale de `thickness` mètres (en espace objet : diviser par l'échelle si le maillage est mis
 * à l'échelle). Coût : une passe de plus pour cet objet ; à réserver aux petits objets mis en
 * avant (pelote, papillons), jamais à l'herbe ni au chat (fourrure).
 * @param {object} [opts] `color` (hex), `thickness` (m)
 * @returns {THREE.MeshBasicMaterial}
 */
export function outlineMaterial(opts = {}) {
  const thickness = opts.thickness ?? OUTLINE.thickness;
  const m = new THREE.MeshBasicMaterial({ color: opts.color ?? OUTLINE.color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness };
    shader.vertexShader = 'uniform float outlineThickness;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      // `normal` (attribut) et non `objectNormal` : ce dernier n'existe dans le shader de
      // MeshBasicMaterial qu'avec envMap ou skinning (meshbasic.glsl.js de three 0.186).
      '#include <begin_vertex>\ntransformed += normalize(normal) * outlineThickness;',
    );
  };
  m.customProgramCacheKey = () => `catgame-outline-${thickness}`;
  return m;
}
