import * as THREE from 'three';
import { STONE, MOSS, color, jitter, toonMaterial } from '../style/palette.js';
import { heightAt as terrainHeightAt } from './Terrain.js';

/**
 * Ruines de la prairie (mission catgame_monde, 2026-10-26, agent R). Décision de l'utilisateur :
 * « des montagnes en arrière plan et des vestiges de mur, d'eglise ect pour un monde plus vivant » ;
 * murs : « si il peut grimper dessus ».
 *
 * Contenu : une petite église en ruine (nef sans toit avec un reste de toiture, pignon avec
 * clocher-mur et baie, porte en ogive, oculus, fenêtres en ogive cassées) face au point de départ,
 * et quatre pans de murs : deux murets BAS (≈ 0,42 m au-dessus du sol, le chat saute dessus et y
 * marche) et deux murs HAUTS (le chat les contourne ; l'un a une arche où il peut passer).
 *
 * Style (docs/recherche/style.md § 10, inspiration seulement) : pierres empilées aux arêtes
 * chanfreinées et normales « en coussin » (rendu doux en toon), joints en creux d'ombre sans
 * mortier, sommets en gradins, mousse sur le dessus, pierres tombées, rochers ronds au pied.
 * Couleurs : STONE et MOSS de palette.js (une teinte par bloc, `jitter`), matériau `toonMaterial`.
 * Pas de contour en coque inversée : les normales en coussin ne sont pas partagées entre faces,
 * la coque se fendrait aux arêtes ; les joints font office de trait.
 *
 * Coût : tout le décor est UNE géométrie fusionnée (un seul appel de dessin, plus la passe
 * d'ombre si `shadows`), 24 sommets et 44 triangles par pierre. Un maillage invisible
 * (`pickables`) porte le dessus des murets bas pour le clic ; il n'est jamais dessiné.
 *
 * Pose sur le relief : chaque pierre d'un mur isolé repose sur min(heightAt) à travers l'épaisseur
 * du mur à son abscisse, moins SINK (le mur suit le sol, comme dans les murets de référence) ;
 * l'église est de niveau, sa base est le minimum de heightAt sur toute son emprise moins SINK.
 *
 * Interface (détail dans la fiche 07_ruines de la mission) :
 * - `new Ruins(scene, { heightAt, shadows })` ; `ruins.mesh`, `ruins.pickables`, `ruins.obstacles`,
 *   `ruins.rubble`, `ruins.surfaces`, `ruins.stats`.
 * - `walkableAt(x, z, margin)`, `obstacleAt(x, z, margin)`, `resolve(x, z, radius, opts)`,
 *   `blockedSegment(ax, az, bx, bz, radius, opts)`, `detour(ax, az, bx, bz, radius, opts)`.
 */

export const SINK = 0.08;          // m : la base des pierres est enterrée de SINK sous le sol le plus bas
export const LOW_WALL_TOP = 0.42;  // m : hauteur des murets bas au-dessus de leur base locale (+SINK enterré)
const VD = 0.2;                    // m : profondeur radiale des claveaux d'arche

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ disposition (mètres, monde)

/**
 * Église : centre, demi-dimensions, orientation calculée pour que la façade (porte) regarde
 * l'origine. Placée à 12,5 m, légèrement à gauche de l'axe de la caméra de départ
 * (caméra (1,45 ; 0,42 ; 2,05) → cible (0 ; 0,22 ; 0)), derrière le chat : elle ne le masque pas.
 */
export const CHURCH = { x: -3.65, z: -11.95, width: 4.6, length: 7.6, thick: 0.5, eave: 2.9, apex: 4.7, belfry: 6.0 };

/**
 * Pans de murs isolés : extrémités p0 → p1 (x, z), épaisseur, hauteur (fonction de l'abscisse s),
 * `climbable` = muret bas praticable. Ouvertures : { c (abscisse du centre), w, sill, spring,
 * kind: 'pointed' | 'round' | 'circle', passable }.
 */
export const WALLS = [
  { name: 'muret_est', climbable: true, p0: [-1.15, -4.55], p1: [1.95, -4.2], thick: 0.46, seed: 21 },
  { name: 'muret_ouest', climbable: true, p0: [-4.45, 0.05], p1: [-5.3, -2.6], thick: 0.46, seed: 37 },
  {
    name: 'mur_haut_sud_est', climbable: false, p0: [3.0, -7.2], p1: [6.1, -8.9], thick: 0.48, seed: 53,
    top: (s) => (s < 0.7 ? 1.35 : s < 1.5 ? 1.95 : s < 2.3 ? 1.7 : s < 2.9 ? 1.25 : 0.95),
    openings: [{ c: 1.6, w: 0.6, sill: 0.85, spring: 1.35, kind: 'pointed' }],
  },
  {
    name: 'mur_arche_nord_ouest', climbable: false, p0: [-8.6, 2.2], p1: [-5.4, 5.3], thick: 0.5, seed: 71,
    top: (s) => (s < 0.5 ? 1.5 : s < 1.1 ? 2.0 : s < 3.4 ? 2.25 : s < 4.0 ? 1.7 : 1.1),
    openings: [{ c: 2.2, w: 1.0, sill: 0, spring: 0.95, kind: 'round', passable: true }],
  },
];

// ------------------------------------------------------------------ pierre chanfreinée

/** Topologie d'une boîte chanfreinée : 24 sommets (8 coins × 3 faces), 44 triangles. */
const BOX = (() => {
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push([(i & 1) ? 1 : -1, (i & 2) ? 1 : -1, (i & 4) ? 1 : -1]);
  const vid = (c, k) => c * 3 + k;
  const tris = [];
  const quad = (a, b, cc, d) => { tris.push([a, b, cc], [a, cc, d]); };
  const cornerOf = (sx, sy, sz) => corners.findIndex((s) => s[0] === sx && s[1] === sy && s[2] === sz);
  // Faces : 4 coins de signe s sur l'axe k, parcourus en cycle dans le plan des deux autres axes.
  for (let k = 0; k < 3; k++) {
    const i = (k + 1) % 3, j = (k + 2) % 3;
    for (const s of [-1, 1]) {
      const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
        const sg = [0, 0, 0]; sg[k] = s; sg[i] = a; sg[j] = b;
        return vid(cornerOf(...sg), k);
      });
      quad(...ring);
    }
  }
  // Arêtes : entre la face (i, si) et la face (j, sj), le long de l'axe k.
  for (let k = 0; k < 3; k++) {
    const i = (k + 1) % 3, j = (k + 2) % 3;
    for (const si of [-1, 1]) for (const sj of [-1, 1]) {
      const sg0 = [0, 0, 0], sg1 = [0, 0, 0];
      sg0[i] = sg1[i] = si; sg0[j] = sg1[j] = sj; sg0[k] = -1; sg1[k] = 1;
      const c0 = cornerOf(...sg0), c1 = cornerOf(...sg1);
      quad(vid(c0, i), vid(c1, i), vid(c1, j), vid(c0, j));
    }
  }
  // Coins.
  for (let c = 0; c < 8; c++) tris.push([vid(c, 0), vid(c, 1), vid(c, 2)]);
  // Sens : normale sortante (boîte convexe centrée : produit scalaire avec le centre du triangle).
  const P = [];
  for (let c = 0; c < 8; c++) for (let k = 0; k < 3; k++) {
    const p = corners[c].map((s, a) => s * (a === k ? 1 : 0.7));
    P.push(p);
  }
  const out = [];
  for (const t of tris) {
    const [a, b, cc] = t.map((v) => P[v]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = [(a[0] + b[0] + cc[0]) / 3, (a[1] + b[1] + cc[1]) / 3, (a[2] + b[2] + cc[2]) / 3];
    out.push(n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0 ? t : [t[0], t[2], t[1]]);
  }
  return { corners, tris: out.flat() };
})();

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1);
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1), _X = new THREE.Vector3(1, 0, 0);
const PILLOW = 0.3; // inclinaison des normales vers le coin : aplat légèrement bombé en toon

/** Accumulateur de géométrie fusionnée (positions, normales, couleurs, index). */
class Builder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.idx = []; this.count = 0; }

  /**
   * Pierre : demi-tailles (hx, hy, hz), chanfrein r, position, quaternion, couleur (THREE.Color),
   * mousse : { amount 0-1, color } posée sur les sommets dont la normale monde regarde vers le haut.
   */
  stone(hx, hy, hz, r, pos, quat, col, moss = null) {
    r = Math.min(r, 0.45 * Math.min(hx, hy, hz));
    const h = [hx, hy, hz], base = this.pos.length / 3;
    _m.compose(pos, quat, _s1);
    for (let c = 0; c < 8; c++) {
      const sg = BOX.corners[c];
      for (let k = 0; k < 3; k++) {
        _v.set(...[0, 1, 2].map((a) => sg[a] * (a === k ? h[a] : h[a] - r))).applyMatrix4(_m);
        _n.set(...[0, 1, 2].map((a) => (a === k ? sg[a] : 0) + PILLOW * sg[a])).normalize().applyQuaternion(quat);
        this.pos.push(_v.x, _v.y, _v.z);
        this.nrm.push(_n.x, _n.y, _n.z);
        let cr = col.r, cg = col.g, cb = col.b;
        if (moss && _n.y > 0.55) {
          const t = moss.amount * Math.min((_n.y - 0.55) / 0.3, 1);
          cr += (moss.color.r - cr) * t; cg += (moss.color.g - cg) * t; cb += (moss.color.b - cb) * t;
        }
        this.col.push(cr, cg, cb);
      }
    }
    for (const i of BOX.tris) this.idx.push(base + i);
    this.count++;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    const n = this.pos.length / 3;
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Teinte d'un bloc : crème majoritaire, terre cuite et rose rares, gris chaud plutôt en bas. */
function stoneColor(rand, low = false) {
  const w = [5, 3, 2, 0.6, 0.6, 2, low ? 2.5 : 0.8];
  let x = rand() * w.reduce((a, b) => a + b, 0), i = 0;
  while (x > w[i]) x -= w[i++];
  return jitter(STONE.blocks[Math.min(i, 6)], 0.045, rand);
}

function mossOf(rand, p) {
  if (rand() > p) return null;
  return { amount: 0.55 + 0.45 * rand(), color: color(rand() < 0.6 ? MOSS.base : MOSS.light) };
}

// ------------------------------------------------------------------ ouvertures

/** Demi-largeur intérieure d'une ouverture à la hauteur y (−1 si y est hors de l'ouverture). */
function halfIn(o, y) {
  if (o.kind === 'circle') {
    const R = o.w / 2, u = y - o.cy;
    return Math.abs(u) <= R ? Math.sqrt(R * R - u * u) : -1;
  }
  if (y < o.sill) return -1;
  if (y <= o.spring) return o.w / 2;
  const u = y - o.spring;
  if (o.kind === 'round') { const R = o.w / 2; return u <= R ? Math.sqrt(R * R - u * u) : -1; }
  // ogive équilatérale : deux arcs de rayon w centrés aux naissances opposées
  return u <= 0.866 * o.w ? Math.sqrt(o.w * o.w - u * u) - o.w / 2 : -1;
}

/** Demi-largeur extérieure de l'anneau de claveaux à la hauteur y (−1 hors anneau). */
function halfOut(o, y, vd) {
  if (o.kind === 'circle') {
    const R = o.w / 2 + vd, u = y - o.cy;
    return Math.abs(u) <= R ? Math.sqrt(R * R - u * u) : -1;
  }
  if (y < o.spring) return y >= o.sill ? o.w / 2 : -1;
  const u = y - o.spring;
  if (o.kind === 'round') { const R = o.w / 2 + vd; return u <= R ? Math.sqrt(R * R - u * u) : -1; }
  const R = o.w + vd, v = R * R - u * u - o.w * o.w / 4;
  return v >= 0 && R * R - u * u >= 0 ? Math.sqrt(R * R - u * u) - o.w / 2 : -1;
}

/** Demi-largeur à retirer des assises dans la bande [y0, y1] (0 si l'ouverture ne la touche pas). */
function cutHalf(o, y0, y1, vd) {
  let inMax = -1, outMin = Infinity, anyOut = false;
  for (let k = 0; k <= 8; k++) {
    const y = y0 + (y1 - y0) * k / 8;
    inMax = Math.max(inMax, halfIn(o, y));
    const ho = halfOut(o, y, vd);
    if (ho >= 0) { anyOut = true; outMin = Math.min(outMin, ho); } else outMin = Math.min(outMin, 0);
  }
  if (inMax < 0 && !anyOut) return 0;
  return Math.max(inMax >= 0 ? inMax + 0.02 : 0, anyOut ? outMin : 0);
}

/** Claveaux le long d'un arc : centres (s, y), angle de la tangente, longueur tangentielle. */
function voussoirs(o, vd) {
  const out = [];
  const arc = (cs, cy, R, a0, a1) => {
    const n = Math.max(2, Math.ceil((R * Math.abs(a1 - a0)) / 0.2));
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n;
      out.push({ s: cs + R * Math.cos(a), y: cy + R * Math.sin(a), ang: a + Math.PI / 2, len: R * Math.abs(a1 - a0) / n });
    }
  };
  if (o.kind === 'circle') arc(o.c, o.cy, o.w / 2 + vd / 2, 0, 2 * Math.PI);
  else if (o.kind === 'round') arc(o.c, o.spring, o.w / 2 + vd / 2, 0, Math.PI);
  else {
    const R = o.w + vd / 2, a = Math.acos(o.w / (2 * R));
    arc(o.c - o.w / 2, o.spring, R, 0, a);             // côté droit
    arc(o.c + o.w / 2, o.spring, R, Math.PI - a, Math.PI); // côté gauche
  }
  return out;
}

// ------------------------------------------------------------------ mur

/**
 * Construit un mur : assises de pierres le long de p0 → p1. Renvoie les données de collision :
 * tronçons (pour `obstacles`), pierres du dessus (pour `walkableAt`), base locale.
 */
function buildWall(B, spec, heightAt) {
  const rand = rng(spec.seed ?? 1);
  const [x0, z0] = spec.p0, [x1, z1] = spec.p1;
  const L = Math.hypot(x1 - x0, z1 - z0);
  const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
  const nx = -dz, nz = dx;                 // normale (axe z local du mur)
  const rotY = Math.atan2(-dz, dx);
  const T = spec.thick;
  const level = spec.baseY !== undefined;
  const baseAt = (s) => {
    if (level) return spec.baseY;
    const px = x0 + dx * s, pz = z0 + dz * s;
    return Math.min(heightAt(px - nx * T / 2, pz - nz * T / 2), heightAt(px, pz), heightAt(px + nx * T / 2, pz + nz * T / 2)) - SINK;
  };
  const top = spec.climbable ? () => LOW_WALL_TOP + SINK : (spec.top ?? (() => 1.5));
  const openings = (spec.openings ?? []).map((o) => ({ ...o, vd: o.vd ?? VD }));
  const qYaw = new THREE.Quaternion().setFromAxisAngle(_Y, rotY);
  const world = (s, t, y, out) => out.set(x0 + dx * s + nx * t, y, z0 + dz * s + nz * t);

  // Assises
  const rows = [];
  if (spec.climbable) {
    const H = LOW_WALL_TOP + SINK, n = 3;
    for (let i = 0; i < n; i++) rows.push([H * i / n, H * (i + 1) / n]);
  } else {
    const yMax = Math.max(...Array.from({ length: 64 }, (_, i) => top(L * i / 63)));
    let y = 0;
    while (y < yMax - 0.06) { const p = 0.2 + 0.08 * rand(); rows.push([y, y + p]); y += p; }
  }
  const lmin = spec.climbable ? 0.3 : 0.28, lmax = spec.climbable ? 0.52 : 0.55;
  const placed = rows.map(() => []);
  const tops = [];   // pierres du dessus (murets bas) : { s0, s1, top }
  const stones = []; // { s, top } pour le sommet des tronçons
  const bottoms = []; // pierres de la première assise : { s0, s1, bottom } (contrôle de pose)
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  const wallTop = (s) => top(Math.min(Math.max(s, 0), L));

  rows.forEach(([y0, y1], r) => {
    // intervalles libres de la rangée (ouvertures retirées)
    let free = [[0, L]];
    for (const o of openings) {
      const hw = cutHalf(o, y0 + 0.015, y1 - 0.015, o.vd);
      if (hw <= 0) continue;
      const a = o.c - hw, b = o.c + hw;
      free = free.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, a], [b, v]].filter(([m, n]) => n - m > 0.06)));
    }
    for (const [u, v] of free) {
      let s = u;
      let first = true;
      while (v - s > 0.06) {
        let len = first && r % 2 ? lmin * 0.6 + rand() * 0.2 : lmin + (lmax - lmin) * rand();
        first = false;
        if (v - (s + len) < lmin * 0.55) len = v - s;
        const sc = s + len / 2;
        const keep = y0 + (y1 - y0) * 0.5 < wallTop(sc);
        if (keep) placed[r].push([s, s + len]);
        s += len;
      }
    }
  });

  rows.forEach(([y0, y1], r) => {
    const climbTop = spec.climbable && r === rows.length - 1;
    for (const [s0, s1] of placed[r]) {
      const sc = (s0 + s1) / 2;
      const above = placed[r + 1]?.some(([a, b]) => a <= sc && sc <= b);
      const isTop = !above;
      const base = baseAt(sc);
      const hy = (y1 - y0) / 2 + 0.018;
      const hx = (s1 - s0) / 2 + 0.006;
      const tj = climbTop ? 0 : (rand() - 0.5) * 0.025;
      const yj = climbTop || r === 0 ? 0 : (rand() - 0.5) * 0.012;
      world(sc, tj, base + (y0 + y1) / 2 + yj, p);
      q.copy(qYaw);
      if (!climbTop) q.multiply(_q2.setFromAxisAngle(_Y, (rand() - 0.5) * 0.05)).multiply(_q.setFromAxisAngle(_Z, (rand() - 0.5) * 0.03));
      const col = stoneColor(rand, r === 0);
      const moss = isTop ? mossOf(rand, spec.climbable ? 0.75 : 0.65) : (rand() < 0.06 ? mossOf(rand, 1) : null);
      B.stone(hx, hy, T / 2 + (r === 0 ? 0.02 : 0), 0.045, p, q, col, moss);
      const yTop = base + y1;
      stones.push({ s: sc, s0, s1, top: yTop });
      if (climbTop) tops.push({ s0, s1, top: yTop });
      if (r === 0) bottoms.push({ s0, s1, bottom: base - 0.018 });
    }
  });

  // Claveaux des arches (seulement sous le sommet du mur ruiné)
  for (const o of openings) {
    for (const v of voussoirs(o, o.vd)) {
      if (v.y + o.vd / 2 > wallTop(v.s) + 0.05) continue;
      const base = baseAt(o.c);
      world(v.s, 0, base + v.y, p);
      q.copy(qYaw).multiply(_q.setFromAxisAngle(_Z, v.ang));
      B.stone(v.len / 2 + 0.01, o.vd / 2, T / 2 + 0.025, 0.04, p, q, stoneColor(rand), rand() < 0.15 ? mossOf(rand, 1) : null);
    }
  }

  // Tronçons pleins pour la collision (une ouverture « passable » coupe le mur au sol)
  let cuts = [[0, L]];
  for (const o of openings) {
    if (!o.passable) continue;
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    cuts = cuts.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, a], [b, v]].filter(([m, n]) => n - m > 0.05)));
  }
  const pieces = cuts.map(([u, v]) => {
    const inside = stones.filter((st) => st.s >= u && st.s <= v);
    const topY = inside.length ? Math.max(...inside.map((st) => st.top)) : baseAt((u + v) / 2);
    let ground = Infinity;
    for (let k = 0; k <= 8; k++) ground = Math.min(ground, baseAt(u + (v - u) * k / 8) + SINK);
    const sc = (u + v) / 2;
    return {
      name: spec.name, x: x0 + dx * sc, z: z0 + dz * sc, hx: (v - u) / 2, hz: T / 2, rotY,
      top: topY, ground, height: topY - ground, climbable: !!spec.climbable,
    };
  });

  return { name: spec.name, x0, z0, dx, dz, nx, nz, L, T, rotY, tops, bottoms, pieces, climbable: !!spec.climbable };
}

// ------------------------------------------------------------------ église

/** Repère local de l'église : x en travers, z le long de la nef, façade en +z tournée vers l'origine. */
function churchFrame(c) {
  const rotY = Math.atan2(-c.x, -c.z);
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  const toWorld = (lx, lz) => [c.x + lx * cos + lz * sin, c.z - lx * sin + lz * cos];
  return { rotY, toWorld };
}

function churchWalls(c, baseY) {
  const { toWorld } = churchFrame(c);
  const W = c.width, Lc = c.length, T = c.thick, e = c.eave, ap = c.apex;
  const zf = Lc / 2 - T / 2, zb = -Lc / 2 + T / 2, xs = W / 2 - T / 2;
  const mid = W / 2;
  const gable = (s) => e + (ap - e) * Math.max(0, 1 - Math.abs(s - mid) / (W / 2));
  return [
    {
      // Façade : pignon cassé à droite, clocher-mur, porte en ogive, oculus.
      name: 'eglise_facade', p0: toWorld(-W / 2, zf), p1: toWorld(W / 2, zf), thick: T, baseY, seed: 101,
      top: (s) => {
        const d = s - mid;
        if (Math.abs(d) < 0.62) return d > 0.22 ? c.belfry - 0.45 : c.belfry;
        if (d > 0.9 && d < 1.9) return gable(s) - 0.85;
        return gable(s);
      },
      openings: [
        { c: mid, w: 1.2, sill: 0, spring: 1.5, kind: 'pointed', passable: true },
        { c: mid, w: 0.7, cy: 3.6, kind: 'circle', vd: 0.16 },
        { c: mid, w: 0.5, sill: ap + 0.25, spring: ap + 0.65, kind: 'round', vd: 0.14 },
      ],
    },
    {
      // Mur gauche (sous le reste de toiture) : haut près de la façade, puis en gradins.
      name: 'eglise_gauche', p0: toWorld(-xs, Lc / 2 - T), p1: toWorld(-xs, -Lc / 2 + T), thick: T, baseY, seed: 113,
      top: (s) => (s < 2.6 ? e : s < 3.6 ? 2.3 : s < 4.8 ? 1.6 : s < 6.0 ? 1.1 : 1.5),
      openings: [
        { c: 1.4, w: 0.7, sill: 0.95, spring: 1.65, kind: 'pointed' },
        { c: 4.2, w: 0.7, sill: 0.95, spring: 1.65, kind: 'pointed' },
      ],
    },
    {
      name: 'eglise_droite', p0: toWorld(xs, -Lc / 2 + T), p1: toWorld(xs, Lc / 2 - T), thick: T, baseY, seed: 127,
      top: (s) => (s < 1.6 ? 0.9 : s < 3.2 ? 1.3 : s < 4.4 ? 2.0 : s < 5.4 ? 2.5 : e),
      openings: [
        { c: 2.2, w: 0.7, sill: 0.95, spring: 1.65, kind: 'pointed' },
        { c: 4.9, w: 0.7, sill: 0.95, spring: 1.65, kind: 'pointed' },
      ],
    },
    {
      // Chevet : haute fenêtre en ogive entre deux restes en gradins.
      name: 'eglise_chevet', p0: toWorld(W / 2, zb), p1: toWorld(-W / 2, zb), thick: T, baseY, seed: 139,
      top: (s) => (s < 1.0 ? 1.2 : s < 1.5 ? 1.8 : s < 3.1 ? 3.0 : s < 3.8 ? 2.0 : 1.0),
      openings: [{ c: 2.3, w: 0.8, sill: 1.0, spring: 1.9, kind: 'pointed' }],
    },
  ];
}

/** Reste de toiture : tuiles chanfreinées sur le versant gauche, près de la façade, bord déchiqueté. */
function buildRoof(B, c, baseY, rand) {
  const { rotY } = churchFrame(c);
  const { toWorld } = churchFrame(c);
  const W = c.width, Lc = c.length;
  const run = W / 2 + 0.15, rise = c.apex - c.eave;
  const alpha = Math.atan2(rise, W / 2);
  const slope = run / Math.cos(alpha);
  const rowStep = 0.27, tileW = 0.36;
  const qChurch = new THREE.Quaternion().setFromAxisAngle(_Y, rotY);
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  const roofCols = [0xeab39a, 0xdcb582, 0xeab39a, 0xf2cdbf];
  const zStart = Lc / 2 - 0.3;
  let n = 0;
  for (let i = 0; i * rowStep < slope * 0.78; i++) {
    const u = i * rowStep + 0.12;
    const depth = 2.5 - i * 0.16 - rand() * 0.45;
    const lx = -run + u * Math.cos(alpha);
    const ly = baseY + c.eave + 0.1 - 0.15 * Math.tan(alpha) + u * Math.sin(alpha);
    const off = (i % 2) * tileW / 2;
    for (let zz = off; zz < depth; zz += tileW) {
      const lz = zStart - zz - tileW / 2;
      const [wx, wz] = toWorld(lx, lz);
      p.set(wx, ly + 0.012 * i, wz);
      q.copy(qChurch).multiply(_q.setFromAxisAngle(_Z, alpha + 0.07 + (rand() - 0.5) * 0.06))
        .multiply(_q2.setFromAxisAngle(_X, (rand() - 0.5) * 0.05));
      const col = jitter(roofCols[Math.floor(rand() * roofCols.length)], 0.05, rand);
      B.stone(0.17, 0.035, tileW / 2 - 0.005, 0.025, p, q, col, rand() < 0.3 ? mossOf(rand, 1) : null);
      n++;
    }
  }
  return n;
}

// ------------------------------------------------------------------ boîtes orientées

function toLocal(o, x, z) {
  const ddx = x - o.x, ddz = z - o.z, c = Math.cos(o.rotY), s = Math.sin(o.rotY);
  return [ddx * c - ddz * s, ddx * s + ddz * c];
}

function toWorldBox(o, lx, lz) {
  const c = Math.cos(o.rotY), s = Math.sin(o.rotY);
  return [o.x + lx * c + lz * s, o.z - lx * s + lz * c];
}

/** Intersection segment / boîte agrandie de `pad` : premier t ∈ [0, 1] ou −1. */
function segBox(o, ax, az, bx, bz, pad) {
  const [lax, laz] = toLocal(o, ax, az), [lbx, lbz] = toLocal(o, bx, bz);
  const d = [lbx - lax, lbz - laz], a = [lax, laz], h = [o.hx + pad, o.hz + pad];
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (Math.abs(a[k]) > h[k]) return -1; continue; }
    let u = (-h[k] - a[k]) / d[k], v = (h[k] - a[k]) / d[k];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 > t1) return -1;
  }
  return t0;
}

// ------------------------------------------------------------------ classe publique

export class Ruins {
  /**
   * @param {THREE.Object3D|null} scene  scène où ajouter `ruins.group` (null : rien n'est ajouté)
   * @param {object} [opts]
   * @param {(x:number, z:number) => number} [opts.heightAt]  hauteur du sol (Terrain.js par défaut)
   * @param {boolean} [opts.shadows=true]  le décor projette et reçoit l'ombre du soleil
   */
  constructor(scene, { heightAt = terrainHeightAt, shadows = true } = {}) {
    this.heightAt = heightAt;
    const B = new Builder();
    const rand = rng(977);

    // Église, de niveau
    const c = CHURCH;
    const { toWorld } = churchFrame(c);
    let gmin = Infinity, gmax = -Infinity;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 8; j++) {
      const [wx, wz] = toWorld(-c.width / 2 + c.width * i / 6, -c.length / 2 + c.length * j / 8);
      const h = heightAt(wx, wz); gmin = Math.min(gmin, h); gmax = Math.max(gmax, h);
    }
    this.churchBase = gmin - SINK;
    this.churchGround = [gmin, gmax];
    const specs = [...churchWalls(c, this.churchBase), ...WALLS];
    this.walls = specs.map((sp) => buildWall(B, sp, heightAt));
    const stonesWalls = B.count;
    const tiles = buildRoof(B, c, this.churchBase, rand);

    /** Empreintes au sol (boîtes orientées) : murs (en tronçons) et rochers. */
    this.obstacles = this.walls.flatMap((w) => w.pieces);

    // Rochers ronds au pied des murs (obstacles non praticables)
    const boulders = [
      [c, -c.width / 2 - 0.55, c.length / 2 - 0.2, 0.42], [c, c.width / 2 + 0.5, -c.length / 2 + 0.6, 0.36],
      [c, c.width / 2 + 0.75, 1.2, 0.3],
    ];
    const pB = new THREE.Vector3(), qB = new THREE.Quaternion();
    const placeBoulder = (wx, wz, size, name) => {
      const g = heightAt(wx, wz);
      const yaw = rand() * Math.PI * 2;
      pB.set(wx, g + size * 0.25, wz);
      qB.setFromAxisAngle(_Y, yaw).multiply(_q.setFromAxisAngle(_X, (rand() - 0.5) * 0.3));
      const col = color(STONE.boulder).lerp(color(STONE.boulderShade), rand() * 0.25);
      B.stone(size * 1.15, size * 0.75, size, size * 0.42, pB, qB, col, mossOf(rand, 0.6));
      this.obstacles.push({ name, x: wx, z: wz, hx: size * 1.15, hz: size, rotY: yaw, top: g + size, ground: g, height: size, climbable: false });
    };
    boulders.forEach(([cc, lx, lz, size], i) => { const [wx, wz] = toWorld(lx, lz); placeBoulder(wx, wz, size, `rocher_eglise_${i}`); });
    { // au pied du mur haut sud-est
      const w = this.walls.find((x) => x.name === 'mur_haut_sud_est');
      placeBoulder(w.x0 + w.dx * 0.9 - w.nx * 0.6, w.z0 + w.dz * 0.9 - w.nz * 0.6, 0.33, 'rocher_mur_se');
    }

    // Pierres tombées (décor, listées dans `rubble` ; pas d'obstacle)
    this.rubble = [];
    const pR = new THREE.Vector3(), qR = new THREE.Quaternion();
    const scatter = (wall, count, spread) => {
      for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 12; tries++) {
          const s = wall.L * rand();
          const side = rand() < 0.5 ? -1 : 1;
          const t = side * (wall.T / 2 + 0.25 + spread * rand());
          const wx = wall.x0 + wall.dx * s + wall.nx * t, wz = wall.z0 + wall.dz * s + wall.nz * t;
          const r = Math.hypot(wx, wz);
          if (r < 3.4 || r > 17) continue;
          if (this.obstacleAt(wx, wz, 0.15)) continue;
          const hx = 0.13 + 0.12 * rand(), hy = 0.08 + 0.04 * rand(), hz = 0.12 + 0.08 * rand();
          const g = heightAt(wx, wz);
          pR.set(wx, g + hy * 0.45, wz);
          qR.setFromAxisAngle(_Y, rand() * Math.PI * 2)
            .multiply(_q.setFromAxisAngle(_X, (rand() - 0.5) * 0.5)).multiply(_q2.setFromAxisAngle(_Z, (rand() - 0.5) * 0.5));
          B.stone(hx, hy, hz, 0.04, pR, qR, stoneColor(rand), mossOf(rand, 0.55));
          this.rubble.push({ x: wx, z: wz, r: Math.max(hx, hz), top: g + hy * 1.45 });
          break;
        }
      }
    };
    for (const w of this.walls) scatter(w, w.climbable ? 2 : w.name.startsWith('eglise') ? 5 : 6, w.climbable ? 0.4 : 1.3);

    // Maillage unique
    this.geometry = B.geometry();
    this.material = toonMaterial(0xffffff, { vertexColors: true });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'Ruins';
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = shadows;
    this.mesh.matrixAutoUpdate = false;

    // Dessus des murets bas : surfaces praticables et maillage de clic invisible
    this.surfaces = this.walls.filter((w) => w.climbable).map((w) => {
      const topY = w.tops.reduce((a, t) => a + t.top, 0) / Math.max(1, w.tops.length);
      const piece = w.pieces[0];
      return { name: w.name, x: piece.x, z: piece.z, hx: piece.hx, hz: piece.hz, rotY: w.rotY, top: topY,
        topMin: Math.min(...w.tops.map((t) => t.top)), topMax: Math.max(...w.tops.map((t) => t.top)) };
    });
    const pp = [], ii = [];
    for (const w of this.walls) {
      if (!w.climbable) continue;
      for (const t of w.tops) {
        const b = pp.length / 3;
        for (const [s, tt] of [[t.s0, -w.T / 2], [t.s1, -w.T / 2], [t.s1, w.T / 2], [t.s0, w.T / 2]]) {
          pp.push(w.x0 + w.dx * s + w.nx * tt, t.top, w.z0 + w.dz * s + w.nz * tt);
        }
        ii.push(b, b + 2, b + 1, b, b + 3, b + 2);
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setIndex(ii);
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    tg.computeBoundingSphere();
    this.walkMesh = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.walkMesh.name = 'RuinsWalkable';
    this.walkMesh.visible = false; // jamais dessiné ; le Raycaster de three ignore `visible`
    this.walkMesh.userData.ruins = this;
    /** Meshes à donner au clic (Picker : `world.pickables`), en plus du terrain. */
    this.pickables = [this.walkMesh];

    this.group = new THREE.Group();
    this.group.name = 'RuinsGroup';
    this.group.add(this.mesh, this.walkMesh);
    if (scene) scene.add(this.group);

    this.stats = {
      stones: B.count, wallStones: stonesWalls, roofTiles: tiles, triangles: this.geometry.index.count / 3,
      vertices: this.geometry.attributes.position.count, drawCalls: 1, shadowDrawCalls: shadows ? 1 : 0,
    };
  }

  /**
   * Hauteur (y monde) du dessus d'un muret bas si (x, z) est dessus, sinon null.
   * `margin` (m) : retrait depuis les bords longs (ex. demi-largeur des pattes).
   */
  walkableAt(x, z, margin = 0) {
    let best = null;
    for (const w of this.walls) {
      if (!w.climbable) continue;
      const rx = x - w.x0, rz = z - w.z0;
      const s = rx * w.dx + rz * w.dz, t = rx * w.nx + rz * w.nz;
      if (Math.abs(t) > w.T / 2 - margin || s < margin || s > w.L - margin) continue;
      for (const st of w.tops) {
        if (s >= st.s0 && s <= st.s1) { if (best === null || st.top > best) best = st.top; break; }
      }
    }
    return best;
  }

  /** Premier obstacle dont l'empreinte (agrandie de `margin`) contient (x, z), sinon null. */
  obstacleAt(x, z, margin = 0) {
    for (const o of this.obstacles) {
      const [lx, lz] = toLocal(o, x, z);
      if (Math.abs(lx) <= o.hx + margin && Math.abs(lz) <= o.hz + margin) return o;
    }
    return null;
  }

  /** Filtre commun : `y` (hauteur des pieds) ignore les obstacles dont le dessus est sous les pieds ; `climbable` false ignore les murets bas. */
  _active(o, opts) {
    if (opts.climbable === false && o.climbable) return false;
    if (opts.y !== undefined && opts.y >= o.top - 0.05) return false;
    return true;
  }

  /**
   * Repousse un disque (centre x, z, rayon `radius`) hors des obstacles actifs (deux passes).
   * opts : { y, climbable } (voir `_active`). Renvoie { x, z, hit } (hit = dernier obstacle touché ou null).
   */
  resolve(x, z, radius, opts = {}, out = { x: 0, z: 0, hit: null }) {
    out.x = x; out.z = z; out.hit = null;
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.obstacles) {
        if (!this._active(o, opts)) continue;
        const [lx, lz] = toLocal(o, out.x, out.z);
        if (Math.abs(lx) > o.hx + radius || Math.abs(lz) > o.hz + radius) continue;
        const cx = Math.max(-o.hx, Math.min(o.hx, lx)), cz = Math.max(-o.hz, Math.min(o.hz, lz));
        let ex = lx - cx, ez = lz - cz;
        const d = Math.hypot(ex, ez);
        let nlx, nlz;
        if (d > 1e-6) {
          if (d >= radius) continue;
          nlx = cx + ex / d * radius; nlz = cz + ez / d * radius;
        } else {
          // centre dans la boîte : sortie par le côté le plus proche
          const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx || 1) * (o.hx + radius); nlz = lz; }
          else { nlx = lx; nlz = Math.sign(lz || 1) * (o.hz + radius); }
        }
        [out.x, out.z] = toWorldBox(o, nlx, nlz);
        out.hit = o;
      }
    }
    return out;
  }

  /**
   * Le segment a → b (parcouru par un disque de rayon `radius`) touche-t-il un obstacle actif ?
   * Renvoie { t, obstacle } (t ∈ [0, 1], premier contact le long du segment) ou null.
   */
  blockedSegment(ax, az, bx, bz, radius = 0, opts = {}) {
    let best = null;
    for (const o of this.obstacles) {
      if (!this._active(o, opts)) continue;
      const t = segBox(o, ax, az, bx, bz, radius);
      if (t >= 0 && (!best || t < best.t)) best = { t, obstacle: o };
    }
    return best;
  }

  /**
   * Point de passage pour contourner le premier obstacle entre a et b : coin de sa boîte agrandie
   * de `radius` + 0,15 m, atteignable depuis a sans retoucher cet obstacle, qui minimise
   * |a→coin| + |coin→b|. Renvoie { x, z, obstacle } ou null si le segment est libre.
   * À rappeler depuis le coin atteint (plusieurs obstacles).
   */
  detour(ax, az, bx, bz, radius = 0, opts = {}) {
    const hit = this.blockedSegment(ax, az, bx, bz, radius, opts);
    if (!hit) return null;
    const o = hit.obstacle, pad = radius + 0.15;
    let best = null;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [cx, cz] = toWorldBox(o, sx * (o.hx + pad), sz * (o.hz + pad));
      if (Math.hypot(cx - ax, cz - az) < 0.05) continue; // coin déjà atteint
      if (segBox(o, ax, az, cx, cz, radius) >= 0) continue;
      const cost = Math.hypot(cx - ax, cz - az) + Math.hypot(bx - cx, bz - cz);
      if (!best || cost < best.cost) best = { x: cx, z: cz, obstacle: o, cost };
    }
    if (!best) {
      // a est dans un coin mort (contre la boîte) : coin le plus proche de a
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const [cx, cz] = toWorldBox(o, sx * (o.hx + pad), sz * (o.hz + pad));
        const cost = Math.hypot(cx - ax, cz - az);
        if (cost < 0.05) continue;
        if (!best || cost < best.cost) best = { x: cx, z: cz, obstacle: o, cost };
      }
    }
    return best;
  }

  /** Rien d'animé pour l'instant (présent pour l'appel uniforme depuis World.js). */
  update() {}

  dispose() {
    this.group.parent?.remove(this.group);
    this.geometry.dispose();
    this.material.dispose();
    this.walkMesh.geometry.dispose();
    this.walkMesh.material.dispose();
  }
}
