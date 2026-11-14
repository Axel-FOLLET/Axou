/**
 * Cutscene capture, run from the project root with the dev server already running (Node 24, ffmpeg, a Chromium):
 *
 *   node tools/cutscenes/capture.mjs <scene> [options]
 *
 *   <scene>            stage module tools/cutscenes/stages/<scene>.js (or a path to a .js file inside the project)
 *   --fps n            frames per second (default 30)
 *   --size WxH         picture size in pixels, both even (default 1280x720)
 *   --from s           first recorded instant, in seconds of the scene (default 0); the scene is simulated from 0
 *   --to s             end of the capture in seconds (default: the stage's DURATION)
 *   --every n          record one image out of n (default 1): quick previews; the simulation still moves at every step
 *   --out dir          folder of the images (default .shots/cutscenes/<scene>/); images are named <step>_t<seconds>.png
 *   --encode file.mp4  then encode them: H.264 yuv420p, faststart, no audio track
 *   --crf n            quality of that encoding (default 20, lower is better and bigger)
 *   --sheet file.png   contact sheet of up to 30 recorded images, each labelled with its step and time
 *   --url address      dev server (default http://localhost:5173/); this tool never starts one
 *
 * A headless Chromium opens the game, tools/cutscenes/harness.js takes it over (story and interface off, quality
 * frozen, virtual clock) and calls the stage at every frame; each image comes back over the DevTools protocol.
 * A capture draws one image every few seconds in software rendering: run long captures with
 * `flock .shots/locks/render.lock node tools/cutscenes/capture.mjs ...` so that only one runs at a time.
 * Exit code: 0 done, 1 failed, 2 no browser found. The contract of a stage module is in tools/README.md.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Page, findBrowser, launchBrowser, processTreeRssMb } from './devtools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Values that shape the capture. */
const CAPTURE = {
  fps: 30,                       // images per second of the videos of the game
  size: [1280, 720],             // px: the videos are played full screen at this size
  url: 'http://localhost:5173/',
  crf: 20,                       // x264 quality: see tools/README.md for the size it gives
  preset: 'slow',                // x264 speed/size trade-off: encoding is short next to the capture itself
  sheetMaxImages: 30,            // thumbnails on a contact sheet
  gameTimeoutMs: 180_000,        // ms: the game (models, shaders) loads in the browser
  stepTimeoutMs: 300_000,        // ms: one image; the first one compiles the shaders
  serverTimeoutMs: 5_000,        // ms: the dev server answers
  memoryEveryMs: 2_000,          // ms between two samples of the browser's memory
};

/**
 * Stops the browser from reloading the page when Vite announces a file change: other agents edit `src/` during a
 * capture, and a reload would lose the frames drawn so far. Vite's client talks over a WebSocket of protocol
 * `vite-hmr`; it gets a socket that never opens, so it never hears anything.
 */
const BLOCK_VITE_RELOAD = `(() => {
  const Native = window.WebSocket;
  window.WebSocket = new Proxy(Native, {
    construct(target, args) {
      if ([].concat(args[1] ?? []).includes('vite-hmr')) {
        return Object.assign(new EventTarget(), { readyState: 0, OPEN: 1, send() {}, close() {} });
      }
      return Reflect.construct(target, args);
    },
  });
})();`;

const GAME_READY = `!!(window.__world && window.__story && window.__quality && window.__cat && window.__npcs && window.__sword
  && window.__music && window.__world.renderer.info.render.frame > 0)`;

function fail(message) {
  console.error(`capture: ${message}`);
  process.exit(1);
}

function parseArguments(argv) {
  const options = { fps: CAPTURE.fps, size: CAPTURE.size, from: 0, to: null, every: 1, out: null, encode: null, crf: CAPTURE.crf,
    sheet: null, url: CAPTURE.url, scene: null };
  const number = (flag, value, { integer = false, min = 0 } = {}) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) fail(`${flag} needs ${integer ? 'an integer' : 'a number'} >= ${min}, got "${value}"`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { if (options.scene) fail(`unexpected argument "${arg}"`); options.scene = arg; continue; }
    const value = argv[++i];
    if (value === undefined) fail(`${arg} needs a value`);
    switch (arg) {
      case '--fps': options.fps = number(arg, value, { integer: true, min: 1 }); break;
      case '--size': {
        const match = /^(\d+)x(\d+)$/.exec(value);
        if (!match || match[1] % 2 || match[2] % 2 || !+match[1] || !+match[2]) fail(`--size needs WxH with even numbers, got "${value}"`);
        options.size = [Number(match[1]), Number(match[2])];
        break;
      }
      case '--from': options.from = number(arg, value); break;
      case '--to': options.to = number(arg, value); break;
      case '--every': options.every = number(arg, value, { integer: true, min: 1 }); break;
      case '--out': options.out = value; break;
      case '--encode': options.encode = value; break;
      case '--crf': options.crf = number(arg, value, { integer: true }); break;
      case '--sheet': options.sheet = value; break;
      case '--url': options.url = value; break;
      default: fail(`unknown option ${arg}`);
    }
  }
  if (!options.scene) fail('usage: node tools/cutscenes/capture.mjs <scene> [--fps n] [--size WxH] [--from s] [--to s] [--every n] [--out dir] [--encode file.mp4] [--crf n] [--sheet file.png] [--url address]');
  return options;
}

/** Name and served URL of the stage module. */
function resolveStage(scene) {
  const file = scene.includes('/') || scene.endsWith('.js')
    ? path.resolve(ROOT, scene)
    : path.join(ROOT, 'tools', 'cutscenes', 'stages', `${scene}.js`);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail(`stage ${scene} is outside the project: the dev server cannot serve it`);
  if (!fs.existsSync(file)) fail(`stage not found: ${relative}`);
  return { name: path.basename(file, '.js'), url: `/${relative.split(path.sep).join('/')}` };
}

async function checkServer(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(CAPTURE.serverTimeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    fail(`no dev server at ${url} (${error.message}): start it with \`npm run dev\` first`);
  }
}

/** Evaluates in the page, failing if the step takes longer than `ms`. */
async function evaluateWithin(page, expression, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: no answer after ${ms / 1000} s`)), ms); });
  try { return await Promise.race([page.evaluate(expression), timeout]); } finally { clearTimeout(timer); }
}

const frameName = (step, seconds) => `${String(step).padStart(5, '0')}_t${seconds.toFixed(3).padStart(7, '0')}.png`;
const FRAME_FILE = /^\d{5}_t\d{3,}\.\d{3}\.png$/;

/** Indices (into the list of recorded images) kept for the contact sheet: spread evenly, first and last included. */
function sheetPicks(count) {
  const picks = new Set();
  const kept = Math.min(count, CAPTURE.sheetMaxImages);
  for (let k = 0; k < kept; k++) picks.add(kept === 1 ? 0 : Math.round(k * (count - 1) / (kept - 1)));
  return picks;
}

function encode(options, outDir) {
  const target = path.resolve(options.encode);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const rate = options.fps / options.every;
  // BT.709 matrix and tags: the browser draws untagged HD video as BT.709, ffmpeg would otherwise convert with BT.601.
  const filter = 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p';
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(rate), '-pattern_type', 'glob', '-i', path.join(outDir, '*_t*.png'),
    '-vf', filter, '-c:v', 'libx264', '-preset', CAPTURE.preset, '-crf', String(options.crf), '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', target];
  const started = Date.now();
  const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) fail(`ffmpeg failed (status ${result.status ?? result.error?.message})`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt:format=duration,size', '-of', 'json', target], { encoding: 'utf8' });
  const info = JSON.parse(probe.stdout || '{}');
  const stream = info.streams?.[0] ?? {};
  const size = Number(info.format?.size ?? fs.statSync(target).size);
  console.log(`encoded ${path.relative(ROOT, target) || target} in ${((Date.now() - started) / 1000).toFixed(1)} s (crf ${options.crf}, ${CAPTURE.preset}): `
    + `${stream.codec_name} ${stream.width}x${stream.height} ${stream.r_frame_rate} ${stream.pix_fmt}, ${stream.nb_frames} frames, `
    + `${Number(info.format?.duration).toFixed(3)} s, ${(size / 1e6).toFixed(2)} MB, ${(size * 8 / Number(info.format?.duration) / 1e6).toFixed(2)} Mbit/s`);
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const stage = resolveStage(options.scene);
  const [width, height] = options.size;
  const outDir = path.resolve(ROOT, options.out ?? path.join('.shots', 'cutscenes', stage.name));
  const executable = findBrowser();
  if (!executable) { console.log('No browser found: set CHROME_PATH to a Chromium or Chrome executable.'); process.exit(2); }
  await checkServer(options.url);

  const browser = await launchBrowser(executable, { width, height });
  const cleanup = () => { browser.child.removeAllListeners('exit'); browser.child.kill('SIGKILL'); fs.rmSync(browser.profile, { recursive: true, force: true }); };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  browser.child.on('exit', () => { console.error('capture: the browser stopped'); process.exit(1); });

  let failure = null;
  const page = await Page.connect(browser.url);
  try {
    await page.open(options.url, { width, height, initScript: BLOCK_VITE_RELOAD });
    await page.waitFor('the game', GAME_READY, CAPTURE.gameTimeoutMs);
    page.navigations = 0; // from here a navigation is a reload by the dev server or the page, which ends the capture
    const started = Date.now();
    const info = await evaluateWithin(page,
      `import('/tools/cutscenes/harness.js').then((module) => { window.__cutsceneCapture = module; return module.init(${JSON.stringify({ stageUrl: stage.url, fps: options.fps })}); })`,
      CAPTURE.stepTimeoutMs, 'stage setup');
    const to = options.to ?? info.duration;
    const steps = Math.round(to * options.fps);
    const firstStep = Math.round(options.from * options.fps);
    if (firstStep >= steps) throw new Error(`--from ${options.from} is not before the end of the capture (${to} s)`);
    const recorded = [];
    for (let i = firstStep; i < steps; i += options.every) recorded.push(i);
    const picks = options.sheet ? sheetPicks(recorded.length) : new Set();
    console.log(`${stage.name}: ${steps} steps at ${options.fps} fps (${to} s of ${info.duration} s), ${recorded.length} images ${width}x${height}, quality ${info.quality}, `
      + `clock ok (raf step ${info.clock.rafStepMs.toFixed(3)} ms, game timer ${(info.clock.gameTimerStepS * 1000).toFixed(3)} ms), setup ${((Date.now() - started) / 1000).toFixed(1)} s`);

    fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(outDir)) if (FRAME_FILE.test(file)) fs.rmSync(path.join(outDir, file));
    fs.writeFileSync(path.join(outDir, 'stage.json'), JSON.stringify({ scene: stage.name, fps: options.fps, size: [width, height], from: options.from, to,
      every: options.every, duration: info.duration, steps, images: recorded.length, soundCues: info.soundCues }, null, 2));

    const durations = [];
    let peakMb = 0, lastSample = 0, nextRecorded = 0;
    const began = Date.now();
    for (let i = 0; i < steps; i++) {
      const record = i === recorded[nextRecorded];
      const stepStart = Date.now();
      const data = await evaluateWithin(page, `__cutsceneCapture.step(${i}, ${record}, ${picks.has(nextRecorded)})`, CAPTURE.stepTimeoutMs, `step ${i}`);
      if (page.navigations > 0) throw new Error('the page reloaded during the capture (the frames drawn so far are kept)');
      if (!record) continue;
      nextRecorded++;
      fs.writeFileSync(path.join(outDir, frameName(i, i / options.fps)), Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
      durations.push((Date.now() - stepStart) / 1000);
      if (Date.now() - lastSample > CAPTURE.memoryEveryMs) { lastSample = Date.now(); peakMb = Math.max(peakMb, processTreeRssMb(browser.child.pid) ?? 0); }
      if (nextRecorded % 10 === 0 || nextRecorded === recorded.length) {
        const rate = (Date.now() - began) / 1000 / nextRecorded;
        console.log(`  ${nextRecorded}/${recorded.length} images, step ${i}, ${rate.toFixed(2)} s per image, about ${Math.round(rate * (recorded.length - nextRecorded))} s left`);
      }
    }
    if (options.sheet) {
      const sheet = await page.evaluate(`__cutsceneCapture.sheet(${JSON.stringify(`${stage.name}  ${width}x${height}  ${options.fps} fps${options.every > 1 ? `  1 image out of ${options.every}` : ''}`)})`);
      fs.mkdirSync(path.dirname(path.resolve(options.sheet)), { recursive: true });
      fs.writeFileSync(options.sheet, Buffer.from(sheet.slice(sheet.indexOf(',') + 1), 'base64'));
      console.log(`contact sheet: ${options.sheet}`);
    }
    const end = await page.evaluate('__cutsceneCapture.finish()');
    peakMb = Math.max(peakMb, processTreeRssMb(browser.child.pid) ?? 0);
    console.log(`captured ${recorded.length} images in ${((Date.now() - began) / 1000).toFixed(1)} s: first ${durations[0].toFixed(2)} s, median ${median(durations).toFixed(2)} s, `
      + `mean ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)} s per image; browser memory peak ${peakMb.toFixed(0)} MB (all its processes); `
      + `game timer step min ${(end.gameTimerStepS.min * 1000).toFixed(3)} ms, max ${(end.gameTimerStepS.max * 1000).toFixed(3)} ms over ${end.gameTimerStepS.count} frames`);
    console.log(`images: ${path.relative(ROOT, outDir) || outDir}`);
  } catch (error) {
    failure = error;
  }
  const problems = [...page.problems];
  cleanup();
  if (failure) { console.error(`capture failed: ${failure.message}`); if (problems.length) console.error(`page problems:\n  ${problems.join('\n  ')}`); process.exit(1); }
  if (options.encode) encode(options, outDir);
  if (problems.length) { console.error(`page problems:\n  ${problems.join('\n  ')}`); process.exit(1); }
}

main().catch((error) => { console.error(error); process.exit(1); });
