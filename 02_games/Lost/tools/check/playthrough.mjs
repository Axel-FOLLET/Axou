/**
 * Short scripted playthrough, run by `npm run check` or on its own:
 *   node tools/check/playthrough.mjs
 *
 * Starts the Vite dev server, opens the game in a headless Chromium and plays one fight through the debug
 * handles: title screen, arrival cutscene, boss music, arena, sword cutscene, march at half boss health, victory, hug
 * cutscene. Fails on an uncaught exception, a console error (a video that cannot be loaded or played logs one), a missing
 * file or a wrong game state. Audio is checked as state only.
 *
 * No extra dependency: the browser is driven over the DevTools protocol with Node's built-in WebSocket.
 * Browser lookup: CHROME_PATH, then the Playwright cache, then PATH. Exit code 2 means no browser was found.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5199;              // first port tried, away from the usual dev server on 5173
const TIMEOUT_MS = 180_000;     // whole run; software rendering is slow
const BROWSER_NAMES = ['chrome-headless-shell', 'headless_shell', 'chrome', 'chromium', 'chromium-browser', 'google-chrome'];

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(cache)) {
    for (const build of fs.readdirSync(cache).filter((d) => d.startsWith('chromium')).sort()) {
      const buildDir = path.join(cache, build);
      for (const sub of fs.readdirSync(buildDir)) {
        for (const name of BROWSER_NAMES) {
          const candidate = path.join(buildDir, sub, name);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
        }
      }
    }
  }
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of BROWSER_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** Starts the browser and resolves with the process and its DevTools WebSocket URL. */
function launch(executable) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lost-check-'));
  const child = spawn(executable, [
    '--headless', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required', '--window-size=1280,800', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let log = '';
    child.once('error', reject);
    child.stderr.on('data', (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve({ child, profile, url: match[1] });
    });
    child.once('exit', (code) => reject(new Error(`browser exited early (code ${code}): ${log.slice(-400)}`)));
  });
}

/** Minimal DevTools protocol client attached to one page. */
class Page {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionId = undefined;
    this.problems = [];
    socket.addEventListener('message', (event) => this._receive(JSON.parse(event.data)));
  }

  send(method, params = {}, root = false) {
    const id = this.nextId++;
    const sessionId = root ? undefined : this.sessionId;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  _receive(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, method } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
      return;
    }
    const p = message.params;
    if (message.method === 'Runtime.exceptionThrown') {
      this.problems.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`);
    } else if (message.method === 'Runtime.consoleAPICalled') {
      const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (p.type === 'error' || (p.type === 'warning' && text.startsWith('[audio]'))) this.problems.push(`console.${p.type}: ${text}`);
    } else if (message.method === 'Log.entryAdded' && p.entry.level === 'error' && !/favicon\.ico/.test(p.entry.url ?? '')) {
      this.problems.push(`${p.entry.text} ${p.entry.url ?? ''}`);
    }
  }

  async open(url) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' }, true);
    ({ sessionId: this.sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true }, true));
    await Promise.all([this.send('Runtime.enable'), this.send('Log.enable'), this.send('Page.enable')]);
    await this.send('Page.navigate', { url });
  }

  /** Runs `fn` in the page, awaits it, returns its plain-data result. */
  async run(fn, arg) {
    const result = await this.send('Runtime.evaluate', {
      expression: `(${fn})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  async waitFor(label, fn, timeoutMs = 60_000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try { if (await this.run(fn)) return; } catch { /* page still loading */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`timed out waiting for: ${label}`);
  }
}

function expect(step, condition, details) {
  if (!condition) throw new Error(`${step}: unexpected state ${JSON.stringify(details)}`);
  console.log(`  ok  ${step}`);
}

async function play(page) {
  await page.waitFor('game modules', () => !!(window.__world && window.__music && window.__story && document.querySelector('button.play')));
  // Software rendering runs at about 1 frame/s: drawing is cut, except for the single frame rendered below.
  await page.run(() => { const r = window.__world.renderer; r.__draw = r.render; r.render = () => {}; });
  await page.waitFor('music decoded', () => { const l = window.__music.state.loaded; return !!(l.boss && l.bossMarch); });
  await page.run(() => document.querySelector('button.play').click());
  await page.waitFor('audio running', () => window.__music.state.context === 'running');
  expect('title screen leads to the game', true);

  const arrival = await page.run(() => ({ step: window.__story.step, cut: window.__cutscene.state, track: window.__music.state.track }));
  expect('play button starts the arrival cutscene in silence', arrival.step === 'arrival' && arrival.cut.name === 'arrival' && arrival.track === null, arrival);
  await page.waitFor('arrival video playing', () => window.__cutscene.state.time > 0, 60_000);
  expect('arrival video plays', true);

  await page.run(() => window.__story.skipTo('combat'));
  await page.waitFor('duel started', () => !!window.__combat.duel, 45_000);
  const fight = await page.run(() => {
    const w = window.__world, r = w.renderer;
    r.__draw.call(r, w.scene, w.camera);
    return { glError: r.getContext().getError(), track: window.__music.state.track, arena: w.arena.group.children.map((c) => c.name).sort(), progress: w.arena.progress };
  });
  expect('boss music plays', fight.track === 'boss', fight);
  expect('arena holds only the floor and the night', fight.arena.join() === 'Arena_disk,Arena_night', fight);
  expect('a combat frame renders without WebGL error', fight.glError === 0, fight);

  await page.waitFor('sword can be taken', () => window.__story.swordTakeable, 45_000);
  await page.run(() => window.__sword.take());
  const cut2 = await page.run(() => ({ cut: window.__cutscene.state, paused: window.__combat.duel.paused, track: window.__music.state.track }));
  expect('clicking the sword starts cutscene 2, duel paused, boss music goes on', cut2.cut.name === 'sword' && cut2.paused && cut2.track === 'boss', cut2);
  await page.run(() => window.__cutscene.end());
  const held = await page.run(() => ({ sword: window.__sword.info, catSword: !!window.__cat.sword, paused: window.__combat.duel.paused, cut: window.__cutscene.state }));
  expect('after cutscene 2 the stone is split, the kitten holds the sword, the duel resumes', held.sword.split && held.sword.state === 'held' && held.catSword && !held.paused && !held.cut.active, held);

  // The march is decided on a game frame: wait for it instead of a fixed delay (a loaded machine can take over 500 ms per frame).
  await page.run(() => window.__combat.setHp(window.__combat.duel.maxHp * 0.49));
  await page.waitFor('march music', () => window.__music.state.march, 20_000).catch(() => {});
  const march = await page.run(() => {
    const m = window.__music.state;
    return { wanted: m.wanted, march: m.march, armed: m.armed, fraction: m.bossFraction };
  });
  expect('march starts at half boss health', march.march && march.wanted === 'bossMarch', march);

  await page.run(() => window.__combat.setHp(0));
  await page.waitFor('victory cue', () => window.__story.lastCue === 'victory', 20_000);
  await page.waitFor('meadow music is back', () => window.__music.state.track === 'meadow', 20_000);
  expect('victory returns to the meadow music', true);

  await page.run(() => { window.__story.skipTo('maman'); window.__story._startHug(); });
  const hug = await page.run(() => ({ step: window.__story.step, cut: window.__cutscene.state }));
  expect('the hug plays as cutscene 3', hug.step === 'hug' && hug.cut.name === 'hug', hug);
  await page.run(() => window.__cutscene.end());
  const end = await page.run(() => ({ step: window.__story.step, screen: window.__endScreen.mode }));
  expect('the end screen follows cutscene 3', end.step === 'end' && end.screen === 'end', end);
}

async function main() {
  const executable = findBrowser();
  if (!executable) {
    console.log('No browser found: set CHROME_PATH to a Chromium or Chrome executable.');
    process.exit(2);
  }
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: PORT, host: 'localhost' } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  console.log(`  dev server on ${url} (closed at the end)`);
  const browser = await launch(executable);
  const guard = setTimeout(() => { console.error('Playthrough timed out.'); browser.child.kill('SIGKILL'); process.exit(1); }, TIMEOUT_MS);
  let failure = null;
  try {
    const socket = new WebSocket(browser.url);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('cannot reach the browser')); });
    const page = new Page(socket);
    await page.open(url);
    await play(page);
    if (page.problems.length) failure = new Error(`page problems:\n  ${page.problems.join('\n  ')}`);
    socket.close();
  } catch (err) {
    failure = err;
  }
  clearTimeout(guard);
  browser.child.removeAllListeners('exit');
  browser.child.kill('SIGKILL');
  await server.close();
  fs.rmSync(browser.profile, { recursive: true, force: true });
  if (failure) { console.error(failure.message); process.exit(1); }
  console.log('Playthrough passed.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
