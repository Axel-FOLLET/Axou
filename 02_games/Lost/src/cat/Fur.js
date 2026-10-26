import * as THREE from 'three';
import { CAT, color } from '../style/palette.js';

/**
 * Fourrure en coques (« shells ») : copies du maillage du corps, chacune gonflée un peu plus le
 * long de la normale et percée de trous pour ne garder que des sections de poils.
 *
 * - Chaque coque est un SkinnedMesh qui partage la géométrie et le squelette du corps : la
 *   fourrure suit tous les clips sans calcul côté CPU.
 * - Le décalage est appliqué dans l'espace de liaison (avant le skinning) : normale de repos,
 *   peignage vers la queue et léger tombant, petite ondulation de vent ; le skinning plie ensuite
 *   le tout avec le corps.
 * - Les poils sont un motif cellulaire 3D calculé sur la position de repos du sommet (donc stable
 *   pendant les animations et sans coutures d'UV) : un poil par cellule, de hauteur aléatoire,
 *   qui s'affine en montant.
 * - La longueur dépend des os qui portent le sommet (`LENGTH_BY_BONE`) : courte sur le museau,
 *   les oreilles et les pattes, plus longue sur le tronc, le cou et la queue.
 */
const SHELLS = 18;          // 24 ralentissait trop les animations (choix de l'utilisateur, 2026-10-22)
const MAX_LENGTH = 0.022;   // mètres, longueur de référence (facteur 1 de LENGTH_BY_BONE)
const SPACING = 0.0013;     // mètres entre deux poils : valeur actuelle = 1,3 mm (historique : 1,8 mm, puis 1,5 mm le 2026-10-23 soir « + de poils », puis 1,3 mm le même soir à la demande de l'utilisateur)
// Robe noire (choix de l'utilisateur, 2026-10-22) : la texture d'origine ne sert plus qu'à
// moduler légèrement la teinte et à repérer la peau rose (truffe) ; pointes un peu rousses au
// soleil, comme un vrai chat noir.
// Style « dessin animé doux » (2026-10-25, docs/recherche/style.md § 5 « Chat ») : couleurs prises
// dans palette.js ; noir un peu plus chaud et moins profond (0x221d19 -> 0x2a2320), pointes plus
// rousses (0x4a3628 -> 0x5c4536), liseré doré (`CAT.sheen`) au lieu du gris.
const COAT = color(CAT.coat);
const TIP = color(CAT.tip);
const SHEEN = color(CAT.sheen).multiplyScalar(CAT.sheenStrength);
// Correction 2 (2026-10-26) : aplat gris-brun côté soleil (CAT.coatLit × CAT.coatLitStrength).
const COAT_LIT = color(CAT.coatLit).multiplyScalar(CAT.coatLitStrength);

/**
 * Facteur de longueur selon le nom de l'os (premier motif qui correspond), multiplié par
 * MAX_LENGTH. Corps plus fourni le 2026-10-23 (demande de l'utilisateur) : tronc 0,85 -> 1,3,
 * cou 1,0 -> 1,3 et collerette en haut du cou (`Neck002`) 1,6, queue 1,0 -> 1,2, bout de queue
 * 0,85 -> 1,0, mollets 0,45 -> 0,6 ; oreilles et pieds inchangés. Les os de la tête (`Head`,
 * `Nose`, `Mouth`, `Ear_connector`) ne servent plus que de repli : leur longueur vient de
 * headFactor.
 */
const LENGTH_BY_BONE = [
  [/^Ear(?!_connector)/, 0.06],
  [/^(Nose|Mouth)/, 0.14],
  [/^Ear_connector/, 0.5],
  [/^Head/, 0.9],
  [/^Neck002/, 1.6],
  [/^(Toe|toe_)/, 0.12],
  [/^Foot/, 0.2],
  [/^Calf/, 0.6],
  [/^Tail007/, 1.0],
  [/^Tail/, 1.2],
  [/^Neck/, 1.3],
  [/./, 1.3],
];

// Tête touffue (2026-10-23, demande de l'utilisateur : « touffu et mignon ») : voir headFactor.
// Un peu plus fourni le 2026-10-23 au soir (demande de l'utilisateur : « légèrement plus de poils
// sur le crâne et le visage ») : crâne 1,0 -> 1,2, joues 1,45 -> 1,6, museau 0,15 -> 0,22.
// Les noms d'os perdent leurs points dans three.js (`Tail.007` -> `Tail007`).
// `Ear_connector*` porte le dessus du crâne entre les oreilles.
const HEAD_BONES = /^(Head|Nose|Mouth|Ear_connector)/;
const HEAD_SKULL = 1.2;
const HEAD_CHEEK = 1.6;
const HEAD_MUZZLE = 0.22;
// Rayon (en rayons d'œil) où la fourrure reprend toute sa longueur autour des yeux. 1,7 avant :
// avec les yeux agrandis (rayon 0,32, écart 0,99 dans l'espace de liaison), ce disque couvrait
// tout l'espace entre les yeux et le front, rasés (mesuré le 2026-10-23).
const EYE_CLEAR = 1.5;
// Correction 2 (2026-10-26) : forme des poils. HEIGHT_MIN = hauteur minimale d'un poil (fraction
// de la longueur ; 0,5 avant) ; TIP_TAPER = part de l'effilement vers la pointe (1 avant : pointe
// de largeur nulle, d'où des points isolés sur les coques extérieures).
const HEIGHT_MIN = 0.7;
const TIP_TAPER = 0.7;

function lengthFactor(name) {
  for (const [re, f] of LENGTH_BY_BONE) if (re.test(name)) return f;
  return 1;
}

/**
 * Inverse de la matrice de liaison. Ne pas utiliser `mesh.bindMatrixInverse` : en mode
 * « attached », three.js la remplace à chaque image par l'inverse de la matrice monde (mesuré :
 * échelle 11,5 alors que `bindMatrix` est l'identité).
 */
function bindInverse(mesh) {
  return mesh.bindMatrix.clone().invert();
}

/** Sphères englobantes des yeux, exprimées dans l'espace de liaison du corps. */
function eyeSpheres(body, eyes) {
  return eyes.map((eye) => {
    eye.geometry.computeBoundingSphere();
    const s = eye.geometry.boundingSphere.clone();
    const toBody = bindInverse(body).multiply(eye.bindMatrix);
    return s.applyMatrix4(toBody);
  });
}

/**
 * Attribut `furMask` : moyenne pondérée par la peau des facteurs de longueur des os, ramenée à
 * zéro autour des yeux (sinon les poils des paupières mordent sur le globe).
 */
function buildMask(mesh, eyes) {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  const factors = mesh.skeleton.bones.map((b) => lengthFactor(b.name));
  const isHead = mesh.skeleton.bones.map((b) => HEAD_BONES.test(b.name));
  const spheres = eyeSpheres(mesh, eyes);
  const p = new THREE.Vector3();
  const mask = new Float32Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let sum = 0, total = 0, head = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      const b = si.getComponent(v, k);
      sum += w * factors[b];
      total += w;
      if (isHead[b]) head += w;
    }
    let m = total > 0 ? sum / total : 1;
    p.fromBufferAttribute(pos, v);
    if (head > 0 && spheres.length === 2) {
      m = THREE.MathUtils.lerp(m, headFactor(p, spheres), head / total);
    }
    for (const s of spheres) {
      const d = p.distanceTo(s.center) / s.radius;
      m *= THREE.MathUtils.smoothstep(d, 1.15, EYE_CLEAR);
    }
    mask[v] = m;
  }
  geo.setAttribute('furMask', new THREE.BufferAttribute(mask, 1));
}

/**
 * Facteur de longueur sur la tête, selon la position et non selon l'os : presque toute la tête
 * est pondérée sur l'os `Nose` (mesuré le 2026-10-23 : 907 sommets contre 38 sur `Head`), si bien
 * qu'un facteur par os rasait le crâne et les joues. Repère : centre et écart des yeux, dans
 * l'espace de liaison (+Y haut, +Z avant).
 * - crâne et front : HEAD_SKULL ;
 * - joues, sous et derrière les yeux, sur les côtés : jusqu'à HEAD_CHEEK (collerette) ;
 * - museau, devant les yeux et sous leur niveau, et bout du nez : HEAD_MUZZLE.
 */
function headFactor(p, [a, b]) {
  const S = THREE.MathUtils.smoothstep;
  const u = a.center.distanceTo(b.center);              // écart des yeux
  const c = a.center.clone().add(b.center).multiplyScalar(0.5);
  const dx = Math.abs(p.x - c.x) / u, dy = (p.y - c.y) / u, dz = (p.z - c.z) / u;
  const cheek = S(dx, 0.45, 0.75) * (1 - S(dy, -0.1, 0.15)) * (1 - S(dz, -0.05, 0.2));
  const muzzle = Math.max(S(dz, 0.0, 0.3) * (1 - S(dy, -0.25, 0.05)), S(dz, 0.3, 0.5));
  const f = THREE.MathUtils.lerp(HEAD_SKULL, HEAD_CHEEK, cheek);
  return THREE.MathUtils.lerp(f, HEAD_MUZZLE, muzzle);
}

/** Direction en espace de liaison du maillage (repère où vivent `position` et `normal`). */
function bindDirection(mesh, worldDir) {
  return worldDir.clone().transformDirection(bindInverse(mesh));
}

/** Position en espace de liaison de l'origine d'un os. */
function bindBonePosition(mesh, name) {
  const i = mesh.skeleton.bones.findIndex((b) => b.name === name);
  if (i < 0) return null;
  const m = mesh.skeleton.boneInverses[i].clone().invert().premultiply(bindInverse(mesh));
  return new THREE.Vector3().setFromMatrixPosition(m);
}

const VERTEX_HEAD = /* glsl */`
attribute float furMask;
uniform float furShell;
uniform float furLength;
uniform float furTime;
uniform vec3 furComb;
uniform vec3 furWind;
varying vec3 vFurPos;
`;

const VERTEX_BODY = /* glsl */`
#include <begin_vertex>
{
  vec3 n = normalize(normal);
  vec3 comb = furComb - n * dot(furComb, n);
  float len = furLength * furMask;
  float sway = sin(furTime * 1.6 + dot(position, vec3(0.9, 0.5, 0.7)) * 0.6);
  transformed += n * len * furShell
    + (comb * 0.6 + furWind * sway * 0.25) * len * furShell * furShell;
  vFurPos = position;
}
`;

// Teinte de la robe, partagée par la peau de base et les coques. Tout est noir, truffe comprise
// (une détection de la peau rose par couleur prenait aussi les frontières roux/blanc de la
// texture calico : liserés roux observés le 2026-10-22).
const COAT_GLSL = /* glsl */`
uniform vec3 furCoat;
uniform vec3 furSheen;
uniform vec3 furCoatLit;
void furCoatColor(inout vec3 c) {
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  c = furCoat * (0.8 + 0.4 * lum);
}
`;

const BASE_FRAGMENT = /* glsl */`
furCoatColor(diffuseColor.rgb);
#include <alphamap_fragment>
`;

const FRAGMENT_HEAD = /* glsl */`
uniform float furShell;
uniform float furDensity;
uniform vec3 furTip;
varying vec3 vFurPos;
vec3 furHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

const FRAGMENT_BODY = /* glsl */`
{
  // Poil le plus proche (cellules voisines 2×2×2) : distance et hauteur aléatoire.
  vec3 p = vFurPos * furDensity;
  vec3 cell = floor(p);
  vec3 o = step(0.5, fract(p)) - 1.0;
  float best = 1e9;
  float height = 1.0;
  for (int x = 0; x < 2; x++)
  for (int y = 0; y < 2; y++)
  for (int z = 0; z < 2; z++) {
    vec3 c = cell + o + vec3(float(x), float(y), float(z));
    vec3 h = furHash(c);
    vec3 d = p - (c + 0.15 + 0.7 * h);
    float dd = dot(d, d);
    if (dd < best) { best = dd; height = mix(${HEIGHT_MIN.toFixed(2)}, 1.0, fract(h.x * 7.13 + h.z * 3.71)); }
  }
  // Largeur à la racine en fraction de case : 0,6 -> 0,65 le 2026-10-23 (cases plus petites).
  // Correction 2 (2026-10-26) : pointe moins effilée (TIP_TAPER) et hauteurs moins dispersées
  // (HEIGHT_MIN) : les coques extérieures ne sont plus des points épars (bord bruité).
  float r = 0.65 * (1.0 - ${TIP_TAPER.toFixed(2)} * furShell / height);
  diffuseColor.a = furShell < height ? 1.0 - smoothstep(r * 0.6, r, sqrt(best)) : 0.0;
  // Entre les poils : on sort tout de suite, sans payer l'éclairage (la majorité des pixels).
  if (diffuseColor.a < 0.02) discard;
  furCoatColor(diffuseColor.rgb);
  // Racines dans l'ombre des poils voisins, pointes plus claires et légèrement rousses.
  diffuseColor.rgb = diffuseColor.rgb * mix(0.55, 1.0, furShell) + furTip * furShell * furShell;
}
#include <alphamap_fragment>
`;

// Liseré de contre-jour : les poils vus par la tranche s'éclairent, ce qui dessine le volume
// d'un pelage noir (sinon une silhouette plate). Renforcé de 0,22 à 0,3 le 2026-10-23, en même
// temps que le peignage passait de 0,9 à 0,6 (poils plus dressés, chat plus touffu).
// 2026-10-25 : teinte dorée chaude `furSheen` (CAT.sheen × CAT.sheenStrength, palette.js) au lieu
// du gris vec3(0.3, 0.27, 0.25) : reflet doux de soleil, silhouette détachée du fond.
// Correction 2 (2026-10-26, captures « final » : silhouette noir brun uniforme, sans liseré ni
// aplat de lumière) : `coatLight(shell)` remplace l'ancien liseré `furSheen * rim * rim * furShell`,
// qui ne touchait presque que les coques extérieures, éparses. Calcul en espace vue :
// - `sun` : demi-Lambert doux avec le soleil (`directionalLights[0]` : three place d'abord les
//   lumières qui projettent une ombre, donc le soleil de World.js) ;
// - aplat gris-brun `furCoatLit` côté soleil, renforcé sur le dessus (dos, tête) ;
// - liseré pêche `furSheen` sur les contours, fort côté soleil, faible (0,3) à l'ombre ;
// - le tout atténué vers les racines (profondeur du pelage), mais présent sur la peau de base.
function coatLight(shell) {
  return /* glsl */`
#include <emissivemap_fragment>
{
  vec3 furN = normalize(normal);
  vec3 furV = normalize(vViewPosition);
  vec3 furUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  #if NUM_DIR_LIGHTS > 0
    vec3 furL = directionalLights[0].direction;
  #else
    vec3 furL = furUp;
  #endif
  float furSun = smoothstep(-0.1, 0.7, dot(furN, furL));
  float furTop = smoothstep(0.0, 0.85, dot(furN, furUp));
  float furDepth = mix(0.5, 1.0, ${shell});
  float rim = 1.0 - abs(dot(furN, furV));
  totalEmissiveRadiance += furCoatLit * furSun * (0.55 + 0.45 * furTop) * furDepth;
  totalEmissiveRadiance += furSheen * rim * rim * mix(0.3, 1.0, furSun) * mix(0.6, 1.0, ${shell});
}
`;
}
const RIM_FRAGMENT = coatLight('furShell');
const BASE_LIGHT_FRAGMENT = coatLight('0.0');

export class Fur {
  /**
   * @param {THREE.SkinnedMesh} body maillage du corps (géométrie, squelette et matériau partagés)
   * @param {THREE.SkinnedMesh[]} eyes globes oculaires, autour desquels la fourrure s'efface
   */
  constructor(body, eyes = []) {
    this.body = body;
    this.shells = [];
    buildMask(body, eyes);

    const scale = body.getWorldScale(new THREE.Vector3()).x;
    const head = bindBonePosition(body, 'Head');
    const tail = bindBonePosition(body, 'Tail');
    const back = head && tail ? tail.clone().sub(head).normalize() : new THREE.Vector3(0, 0, -1);
    const down = bindDirection(body, new THREE.Vector3(0, -1, 0));
    this.uniforms = {
      furLength: { value: MAX_LENGTH / scale },
      furDensity: { value: scale / SPACING },
      furTime: { value: 0 },
      furComb: { value: back.add(down.multiplyScalar(0.5)).normalize() },
      furWind: { value: bindDirection(body, new THREE.Vector3(1, 0, 0.3)) },
      furCoat: { value: COAT.clone() },
      furTip: { value: TIP.clone() },
      furSheen: { value: SHEEN.clone() },
      furCoatLit: { value: COAT_LIT.clone() },
    };

    // Racine de la fourrure : la peau lisse devient mate et sombre, comme le fond d'un pelage.
    const baseColor = body.material.color.clone();
    body.material.roughness = 1;
    body.material.color.multiplyScalar(0.7);
    body.material.onBeforeCompile = (shader) => {
      shader.uniforms.furCoat = this.uniforms.furCoat;
      shader.uniforms.furSheen = this.uniforms.furSheen;
      shader.uniforms.furCoatLit = this.uniforms.furCoatLit;
      shader.fragmentShader = COAT_GLSL + shader.fragmentShader
        .replace('#include <alphamap_fragment>', BASE_FRAGMENT)
        .replace('#include <emissivemap_fragment>', BASE_LIGHT_FRAGMENT);
    };
    body.material.customProgramCacheKey = () => 'cat-coat';
    body.material.needsUpdate = true;

    for (let i = 1; i <= SHELLS; i++) {
      const shell = new THREE.SkinnedMesh(body.geometry, this._material(body.material, baseColor, i / SHELLS));
      shell.name = `CatFur${i}`;
      shell.position.copy(body.position);
      shell.quaternion.copy(body.quaternion);
      shell.scale.copy(body.scale);
      shell.bind(body.skeleton, body.bindMatrix);
      shell.frustumCulled = false;
      shell.castShadow = false;
      shell.receiveShadow = true;
      shell.renderOrder = i;
      body.parent.add(shell);
      this.shells.push(shell);
    }
  }

  _material(base, color, t) {
    const m = base.clone();
    m.color.copy(color);
    // Un peu de brillance : sans reflet, un pelage noir n'est plus qu'une silhouette.
    m.roughness = 0.62;
    m.alphaTest = 0.5;
    m.alphaToCoverage = true;
    // L'alpha sert seulement à la couverture : on garde celui du canvas (1), sinon le fond de la
    // page transparaît à travers les poils (mesuré : 80 509 pixels à alpha < 1, points clairs).
    m.blending = THREE.CustomBlending;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.ZeroFactor;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { furShell: { value: t } });
      shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_BODY);
      shader.fragmentShader = COAT_GLSL + FRAGMENT_HEAD + shader.fragmentShader
        .replace('#include <alphamap_fragment>', FRAGMENT_BODY)
        .replace('#include <emissivemap_fragment>', RIM_FRAGMENT);
    };
    m.customProgramCacheKey = () => 'cat-fur';
    return m;
  }

  /**
   * Garde une coque sur `step` (1 = toutes, Infinity = aucune) : moins de passes pour les cartes
   * graphiques faibles. Ne fait que réduire : un réglage plus léger déjà posé est conservé.
   */
  setStep(step) {
    step = Math.max(this.step ?? 1, step);
    this.step = step;
    this.shells.forEach((s, i) => { s.visible = (i + 1) % step === 0; });
  }

  update(time) {
    this.uniforms.furTime.value = time;
  }
}
