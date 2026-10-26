import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from '../style/palette.js';

/**
 * Casque de chevalier mignon (mission catgame_monde, 2026-10-26, lot H).
 * Décision de l'utilisateur : « le casque reste c'est mignon mais la visière peut être levée ou
 * baissée ». Style « dessin animé doux » (docs/recherche/style.md) : coque ronde en métal clair et
 * chaud (pas chromé), bourrelets laiton doux, plumet rose pastel en boules, contour brun de palette.js.
 *
 * Géométrie construite ici (aucun fichier externe), ajustée au chargement sur la tête réelle du GLB :
 * - repère « casque » : axes de `cat.root` (+Y haut, +Z museau), origine = os `Head` dans la pose de
 *   liaison du skin, unités = mètres ; le groupe du casque est enfant de l'os `Head` (il suit la tête
 *   dans tous les clips et dans la couche procédurale) et compense l'échelle du modèle (0,0864 m par
 *   unité du rig, mesuré) ;
 * - nuage de points : sommets du corps dont l'os dominant est `Head`, `Nose`, `Mouth`,
 *   `Ear_connector*` ou `Neck002`, poussés le long de la normale de la longueur réelle des poils
 *   (`furMask` posé par Fur.js × 0,022 m, MAX_LENGTH de Fur.js) : la coque passe au-dessus des
 *   pointes de la fourrure ;
 * - yeux : sphères englobantes de `EyeA` / `EyeB` ; oreilles : axes os `Ear` → `Ear002` et
 *   `Ear006` → `Ear004` (rattachés à `Neck002` par `Ear_connector*`, pas à `Head`), trous percés
 *   autour de ces axes, rayon = section réelle de l'oreille à la traversée + marge de mouvement.
 *
 * Coque : ellipsoïde de demi-axes (k·R, R, R) centré au niveau des yeux ; sa symétrie autour de
 * l'axe X permet à la visière (même forme, un peu plus grande) de tourner autour de la charnière
 * latérale sans traverser la coque. Les bords (ouverture du visage, trous d'oreilles, fentes) sont
 * découpés exactement par des fonctions de distance (pas de bords en escalier).
 * Visière : pleine hauteur au centre (fentes devant les yeux), bride étroite vers les charnières ;
 * ce bord haut est calculé pour que la visière levée ne couvre pas les trous d'oreilles (les
 * oreilles, tenues par `Neck002`, bougent jusqu'à ~50° autour de la charnière dès |x| ≈ 50 mm).
 *
 * Interface : voir la classe `Helmet` (setVisor, update, visorOpen, setVisible, hit).
 */

/** Couleurs du casque (sRGB). Candidates pour palette.js (fichier de S) : on les garde ici. */
export const HELMET_COLORS = {
  metal: 0xeee3cf,      // étain clair et chaud (crème argentée), pas chromé
  trim: 0xf0c886,       // laiton doux : bourrelets, charnières, rivets
  plume: 0xffb0c4,      // plumet rose pastel
  plumeLight: 0xffd3de, // boules claires du plumet
};

const FUR_MAX = 0.022;      // m, MAX_LENGTH de Fur.js (longueur pour un facteur 1)
const FUR_FALLBACK = 1.6;   // facteur si `furMask` manque (le plus long de Fur.js)
const GAP = 0.005;          // m, jeu entre la pointe des poils et la coque
const TUBE = 0.0045;        // m, rayon des bourrelets (bords, trous d'oreilles, visière)
const VISOR_GAP = TUBE + 0.0035; // m, visière au-dessus de la coque (franchit les bourrelets)
// Trous d'oreilles. Les oreilles sont rattachées à `Neck002`, pas à `Head` : les clips et la couche
// procédurale (frémissements ±0,35 rad) les déplacent par rapport au casque. Valeurs réglées par
// simulation hors navigateur (8 états, 9 s chacun ; fiche 03) : empreinte des oreilles sur la coque
// décalée de ~12 mm vers l'arrière-haut et ~4 mm vers l'extérieur, rayon utile ~55 mm.
const EAR_MARGIN = 0.020;   // m, ajouté à la section de l'oreille au repos
const HOLE_BACK = 0.012;    // m, centre du trou décalé vers l'arrière-haut
const HOLE_OUT = 0.004;     // m, centre du trou décalé vers l'extérieur
const VISOR_EAR_CLEAR = 0.006; // m, jeu entre la visière levée et le bord des trous d'oreilles
const BROW_ANGLE = 0.10;    // rad au-dessus du haut des yeux : bord du front de la coque
const FACE_SIDE = 0.16;     // rad d'azimut au-delà du bord extérieur des yeux : largeur du visage
const FACE_BLEND = 0.45;    // rad d'azimut : transition front → côtés
const SIDE_LAT = -0.22;     // rad, latitude du bord inférieur sur les côtés
const BACK_LAT = -0.20;     // rad, latitude du bord inférieur à l'arrière (nuque libre en sommeil)
const PLUME_LAT = 1.0;      // rad, latitude du support du plumet (vers l'arrière, hors de la visière levée)
const VISOR_BELOW = 0.10;   // rad sous le bas des yeux : bord inférieur de la visière baissée
const VISOR_OVER = 0.16;    // rad de recouvrement de la visière sur le front de la coque
const OPEN_EXTRA = 0.06;    // rad : visière levée un peu au-dessus du bord du front
const VISOR_TIME = 0.3;     // s, durée du mouvement de la visière
const _noRaycast = () => {};

const smooth = THREE.MathUtils.smoothstep;

// ------------------------------------------------------------------ lecture de la tête du GLB

/** Données de la tête en repère casque (mètres, axes de root, origine = os Head au repos). */
function readHead(cat) {
  const body = cat.meshes.find((m) => m.name === 'CatBody') ?? cat.meshes.find((m) => m.isSkinnedMesh);
  cat.root.updateMatrixWorld(true);
  const rootInv = cat.root.matrixWorld.clone().invert();
  const toRoot = (mesh) => rootInv.clone().multiply(mesh.matrixWorld).multiply(mesh.bindMatrix);
  const b2r = toRoot(body);
  const bones = body.skeleton.bones;
  const boneMatrix = (name) => {
    const i = bones.findIndex((b) => b.name === name);
    return i < 0 ? null : b2r.clone().multiply(body.skeleton.boneInverses[i].clone().invert());
  };
  const headM = boneMatrix('Head');
  const origin = new THREE.Vector3().setFromMatrixPosition(headM);
  const bonePos = (name) => new THREE.Vector3().setFromMatrixPosition(boneMatrix(name)).sub(origin);

  const g = body.geometry;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const mask = g.getAttribute('furMask');
  const si = g.getAttribute('skinIndex');
  const sw = g.getAttribute('skinWeight');
  const nm = new THREE.Matrix3().getNormalMatrix(b2r);
  const earL = new Set(['Ear', 'Ear001', 'Ear002']);
  const fur = [];
  const ears = { L: [], R: [] };
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    const name = bones[si.getComponent(i, best)].name;
    const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(b2r).sub(origin);
    if (/^Ear(?!_connector)/.test(name)) { (earL.has(name) ? ears.L : ears.R).push(p); continue; }
    if (!/^(Head|Nose|Mouth|Ear_connector|Neck002)/.test(name)) continue;
    n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
    fur.push(p.addScaledVector(n, FUR_MAX * (mask ? mask.getX(i) : FUR_FALLBACK)));
  }
  const eyes = cat.meshes.filter((m) => m !== body && m.isSkinnedMesh).map((eye) => {
    eye.geometry.computeBoundingSphere();
    const s = eye.geometry.boundingSphere.clone().applyMatrix4(toRoot(eye));
    s.center.sub(origin);
    return s;
  });
  return {
    headM, origin, fur, eyes,
    ears: [
      { base: bonePos('Ear'), tip: bonePos('Ear002'), verts: ears.L },
      { base: bonePos('Ear006'), tip: bonePos('Ear004'), verts: ears.R },
    ],
  };
}

// ------------------------------------------------------------------ forme

/** Direction normalisée d'un point relatif au centre, pour un ellipsoïde (k·R, R, R). */
function dirOf(v, k, out = new THREE.Vector3()) {
  return out.set(v.x / k, v.y, v.z).normalize();
}
const latOf = (d) => Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
const aziOf = (d) => Math.atan2(d.x, d.z);
const alphaOf = (d) => Math.atan2(d.y, d.z); // angle autour de l'axe X (charnière), 0 = devant

/**
 * Ajuste la coque : centre au niveau des yeux, recherche de la profondeur du centre et de
 * l'aplatissement k qui donnent le plus petit volume tout en couvrant la fourrure.
 */
function design(head) {
  const { fur, eyes } = head;
  const eyeY = eyes.reduce((s, e) => s + e.center.y, 0) / eyes.length;
  let best = null;
  for (let cz = -0.04; cz <= 0.08 + 1e-9; cz += 0.004) {
    const C = new THREE.Vector3(0, eyeY, cz);
    // Angles des yeux autour de la charnière (axe X passant par C) et azimut de leur bord extérieur.
    let eyeAMin = Infinity, eyeAMax = -Infinity;
    for (const e of eyes) {
      const y = e.center.y - C.y, z = e.center.z - C.z;
      const a = Math.atan2(y, z), h = Math.asin(Math.min(1, e.radius / Math.hypot(y, z)));
      eyeAMin = Math.min(eyeAMin, a - h); eyeAMax = Math.max(eyeAMax, a + h);
    }
    for (let k = 0.9; k <= 1.4 + 1e-9; k += 0.02) {
      let faceAzi = 0;
      for (const e of eyes) {
        const z = e.center.z - C.z;
        faceAzi = Math.max(faceAzi, Math.atan2((Math.abs(e.center.x) + e.radius) / k, z));
      }
      const shape = {
        C, k, browLat: eyeAMax + BROW_ANGLE, faceAzi: faceAzi + FACE_SIDE,
        visorLow: eyeAMin - VISOR_BELOW, visorHigh: eyeAMax + BROW_ANGLE + VISOR_OVER,
      };
      let R = 0;
      const v = new THREE.Vector3(), d = new THREE.Vector3();
      for (const p of fur) {
        v.subVectors(p, C);
        dirOf(v, k, d);
        if (!domeCovers(shape, d) && !visorCovers(shape, d)) continue;
        R = Math.max(R, Math.hypot(v.x / k, v.y, v.z));
      }
      R += GAP;
      const vol = k * R * R * R;
      if (!best || vol < best.vol) best = { ...shape, R, vol };
    }
  }
  return best;
}

/** Latitude du bord inférieur de la coque selon l'azimut : front (sourcil), côtés, arrière. */
function rimLat(shape, azi) {
  const a = Math.abs(azi);
  const side = THREE.MathUtils.lerp(shape.browLat, SIDE_LAT, smooth(a, shape.faceAzi, shape.faceAzi + FACE_BLEND));
  return THREE.MathUtils.lerp(side, BACK_LAT, smooth(a, Math.PI * 0.55, Math.PI * 0.9));
}
const domeCovers = (shape, d) => latOf(d) > rimLat(shape, aziOf(d));
const visorCovers = (shape, d) => {
  const a = alphaOf(d);
  return a > shape.visorLow && a < shape.visorHigh;
};

// ------------------------------------------------------------------ géométrie

/**
 * Morceau d'ellipsoïde (demi-axes kR, R, R) découpé par une fonction de distance signée
 * `sdf(d, p)` en mètres (> 0 : gardé) ; d = direction normalisée, p = point (relatif au centre).
 * Triangles de la grille latitude-longitude coupés exactement sur sdf = 0.
 */
function ellipsoidPatch(R, k, sdf, nAzi = 112, nLat = 72) {
  const pt = (d) => new THREE.Vector3(d.x * k * R, d.y * R, d.z * R);
  const normal = (d) => new THREE.Vector3(d.x / k, d.y, d.z).normalize();
  const grid = [];
  for (let j = 0; j <= nLat; j++) {
    const th = (j / nLat) * Math.PI;
    const row = [];
    for (let i = 0; i <= nAzi; i++) {
      const ph = (i / nAzi) * Math.PI * 2;
      const d = new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      row.push({ d, f: sdf(d, pt(d)) });
    }
    grid.push(row);
  }
  const positions = [], normals = [];
  const lerpV = (a, b) => {
    const t = a.f / (a.f - b.f);
    const d = a.d.clone().lerp(b.d, t).normalize();
    return { d, f: 0 };
  };
  const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
  const emit = (poly) => {
    for (let i = 1; i + 1 < poly.length; i++) {
      let tri = [poly[0], poly[i], poly[i + 1]];
      const p = tri.map((v) => pt(v.d));
      _e1.subVectors(p[1], p[0]); _e2.subVectors(p[2], p[0]);
      const c = _e1.cross(_e2);
      if (c.lengthSq() < 1e-14) continue;
      if (c.dot(normal(tri[0].d)) < 0) { tri = [tri[0], tri[2], tri[1]]; p.splice(1, 2, p[2], p[1]); }
      for (let m = 0; m < 3; m++) {
        positions.push(p[m].x, p[m].y, p[m].z);
        const nn = normal(tri[m].d);
        normals.push(nn.x, nn.y, nn.z);
      }
    }
  };
  const clip = (tri) => {
    // Sutherland-Hodgman contre f >= 0.
    const out = [];
    for (let i = 0; i < 3; i++) {
      const a = tri[i], b = tri[(i + 1) % 3];
      if (a.f >= 0) out.push(a);
      if ((a.f >= 0) !== (b.f >= 0)) out.push(lerpV(a, b));
    }
    if (out.length >= 3) emit(out);
  };
  for (let j = 0; j < nLat; j++) {
    for (let i = 0; i < nAzi; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i], d = grid[j + 1][i + 1];
      clip([a, c, d]);
      clip([a, d, b]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Tube fermé le long d'une suite de points. */
function tube(points, radius = TUBE, segments = 160) {
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, 8, true);
}

// ------------------------------------------------------------------ casque

export class Helmet {
  /**
   * Construit le casque et l'attache à l'os `Head` du chat (visière levée).
   * @param {import('./Cat.js').Cat} cat chat déjà construit (Cat.load)
   */
  constructor(cat) {
    this.cat = cat;
    const head = readHead(cat);
    const shape = design(head);
    this.shape = shape;
    const { C, k, R } = shape;

    // Groupe enfant de l'os Head : repère casque (axes de root, mètres, origine = os Head).
    this.group = new THREE.Group();
    this.group.name = 'Helmet';
    const local = head.headM.clone().invert().multiply(new THREE.Matrix4().makeTranslation(head.origin));
    local.decompose(this.group.position, this.group.quaternion, this.group.scale);
    cat.rig.head.add(this.group);

    // Centre de la coque et de la charnière.
    this.shell = new THREE.Group();
    this.shell.position.copy(C);
    this.group.add(this.shell);

    const metal = toonMaterial(HELMET_COLORS.metal, { side: THREE.DoubleSide });
    const trim = toonMaterial(HELMET_COLORS.trim);
    const plume = toonMaterial(HELMET_COLORS.plume);
    const plumeLight = toonMaterial(HELMET_COLORS.plumeLight);
    const outline = outlineMaterial();
    this._materials = [metal, trim, plume, plumeLight, outline];
    this.meshes = [];
    const add = (parent, geo, mat, withOutline = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = _noRaycast;
      parent.add(m);
      this.meshes.push(m);
      if (withOutline) {
        const o = new THREE.Mesh(geo, outline);
        o.raycast = _noRaycast;
        m.add(o);
      }
      return m;
    };

    // Trous d'oreilles : axe de l'oreille, rayon = section de l'oreille à la traversée + marge.
    this.holes = head.ears.map((ear) => {
      const dir = ear.tip.clone().sub(ear.base).normalize();
      const base = ear.base.clone().sub(C);
      let r = 0;
      const v = new THREE.Vector3(), w = new THREE.Vector3();
      for (const p of ear.verts) {
        v.subVectors(p, C);
        if (Math.abs(Math.hypot(v.x / k, v.y, v.z) - R) > 0.02) continue;
        w.subVectors(v, base);
        r = Math.max(r, w.sub(dir.clone().multiplyScalar(w.dot(dir))).length());
      }
      // Décalage du centre (voir HOLE_BACK) : u = arrière-haut, o = extérieur, tous deux ⟂ à l'axe.
      const u = new THREE.Vector3(1, 0, 0).cross(dir).normalize().negate();
      const o = dir.clone().cross(u).normalize();
      if (o.x * Math.sign(base.x) < 0) o.negate();
      base.addScaledVector(u, HOLE_BACK).addScaledVector(o, HOLE_OUT);
      return { base, dir, radius: r + EAR_MARGIN, section: r };
    });
    const holeSdf = (p) => {
      let f = Infinity;
      const w = new THREE.Vector3();
      for (const h of this.holes) {
        w.subVectors(p, h.base);
        const along = w.dot(h.dir);
        if (along < 0) continue; // demi-cylindre vers la pointe seulement
        f = Math.min(f, w.sub(h.dir.clone().multiplyScalar(along)).length() - h.radius);
      }
      return f;
    };

    // Coque : au-dessus du bord (front, côtés, arrière), hors des trous d'oreilles.
    const domeSdf = (d, p) => Math.min((latOf(d) - rimLat(shape, aziOf(d))) * R, holeSdf(p));
    this.dome = add(this.shell, ellipsoidPatch(R, k, domeSdf), metal, true);

    // Bourrelet du bord inférieur.
    const rim = [];
    for (let i = 0; i < 160; i++) {
      const az = (i / 160) * Math.PI * 2 - Math.PI;
      const lat = rimLat(shape, az);
      rim.push(new THREE.Vector3(Math.cos(lat) * Math.sin(az) * k * R, Math.sin(lat) * R, Math.cos(lat) * Math.cos(az) * R));
    }
    add(this.shell, tube(rim), trim);

    // Bourrelets des trous : sur la coque, juste à l'extérieur du trou (ne réduisent pas le passage).
    for (const h of this.holes) {
      const rr = h.radius + TUBE * 0.9;
      const u = new THREE.Vector3(1, 0, 0).cross(h.dir);
      if (u.lengthSq() < 1e-6) u.set(0, 1, 0).cross(h.dir);
      u.normalize();
      const w = h.dir.clone().cross(u);
      const ring = [];
      for (let i = 0; i < 48; i++) {
        const ps = (i / 48) * Math.PI * 2;
        const q = h.base.clone().addScaledVector(u, Math.cos(ps) * rr).addScaledVector(w, Math.sin(ps) * rr);
        ring.push(onEllipsoid(q, h.dir, k * R, R));
      }
      add(this.shell, tube(ring, TUBE * 0.9, 64), trim);
    }

    // Plumet : boules douces le long d'une courbe, du sommet vers l'arrière.
    const top = new THREE.Vector3(0, Math.sin(PLUME_LAT), -Math.cos(PLUME_LAT));
    const baseP = new THREE.Vector3(top.x * k * R, top.y * R, top.z * R);
    const holder = add(this.shell, new THREE.CylinderGeometry(0.009, 0.011, 0.018, 16), trim);
    holder.position.copy(baseP).addScaledVector(top, 0.004);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top);
    const plumeCurve = new THREE.QuadraticBezierCurve3(
      baseP.clone().addScaledVector(top, 0.012),
      baseP.clone().add(new THREE.Vector3(0, 0.075, 0.005)),
      baseP.clone().add(new THREE.Vector3(0, 0.045, -0.085)),
    );
    const puffs = [[0.08, 0.017], [0.3, 0.022], [0.52, 0.021], [0.72, 0.018], [0.9, 0.014]];
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    puffs.forEach(([t, r], i) => {
      const m = add(this.shell, sphere, i % 2 ? plumeLight : plume, true);
      m.position.copy(plumeCurve.getPoint(t));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), plumeCurve.getTangent(t));
      m.scale.set(r, r * 1.3, r);
    });

    // Rivets sur les côtés et à l'arrière, juste au-dessus du bord.
    const rivet = new THREE.SphereGeometry(0.0045, 10, 8);
    for (const az of [-2.6, -2.0, -1.4, 1.4, 2.0, 2.6, Math.PI]) {
      const lat = rimLat(shape, az) + 0.13;
      const d = new THREE.Vector3(Math.cos(lat) * Math.sin(az), Math.sin(lat), Math.cos(lat) * Math.cos(az));
      if (holeSdf(new THREE.Vector3(d.x * k * R, d.y * R, d.z * R)) < 0.01) continue;
      add(this.shell, rivet, trim).position.set(d.x * k * R * 1.01, d.y * R * 1.01, d.z * R * 1.01);
    }

    // Visière : secteur d'ellipsoïde (même forme, + VISOR_GAP) entre deux plans passant par la
    // charnière (axe X), percé de deux fentes à hauteur des yeux ; tourne autour de l'axe X.
    const Rv = R + VISOR_GAP;
    const kv = (k * R + VISOR_GAP) / Rv;
    const eyeA = head.eyes.reduce((s, e) => s + Math.atan2(e.center.y - C.y, e.center.z - C.z), 0) / head.eyes.length;
    const eyeX = head.eyes.reduce((s, e) => s + Math.abs(e.center.x), 0) / head.eyes.length;
    const eyeR = head.eyes.reduce((s, e) => s + e.radius, 0) / head.eyes.length;
    // Visière levée : son bord inférieur passe juste au-dessus du bord du front.
    this.openAngle = shape.browLat + OPEN_EXTRA - shape.visorLow;
    // Bord haut de la visière selon |x| : pleine hauteur au centre ; sur les côtés il descend pour
    // que, levée, la visière ne couvre pas les trous d'oreilles (elle devient une bride vers la
    // charnière). Table de N+1 valeurs, pente limitée pour un contour doux.
    const xMax = kv * Rv;
    const NP = 96;
    const highTab = [];
    const _q = new THREE.Vector3();
    for (let i = 0; i <= NP; i++) {
      const x = (i / NP) * xMax * 0.999;
      const rho = Rv * Math.sqrt(Math.max(0, 1 - (x / xMax) ** 2));
      let hi = shape.visorHigh;
      for (let a = shape.visorLow; a <= shape.visorHigh; a += 0.004) {
        const ar = a + this.openAngle;
        let clear = Infinity;
        for (const sx of [-1, 1]) clear = Math.min(clear, holeSdf(_q.set(sx * x, rho * Math.sin(ar), rho * Math.cos(ar))));
        if (clear < VISOR_EAR_CLEAR + TUBE) { hi = a; break; }
      }
      highTab.push(hi);
    }
    const STRAP = 0.10; // rad, hauteur minimale de la bride
    for (let i = 1; i <= NP; i++) highTab[i] = Math.min(highTab[i], highTab[i - 1]);
    const slope = 1.1 * (xMax / NP) / 0.016; // rad par pas : ~1,1 rad sur 16 mm
    for (let i = NP - 1; i >= 0; i--) highTab[i] = Math.min(highTab[i], highTab[i + 1] + slope);
    for (let i = 0; i <= NP; i++) highTab[i] = Math.max(highTab[i], shape.visorLow + STRAP);
    const highAt = (x) => {
      const f = THREE.MathUtils.clamp(Math.abs(x) / xMax, 0, 1) * NP;
      const i = Math.min(NP - 1, Math.floor(f));
      return THREE.MathUtils.lerp(highTab[i], highTab[i + 1], f - i);
    };
    this.visorHighAt = highAt;
    // Fentes : arrêtées avant la descente du bord haut.
    const slitEnd = (a, hh) => {
      let x = 0;
      while (x < xMax && highAt(x) > a + (hh + 0.009) / Rv) x += 0.001;
      return x - 0.004;
    };
    const slits = [
      { a: eyeA + 0.03, hh: 0.0055, x0: eyeX - eyeR * 1.15, x1: eyeX + eyeR * 1.15 },
      { a: eyeA - 0.14, hh: 0.0035, x0: eyeX - eyeR * 0.8, x1: eyeX + eyeR * 0.8 },
    ];
    for (const s of slits) s.x1 = Math.min(s.x1, slitEnd(s.a, s.hh));
    const slitSdf = (d, p) => {
      let f = Infinity;
      const a = alphaOf(d);
      for (const s of slits) {
        const cx = (s.x0 + s.x1) / 2, hw = (s.x1 - s.x0) / 2 - s.hh;
        const qx = Math.abs(Math.abs(p.x) - cx) - hw;
        const qy = Math.abs(a - s.a) * Rv - 0;
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        f = Math.min(f, Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - s.hh);
      }
      return f;
    };
    this.slits = slits;
    const visorSdf = (d, p) => {
      const a = alphaOf(d);
      return Math.min((a - shape.visorLow) * Rv, (highAt(p.x) - a) * Rv, slitSdf(d, p));
    };
    this.visorPivot = new THREE.Group();
    this.shell.add(this.visorPivot);
    this.visor = add(this.visorPivot, ellipsoidPatch(Rv, kv, visorSdf, 128, 96), metal, true);
    // Bourrelet de la visière : bord inférieur puis bord supérieur, d'une charnière à l'autre.
    const edge = [];
    const N = 64;
    for (let i = 0; i <= N; i++) edge.push(sectorPoint(Rv, kv, -Math.PI / 2 + (i / N) * Math.PI, shape.visorLow));
    for (let i = N; i >= 0; i--) {
      const beta = -Math.PI / 2 + (i / N) * Math.PI;
      edge.push(sectorPoint(Rv, kv, beta, highAt(Math.sin(beta) * xMax)));
    }
    add(this.visorPivot, tube(edge, TUBE, 220), trim);
    // Charnières : boutons laiton de chaque côté (fixés à la coque, ne tournent pas).
    const bolt = new THREE.CylinderGeometry(0.011, 0.012, 0.008, 18);
    for (const s of [-1, 1]) {
      const b = add(this.shell, bolt, trim, true);
      b.position.set(s * (kv * Rv + 0.003), 0, 0);
      b.rotation.z = Math.PI / 2;
    }

    this._open = true;
    this._t = 1;           // avancement de l'animation (1 = terminée)
    this._from = this.openAngle;
    this._to = this.openAngle;
    this._angle = this.openAngle;
    this.visorPivot.rotation.x = -this._angle;
  }

  /** Visière levée (true) ou baissée (false) : état demandé (lecture). */
  get visorOpen() { return this._open; }

  /** Lève (true) ou baisse (false) la visière : rotation douce de VISOR_TIME s autour de la charnière. */
  setVisor(open) {
    open = !!open;
    if (open === this._open) return;
    this._open = open;
    this._from = this._angle;
    this._to = open ? this.openAngle : 0;
    this._t = 0;
  }

  /** Inverse la visière ; renvoie le nouvel état. */
  toggleVisor() { this.setVisor(!this._open); return this._open; }

  /** À appeler à chaque image (secondes). */
  update(dt) {
    if (this._t >= 1) return;
    this._t = Math.min(1, this._t + dt / VISOR_TIME);
    const e = this._t * this._t * (3 - 2 * this._t);
    this._angle = THREE.MathUtils.lerp(this._from, this._to, e);
    this.visorPivot.rotation.x = -this._angle;
  }

  /** Affiche ou cache tout le casque. */
  setVisible(visible) { this.group.visible = !!visible; }

  /**
   * Les maillages du casque ignorent le raycast (`raycast` vide) : un clic sur le casque traverse
   * jusqu'à la tête du chat si elle est derrière. Pour qu'un clic sur le bord du casque compte comme
   * un clic sur le chat : `helmet.hit(raycaster)` renvoie l'intersection la plus proche ou null.
   */
  hit(raycaster) {
    if (!this.group.visible) return null;
    const out = [];
    for (const m of this.meshes) THREE.Mesh.prototype.raycast.call(m, raycaster, out);
    out.sort((a, b) => a.distance - b.distance);
    return out[0] ?? null;
  }

  dispose() {
    this.group.removeFromParent();
    const geos = new Set(this.meshes.map((m) => m.geometry));
    geos.forEach((g) => g.dispose());
    this._materials.forEach((m) => m.dispose());
  }
}

/** Raccourci : construit le casque, le range dans `cat.helmet` et le renvoie. */
export function attachHelmet(cat) {
  cat.helmet = new Helmet(cat);
  return cat.helmet;
}

/** Sortie de l'ellipsoïde (kR, R, R) le long de la droite q + t·dir (racine la plus grande). */
function onEllipsoid(q, dir, a, R) {
  const s = new THREE.Vector3(1 / a, 1 / R, 1 / R);
  const qs = q.clone().multiply(s), ds = dir.clone().multiply(s);
  const A = ds.dot(ds), B = 2 * qs.dot(ds), Cc = qs.dot(qs) - 1;
  const disc = Math.max(0, B * B - 4 * A * Cc);
  return q.clone().addScaledVector(dir, (-B + Math.sqrt(disc)) / (2 * A));
}

/** Point de l'ellipsoïde (kR, R, R) d'abscisse sin(beta)·kR et d'angle alpha autour de l'axe X. */
function sectorPoint(R, k, beta, alpha) {
  const s = Math.sin(beta), rho = Math.cos(beta);
  return new THREE.Vector3(s * k * R, rho * Math.sin(alpha) * R, rho * Math.cos(alpha) * R);
}
