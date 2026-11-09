import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHADOW, color, toonMaterial } from '../style/palette.js';
import { CLIMB } from '../game/climb.js';

/**
 * Look of the snow cats' snowballs and of their impact marks; used by SnowCats.js. The snow cats themselves are regular
 * NPCs (Npc.js, type `snowCat`). Round, soft shapes like the pines and stones of zone 2 (snowLook.js): flat toon
 * shading, per-vertex colour (light snow on top, lavender shade below, never grey or black), no texture.
 */

/**
 * Snowball snow (tuned in `CLIMB.snowball.snow`): `top` above, `shade` below, blended by the normal, then scaled by
 * `lift`. The game's sun is warm and turns pure white snow sandy (SNOW.fresh, palette.js), hence slightly cool tints;
 * `glow` is an emissive term that keeps the ball white in shadow.
 */
function snowShade(ny) {
  const t = THREE.MathUtils.smoothstep(ny, -0.55, 0.75);
  const S = CLIMB.snowball.snow;
  return _snowA.copy(color(S.shade)).lerp(color(S.top), t).multiplyScalar(S.lift);
}
const _snowA = new THREE.Color();

/** Part geometry: positions of `geo` transformed by `m`, per-vertex colour from the normal. */
function part(geo, m, colorOf) {
  geo.deleteAttribute('uv');
  geo.applyMatrix4(m);
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const col = colorOf(n.getY(i), n.getX(i), n.getZ(i));
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

const flat = (hex) => { const c = color(hex); return () => c; };

/** Snowball: unit-radius sphere (scaled by the ball), light on top, lavender below. */
export function snowballGeometry() {
  return part(new THREE.SphereGeometry(1, 14, 10), new THREE.Matrix4(), snowShade);
}

/** Toon material with per-vertex colour, shared by the snowballs and their fragments. */
export function snowCatMaterial() {
  const S = CLIMB.snowball.snow;
  return toonMaterial(0xffffff, { vertexColors: true, emissive: S.glowColor, emissiveIntensity: S.glow });
}

/**
 * Ground impact mark (the shadow of the incoming ball): lavender disc (the game's shadow tint, `SHADOW.tint`) ringed
 * by a lighter band, lying in the XZ plane (normal +Y), radius 1.
 */
export function impactMarkGeometry() {
  const disk = part(new THREE.CircleGeometry(0.86, 28).rotateX(-Math.PI / 2), new THREE.Matrix4(), flat(SHADOW.tint));
  const ring = part(new THREE.RingGeometry(0.88, 1, 28).rotateX(-Math.PI / 2), new THREE.Matrix4(), flat(0xd9c9e8));
  return mergeGeometries([disk, ring], false);
}

/** Impact mark material: translucent, no depth write, kept on the ground by polygon offset. */
export function impactMarkMaterial() {
  return new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}
