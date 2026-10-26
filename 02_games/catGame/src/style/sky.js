import * as THREE from 'three';
import { SKY } from './palette.js';

/**
 * Ciel peint (docs/recherche/style.md § 5 « Ciel ») : sphère vue de l'intérieur, dégradé vertical
 * à quatre arrêts (horizon pêche → rose pêche → bleu pâle → bleu tendre) et halo doré large
 * autour du soleil. Couleurs affichées telles quelles (pas de tone mapping, comme le brouillard).
 * Technique de l'exemple three.js `webgl_lights_hemisphere` (sphère BackSide + ShaderMaterial),
 * sans le `Sky` physique de three.js (écarté : couleurs non réglables directement).
 *
 * Usage (World.js) :
 *   this.sky = createSky();  scene.add(this.sky);
 *   chaque image : this.sky.position.copy(camera.position);
 *   direction du soleil : this.sky.material.uniforms.sunDir.value.copy(dir).normalize();
 *
 * Coût : un seul maillage de 32 × 16 segments, un calcul par pixel très court ; pas de brouillard
 * (`fog: false`), dessiné en premier (`renderOrder` −1), n'écrit pas la profondeur.
 */
const VERTEX = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */`
uniform vec3 top;
uniform vec3 mid;
uniform vec3 blush;
uniform vec3 horizon;
uniform vec3 sunGlow;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // Horizon exact jusqu'à h = 0,02 (raccord avec le brouillard), puis rose pêche, bleu pâle, bleu.
  vec3 c = mix(horizon, blush, smoothstep(0.02, 0.16, h));
  c = mix(c, mid, smoothstep(0.10, 0.38, h));
  c = mix(c, top, smoothstep(0.32, 0.95, h));
  // Halo : très large et pâle, plus un cœur doux (pas de disque net) ; nul sous l'horizon.
  float s = max(dot(d, normalize(sunDir)), 0.0);
  float glow = (0.45 * pow(s, 5.0) + 0.4 * pow(s, 32.0)) * smoothstep(0.0, 0.1, h);
  c = mix(c, sunGlow, clamp(glow, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  // Pas de tone mapping (toneMapped: false) : dans three, la couleur du brouillard est ajoutée
  // après le tone mapping, donc sans lui ; le ciel doit faire pareil pour que l'horizon et le
  // brouillard donnent le même pixel (sinon ligne nette, constatée sur capture le 2026-10-26).
  #include <colorspace_fragment>
}
`;

/** @returns {THREE.Mesh} sphère de ciel (rayon 150 m, sous le `far` 200 m de la caméra) */
export function createSky(radius = 150) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(SKY.top) },
      mid: { value: new THREE.Color(SKY.mid) },
      blush: { value: new THREE.Color(SKY.blush) },
      horizon: { value: new THREE.Color(SKY.horizon) },
      sunGlow: { value: new THREE.Color(SKY.sunGlow) },
      sunDir: { value: new THREE.Vector3(4, 5, 3).normalize() },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  sky.name = 'Sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  sky.raycast = () => {}; // jamais touché par Picker.js
  return sky;
}
