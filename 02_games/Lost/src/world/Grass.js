import * as THREE from 'three';
import { GLSL_FIELD, inject } from './field.js';
import { GLSL_TERRAIN } from './Terrain.js';
import { GRASS_KINDS, toonMaterial, color, jitter } from '../style/palette.js';

/**
 * Herbe « Tiny Glade » (mission catgame_monde, 2026-10-26, agent G ; références :
 * docs/recherche/style.md § 10). Retour de l'utilisateur : « l'herbe doit être plus détaillé et pas
 * en forme de choux ». Les touffes rondes de la mission catgame_style sont remplacées par des
 * bouquets de BRINS fins (rubans effilés et courbés), en quatre familles (palette `GRASS_KINDS`) :
 * - `fine` : brins fins de prairie, longs et souples (fond du tapis) ;
 * - `tuft` : touffes hirsutes, brins plus courts et très écartés en mèches ;
 * - `seed` : tiges fines à épillet crème (tête ovale), qui dépassent l'herbe ;
 * - `short` : herbe courte et dense (clairière, pied des murs).
 * Le mélange se fait en taches : chaque famille a un masque de densité tiré de bruits lents de la
 * position monde (`kindDensity`), d'où des plaques de touffes, des îlots d'épillets et des creux
 * d'herbe plus basse. Un « peignage » lent (direction qui varie dans le champ) couche les brins
 * dans un même sens par endroits, comme le tapis à mèches orientées de Tiny Glade (V3 08:30).
 *
 * Relief : le pied de chaque brin est posé sur le sol dans le shader (`terrainHeight` de
 * GLSL_TERRAIN, Terrain.js). Exclusions (murs de Ruins.js) : texture de distance au mur la plus
 * proche (`uExcl`, construite par Meadow.js) ; pas d'herbe dans l'emprise, herbe courte au pied.
 *
 * Clairière de départ : plus de cercle. `clearingAt` déforme le rayon par un bruit ; au centre,
 * herbe courte et clairsemée ; le chat ne creuse plus de trou (simple couchage des brins).
 *
 * Instanciation : `InstancedBufferGeometry` sur un `Mesh` par famille et par couche (10 appels de
 * dessin). Une instance = un bouquet (position dans la tuile, angle, tirage, échelles, teinte) ;
 * la géométrie du bouquet porte la forme des brins (voir `clumpGeometry`).
 *
 * Toute formule de hauteur existe deux fois (JS et GLSL) : modifier les deux côtés.
 */

// ---------------------------------------------------------------- champ de la prairie (JS = GLSL)

/** Clairière : transition herbe courte → prairie sur le rayon déformé (m). */
export const CLEAR_START = 1.4;
export const CLEAR_END = 5.4;
/** Distance au mur (m) au-delà de laquelle un mur n'a plus d'effet (codage de la texture). */
export const WALL_FAR = 2.0;

const sstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const nA = (x, z) => 0.5 + 0.25 * (Math.sin(x * 0.31 + z * 0.17) + Math.sin(z * 0.29 - x * 0.13 + 1.7));
const nB = (x, z) => 0.5 + 0.25 * (Math.sin(0.53 * x - 0.41 * z + 0.6) + Math.sin(0.47 * z + 0.37 * x + 2.9));
const nC = (x, z) => 0.5 + 0.25 * (Math.sin(1.37 * x + 0.71 * z + 1.3) + Math.sin(1.21 * z - 0.93 * x + 0.2));

/** 0 au cœur de la clairière de départ, 1 en pleine prairie ; bord irrégulier (rayon bruité de ±2 m). */
export function clearingAt(x, z) {
  const r = Math.hypot(x, z);
  const warp = (1.3 * Math.sin(0.9 * x + 0.4) * Math.sin(0.7 * z - 1.1) + 0.7 * Math.sin(1.7 * x - 1.3 * z + 2.0)) * Math.min(r / 2.5, 1);
  return sstep(CLEAR_START, CLEAR_END, r + warp);
}

/**
 * Hauteur moyenne des brins fins au-dessus du SOL en (x, z), en mètres. `wall` = distance au mur
 * le plus proche (m, WALL_FAR si aucun) : 0 dans l'emprise d'un mur, herbe courte à son pied.
 * Clairière 0,07-0,18 m ; prairie 0,42-1,12 m (creux plus bas là où le bruit B est fort).
 */
export function grassHeight(x, z, wall = WALL_FAR) {
  if (wall <= 0) return 0;
  const t = clearingAt(x, z);
  const c = nC(x, z);
  const short = 0.07 + 0.11 * c;
  const tall = 0.72 + 0.4 * nA(x, z) - 0.3 * sstep(0.6, 0.9, nB(x, z));
  let h = short + (tall - short) * t;
  const nearWall = 1 - sstep(0.15, 1.0, wall);
  h += (Math.min(h, 0.13 + 0.08 * c) - h) * nearWall;
  return h;
}

/**
 * Distance signée (m) de (x, z) à la zone exclue la plus proche (négative dedans), bornée à
 * WALL_FAR. Zone : rectangle `{ x, z, hx, hz, rotY }` (demi-côtés, rotation autour de Y comme
 * `Object3D.rotation.y`) ou disque `{ x, z, r }`.
 */
export function exclusionDistance(list, x, z) {
  let d = WALL_FAR;
  for (const e of list) {
    const dx = x - e.x, dz = z - e.z;
    let s;
    if (e.r !== undefined) s = Math.hypot(dx, dz) - e.r;
    else {
      const c = Math.cos(e.rotY || 0), sn = Math.sin(e.rotY || 0);
      const lx = Math.abs(c * dx - sn * dz) - e.hx, lz = Math.abs(sn * dx + c * dz) - e.hz;
      s = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
    }
    if (s < d) d = s;
  }
  return d;
}

const GLSL_GRASS_FIELD = /* glsl */ `
uniform sampler2D uExcl;  // distance au mur (0-1 × uExclBox.w), construite par Meadow.js
uniform vec4 uExclBox;    // x min, z min, côté (m), distance maximale codée (m)
float gNA(vec2 p) { return 0.5 + 0.25 * (sin(p.x * 0.31 + p.y * 0.17) + sin(p.y * 0.29 - p.x * 0.13 + 1.7)); }
float gNB(vec2 p) { return 0.5 + 0.25 * (sin(0.53 * p.x - 0.41 * p.y + 0.6) + sin(0.47 * p.y + 0.37 * p.x + 2.9)); }
float gNC(vec2 p) { return 0.5 + 0.25 * (sin(1.37 * p.x + 0.71 * p.y + 1.3) + sin(1.21 * p.y - 0.93 * p.x + 0.2)); }
float clearingAt(vec2 p) {
  float r = length(p);
  float w = (1.3 * sin(0.9 * p.x + 0.4) * sin(0.7 * p.y - 1.1) + 0.7 * sin(1.7 * p.x - 1.3 * p.y + 2.0)) * min(r / 2.5, 1.0);
  return smoothstep(${CLEAR_START.toFixed(4)}, ${CLEAR_END.toFixed(4)}, r + w);
}
float wallDist(vec2 p) {
  vec2 uv = (p - uExclBox.xy) / uExclBox.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return uExclBox.w;
  return texture(uExcl, uv).r * uExclBox.w;
}
float grassHeight(vec2 p, float t, float wall) {
  float c = gNC(p);
  float sh = 0.07 + 0.11 * c;
  float tall = 0.72 + 0.4 * gNA(p) - 0.3 * smoothstep(0.6, 0.9, gNB(p));
  float h = mix(sh, tall, t);
  float nearWall = 1.0 - smoothstep(0.15, 1.0, wall);
  h = mix(h, min(h, 0.13 + 0.08 * c), nearWall);
  return wall <= 0.0 ? 0.0 : h;
}
// Densité de chaque famille (0-1) : fine 0, touffe 1, épillet 2, courte 3.
float kindDensity(float kind, vec2 p, float t, float wall) {
  float nearWall = 1.0 - smoothstep(0.15, 1.0, wall);
  float d;
  if (kind < 0.5) d = mix(0.35, 0.95, t) * (0.8 + 0.2 * gNC(p)) * (1.0 - 0.7 * nearWall);
  else if (kind < 1.5) d = mix(0.25, 1.0, smoothstep(0.42, 0.72, gNA(p))) * mix(0.45, 1.0, t) * (1.0 - 0.8 * nearWall);
  else if (kind < 2.5) d = smoothstep(0.52, 0.85, gNB(p)) * t * (1.0 - nearWall);
  else d = max(max(0.6 * (1.0 - t), nearWall), 0.16);
  return d * step(0.02, wall);
}
// Hauteur propre à la famille, à partir de la hauteur des brins fins.
float kindHeight(float kind, vec2 p, float h) {
  float tallness = smoothstep(0.25, 0.6, h);
  if (kind < 0.5) return h;
  if (kind < 1.5) return mix(h, h * 0.55, tallness);
  if (kind < 2.5) return h * 1.15 + 0.08;
  return min(h, 0.09 + 0.12 * gNC(p));
}
`;

// ---------------------------------------------------------------- forme des bouquets

/** Profils de brin : s (0 pied → 1 pointe), largeur relative, tête (épillet). */
const PROFILES = {
  blade3: [[0, 1], [0.35, 0.92], [0.7, 0.6], [1, 0]],      // 7 sommets, 5 triangles
  blade2: [[0, 1], [0.5, 0.78], [1, 0]],                   // 5 sommets, 3 triangles
  blade1: [[0, 1], [1, 0]],                                // 3 sommets, 1 triangle
  // Tige fine puis épillet ovale (crème) : 11 sommets, 9 triangles.
  seed: [[0, 0.22], [0.4, 0.2], [0.7, 0.18], [0.78, 0.75, 1], [0.89, 1, 1], [1, 0, 1]],
  seedFar: [[0, 0.22], [0.74, 0.18], [0.87, 1, 1], [1, 0, 1]],
};

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Brins d'un bouquet (repère du bouquet, rayon 1, hauteur 1) selon la famille : pied (bx, bz),
 * direction de courbure `phi`, courbure `lean` (écart horizontal à la pointe / longueur),
 * longueur `len`, largeur `w`, profil.
 */
function bladeSet(kind, n, profile, rand) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    if (kind === 'fine') {
      const r = Math.sqrt(rand());
      out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: rand() * Math.PI * 2, lean: 0.12 + 0.3 * rand(), len: 0.62 + 0.38 * rand(), w: 0.8 + 0.3 * rand(), profile });
    } else if (kind === 'tuft') {
      // Mèches : pieds serrés, brins très écartés vers l'extérieur, longueurs inégales.
      const r = 0.25 + 0.35 * rand();
      out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: a + (rand() - 0.5) * 0.8, lean: 0.35 + 0.45 * rand(), len: 0.5 + 0.5 * rand(), w: 0.85 + 0.3 * rand(), profile });
    } else if (kind === 'short') {
      const r = Math.sqrt(rand());
      out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: rand() * Math.PI * 2, lean: 0.2 + 0.4 * rand(), len: 0.55 + 0.45 * rand(), w: 0.8 + 0.4 * rand(), profile });
    }
  }
  return out;
}

/** Bouquet d'épillets : `stems` tiges presque droites + `leaves` petites feuilles basses. */
function seedSet(stems, leaves, stemProfile, rand) {
  const out = [];
  for (let i = 0; i < stems; i++) {
    const a = rand() * Math.PI * 2, r = 0.5 * Math.sqrt(rand());
    out.push({ bx: Math.cos(a) * r, bz: Math.sin(a) * r, phi: rand() * Math.PI * 2, lean: 0.05 + 0.15 * rand(), len: 0.8 + 0.2 * rand(), w: 1, profile: stemProfile });
  }
  for (let i = 0; i < leaves; i++) {
    const a = rand() * Math.PI * 2;
    out.push({ bx: Math.cos(a) * 0.4, bz: Math.sin(a) * 0.4, phi: a, lean: 0.5 + 0.3 * rand(), len: 0.28 + 0.12 * rand(), w: 0.55, profile: PROFILES.blade2 });
  }
  return out;
}

/**
 * Géométrie d'un bouquet. Attributs par sommet :
 * - `position` : pied du brin (x, z, en rayons de bouquet) ; y = s, position le long du brin ;
 * - `color` : r = côté (−0,5 / 0 / +0,5 de la largeur), g = largeur relative au profil,
 *   b = 1 sur l'épillet (couleur de tête) ;
 * - `aBl` : direction de courbure, courbure, longueur relative, largeur relative du brin.
 */
function clumpGeometry(blades) {
  const pos = [], col = [], bl = [], nrm = [], idx = [];
  const push = (B, s, w, side, head) => {
    pos.push(B.bx, s, B.bz);
    col.push(side, w, head);
    bl.push(B.phi, B.lean, B.len, B.w);
    nrm.push(0, 1, 0);
    return pos.length / 3 - 1;
  };
  for (const B of blades) {
    let prev = null;
    for (const [s, w, head = 0] of B.profile) {
      const row = w > 0 ? [push(B, s, w, -0.5, head), push(B, s, w, 0.5, head)] : [push(B, s, 0, 0, head)];
      if (prev) {
        if (row.length === 2) idx.push(prev[0], prev[1], row[1], prev[0], row[1], row[0]);
        else idx.push(prev[0], prev[1], row[0]);
      }
      prev = row;
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aBl', new THREE.Float32BufferAttribute(bl, 4));
  return g;
}

// ---------------------------------------------------------------- couches et familles

/**
 * Familles : identifiant shader, échelle de hauteur aléatoire, rayon du bouquet (m), couleurs.
 * Pointe (`tips`) tirée par bouquet ; `head` = épillet.
 */
const KIND_INFO = {
  fine: { id: 0, radius: 0.09, base: GRASS_KINDS.fine.base, tips: [GRASS_KINDS.fine.tip], warm: GRASS_KINDS.tuft.warmTip, warmRate: 0.05 },
  tuft: { id: 1, radius: 0.06, base: GRASS_KINDS.tuft.base, tips: [GRASS_KINDS.tuft.tip], warm: GRASS_KINDS.tuft.warmTip, warmRate: 0.18 },
  seed: { id: 2, radius: 0.06, base: GRASS_KINDS.seed.base, tips: [GRASS_KINDS.seed.stem], head: GRASS_KINDS.seed.head, warmRate: 0 },
  short: { id: 3, radius: 0.12, base: GRASS_KINDS.short.base, tips: [GRASS_KINDS.short.tip], warm: GRASS_KINDS.fine.tip, warmRate: 0.2 },
};

/**
 * Couches qui suivent la caméra (tuiles répétées autour de `center`) : demi-côté de la tuile (m),
 * apparition et disparition (m depuis le centre), puis une entrée par famille : bouquets par
 * tuile, brins par bouquet (ou tiges et feuilles pour les épillets), profil, largeur d'un brin (m).
 * Plus loin : moins de brins par bouquet, profils plus simples, brins plus larges (couverture).
 */
export const LAYERS = [
  { name: 'proche', half: 5, fadeIn: null, fadeOut: [3.8, 5.0], receiveShadow: true, kinds: {
    fine: { count: 3600, n: 7, profile: 'blade3', width: 0.026 },
    tuft: { count: 1500, n: 9, profile: 'blade2', width: 0.032 },
    seed: { count: 700, stems: 3, leaves: 3, profile: 'seed', width: 0.04 },
    short: { count: 1800, n: 8, profile: 'blade2', width: 0.028 },
  } },
  { name: 'moyenne', half: 11, fadeIn: [3.6, 5.0], fadeOut: [8.5, 11], receiveShadow: false, kinds: {
    fine: { count: 6000, n: 5, profile: 'blade2', width: 0.042 },
    tuft: { count: 2000, n: 6, profile: 'blade2', width: 0.05 },
    seed: { count: 1200, stems: 2, leaves: 0, profile: 'seedFar', width: 0.06 },
    short: { count: 1500, n: 5, profile: 'blade1', width: 0.05 },
  } },
  { name: 'lointaine', half: 24, fadeIn: [8.0, 11], fadeOut: [18, 23.5], receiveShadow: false, kinds: {
    fine: { count: 9000, n: 4, profile: 'blade1', width: 0.085 },
    tuft: { count: 4000, n: 5, profile: 'blade1', width: 0.095 },
  } },
];

const VERTEX_HEAD = /* glsl */ `
${GLSL_FIELD}
${GLSL_TERRAIN}
${GLSL_GRASS_FIELD}
uniform vec2 uCenter;
uniform vec4 uLayer;     // demi-côté, début et fin d'apparition (0 = aucune), largeur d'un brin
uniform vec2 uFadeOut;   // début et fin de disparition
uniform vec4 uKind;      // famille (0-3), rayon du bouquet (m)
uniform vec4 uCorridor;  // caméra x, z ; chat x, z (herbe abaissée entre les deux)
uniform float uCorridorOn;
uniform vec3 uKBase;     // pied (linéaire)
uniform vec3 uKHead;     // épillet (linéaire)
attribute vec4 aBlade;   // x, z dans la tuile ; angle ; tirage 0-1
attribute vec4 aShape;   // facteur de hauteur ; facteur de largeur ; direction et force de courbure
attribute vec4 aTint;    // couleur de pointe (linéaire) ; nuance
attribute vec4 aBl;      // brin : direction de courbure, courbure, longueur, largeur
`;

const VERTEX_BLADE = /* glsl */ `
vec2 gTile = vec2(2.0 * uLayer.x);
vec2 gC = aBlade.xy + gTile * floor((uCenter - aBlade.xy) / gTile + 0.5);
float gD = length(gC - uCenter);
float gKeep = 1.0 - smoothstep(uFadeOut.x, uFadeOut.y, gD);
if (uLayer.z > 0.0) gKeep *= smoothstep(uLayer.y, uLayer.z, gD);
float gT = clearingAt(gC);
float gWall = wallDist(gC);
float gOn = step(aBlade.w, gKeep * kindDensity(uKind.x, gC, gT, gWall));
float gH = kindHeight(uKind.x, gC, grassHeight(gC, gT, gWall)) * aShape.x * gOn;
// Couloir de vue : l'herbe entre la caméra et le chat est abaissée pour qu'il reste visible.
vec2 gSeg = uCorridor.zw - uCorridor.xy;
float gU = clamp(dot(gC - uCorridor.xy, gSeg) / max(dot(gSeg, gSeg), 1e-4), 0.0, 1.0);
float gSegD = length(gC - (uCorridor.xy + gSeg * gU));
float gCor = (1.0 - smoothstep(0.5, 1.1, gSegD)) * uCorridorOn;
gH = mix(gH, min(gH, 0.22), gCor);
// Devant l'objectif : pas de grand brin qui barre l'image.
float gCamD = length(gC - uPushB.xy);
gH = mix(min(gH, 0.2), gH, smoothstep(0.5, 1.6, gCamD));
// Courbure : vent + écartement (chat, caméra) + peignage lent du champ + courbure propre.
float gCombA = 2.5 * sin(0.21 * gC.x + 0.3) + 2.0 * sin(0.17 * gC.y - 0.8);
vec2 gComb = vec2(cos(gCombA), sin(gCombA));
vec2 gOff = windAt(gC, uTime) + pushAt(gC) + gComb * 0.14 + vec2(cos(aShape.z), sin(aShape.z)) * aShape.w;
float gOL = length(gOff);
if (gOL > 1.1) gOff *= 1.1 / gOL;
// Brin : pied dans le bouquet, ruban effilé courbé dans sa direction propre.
float gCa = cos(aBlade.z), gSa = sin(aBlade.z);
vec2 gBo = position.xz * uKind.y;
vec2 gBase = gC + vec2(gCa * gBo.x - gSa * gBo.y, gSa * gBo.x + gCa * gBo.y);
float gS = position.y;
float gPhi = aBl.x + aBlade.z;
vec2 gDir = vec2(cos(gPhi), sin(gPhi));
vec2 gLat = vec2(-gDir.y, gDir.x);
float gL = gH * aBl.z;
float gW = uLayer.w * aShape.y * aBl.w * color.g * gOn;
vec2 gXZ = gBase + gLat * (color.r * gW) + gDir * (aBl.y * gL * gS * gS);
float gBend = gL * pow(gS, 1.6);
gXZ += gOff * gBend;
float gY = gL * gS * inversesqrt(1.0 + aBl.y * aBl.y * gS * gS) * inversesqrt(1.0 + dot(gOff, gOff));
vec3 gPos = vec3(gXZ.x, terrainHeight(gBase) + gY, gXZ.y);
// Normale : presque verticale, un peu penchée dans le sens du peignage et du brin (reflets par mèche).
vec3 objectNormal = normalize(vec3(gComb * 0.18 + gDir * 0.12, 1.0));
// Couleur : pied → milieu → pointe le long du brin, épillet crème ; nuance par tache.
{
  float gShade = aTint.w * mix(0.93, 1.07, gNC(gC * 1.7));
  vec3 gBaseC = uKBase * gShade;
  vec3 gTipC = aTint.rgb * mix(0.96, 1.04, gNA(gC * 2.3));
  vec3 gMidC = mix(gBaseC, gTipC, 0.45);
  vec3 gBlade = gS < 0.5 ? mix(gBaseC, gMidC, gS / 0.5) : mix(gMidC, gTipC, (gS - 0.5) / 0.5);
  vColor.rgb = color.b > 0.5 ? uKHead * gShade : gBlade;
}
`;

export class Grass {
  /**
   * @param {object} uniforms uniformes partagés (uTime, uWindDir, uWindStrength, uPushA, uPushB,
   *   uCenter, uCorridor, uCorridorOn, uExcl, uExclBox) : objets { value } communs à toutes les couches.
   */
  constructor(uniforms, seed = 1) {
    this.layers = [];
    this.group = new THREE.Group();
    this.group.name = 'Grass';
    LAYERS.forEach((layer, li) => {
      Object.entries(layer.kinds).forEach(([kind, cfg], ki) => {
        const info = KIND_INFO[kind];
        const rand = rng(seed * 7919 + li * 104729 + ki * 1299709);
        const blades = kind === 'seed'
          ? seedSet(cfg.stems, cfg.leaves, PROFILES[cfg.profile], rand)
          : bladeSet(kind, cfg.n, PROFILES[cfg.profile], rand);
        const g = clumpGeometry(blades);
        const blade = new Float32Array(cfg.count * 4);
        const shape = new Float32Array(cfg.count * 4);
        const tint = new Float32Array(cfg.count * 4);
        for (let i = 0; i < cfg.count; i++) {
          blade.set([(rand() * 2 - 1) * layer.half, (rand() * 2 - 1) * layer.half, rand() * Math.PI * 2, rand()], i * 4);
          // Hauteur ×0,75 à 1,25 ; largeur ×0,85 à 1,15 ; courbure propre du bouquet.
          shape.set([0.75 + 0.5 * rand(), 0.85 + 0.3 * rand(), rand() * Math.PI * 2, 0.03 + 0.1 * rand()], i * 4);
          const tipHex = rand() < info.warmRate ? info.warm : info.tips[Math.floor(rand() * info.tips.length)];
          const c = jitter(tipHex, 0.05, rand);
          tint.set([c.r, c.g, c.b, 0.93 + 0.12 * rand()], i * 4);
        }
        g.setAttribute('aBlade', new THREE.InstancedBufferAttribute(blade, 4));
        g.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4));
        g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 4));
        g.instanceCount = cfg.count;

        const own = {
          uLayer: { value: new THREE.Vector4(layer.half, layer.fadeIn?.[0] ?? 0, layer.fadeIn?.[1] ?? 0, cfg.width) },
          uFadeOut: { value: new THREE.Vector2(layer.fadeOut[0], layer.fadeOut[1]) },
          uKind: { value: new THREE.Vector4(info.id, info.radius, 0, 0) },
          uKBase: { value: color(info.base) },
          uKHead: { value: color(info.head ?? info.base) },
        };
        const mat = toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
        mat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms, own);
          let vs = shader.vertexShader;
          vs = inject(vs, '#include <common>', VERTEX_HEAD);
          vs = inject(vs, '#include <beginnormal_vertex>', VERTEX_BLADE, true);
          vs = inject(vs, '#include <begin_vertex>', 'vec3 transformed = gPos;', true);
          shader.vertexShader = vs;
          // Pas d'inversion de normale sur la face arrière (normale déjà orientée vers le haut).
          shader.fragmentShader = inject(shader.fragmentShader, '#include <normal_fragment_begin>',
            'normal = normalize( vNormal ); nonPerturbedNormal = normal;');
        };
        mat.customProgramCacheKey = () => 'catgame-grass-blades-1';

        const mesh = new THREE.Mesh(g, mat);
        mesh.name = `Grass_${layer.name}_${kind}`;
        mesh.frustumCulled = false; // position calculée dans le shader : la sphère englobante est fausse
        mesh.receiveShadow = layer.receiveShadow; // ombre du chat sur la couche proche seulement
        mesh.castShadow = false;
        mesh.raycast = () => {}; // jamais touché par un Raycaster (clic au sol de Picker.js)
        this.group.add(mesh);
        this.layers.push({ layer, kind, cfg, mesh, geometry: g, own, trianglesPer: g.index.count / 3 });
      });
    });
  }

  /** Part des bouquets dessinés (0 à 1) ; les brins restants s'élargissent pour garder la couverture. */
  setDensity(fraction) {
    const f = Math.min(Math.max(fraction, 0.05), 1);
    for (const l of this.layers) {
      l.geometry.instanceCount = Math.round(l.cfg.count * f);
      l.own.uLayer.value.w = l.cfg.width * Math.min(1.5, 1 / Math.sqrt(f));
    }
  }

  /** Nombre de bouquets au total (toutes couches et familles). */
  get total() {
    return this.layers.reduce((s, l) => s + l.cfg.count, 0);
  }

  /** Nombre de bouquets dessinés actuellement (somme des couches). */
  get drawn() {
    return this.layers.reduce((s, l) => s + l.geometry.instanceCount, 0);
  }

  /** Triangles dessinés actuellement. */
  get triangles() {
    return this.layers.reduce((s, l) => s + l.geometry.instanceCount * l.trianglesPer, 0);
  }
}
