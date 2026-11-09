import * as THREE from 'three';

/**
 * Colour palette and material helpers of the soft cartoon art style. Imported by the world, cat, NPC, critter and UI
 * modules.
 *
 * Main criterion: cosy and cute. Soft colours, golden light, light coloured shadows, never pure black nor a dominant
 * cold hue.
 *
 * Conventions:
 * - All colours are sRGB hex numbers (as in a paint program). `new THREE.Color(hex)` or `color(hex)` converts them to
 *   the three.js working space. For a vertex colour, use `color(hex)` then write `.r .g .b` (linear values), as
 *   Grass.js does.
 * - Scenery materials use `toonMaterial()`: MeshToonMaterial (flat shading, cheaper than MeshStandardMaterial) with a
 *   shared three-step ramp.
 */

// ---------------------------------------------------------------- sky, fog, rendering

/**
 * Painted sky: four-stop vertical gradient plus a golden glow on the sun side. The `blush` stop sits between the
 * peach horizon and the blue because a direct peach-to-blue blend goes through a dull beige grey.
 */
export const SKY = {
  top: 0x8ec5ee,      // soft blue at the zenith
  mid: 0xcfe7f7,      // pale blue at mid height
  blush: 0xffe2d8,    // very light pink-peach just above the horizon
  horizon: 0xffe9cc,  // light peach at the horizon (late afternoon light)
  sunGlow: 0xfff3c4,  // glow around the sun
};

/**
 * Linear fog of exactly the horizon colour, so that distant grass and ground melt into the bottom of the sky with no
 * visible line. The sky skips tone mapping (sky.js), like the fog colour in three: same final pixel.
 * `near` / `far` in metres (THREE.Fog).
 */
export const FOG = { color: SKY.horizon, near: 8, far: 34 };

/**
 * Rendering: Neutral tone mapping (Khronos PBR Neutral, no hue shift) keeps the pastels intact; exposure 1.
 * `background` = page colour (index.html) = horizon.
 */
export const RENDER = {
  toneMapping: THREE.NeutralToneMapping,
  exposure: 1.0,
  background: SKY.horizon,
};

// ---------------------------------------------------------------- lights

/**
 * Warm, low sun (late afternoon), light ambient sky and a ground that bounces golden light: faces in shadow stay
 * light and warm. `sun.offset` in metres from the camera target; intensities in three.js light units.
 */
export const LIGHT = {
  sun: { color: 0xffe0b0, intensity: 2.2, offset: [4, 5, 3] },
  hemiSky: 0xd8e9ff,
  hemiGround: 0xe0c48e,
  hemiIntensity: 1.1,
  // Soft warm rim light: separates the black silhouette of the cat.
  rim: { color: 0xffd6a8, intensity: 0.5, offset: [-3, 2, -4] },
};

/** Cast shadow: strength of the sun shadow (0 = none, 1 = full); `tint` is read by world/snowCatLook.js. */
export const SHADOW = { intensity: 0.55, tint: 0x8a7fae };

// ---------------------------------------------------------------- ground and grass

/** Ground: soft, bright green, lighter at the centre (clearing). */
export const GROUND = { center: 0xb7d97a, edge: 0x93c066 };

/**
 * Grass tufts: root-to-tip gradient on each tuft, plus tip variants picked per tuft. `base` is never dark: the shadow
 * between tufts is a colour.
 */
export const GRASS = {
  base: 0x6fae5c,     // root (rich sage green, not olive)
  mid: 0x96cc68,      // middle
  tip: 0xc9e47e,      // tip (lime green)
  // Fresh, not too yellow: under the golden sun, yellower tips turn orange.
  tips: [0xc4e584, 0xcfeb94, 0xb2dc7e],  // tip variants, one per tuft
  warmTip: 0xe3eaa2,  // cream-lime tip, rare (about 1 tuft in 8)
};

// ---------------------------------------------------------------- flowers

export const FLOWERS = {
  stem: 0x7fb562,
  leaf: 0x8cc46e,
  daisyPetal: 0xfffaf0,     // daisy
  daisyHeart: 0xffcf5a,
  poppy: 0xff9e8a,          // pastel poppy (coral)
  poppyHeart: 0x7a5a52,     // soft brown heart, not black
  cornflower: 0x9fb6ff,     // periwinkle cornflower
  cornflowerBud: 0x8fae7a,
  buttercup: 0xffe27a,      // buttercup
  buttercupHeart: 0xf2c25a,
  lavender: 0xc8a8ec,
  lavenderLight: 0xdcc4f4,
};

// ---------------------------------------------------------------- critters

/** Butterflies: same species names as `Butterfly.js` (SPECIES); softened edges, no black. */
export const BUTTERFLIES = {
  monarch: { base: 0xffb27a, edge: 0xe2846a },
  brimstone: { base: 0xfff08e, edge: 0xffc860 },
  'blue': { base: 0xa9d8ff, edge: 0x7ea8e6 },
  'pink white': { base: 0xffe6ef, edge: 0xff9fc2 },
  body: 0x6e584a,      // soft brown body
  antenna: 0x5a463a,
};

/** Yarn ball: soft raspberry pink, three tones for the wraps of yarn, plus the trailing thread. */
export const YARN = { base: 0xff8fa6, light: 0xffc4cf, dark: 0xe0687f, trail: 0xe9768d };

// ---------------------------------------------------------------- cat

/**
 * Black cat, readable and soft: warm black (never 0x000000), slightly caramel tips, golden rim light that draws the
 * volume, bright yellow-green eyes.
 */
export const CAT = {
  coat: 0x2a2320,
  tip: 0x5c4536,
  sheen: 0xffd9a8,          // rim light colour (Fur.js, COAT_LIGHT)
  // Rim light strength: high enough to keep the black coat from reading as a flat silhouette.
  sheenStrength: 0.6,
  // Sun-side flat tint, stronger on the back and head (Fur.js): very dark grey-brown added as emissive ×
  // coatLitStrength, so that the black is less absolute.
  coatLit: 0x7a685c,
  coatLitStrength: 0.45,
  eyeIrisIn: 0xeef27e,
  eyeIrisOut: 0x7cc24e,
  eyeRing: 0x3b2a1e,        // iris edge and eye corner: brown, not black
};

// ---------------------------------------------------------------- outline, interface

/** Inverted-hull outline (`outlineMaterial`): thin warm brown. Thickness in metres. */
export const OUTLINE = { color: 0x5a4436, thickness: 0.004 };

// ---------------------------------------------------------------- world: Tiny Glade inspiration
// Hues taken from public video captures, then lightened and softened toward the soft cartoon style.

/**
 * Stone of the low walls and ruins: varied warm blocks (one hue per block, then `jitter`), never cold grey. Warm
 * mauve shadows, joints as shadow gaps (no white mortar).
 */
export const STONE = {
  blocks: [
    0xf1dcb2,  // cream (most common)
    0xe8c78f,  // sand beige
    0xdcb582,  // deeper warm beige
    0xeab39a,  // rosy terracotta (rare, about 1 block in 8)
    0xf2cdbf,  // pale pink (rare)
    0xdcc38e,  // soft ochre
    0xcdc2b0,  // warm grey (corner stones, footing)
  ],
  base: 0xe8c78f,      // default hue when a single colour is needed
  sun: 0xfde9c4,       // sunlit face (light toon step)
  shade: 0xb89c8c,     // shaded face: mauve beige, never black
  joint: 0x9e8270,     // gap between blocks (thin dark band or recessed face)
  boulder: 0xc2bbae,   // large rounded rocks at the foot of the walls (warm grey)
  boulderShade: 0x968e92, // rock shadow, slightly mauve
};

/** Moss and ivy on the stones: soft greens, one tone fresher than the grass. */
export const MOSS = {
  base: 0x86a95c,      // moss on top of the stones
  light: 0xb1cb72,     // sunlit moss
  ivy: 0x5f9454,       // ivy leaves (mass)
  ivyLight: 0x92c46c,  // sunlit ivy leaves
};

/**
 * Background mountains, following atmospheric perspective: the farther, the closer to FOG.color. Use `haze(hex, t)`
 * below.
 */
export const MOUNTAIN = {
  near: 0x8fae7e,      // near slope covered with grass (soft grey green)
  nearRock: 0xc2ad9c,  // near rock (rosy beige, STONE family)
  far: 0xb7b9d6,       // far range (bluish lavender)
  farther: 0xd2cfe2,   // last range, almost the sky
  snow: 0xfff7ee,      // snow (cream white, never pure white)
  snowShade: 0xd8d4ec, // shaded snow (lavender)
  haze: FOG.color,     // fade colour = fog = SKY.horizon
  hazeNear: 0.25,      // recommended haze share for the near range (0 to 1)
  hazeFar: 0.6,        // same for the far range
};

/**
 * Rock of the background mountains (world/Mountains.js): colours shown as is, unlit, baked per facet.
 * `rock`: cliff, shifted toward `warm` or `cool` from one band to the next. `lit`: sun side. `shade`: lavender
 * shadow, never grey or black. `ledge`: ledges, lighter than the cliff, which draws the strata. `scree`: pale scree.
 * `meadow`: alpine pasture at the foot of the range. One family per zone: warm stone for the meadow (STONE family),
 * cold rock for zone 2 (SNOW.rock).
 */
export const MOUNTAIN_ROCK = {
  meadow: {
    rock: 0xc4a899, warm: 0xd8b48f, cool: 0xae9fb0, ledge: 0xdfc9ac, lit: 0xf3dcbc, shade: 0x8d86b4,
    scree: 0xcfbba6, meadow: 0xa4bd86, snow: MOUNTAIN.snow, snowShade: MOUNTAIN.snowShade, haze: MOUNTAIN.haze,
  },
  zone2: {
    rock: 0x8a8399, warm: 0xa08f96, cool: 0x757a9c, ledge: 0xaba5b8, lit: 0xc8bcc4, shade: 0x62628e,
    scree: 0xbdbacd, snow: 0xfbf8f4, snowShade: 0xc9cce6, haze: MOUNTAIN.haze,
  },
};

/**
 * Zone 2, snowy mountain (world/Mountain.js): same warm family as MOUNTAIN.snow, never pure white; grey lavender rock
 * to match the shaded snow; blue-green firs dark enough to stand out on white, with no black.
 */
export const SNOW = {
  fresh: 0xeef0fa,     // fresh cold snow: under the warm sun of the game, MOUNTAIN.snow turns sandy
  shade: MOUNTAIN.snowShade,
  path: 0xb9c3da,      // packed path snow: cold (a pinkish grey turns pink here), darker than `fresh`
  rock: 0x938da3,      // bare rock
  earth: 0x75625e,     // earth under thin snow: darker than the rock because Mountain.js brightens the ground (GROUND_LOOK.lift)
  pineTop: 0xa0cba3,   // top of the fir tiers (light sage)
  pineLow: 0x77a781,   // underside of the tiers
  trunk: 0x8b7a7a,     // top of the trunk
  // Firs, stones and ground, brought to the visual level of the meadow.
  cap: 0xeff2fb,       // snow on top of firs, stones and tufts: the lightest, slightly warm
  pineMid: 0x88b992,   // flank of the tiers: between top and underside
  trunkLow: 0x6e6063,  // foot of the trunk
  stones: [0xc9c3c8, 0xc2bcc8, 0xd2cabf, 0xd8cbbd, 0xd6bfbf], // stones: STONE family (warm grey, mauve, cream, sand, pink), most common first
  stoneShade: 0xa398b5, // underside of the stones: soft mauve, never grey
  tufts: [0x8fb8a0, 0xa5c4a8, 0xb9c9ae], // tips of the protruding tufts: sage, lime, straw (GRASS_KINDS)
  twig: 0x7a6254,      // twigs
  dust: 0xb9aab4,      // bare ground at the foot of the scenery: lavender beige (`earth` stood out too much)
  crest: 0xfff3ea,     // crest of the snowdrifts, in the sun
  lee: 0xc8c9e8,       // lee side of the snowdrifts, lavender shadow
  warm: 0xfff0e2,      // patches of warm snow in the sun (ground mottling)
  pathLight: 0xd2d7ea, // packed snow, lighter or more matte in places on the path
};

/**
 * Grass families (at least 3 different silhouettes). Each family has a root (base) and a tip; shadows stay olive or
 * blue-green, never black.
 */
export const GRASS_KINDS = {
  fine: { base: 0x5f9e5a, tip: 0xbfe07e },                    // fine meadow blades, long and supple
  tuft: { base: 0x6aa85a, tip: 0xcde88a, warmTip: 0xe6e7a0 }, // shaggy tufts in wisps, light tips
  seed: { base: 0x77a95e, stem: 0xa9c873, head: 0xe9dca0 },   // seed-head stems (cream-straw head)
  short: { base: 0x6fae5c, tip: 0xa8d474 },                   // short dense grass at the foot of the walls
};

/** Relief: hollows are cooler and darker, bumps lighter and warmer. */
export const TERRAIN = {
  hollow: 0x8db96a,    // bottom of a hollow (to blend with GROUND)
  bump: 0xc8e088,      // sunlit top of a bump
  path: 0xe4c391,      // warm earth path
  pathEdge: 0xcaa67a,  // path edge, darker earth
};

// ---------------------------------------------------------------- functions

/**
 * Atmospheric perspective: blends a colour toward FOG.color. Example: haze(MOUNTAIN.far, MOUNTAIN.hazeFar).
 * @param {number} hex sRGB colour
 * @param {number} t blend factor, 0 to 1
 * @returns {THREE.Color}
 */
export function haze(hex, t) {
  return mix(hex, FOG.color, t);
}

/** three.js colour (working space) from an sRGB hex. New instance on each call. */
export function color(hex) {
  return new THREE.Color(hex);
}

/**
 * Blends two sRGB hex colours in linear space: at t = 0.5 between black and white the result is #bcbcbc (lighter than
 * an sRGB blend).
 * @param {number} a sRGB colour
 * @param {number} b sRGB colour
 * @param {number} t blend factor, 0 to 1
 * @returns {THREE.Color}
 */
export function mix(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

/**
 * Slight variation of a colour to break uniformity (lightness ± amount, hue ± amount / 4).
 * @param {number} hex
 * @param {number} amount 0.04 to 0.08 recommended (above that, flat areas look noisy)
 * @param {() => number} rand generator in [0, 1), e.g. `rng` from random.js
 * @returns {THREE.Color}
 */
export function jitter(hex, amount, rand = Math.random) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.h = (hsl.h + (rand() * 2 - 1) * amount * 0.25 + 1) % 1;
  hsl.l = THREE.MathUtils.clamp(hsl.l + (rand() * 2 - 1) * amount, 0, 1);
  return c.setHSL(hsl.h, hsl.s, hsl.l);
}

/** Default steps: light shadow, half tone, full light (multipliers of the sunlight). */
const LEVELS = {
  2: [0.55, 1.0],
  3: [0.5, 0.78, 1.0],
  4: [0.45, 0.65, 0.85, 1.0],
};
const _gradients = new Map();

/**
 * Gradient ramp for MeshToonMaterial (`gradientMap`): a 1-pixel-high texture, one texel per step, nearest filter
 * (required by three.js), NoColorSpace (data, not colour). Cached: the same setting returns the same shared texture.
 * @param {number|number[]} steps 2, 3 or 4 predefined steps, or a list of increasing levels in 0-1
 * @returns {THREE.DataTexture}
 */
function toonGradient(steps = 3) {
  const levels = Array.isArray(steps) ? steps : (LEVELS[steps] ?? LEVELS[3]);
  const key = levels.join(',');
  let tex = _gradients.get(key);
  if (!tex) {
    const data = new Uint8Array(levels.map((v) => Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255)));
    tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _gradients.set(key, tex);
  }
  return tex;
}

/**
 * Toon material of the scenery (grass, flowers, butterflies, yarn, ground). `onBeforeCompile` hooks written for
 * MeshStandardMaterial still work: the toon vertex shader has the same chunks (`beginnormal_vertex`, `begin_vertex`,
 * `color_vertex`).
 * @param {number|THREE.Color} [hex=0xffffff] colour; leave white with `vertexColors: true`
 * @param {object} [opts] `steps` (ramp, default 3) plus any MeshToonMaterial option
 * @returns {THREE.MeshToonMaterial}
 */
export function toonMaterial(hex = 0xffffff, opts = {}) {
  const { steps = 3, ...rest } = opts;
  return new THREE.MeshToonMaterial({ color: hex, gradientMap: toonGradient(steps), ...rest });
}

/**
 * Inverted-hull outline: material for a COPY of the mesh (same geometry) added as a child of the original. Only back
 * faces are drawn, pushed along the normal by `thickness` metres (object space: divide by the scale on a scaled
 * mesh). Costs one more pass for the object: keep it for small highlighted objects (yarn, butterflies), never for the
 * grass or the furry cat.
 * @param {object} [opts] `color` (hex), `thickness` (m)
 * @returns {THREE.MeshBasicMaterial}
 */
export function outlineMaterial(opts = {}) {
  const thickness = opts.thickness ?? OUTLINE.thickness;
  const m = new THREE.MeshBasicMaterial({ color: opts.color ?? OUTLINE.color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness };
    shader.vertexShader = 'uniform float outlineThickness;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      // `normal` (attribute), not `objectNormal`: the latter only exists in the MeshBasicMaterial shader with envMap
      // or skinning.
      '#include <begin_vertex>\ntransformed += normalize(normal) * outlineThickness;',
    );
  };
  m.customProgramCacheKey = () => `lost-outline-${thickness}`;
  return m;
}
