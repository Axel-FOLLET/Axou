/**
 * Tuning tables of the chase scene (cutscene 1, first part): the clock, Maman's run, the slope, the paint blasts, the
 * giant Chartiste, the sky. Read by `arrival_chase.js` and its modules. Every value has its unit and the reason for it;
 * a change of feel is a change here, not in the logic.
 *
 * Frame conventions: world axes of the game (+Y up). Maman runs down the slope towards +Z. "Left" is the cat's left
 * (+X when she faces +Z), "ahead" is her heading. Positions "relative to Maman" are [left, ahead] in metres.
 */

/** Clock of the scene (s from its start). Every event of the story is keyed on one of these instants. */
export const CLOCK = {
  duration: 36.0,       // s: roadmap asks 33 to 38 for this part; the fall (task 09) adds about 8 s, total 40 to 60
  frontEnd: 5.0,        // s: end of the opening close-up (brief: first 5 s on Maman, seen from the front)
  cry: 10.6,            // s: the Chartiste starts his cry of rage (RageCry) when the camera has revealed him
  catch: 23.7,          // s: her front paw catches the rock (start of the Stumble clip)
  release: 24.2,        // s: the kitten leaves her mouth, 0.5 s after the catch, as she pitches forward
  kittenGone: 25.9,     // s: the kitten is hidden from here (no shot after the cut at 26.2 may show it)
  separation: 29.6,     // s: the violet blast that separates them lands
  fleeStart: 30.1,      // s: Maman bolts sideways (0.5 s after the blast, time to be thrown back)
  blackFrom: 34.6,      // s: fade to black begins
  blackFull: 35.4,      // s: fully black; held to the end so the assembly (task 09) can cut cleanly
};

/** Maman's run. Speeds follow the `run` clip without sliding (formula of Cat.js: stride x scale / duration). */
export const RUN = {
  strideUnits: 4.0 / 0.25, // rig units per cycle: RUN_STRIDE of src/cat/Cat.js (same rig, same clip)
  rate: 0.95,              // clip speed factor: slightly under the full gallop, she is tired
  startZ: -48,             // m: z where the scene starts; chosen so the stumble lies about 60 m down the slope
  startX: 4,               // m
  serpentine: 0.2,         // rad: amplitude of the zig-zag of her heading (dodging, and a path that is not a ruler line)
  serpentinePeriod: 8.0,   // s
  fleeTurn: 1.25,          // rad: heading change when she bolts away after the separation (positive = to her left)
  fleeTurnTime: 0.55,      // s: duration of that turn
  fleeRamp: 0.7,           // s: time to get back to full speed
  slide: 0.35,             // s: time constant of her slide after the catch (speed falls by e every `slide` s)
  riseEnd: 25.9,           // s: speed is zero from here (the Stumble clip ends about 1.8 s after the catch)
};

/** Her pose over the whole scene is driven by clips; these are the stand-ins used while a new clip is missing. */
export const CLIPS = {
  run: 'run',
  carried: 'Carried',
  stumble: 'Stumble',
  stumbleFallback: 'Knockback', // existing clip with a recoil: stand-in until `Stumble` is in cat.glb
  cry: 'RageCry',
  cryFallback: 'BrushHold',     // existing guard clip of the boss: stand-in until `RageCry` is in cat.glb
};

/** Kitten carried in the mouth: how it hangs and swings (roadmap: "it hangs and swings a little because of the run"). */
export const CARRY = {
  nape: [0, 0.3907, -0.6178], // nape point in the Neck001 bone frame: CARRY.nape of src/cat/Cat.js (same value)
  yaw: -Math.PI / 2,          // rad: kitten crosswise to Maman: CARRY.yaw of src/cat/Cat.js
  swingRoll: 0.16,            // rad: side-to-side swing about Maman's axis, at the stride rate (hanging weight)
  swingPitch: 0.1,            // rad: fore-aft swing, twice the stride rate (body jolt at each landing)
  swingLag: 0.9,              // rad: phase lag of the swing behind her stride (a hanging weight lags)
};

/** Kitten in flight after the stumble: ballistic from the mouth, spinning. */
export const FLIGHT = {
  mouth: [0, 0.42, 0.62],  // m: where the mouth is in her frame [left, up, ahead] (matches the carried pose)
  kick: [0.4, 6.4, 3.4],   // m/s added to her own velocity [left, up, ahead]: a lob up and forward, thrown by the fall
  gravity: 9.8,            // m/s2
  spin: [4.5, 1.2, 2.6],   // rad/s about [left, up, ahead]: a limp body tumbling
  clip: 'Carried',         // limp pose kept while flying
};

/** Slope: a mountain flank steeper at the top and flattening towards the valley, with bowl and bumps. */
export const SLOPE = {
  zTop: -330,          // m: top of the ground mesh
  zBottom: 330,        // m: bottom of the ground mesh
  xHalf: 420,          // m: half width of the mesh; the edge is far beyond the fog
  gradient: [0.5, 0.2],// slope (m of drop per m) at the top and at the bottom: 27 degrees down to 11
  easeFrom: -110,      // m: z where the slope starts to ease
  easeLength: 280,     // m: length of that transition
  bowl: 0.0011,        // 1/m: height gained per m2 of lateral distance, the mountain closes in on both sides
  bowlMax: 40,         // m: cap on that gain
  bump: { amp: 1.4, scale: 0.045, fine: 0.35, fineScale: 0.21 }, // m, cycles/m: drifts and ripples
  bumpClear: [2.5, 9], // m: distance to Maman's path where the bumps start and reach full height (she runs on a smooth way)
  cell: 1.0,           // m: fine cell size of the mesh around the filmed area
  fineX: [-45, 75],    // m: filmed area in x (fine cells)
  fineZ: [-130, 140],  // m: filmed area in z
  grow: 1.28,          // growth of the cells outside it
  lift: 1.55,          // factor on the snow colour: the warm sun would turn the snow beige otherwise (GROUND_LOOK.lift = 1.7)
};

/** Fir trees, rocks. Shapes come from src/world/snowLook.js (`addPine`, `addRock`), the look of the snow zone. */
export const SCENERY = {
  seed: 20261112,
  corridor: 3.4,        // m: no tree within this distance of Maman's path (she must not run through a trunk)
  corridorFade: 8,      // m: beyond this the density is full
  nearDensity: 1 / 26,  // trees per m2 within `nearReach` of the path
  farDensity: 1 / 150,  // trees per m2 beyond
  nearReach: 38,        // m
  reach: 120,           // m: no tree beyond this distance from the path
  spacing: 0.5,         // m: minimum gap between two crowns
  height: [3.4, 6.2],   // m: fir height (LOOK.pine.h is 3.2 to 5.6; slightly taller to loom over the small cats)
  radius: [1.0, 1.7],   // m: crown radius
  detailReach: 12,      // m: trees nearer the path than this get the full 11-sided look
  rocks: 46,            // count of scattered rocks
  rockRadius: [0.6, 1.4], // m
  chunk: 36,            // m: merge size of the standing trees (one draw call per chunk)
  stumbleRock: { radius: 0.62, flat: 0.8, ahead: 0.55 }, // the rock she catches her paw on: ahead of her root at the catch
  rockSide: -0.55,       // m: lateral offset of that rock from her track, negative = her right: the Stumble clip catches the right front paw
};

/** Paint blasts. */
export const BLAST = {
  colors: [0xe86a7a, 0xf3c55a, 0xf08a62, 0x9478b8, 0xfff3c4], // pink, yellow, orange (Paint.js PAINT.colors), violet (Maman's mark), cream rim
  shellRadius: 0.55,   // m: falling blob before it lands
  shellStretch: 3.2,   // length of the streak relative to its radius
  skyFlight: 0.95,     // s: shells that fall from the sky above the camera
  skyHeight: 42,       // m: height they start from
  skyOffset: 16,       // m: horizontal run of their fall, uphill
  farFlight: 2.7,      // s: shells thrown by the Chartiste across the valley
  farArc: 55,          // m: apex above the straight line
  core: { rise: 0.22, hold: 0.55, fall: 1.1 }, // s: swelling, holding and collapsing of the main blob
  ring: { speed: 28, life: 0.7 },              // m/s, s: shock ring on the ground
  splatGrow: 0.25,     // s: ground splat reaches its size
  droplets: 30,        // per blast
  dropletSpeed: [7, 21],   // m/s
  dropletElevation: [0.35, 1.3], // rad above the horizon
  dropletSize: [0.12, 0.34],     // m radius
  gravity: 9.8,
  treeRadiusK: 2.9,    // trees within core radius x this are blown away
  treeFly: [3.5, 7.5], // m/s horizontal speed of a blown tree (nearer = faster)
  treeLift: [3.5, 7.5],// m/s upward
  treeSpin: [2.4, 5.0],// rad/s tumbling
  treeDelay: 0.04,     // s of delay per metre from the centre (the blast wave reaches farther trees later)
  shake: { amp: 0.16, decay: 3.2, reach: 55 }, // camera: m of shake at the blast, decay 1/s, distance beyond which none
};

/**
 * Blasts. `t` landing instant (s). `at`: [left, ahead] relative to Maman's position at that instant. `r`: core radius
 * (m). `c`: colour index of BLAST.colors. `from`: 'sky' (falls from above, close) or 'far' (thrown by the Chartiste).
 * `trees`: blows away the firs around it. Instants and places are justified in the sheet of the task.
 */
export const BLASTS = [
  // Stage 2, close-up then side shot: the first shells fall around her.
  { t: 5.4, at: [-8, 10], r: 2.0, c: 0, from: 'sky', trees: true },
  { t: 6.5, at: [-6, 1], r: 2.4, c: 1, from: 'sky', trees: true },
  { t: 7.5, at: [-9, -6], r: 2.2, c: 2, from: 'sky', trees: true },
  { t: 8.9, at: [4, -8], r: 2.6, c: 0, from: 'sky', trees: true },
  // Stage 3: the volley thrown from far away arrives, a rolling barrage that closes in.
  { t: 13.8, at: [8, 6], r: 2.2, c: 1, from: 'far', trees: true },
  { t: 14.6, at: [-6, 3], r: 2.4, c: 0, from: 'far', trees: true },
  { t: 15.4, at: [5, -5], r: 2.2, c: 2, from: 'far', trees: true },
  { t: 16.3, at: [-8, 8], r: 2.6, c: 0, from: 'far', trees: true },
  { t: 17.2, at: [4, 13], r: 2.4, c: 1, from: 'far', trees: true },
  { t: 19.4, at: [0, -9], r: 3.4, c: 0, from: 'far', trees: true },
  { t: 20.4, at: [-7, -3], r: 2.4, c: 2, from: 'far', trees: true },
  { t: 21.6, at: [6, 8], r: 2.4, c: 1, from: 'far', trees: true },
  { t: 22.5, at: [-5, 7], r: 2.2, c: 0, from: 'far', trees: true },
  // Separation: violet, ahead of Maman where the kitten is falling, the biggest of the scene.
  { t: 29.6, at: [0, 6.2], r: 4.4, c: 3, from: 'far', trees: true },
  // Last blast, behind her as she bolts: the closing flash.
  { t: 32.2, at: [-4, -6], r: 3.4, c: 3, from: 'far', trees: true },
];

/** The giant Chartiste: boss form (red coat, brush in the paw), very much larger than in the game (BOSS.scale is 5). */
export const CHARTISTE = {
  scale: 60,                 // x the hero's size (the game's boss is 5): about 37 m long, taller standing, 7 to 8 fir heights
  offset: [-14, -125],       // m: [x, z]: far up the slope, a little to the side so Maman and he are not on the same line
  yaw: 0,                    // rad: faces down the slope (+Z), towards Maman
  brushTip: [-7, 50, 18],    // m: where the thrown paint starts, relative to his root [x, up, z]: his brush paw raised
  poseDelay: 0.0,            // s: he already holds the pose when the camera reveals him
  cryRate: 1.0,              // clip speed of the cry
};

/** Sky, fog and light of the scene: the game's palette pushed to a warmer, lower, more dramatic evening. */
export const MOOD = {
  // The horizon keeps the game's colour (FOG.color): the peaks of Mountains.js mix their haze with it, a different fog
  // colour would show a seam at their feet. Only the upper sky and the glow are pushed.
  sky: { top: 0x5f7fc4, mid: 0xd9b8d0, blush: 0xffbfa6, horizon: 0xffe9cc, sunGlow: 0xffd890 },
  fog: { near: 120, far: 520 },    // m: haze that lets a 40 m giant read at 250 m yet melts the mesh edge
  sunColor: 0xfff3e4,
  sunIntensity: 2.3,
  shadowHalf: 13,                  // m: half width of the sun shadow box (the game's is 4), centred on Maman
  shadowFar: 70,                   // m
  sunOffset: [-9, 7, -4],          // m: low sun behind the slope's top-right, rim-lights Maman's fur from behind the camera shots
};

/** Mountains on the horizon, built with the game's own generator (src/world/Mountains.js). */
export const HORIZON = {
  centre: [0, 0],          // m: x, z of the ring of peaks
  baseY: -205,             // m: height of the base of the peaks, near the lowest filmed ground (the way ends about 190 m below the top)
  cameras: { x: [-160, 160], y: [0, 260], z: [-120, 140] },  // m: box of camera positions (peak-local, base at 0), pruning of hidden faces
  // Giants that tower over the valley, placed round the slope (x, z in m from the centre, H in m). One stands behind the
  // Chartiste so he has a backdrop; the ones at -X and +X close the valley.
  giants: [
    { x: 330, z: -40, H: 175, aspect: 0.5, cols: 34, bands: 6, axis: 1.57 },
    { x: -320, z: 80, H: 150, aspect: 0.52, cols: 28, bands: 5, axis: 1.87 },
    { x: -300, z: -130, H: 160, aspect: 0.52, cols: 28, bands: 5, axis: 1.27 },
    { x: 60, z: 400, H: 140, aspect: 0.56, cols: 24, bands: 4, axis: 2.2 },
    { x: 280, z: 190, H: 125, aspect: 0.56, cols: 24, bands: 4, axis: 2.3 },
    { x: 40, z: -440, H: 230, aspect: 0.5, cols: 30, bands: 6, axis: 0.2 },
  ],
};

/** Snow in the air and kicked up by the paws. */
export const SNOW_AIR = {
  puffRate: 40,          // puffs per s while she runs
  puffLife: 0.6,         // s
  puffSize: [0.025, 0.06],// m radius
  puffRise: 0.35,        // m/s upward drift
  puffBack: 0.9,         // m/s thrown backwards
  puffTint: 0xf2f0fc,
  seed: 20261113,
};

/** Hand-held camera: amplitude (m) of the slow shake, on close shots and on the wide, high ones (it reads stronger far away). */
export const HAND = { near: 0.012, far: 0.02 };
