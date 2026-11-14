import * as THREE from 'three';
import { CCapture } from '../vendor/ccapture.js-2.0.0/src/CCapture.js';
import { FrameEncoder } from '../vendor/ccapture.js-2.0.0/src/encoders/FrameEncoder.js';
import { nextTask } from '../vendor/ccapture.js-2.0.0/src/utils.js';

/**
 * Page side of the cutscene capture tool (tools/cutscenes/capture.mjs, which loads this module into a headless
 * browser pointed at the dev server and calls its exports). Development only: nothing in `src/` imports it, so it
 * never reaches the production build.
 *
 * It turns the running game into a camera set: the story logic and the interface are switched off, the render
 * quality is frozen at its top level, CCapture's TimeWarp replaces the browser clock (performance.now,
 * requestAnimationFrame, timers) by a virtual one that moves one frame at a time, and the stage module of the scene
 * (tools/cutscenes/stages/<name>.js) is called just before each image is drawn. The images go back to Node through
 * the DevTools protocol (`step` returns them), where ffmpeg encodes them.
 *
 * Exports, called by capture.mjs in this order: `init`, then `step` once per frame, `sheet`, `finish`.
 */

const HARNESS = {
  warmupSteps: 3,              // steps: undrawn, they let the game's own timer settle on exact steps before the scene starts
  gameFrameTimeoutMs: 60_000,  // ms (real time): wait for the animation frame the game had already requested
  timerToleranceS: 1e-6,       // s: allowed gap between the game's measured frame time and 1 / fps
  sheetColumns: 6,             // thumbnails per row of the contact sheet
  sheetThumbWidth: 384,        // px: thumbnails are small so a whole sheet stays readable in one view
  sheetGap: 6,                 // px between thumbnails
  sheetJpegQuality: 0.85,
};

const realNow = performance.now.bind(performance); // captured before TimeWarp replaces it

/** Encoder given to CCapture's FrameWrap: keeps the last frame as a PNG data URL for `step` to hand to Node. */
class NodeSink extends FrameEncoder {
  constructor(params) {
    super(params);
    this.extension = 'png';
    this.mimeType = 'image/png';
    this.latest = null;
  }

  async add(canvas) {
    this.latest = canvas.toDataURL('image/png'); // synchronous: the WebGL drawing buffer is still valid right after render
    await super.add();
  }
}

/** Everything the harness keeps between calls. */
const state = {
  game: null, stage: null, ctx: null, capturer: null, sink: null,
  driven: false,       // true while steps are driven by Node (before that the game loop only runs, undrawn)
  record: false,       // does the current step draw an image?
  t: 0, dt: 0,         // scene time (s) and step (s) given to the stage
  gameFrames: 0,       // render calls seen, driven or not
  rendered: 0,         // render calls seen during the current step
  error: null,         // error thrown by the stage's `frame`, rethrown by `step`
  gameDt: { last: 0, min: Infinity, max: 0, count: 0 }, // frame times (s) of the game's own timer, read through the adaptive quality update
  thumbs: [],
  thumbHeight: 0,
};

/** The systems of the game, from the debug handles (src/debug/handles.js). */
function gameHandles() {
  const w = window;
  return {
    THREE,
    world: w.__world, cat: w.__cat, npcs: w.__npcs, story: w.__story,
    sword: w.__sword.sword, dissolve: w.__sword.dissolve,
    launchers: w.__launchers, butterflies: w.__butterflies, yarn: w.__yarn, minimap: w.__minimap, occlusion: w.__occlusion,
    snowfall: w.__snowfall, footprints: w.__footprints, snowCats: w.__snowCats, chavalanche: w.__chavalanche?.chavalanche ?? null,
    quality: w.__quality, music: w.__music.music, canvas: w.__world.renderer.domElement,
  };
}

/** The canvas is the whole picture: every other element of the page is hidden (title, mini-map, bars, veil, bubble). */
function hideInterface() {
  const style = document.createElement('style');
  style.textContent = 'body > :not(#app), #app > :not(canvas) { display: none !important; } body { cursor: none; }';
  document.head.append(style);
}

/**
 * Story logic off, camera free, quality at its top level. The scene sets the camera in `frame`; OrbitControls would
 * pull it back to its own limits (0.7 to 10 m from the kitten) before each image.
 */
function takeOver({ world, cat, story, snowfall, quality }) {
  story.update = () => {};
  world.controls.enabled = false;
  world.controls.update = () => false;
  // The adaptive quality lowers the level when the measured frame rate is under 40: under the virtual clock every
  // frame lasts 1 / fps s, so it would drop a step every second. Its measure doubles as the check of the game timer.
  quality.update = (rawDt) => {
    const stats = state.gameDt;
    stats.last = rawDt;
    stats.min = Math.min(stats.min, rawDt);
    stats.max = Math.max(stats.max, rawDt);
    stats.count++;
  };
  world.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  world.meadow.setQuality(0);
  snowfall.setQuality(0);
  cat.fur.step = 1; // Fur.setStep only lowers: put the shells back before asking for all of them
  cat.fur.setStep(1);
}

/** Calls the stage just before the main render of the game and draws only the images that are recorded. */
function hookRender({ world }) {
  const renderer = world.renderer;
  const draw = renderer.render.bind(renderer);
  renderer.render = (scene, camera) => {
    if (camera !== world.camera) { draw(scene, camera); return; }
    state.gameFrames++;
    if (!state.driven) return; // game loop running before the capture starts: nothing is drawn
    state.rendered++;
    if (state.stage) {
      try { state.stage.frame(state.ctx, state.t, state.dt); } catch (error) { state.error = error; return; }
    }
    world.sky.position.copy(camera.position); // the sky is centred on the camera before the stage moved it
    if (state.record) draw(scene, camera);
  };
}

/** One step of the virtual clock: the game loop runs once and the render hook is reached once. */
function advance(label) {
  state.rendered = 0;
  state.error = null;
  state.capturer.step();
  if (state.error) throw state.error;
  if (state.rendered !== 1) {
    throw new Error(`[cutscene] the game loop reached the render ${state.rendered} times during ${label} (expected 1): see the page console errors`);
  }
}

/** Waits (real time) for the animation frame the game had requested before the virtual clock took over. */
async function waitForGameFrame() {
  const before = state.gameFrames;
  const end = realNow() + HARNESS.gameFrameTimeoutMs;
  while (state.gameFrames === before) {
    if (realNow() > end) throw new Error('[cutscene] the game loop did not run: no animation frame in time');
    await nextTask();
  }
}

/** The clock really is virtual: requestAnimationFrame timestamps, performance.now and the game's timer agree on 1 / fps. */
function checkVirtualTime(fps) {
  const stepMs = 1000 / fps;
  const stamps = [];
  for (let i = 0; i < HARNESS.warmupSteps; i++) {
    requestAnimationFrame((timestamp) => stamps.push([timestamp, performance.now()]));
    advance(`warm-up step ${i + 1}`);
  }
  const rafStep = stamps[stamps.length - 1][0] - stamps[stamps.length - 2][0];
  const sameClock = stamps.every(([timestamp, now]) => timestamp === now);
  const gameStep = state.gameDt.last;
  const ok = Math.abs(rafStep - stepMs) < 1e-6 && sameClock && Math.abs(gameStep - 1 / fps) < HARNESS.timerToleranceS;
  const report = { fps, rafStepMs: rafStep, performanceNowSameAsRaf: sameClock, gameTimerStepS: gameStep };
  if (!ok) throw new Error(`[cutscene] the clock is not virtual: ${JSON.stringify(report)}`);
  state.gameDt = { last: 0, min: Infinity, max: 0, count: 0 }; // from here the statistics only cover the scene
  return report;
}

/**
 * Prepares the capture: loads the stage, takes over the game, starts the virtual clock and runs the stage's `setup`.
 * @param {{ stageUrl: string, fps: number }} options stage module URL served by Vite, frames per second
 * @returns plain data for capture.mjs: duration and sound cues of the stage, quality level, clock check
 */
export async function init({ stageUrl, fps }) {
  const stage = await import(/* @vite-ignore */ stageUrl);
  for (const [name, type] of [['DURATION', 'number'], ['SOUND_CUES', 'object'], ['setup', 'function'], ['frame', 'function']]) {
    if (typeof stage[name] !== type) throw new Error(`[cutscene] ${stageUrl}: export \`${name}\` must be a ${type}`);
  }
  const game = gameHandles();
  state.game = game;
  state.stage = null;
  hideInterface();
  takeOver(game);
  hookRender(game);

  state.sink = new NodeSink({ framerate: fps });
  state.capturer = new CCapture({ encoder: state.sink, framerate: fps, hookMedia: false });
  state.capturer.manual = true; // this module advances the clock itself, one `advance` per image
  state.dt = 1 / fps;
  await state.capturer.start();
  await waitForGameFrame();
  state.driven = true;
  const clock = checkVirtualTime(fps);

  // Handed to the stage: the game's systems plus the capture settings. `settle` runs undrawn steps (the game moves, the
  // stage's `frame` is not called yet), for example to let the kitten finish a pose before the first image.
  const size = [state.game.canvas.width, state.game.canvas.height];
  game.fps = fps;
  game.size = size;
  game.settle = async (seconds) => {
    state.record = false;
    for (let i = 0, n = Math.round(seconds * fps); i < n; i++) advance(`settle step ${i + 1}`);
  };
  state.ctx = await stage.setup(game);
  state.stage = stage;
  const quality = `pixel ratio ${game.world.renderer.getPixelRatio()}, grass level ${game.world.meadow.quality}, snow level ${game.snowfall.level}, fur step ${game.cat.fur.step}`;
  return { duration: stage.DURATION, soundCues: stage.SOUND_CUES, quality, size, clock };
}

/**
 * One step of the scene: the virtual clock moves by 1 / fps, the game updates, the stage's `frame` sets the camera and
 * the actors, then the image is drawn and returned when `record` is true.
 * @param {number} index step number; the scene time is index / fps
 * @param {boolean} record draw and return the image of this step
 * @param {boolean} thumb also keep a thumbnail for the contact sheet
 * @returns {Promise<string|null>} the image as a PNG data URL, or null when it was not recorded
 */
export async function step(index, record, thumb) {
  state.t = index * state.dt;
  state.record = record;
  advance(`step ${index}`);
  if (!record) return null;
  const canvas = state.game.canvas;
  const saved = state.capturer.capture(canvas); // reads the canvas now, before anything else can happen
  if (thumb) addThumbnail(canvas, index, state.t);
  await saved;
  return state.sink.latest;
}

function addThumbnail(canvas, index, t) {
  const width = HARNESS.sheetThumbWidth;
  const thumbnail = document.createElement('canvas');
  thumbnail.width = width;
  thumbnail.height = state.thumbHeight = Math.round(width * canvas.height / canvas.width);
  const context = thumbnail.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
  state.thumbs.push({ index, t, thumbnail });
}

/** Contact sheet of the thumbnails kept by `step`, each labelled with its step number and scene time. */
export function sheet(title) {
  const { sheetColumns, sheetThumbWidth: w, sheetGap: gap } = HARNESS;
  const h = state.thumbHeight;
  const columns = Math.min(state.thumbs.length, sheetColumns);
  const rows = Math.ceil(state.thumbs.length / columns);
  const header = 28;
  const canvas = document.createElement('canvas');
  canvas.width = gap + columns * (w + gap);
  canvas.height = header + gap + rows * (h + gap);
  const context = canvas.getContext('2d');
  context.fillStyle = '#16161a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 15px sans-serif';
  context.textBaseline = 'middle';
  context.fillStyle = '#e8e8ee';
  context.fillText(title, gap, header / 2);
  state.thumbs.forEach(({ index, t, thumbnail }, i) => {
    const x = gap + (i % columns) * (w + gap), y = header + gap + Math.floor(i / columns) * (h + gap);
    context.drawImage(thumbnail, x, y);
    const label = `#${index}  t = ${t.toFixed(2)} s`;
    context.fillStyle = 'rgba(0, 0, 0, 0.65)';
    context.fillRect(x, y + h - 22, context.measureText(label).width + 14, 22);
    context.fillStyle = '#ffffff';
    context.fillText(label, x + 7, y + h - 11);
  });
  return canvas.toDataURL('image/png');
}

/** Ends the capture: the stage's `dispose`, the real clock back. Returns the frame times the game measured. */
export async function finish() {
  state.driven = false;
  await state.stage?.dispose?.(state.ctx);
  await state.capturer.stop();
  const { min, max, count } = state.gameDt;
  return { gameTimerStepS: { min, max, count } };
}
