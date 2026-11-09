import * as THREE from 'three';
import { SKY } from './palette.js';

/**
 * Painted sky: a sphere seen from inside, with a four-stop vertical gradient (peach horizon, pale pink, pale blue,
 * soft blue) and a wide golden glow around the sun. Colours are displayed as is: no tone mapping, like the fog.
 * Built as a BackSide sphere with a ShaderMaterial; three.js's physical `Sky` was rejected because its colours
 * cannot be set directly.
 *
 * Used by World.js:
 *   this.sky = createSky();  scene.add(this.sky);
 *   every frame: this.sky.position.copy(camera.position);
 *   sun direction: this.sky.material.uniforms.sunDir.value.copy(dir).normalize();
 *
 * Cost: one 32 × 16 mesh and a very short per-pixel calculation; no fog, drawn first (`renderOrder` −1), no depth
 * write.
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
  // Exact horizon colour up to h = 0.02 (matches the fog), then pale pink, pale blue, blue.
  vec3 c = mix(horizon, blush, smoothstep(0.02, 0.16, h));
  c = mix(c, mid, smoothstep(0.10, 0.38, h));
  c = mix(c, top, smoothstep(0.32, 0.95, h));
  // Glow: very wide and pale, plus a soft core (no hard disc); zero below the horizon.
  float s = max(dot(d, normalize(sunDir)), 0.0);
  float glow = (0.45 * pow(s, 5.0) + 0.4 * pow(s, 32.0)) * smoothstep(0.0, 0.1, h);
  c = mix(c, sunGlow, clamp(glow, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  // No tone mapping (toneMapped: false): three adds the fog colour after tone mapping, so the sky must skip it too
  // for the horizon and the fog to give the same pixel (otherwise a sharp line shows).
  #include <colorspace_fragment>
}
`;

/**
 * @param {number} [radius] sphere radius (m), must stay below the camera `far`
 * @returns {THREE.Mesh} sky sphere
 */
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
  sky.raycast = () => {}; // never hit by Picker.js
  return sky;
}
