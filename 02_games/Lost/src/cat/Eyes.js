import * as THREE from 'three';
import { CAT, color } from '../style/palette.js';

/**
 * Eyes drawn by a shader on the `EyeA` / `EyeB` globes of the GLB: streaked gradient iris, dark ring, large
 * round pupil and two highlights. Everything is computed in the globe's rest frame, so the drawing turns with
 * the head at no CPU cost. Created by Cat.js and Npc.js.
 *
 * Coordinates: `dir` = point direction from the globe centre; (u, v) = its projection on the plane facing the
 * gaze, i.e. the sine of the angle at the iris centre. Highlights sit at the same place on both eyes.
 *
 * Eyelids: the rig has no eyelid bone; `setLid(t)` lowers a procedural lid of the coat colour in front of the
 * globe, from top to bottom (t = 0 open, t = 1 closed; one shared uniform).
 */
const IRIS = 0.78;                          // iris radius (sine of the angle): a cat's eye is almost all iris
// Pupil half-axes, slightly taller than wide.
const PUPIL = new THREE.Vector2(0.42, 0.50);
const OUTWARD = 0.22;                       // the eyes look slightly outward
// Lid edge in v (top = +1): LID_OPEN at t = 0 (above the globe), LID_CLOSED at t = 1 (below the globe, fully
// covered). LID_ARCH: the edge is arched, higher in the middle.
const LID_OPEN = 1.05;
const LID_CLOSED = -1.2;
const LID_ARCH = 0.12;
// Closed-eye crease: fully covered, the globe reads as an empty socket, so a brown arc at LID_CREASE (curvature
// LID_ARCH, half-thickness LID_CREASE_W) appears from t = LID_CREASE_FROM to 1.
const LID_CREASE = -0.2;
const LID_CREASE_W = 0.05;
const LID_CREASE_FROM = 0.85;
// Share of the coat's emissive tint (CAT.coatLit × coatLitStrength) given to the lid: at 1 the lid is lighter
// than the surrounding fur; 0.6 blends it into the head.
const LID_LIT = 0.6;
// Share of the iris colour added as emissive: a light sparkle, not a glowing eye.
const IRIS_GLOW = 0.35;

const VERTEX_HEAD = /* glsl */`
uniform vec3 eyeCenter;
varying vec3 vEyeDir;
`;

const VERTEX_BODY = /* glsl */`
#include <begin_vertex>
vEyeDir = normalize(position - eyeCenter);
`;

const FRAGMENT_HEAD = /* glsl */`
uniform vec3 eyeForward;
uniform vec3 eyeRight;
uniform vec3 eyeUp;
uniform vec3 eyeIrisIn;
uniform vec3 eyeIrisOut;
uniform vec3 eyeRing;
uniform vec3 eyeLidColor;
uniform float eyeLid;
uniform vec3 eyeLidLit;
varying vec3 vEyeDir;
float eyeLight;
float eyeLidMask;
float eyeCreaseMask;
vec3 eyeGlow;
`;

const FRAGMENT_BODY = /* glsl */`
{
  vec3 d = normalize(vEyeDir);
  vec2 uv = vec2(dot(d, eyeRight), dot(d, eyeUp));
  float r = dot(d, eyeForward) > 0.0 ? length(uv) : 2.0;
  float a = atan(uv.y, uv.x);
  // Iris: lighter near the pupil, darker toward the edge, radial streaks.
  float t = clamp(r / ${IRIS.toFixed(2)}, 0.0, 1.0);
  float streak = 0.85 + 0.15 * sin(a * 37.0 + sin(a * 11.0) * 2.0) * (0.4 + t);
  vec3 iris = mix(eyeIrisIn, eyeIrisOut, smoothstep(0.25, 1.0, t)) * streak;
  // Warm brown ring at the iris edge, then the eye corner (hidden by the lids).
  iris = mix(iris, eyeRing, 0.8 * smoothstep(0.82, 0.98, t));
  vec3 c = mix(iris, eyeRing, smoothstep(${IRIS.toFixed(2)}, ${(IRIS + 0.03).toFixed(2)}, r));
  // Pupil.
  float p = length(uv / vec2(${PUPIL.x.toFixed(2)}, ${PUPIL.y.toFixed(2)}));
  c = mix(vec3(0.004), c, smoothstep(0.92, 1.02, p));
  // Iris glow: the iris emits a little of its own colour, so it stays bright even in the head's shadow.
  eyeGlow = c * ${IRIS_GLOW.toFixed(2)} * (1.0 - smoothstep(${IRIS.toFixed(2)}, ${(IRIS + 0.03).toFixed(2)}, r)) * smoothstep(0.92, 1.02, p);
  // Highlights: a large one top left, a small one bottom right.
  eyeLight = 1.0 - smoothstep(0.085, 0.105, length(uv - vec2(-0.2, 0.24)));
  eyeLight += 0.8 * (1.0 - smoothstep(0.03, 0.045, length(uv - vec2(0.17, -0.15))));
  eyeLight *= step(0.0, dot(d, eyeForward));
  // Eyelid: above the edge (arched, higher in the middle), coat colour, matte, no highlight; a thin brown line
  // at the edge keeps the half-closed eye readable.
  float edge = mix(${LID_OPEN.toFixed(2)}, ${LID_CLOSED.toFixed(2)}, eyeLid) - ${LID_ARCH.toFixed(2)} * uv.x * uv.x;
  float below = edge - uv.y;
  c = mix(c, eyeRing * 0.6, 1.0 - smoothstep(0.0, 0.06, abs(below)));
  eyeLidMask = 1.0 - smoothstep(-0.015, 0.015, below);
  c = mix(c, eyeLidColor, eyeLidMask);
  // Closed eye: crease of the joined lids, a brown arc on the lid that appears only at the end of the closing
  // (t from ${LID_CREASE_FROM.toFixed(2)} to 1).
  float crease = abs(uv.y - (${LID_CREASE.toFixed(2)} - ${LID_ARCH.toFixed(2)} * uv.x * uv.x));
  float creaseK = smoothstep(${LID_CREASE_FROM.toFixed(2)}, 1.0, eyeLid) * eyeLidMask * step(0.0, dot(d, eyeForward));
  eyeCreaseMask = creaseK * (1.0 - smoothstep(${LID_CREASE_W.toFixed(3)}, ${(LID_CREASE_W * 2).toFixed(3)}, crease));
  c = mix(c, eyeRing * 0.5, eyeCreaseMask);
  eyeLight *= 1.0 - smoothstep(-0.03, 0.03, -below);
  eyeGlow *= 1.0 - eyeLidMask;
  diffuseColor.rgb = c;
}
`;

const ROUGHNESS_BODY = /* glsl */`
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.8, eyeLidMask);
`;

const EMISSIVE_BODY = /* glsl */`
#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(eyeLight) * 2.5 + eyeGlow;
// Eyelid: same emissive tint as the sun side of the coat (Fur.js, COAT_LIT), otherwise the covered globe,
// recessed in the socket, looks darker than the fur around it and reads as a hole.
totalEmissiveRadiance += eyeLidLit * eyeLidMask * (1.0 - eyeCreaseMask);
`;

export class Eyes {
  /** @param {THREE.SkinnedMesh[]} eyes eye globes (mesh rest frame) */
  constructor(eyes) {
    this.eyes = eyes;
    // Uniform shared by both eyes: 0 = open, 1 = closed (see setLid).
    this.lid = { value: 0 };
    for (const eye of eyes) {
      eye.geometry.computeBoundingSphere();
      const center = eye.geometry.boundingSphere.center.clone();
      // The muzzle points toward +Z (rest frame); each eye opens slightly toward its own side.
      const toMesh = eye.bindMatrix.clone().invert();
      const side = Math.sign(center.x) || 1;
      const forward = new THREE.Vector3(side * OUTWARD, 0.05, 1).normalize().transformDirection(toMesh);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(toMesh);
      // Right and up as seen from the front (viewer in front of the cat).
      const right = new THREE.Vector3().crossVectors(up, forward).normalize();
      up.crossVectors(forward, right).normalize();

      const m = eye.material.clone();
      m.color.set(0xffffff);
      m.roughness = 0.05;
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, {
          eyeCenter: { value: center },
          eyeForward: { value: forward },
          eyeRight: { value: right },
          eyeUp: { value: up },
          eyeIrisIn: { value: color(CAT.eyeIrisIn) },
          eyeIrisOut: { value: color(CAT.eyeIrisOut) },
          eyeRing: { value: color(CAT.eyeRing) },
          eyeLidColor: { value: color(CAT.coat) },
          eyeLidLit: { value: color(CAT.coatLit).multiplyScalar(CAT.coatLitStrength * LID_LIT) },
          eyeLid: this.lid,
        });
        shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_BODY);
        shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAGMENT_BODY)
          .replace('#include <roughnessmap_fragment>', ROUGHNESS_BODY)
          .replace('#include <emissivemap_fragment>', EMISSIVE_BODY);
      };
      m.customProgramCacheKey = () => 'cat-eye';
      eye.material = m;
    }
  }

  /**
   * Procedural eyelids: 0 = open, 1 = closed; clamped to [0, 1], applied to both eyes on the next frame.
   * @param {number} t
   */
  setLid(t) {
    this.lid.value = THREE.MathUtils.clamp(Number(t) || 0, 0, 1);
  }

  /** Current lid value (0 to 1). */
  getLid() {
    return this.lid.value;
  }
}
