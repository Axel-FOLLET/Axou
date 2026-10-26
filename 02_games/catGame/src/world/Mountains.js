import * as THREE from 'three';
import { MOUNTAIN, LIGHT } from '../style/palette.js';

/**
 * Montagnes douces au loin (mission catgame_monde, 2026-10-26) : trois couronnes de collines
 * arrondies autour de la prairie, hors d'atteinte (au-delà de 95 m ; limite de la prairie : 18 m).
 * Style « dessin animé doux », cosy, inspiré de Tiny Glade : sommets ronds, aplats tendres, pied
 * fondu dans l'horizon.
 *
 * Tour 2 (captures du chef : sommets en pointe triangulaire) : chaque sommet est un dôme
 * (1 − s²)^1,2 (dessus arrondi, pied sans cassure) et non plus une cloche en cosinus ; les dômes
 * sont unis par un maximum adouci (cols arrondis, pas de pointe à la rencontre de deux sommets) ;
 * sommets plus larges que hauts (largeur ≥ 2,5 × hauteur) ; grille plus fine (192 × 16 cases).
 *
 * Brouillard : FOG (palette.js) va de 8 à 34 m, les montagnes seraient donc entièrement couleur
 * d'horizon. Elles ont `fog: false` et leur propre perspective atmosphérique, calculée une fois par
 * sommet : couleur de la couronne (MOUNTAIN de palette.js, agent S), plus claire et chaude côté
 * soleil, mélangée à la brume (`MOUNTAIN.haze` = FOG.color) d'autant plus que la couronne est loin
 * et que le point est bas ; au pied, la couleur est exactement celle de l'horizon, d'où un raccord
 * sans ligne avec le sol dans le brouillard et le bas du ciel. `toneMapped: false`, comme le ciel
 * et la couleur du brouillard (même pixel à l'horizon).
 *
 * Coût : 3 maillages de 192 × 16 cases (18 432 triangles en tout), MeshBasicMaterial (aucun
 * calcul de lumière), pas d'ombre, jamais touchés par un Raycaster.
 */

/** Ombre des flancs : la couleur de la couronne tirée vers cette lavande (jamais gris ni noir). */
const SHADE_TINT = 0x8a8fc0;
/** Éclat côté soleil : crème chaud (MOUNTAIN.snow). */
const LIT = MOUNTAIN.snow;

/**
 * Couronnes : rayon intérieur et extérieur (m), nombre de sommets, hauteur (m, min et max),
 * largeur d'un sommet (rayon du dôme, m, min et max), part de brume (0 = couleur pleine,
 * 1 = horizon), couleur.
 */
export const RANGES = [
  { name: 'proche', inner: 95, outer: 165, peaks: 13, height: [10, 17], width: [34, 52], haze: MOUNTAIN.hazeNear, tint: MOUNTAIN.near, seed: 3 },
  { name: 'lointaine', inner: 140, outer: 250, peaks: 11, height: [18, 30], width: [52, 80], haze: MOUNTAIN.hazeFar, tint: MOUNTAIN.far, seed: 11 },
  { name: 'derniere', inner: 200, outer: 330, peaks: 9, height: [28, 42], width: [80, 115], haze: 0.72, tint: MOUNTAIN.farther, seed: 29 },
];
/** m : rayon d'arrondi des cols (maximum adouci entre deux dômes). */
const SADDLE = 7;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Maximum adouci (polynomial) : comme max(a, b), mais arrondi sur une bande de k mètres. */
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Sommets d'une couronne : centres répartis sur le cercle médian (avec écart), hauteur, largeur. */
function peaksOf(cfg) {
  const rand = rng(cfg.seed);
  const mid = 0.5 * (cfg.inner + cfg.outer);
  const out = [];
  for (let i = 0; i < cfg.peaks; i++) {
    const a = ((i + 0.5 * rand()) / cfg.peaks) * Math.PI * 2;
    const r = mid + (rand() - 0.5) * 0.25 * (cfg.outer - cfg.inner);
    out.push({
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      h: cfg.height[0] + (cfg.height[1] - cfg.height[0]) * rand(),
      w: cfg.width[0] + (cfg.width[1] - cfg.width[0]) * rand(),
    });
  }
  return out;
}

/**
 * Hauteur d'une couronne en (x, z) : union adoucie de dômes (1 − s²)^1,2, ramenée à 0 sur les
 * bords intérieur et extérieur de la couronne.
 */
function rangeHeight(cfg, peaks, x, z) {
  let h = 0;
  for (const p of peaks) {
    const s = Math.hypot(x - p.x, z - p.z) / p.w;
    if (s < 1) h = smax(h, p.h * Math.pow(1 - s * s, 1.2), SADDLE);
  }
  const r = Math.hypot(x, z);
  const span = cfg.outer - cfg.inner;
  return h * smoothstep(cfg.inner, cfg.inner + 0.2 * span, r) * (1 - smoothstep(cfg.outer - 0.15 * span, cfg.outer, r));
}

function rangeMesh(cfg, sunDir, angular = 192, radial = 16) {
  const peaks = peaksOf(cfg);
  const maxH = cfg.height[1];
  const nA = angular, nR = radial + 1;
  const pos = new Float32Array(nA * nR * 3);
  const heights = new Float32Array(nA * nR);
  for (let a = 0; a < nA; a++) {
    const ang = (a / nA) * Math.PI * 2;
    for (let r = 0; r < nR; r++) {
      const rad = cfg.inner + (cfg.outer - cfg.inner) * (r / radial);
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const h = rangeHeight(cfg, peaks, x, z);
      const k = a * nR + r;
      pos.set([x, h, z], k * 3);
      heights[k] = h;
    }
  }
  const idx = [];
  for (let a = 0; a < nA; a++) {
    const a2 = (a + 1) % nA;
    for (let r = 0; r < radial; r++) {
      const p = a * nR + r, q = a2 * nR + r;
      idx.push(p, q, p + 1, q, q + 1, p + 1); // sens direct vu d'en haut (normales vers +y)
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();

  // Couleur par sommet : ombrage doux (demi-Lambert) entre ombre lavande et couleur de couronne,
  // éclat chaud côté soleil, puis brume : plus forte en bas (pied = horizon exact).
  const nrm = g.attributes.normal;
  const col = new Float32Array(nA * nR * 3);
  const base = new THREE.Color(cfg.tint);
  const shade = new THREE.Color(SHADE_TINT).lerp(base, 0.55);
  const lit = new THREE.Color(LIT);
  const haze = new THREE.Color(MOUNTAIN.haze);
  const c = new THREE.Color(), n = new THREE.Vector3();
  for (let k = 0; k < nA * nR; k++) {
    n.fromBufferAttribute(nrm, k);
    const lambert = 0.5 + 0.5 * n.dot(sunDir); // 0 à 1, sans face noire
    c.copy(shade).lerp(base, smoothstep(0.25, 0.75, lambert));
    c.lerp(lit, 0.3 * smoothstep(0.7, 1.0, lambert));
    const foot = 1 - smoothstep(0, 0.55 * maxH, heights[k]);
    c.lerp(haze, cfg.haze + (1 - cfg.haze) * foot);
    col.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();

  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = `Mountains_${cfg.name}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {}; // jamais touché par Picker.js
  return { mesh, peaks, triangles: idx.length / 3 };
}

/**
 * Montagnes : `mountains.group` (à ajouter à la scène), `mountains.triangles`.
 * `sunDir` : direction du soleil (normalisée ou non), par défaut LIGHT.sun.offset.
 */
export class Mountains {
  constructor({ sunDir = new THREE.Vector3(...LIGHT.sun.offset) } = {}) {
    const dir = sunDir.clone().normalize();
    this.group = new THREE.Group();
    this.group.name = 'Mountains';
    this.ranges = RANGES.map((cfg) => rangeMesh(cfg, dir));
    for (const r of this.ranges) this.group.add(r.mesh);
    this.triangles = this.ranges.reduce((s, r) => s + r.triangles, 0);
  }

  /** Hauteur maximale de chaque couronne (m), pour vérification. */
  get maxHeights() {
    return this.ranges.map((r) => {
      const p = r.mesh.geometry.attributes.position;
      let m = 0;
      for (let i = 0; i < p.count; i++) m = Math.max(m, p.getY(i));
      return m;
    });
  }
}
