import * as THREE from 'three';
import { CAT, color } from '../style/palette.js';

/**
 * Yeux dessinés au shader sur les globes `EyeA` / `EyeB` (sphères vertes unies dans le GLB) :
 * iris dégradé et strié, cercle sombre au bord, grosse pupille ronde (regard tendre) et deux
 * reflets de lumière. Tout est calculé dans le repère de repos du globe : le dessin tourne avec
 * la tête sans calcul côté CPU.
 *
 * Coordonnées : `dir` = direction du point depuis le centre du globe ; (u, v) = sa projection sur
 * le plan face au regard (u vers la droite du monde, v vers le haut), donc sin de l'angle au
 * centre de l'iris. Les reflets ont la même position sur les deux yeux, comme une vraie lumière.
 *
 * Style « dessin animé doux » (2026-10-25, docs/recherche/style.md § 5 « Chat ») : iris plus
 * lumineux (`CAT.eyeIrisIn` / `CAT.eyeIrisOut`), cercle et coin de l'œil en brun chaud
 * (`CAT.eyeRing`) au lieu du presque noir.
 *
 * Paupières (2026-10-25) : le rig n'a pas d'os de paupière ; `setLid(t)` fait descendre une
 * paupière procédurale de la couleur du pelage devant le globe, du haut vers le bas, avec un fin
 * liseré brun au bord. t = 0 : yeux ouverts ; t = 1 : yeux fermés. Les deux yeux partagent la même
 * valeur (un seul uniform).
 */
const IRIS = 0.78;                          // rayon de l'iris (sin de l'angle) : l'œil d'un chat est presque tout iris
// Demi-axes de la pupille, un peu plus haute que large. Agrandie de 15 % le 2026-10-23 (demande
// de l'utilisateur : « pupilles légèrement plus grosses ») : 0,36 × 0,44 -> 0,42 × 0,50.
const PUPIL = new THREE.Vector2(0.42, 0.50);
const OUTWARD = 0.22;                       // les yeux regardent un peu vers l'extérieur
// Bord de la paupière en v (haut = +1) : LID_OPEN à t = 0 (au-dessus du globe), LID_CLOSED à t = 1
// (sous le globe, tout est couvert, arrondi compris). LID_ARCH : bord en arc, plus haut au milieu.
const LID_OPEN = 1.05;
const LID_CLOSED = -1.2;
const LID_ARCH = 0.12;
// Part de la couleur de l'iris ajoutée en émissif (correction 1) : éclat léger, pas un œil luminescent.
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
varying vec3 vEyeDir;
float eyeLight;
float eyeLidMask;
vec3 eyeGlow;
`;

const FRAGMENT_BODY = /* glsl */`
{
  vec3 d = normalize(vEyeDir);
  vec2 uv = vec2(dot(d, eyeRight), dot(d, eyeUp));
  float r = dot(d, eyeForward) > 0.0 ? length(uv) : 2.0;
  float a = atan(uv.y, uv.x);
  // Iris : clair près de la pupille, plus foncé vers le bord, stries rayonnantes.
  float t = clamp(r / ${IRIS.toFixed(2)}, 0.0, 1.0);
  float streak = 0.85 + 0.15 * sin(a * 37.0 + sin(a * 11.0) * 2.0) * (0.4 + t);
  vec3 iris = mix(eyeIrisIn, eyeIrisOut, smoothstep(0.25, 1.0, t)) * streak;
  // Cercle brun chaud au bord de l'iris, puis le coin de l'œil (caché par les paupières).
  iris = mix(iris, eyeRing, 0.8 * smoothstep(0.82, 0.98, t));
  vec3 c = mix(iris, eyeRing, smoothstep(${IRIS.toFixed(2)}, ${(IRIS + 0.03).toFixed(2)}, r));
  // Pupille.
  float p = length(uv / vec2(${PUPIL.x.toFixed(2)}, ${PUPIL.y.toFixed(2)}));
  c = mix(vec3(0.004), c, smoothstep(0.92, 1.02, p));
  // Éclat de l'iris (correction 1, 2026-10-26 : yeux petits et ternes de loin) : l'iris émet un
  // peu de sa propre couleur, il reste vert tilleul lumineux même à l'ombre de la tête.
  eyeGlow = c * ${IRIS_GLOW.toFixed(2)} * (1.0 - smoothstep(${IRIS.toFixed(2)}, ${(IRIS + 0.03).toFixed(2)}, r)) * smoothstep(0.92, 1.02, p);
  // Reflets : un gros en haut à gauche, un petit en bas à droite (gros reflet agrandi de 0,075
  // à 0,085 le 2026-10-26, correction 1).
  eyeLight = 1.0 - smoothstep(0.085, 0.105, length(uv - vec2(-0.2, 0.24)));
  eyeLight += 0.8 * (1.0 - smoothstep(0.03, 0.045, length(uv - vec2(0.17, -0.15))));
  eyeLight *= step(0.0, dot(d, eyeForward));
  // Paupière : au-dessus du bord (arc plus haut au milieu), couleur du pelage, mate, sans reflet ;
  // fin liseré brun juste au bord pour que l'œil mi-clos reste lisible.
  float edge = mix(${LID_OPEN.toFixed(2)}, ${LID_CLOSED.toFixed(2)}, eyeLid) - ${LID_ARCH.toFixed(2)} * uv.x * uv.x;
  float below = edge - uv.y;
  c = mix(c, eyeRing * 0.6, 1.0 - smoothstep(0.0, 0.06, abs(below)));
  eyeLidMask = 1.0 - smoothstep(-0.015, 0.015, below);
  c = mix(c, eyeLidColor, eyeLidMask);
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
`;

export class Eyes {
  /** @param {THREE.SkinnedMesh[]} eyes globes oculaires (repère de repos du maillage) */
  constructor(eyes) {
    this.eyes = eyes;
    // Uniform partagé par les deux yeux : 0 = ouverts, 1 = fermés (voir setLid).
    this.lid = { value: 0 };
    for (const eye of eyes) {
      eye.geometry.computeBoundingSphere();
      const center = eye.geometry.boundingSphere.center.clone();
      // Le museau pointe vers +Z (repère de repos) ; chaque œil s'ouvre un peu vers son côté.
      const toMesh = eye.bindMatrix.clone().invert();
      const side = Math.sign(center.x) || 1;
      const forward = new THREE.Vector3(side * OUTWARD, 0.05, 1).normalize().transformDirection(toMesh);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(toMesh);
      // Droite et haut vus de face (spectateur devant le chat).
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
   * Paupières procédurales (pas d'os dans le rig) : 0 = yeux ouverts, 1 = yeux fermés ; valeur
   * bornée à [0, 1], appliquée aux deux yeux à l'image suivante. Exemple « yeux mi-clos de
   * contentement » pendant les papouilles : `cat.eyes.setLid(0.6)`, puis `setLid(0)` à la fin
   * (D peut interpoler t lui-même pour une fermeture douce).
   * @param {number} t
   */
  setLid(t) {
    this.lid.value = THREE.MathUtils.clamp(Number(t) || 0, 0, 1);
  }

  /** Valeur actuelle de la paupière (0 à 1). */
  getLid() {
    return this.lid.value;
  }
}
