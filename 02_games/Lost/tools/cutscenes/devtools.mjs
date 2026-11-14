/**
 * Browser plumbing of the cutscene capture tool (capture.mjs): finds a Chromium, starts it without a window and
 * drives one page over the DevTools protocol with Node's built-in WebSocket (no dependency). Same browser lookup and
 * same software-rendering flags as tools/check/playthrough.mjs.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BROWSER_NAMES = ['chrome-headless-shell', 'headless_shell', 'chrome', 'chromium', 'chromium-browser', 'google-chrome'];
const LAUNCH_TIMEOUT_MS = 30_000; // browser start until its DevTools address is printed

/** Browser lookup: CHROME_PATH, then the Playwright cache, then PATH. Returns null when none is found. */
export function findBrowser() {
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

/** Starts the browser (software WebGL, muted) and resolves with the process, its profile folder and its DevTools URL. */
export function launchBrowser(executable, { width, height }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lost-cutscene-'));
  const child = spawn(executable, [
    '--headless', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('browser did not print its DevTools address in time')), LAUNCH_TIMEOUT_MS);
    child.once('error', reject);
    child.stderr.on('data', (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve({ child, profile, url: match[1] }); }
    });
    child.once('exit', (code) => reject(new Error(`browser exited early (code ${code}): ${log.slice(-400)}`)));
  });
}

/** Resident memory (MB) of a process and all its descendants, or null when `ps` is not available. */
export function processTreeRssMb(rootPid) {
  const ps = spawnSync('ps', ['-e', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' });
  if (ps.status !== 0) return null;
  const rows = ps.stdout.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const inTree = new Set([rootPid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [pid, ppid] of rows) if (!inTree.has(pid) && inTree.has(ppid)) { inTree.add(pid); grew = true; }
  }
  return rows.filter(([pid]) => inTree.has(pid)).reduce((sum, [, , rssKb]) => sum + rssKb, 0) / 1024;
}

/** Minimal DevTools protocol client attached to one page. */
export class Page {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.sessionId = undefined;
    this.problems = [];       // uncaught exceptions, console errors, failed requests
    this.navigations = 0;     // main-frame navigations since the caller last reset it (a reload during a capture is fatal)
    this.closed = false;
    socket.addEventListener('message', (event) => this._receive(JSON.parse(event.data)));
    socket.addEventListener('close', () => {
      this.closed = true;
      for (const { reject, method } of this.pending.values()) reject(new Error(`${method}: browser connection closed`));
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = () => reject(new Error('cannot reach the browser')); });
    return new Page(socket);
  }

  send(method, params = {}, root = false) {
    if (this.closed) return Promise.reject(new Error(`${method}: browser connection closed`));
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
      if (p.type === 'error') this.problems.push(`console.error: ${text}`);
    } else if (message.method === 'Log.entryAdded' && p.entry.level === 'error' && !/favicon\.ico/.test(p.entry.url ?? '')) {
      this.problems.push(`${p.entry.text} ${p.entry.url ?? ''}`);
    } else if (message.method === 'Page.frameNavigated' && !p.frame.parentId) {
      this.navigations++;
    }
  }

  /**
   * Opens a blank page of the given size, installs `initScript` before any page script, then loads `url`.
   * The page is a desktop viewport at device scale 1, so `innerWidth` × `innerHeight` is exactly the video size.
   */
  async open(url, { width, height, initScript }) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' }, true);
    ({ sessionId: this.sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true }, true));
    await Promise.all([this.send('Runtime.enable'), this.send('Log.enable'), this.send('Page.enable')]);
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    if (initScript) await this.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
    await this.send('Page.navigate', { url });
  }

  /** Evaluates an expression in the page, awaits a promise result and returns plain data. */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  async waitFor(label, expression, timeoutMs = 120_000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try { if (await this.evaluate(expression)) return; } catch { /* page still loading */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`timed out waiting for: ${label}`);
  }
}
