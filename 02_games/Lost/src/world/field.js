/**
 * Champ de la prairie : hauteur de l'herbe, vent et écartement au passage du chat.
 * Chaque formule existe deux fois, en GLSL (pour les brins et les fleurs) et en JS (pour le jeu :
 * papillons, pelote, tests). Toute modification se fait des deux côtés.
 *
 * Unités : mètres. Le chat mesure 0,8 m du museau au bout de la queue, tête à 0,54 m debout
 * (README § 7). Le point de départ du chat est l'origine.
 */

// Clairière autour du point de départ : herbe rase jusqu'à CLEAR_INNER, haute au-delà de CLEAR_OUTER.
export const CLEAR_INNER = 2.2;
export const CLEAR_OUTER = 6.0;
// Hauteur moyenne de l'herbe (avant la variation propre à chaque brin, ×0,7 à ×1,25).
export const SHORT_MIN = 0.10, SHORT_VAR = 0.08; // clairière : 0,10 à 0,18 m
export const TALL_MIN = 0.80, TALL_VAR = 0.40;   // prairie : 0,80 à 1,20 m (tête du chat : 0,54 m)

/**
 * Limite de la prairie (mission catgame_monde, 2026-10-26) : rayon en mètres autour de l'origine
 * que ni le chat ni la pelote ne franchissent (appliqué par Brain.js, Cat.js et Yarn.js). Un peu
 * en deçà de FIELD_RADIUS = 20 m (Flowers.js, rayon de semis des fleurs) : des fleurs restent
 * visibles au-delà de la limite. Le sol remonte doucement à partir de là (Terrain.js, « rebord »),
 * sans mur : la limite se lit dans le décor.
 */
export const MEADOW_LIMIT = 18;

const f = (x) => x.toFixed(4);

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Bruit très lent (plaques plus ou moins hautes), 0 à 1. */
function patch(x, z) {
  return 0.5 + 0.25 * (Math.sin(x * 0.31 + z * 0.17) + Math.sin(z * 0.29 - x * 0.13 + 1.7));
}

/** Hauteur moyenne de l'herbe au point (x, z), en mètres, sans le passage du chat. */
export function fieldHeight(x, z) {
  const n = patch(x, z);
  const t = smoothstep(CLEAR_INNER, CLEAR_OUTER, Math.hypot(x, z));
  const short = SHORT_MIN + SHORT_VAR * n;
  const tall = TALL_MIN + TALL_VAR * n;
  return short + (tall - short) * t;
}

/**
 * Vent au point (x, z) à l'instant t : déplacement horizontal du sommet d'une tige, par mètre de
 * hauteur. `dir` = direction unitaire {x, z}, `strength` = force (0,22 par défaut).
 * Rafales qui traversent le champ (vagues) + frémissement rapide.
 */
export function windAt(x, z, t, dir, strength, out = { x: 0, z: 0 }) {
  const px = -dir.z, pz = dir.x;
  const a = x * dir.x + z * dir.z;
  const b = x * px + z * pz;
  const gust = 0.5 + 0.5 * Math.sin(a * 0.45 - t * 1.25 + 1.5 * Math.sin(b * 0.3 + t * 0.21));
  const flutter = Math.sin(t * 2.7 + a * 1.3 + b * 0.9);
  const s = strength * (0.3 + 0.7 * gust);
  const along = s * (1 + 0.25 * flutter);
  const side = 0.06 * strength * flutter;
  out.x = dir.x * along + px * side;
  out.z = dir.z * along + pz * side;
  return out;
}

/**
 * Écartement par une source (chat ou caméra) : `src` = {x, z, radius, strength}.
 * Retourne le déplacement horizontal du sommet par mètre de hauteur, dirigé à l'opposé de la source.
 */
export function pushFrom(x, z, src, out = { x: 0, z: 0 }) {
  const dx = x - src.x, dz = z - src.z;
  const L = Math.hypot(dx, dz);
  const k = (1 - smoothstep(0, src.radius, L)) * src.strength;
  out.x = L > 1e-4 ? dx / L * k : 0;
  out.z = L > 1e-4 ? dz / L * k : 0;
  return out;
}

/** Même code en GLSL. Uniformes attendus : uTime, uWindDir, uWindStrength, uPushA (chat), uPushB (caméra). */
export const GLSL_FIELD = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec4 uPushA; // chat : x, z, rayon, force
uniform vec4 uPushB; // caméra : x, z, rayon, force

float fieldHeight(vec2 p) {
  float n = 0.5 + 0.25 * (sin(p.x * 0.31 + p.y * 0.17) + sin(p.y * 0.29 - p.x * 0.13 + 1.7));
  float t = smoothstep(${f(CLEAR_INNER)}, ${f(CLEAR_OUTER)}, length(p));
  return mix(${f(SHORT_MIN)} + ${f(SHORT_VAR)} * n, ${f(TALL_MIN)} + ${f(TALL_VAR)} * n, t);
}

vec2 windAt(vec2 p, float t) {
  vec2 D = uWindDir;
  vec2 P = vec2(-D.y, D.x);
  float a = dot(p, D);
  float b = dot(p, P);
  float gust = 0.5 + 0.5 * sin(a * 0.45 - t * 1.25 + 1.5 * sin(b * 0.3 + t * 0.21));
  float flutter = sin(t * 2.7 + a * 1.3 + b * 0.9);
  float s = uWindStrength * (0.3 + 0.7 * gust);
  return D * (s * (1.0 + 0.25 * flutter)) + P * (0.06 * uWindStrength * flutter);
}

vec2 pushOne(vec2 p, vec4 src) {
  vec2 d = p - src.xy;
  float L = length(d);
  float k = (1.0 - smoothstep(0.0, src.z, L)) * src.w;
  return L > 1e-4 ? d / L * k : vec2(0.0);
}

vec2 pushAt(vec2 p) {
  return pushOne(p, uPushA) + pushOne(p, uPushB);
}
`;

/** Insère `code` après `token` dans `src` ; erreur explicite si `token` manque (version de three changée). */
export function inject(src, token, code, replace = false) {
  if (!src.includes(token)) throw new Error(`world : point d'insertion absent du shader : ${token}`);
  return src.replace(token, replace ? code : `${token}\n${code}`);
}
