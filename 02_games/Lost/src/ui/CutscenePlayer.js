import { CUTSCENE } from '../game/texts.js';

/**
 * Plays the three video cutscenes of Lost (public/videos, H.264, silent) full screen over the game, on a black
 * background, picture contained (never cropped, whatever the window shape). Created by main.js, used by Story:
 * `play(name)` resolves when the video ends, is skipped, fails or is cancelled; it never rejects, so the game always
 * goes on. A load or playback error is logged with the tag `[cutscene]`.
 *
 * - `play(name)`: Promise of 'ended' | 'skipped' | 'error' | 'cancelled'.
 * - `cancel()`: stops the video at once, without a fade, when the game state was reset under it (step skip, new game).
 * - `end()`: debug access (src/debug/handles.js), plays the cutscene to its end at once.
 * - `state`: plain data for tests ({ active, name, time, duration, skippable }).
 *
 * The skip button only exists for a cutscene marked `skippable`, and only once it has been watched to the end in this
 * browser (memory kept in `localStorage`, which may be missing or refuse writes: then the button never shows).
 */

/** Cutscenes: video file and, for the one that can be skipped, the browser memory key of "seen to the end". */
export const CUTSCENES = {
  arrival: { src: './videos/cutscene_arrival.mp4', skippable: true, seenKey: 'lost.cutscene.arrival.seen' },
  sword: { src: './videos/cutscene_sword.mp4', skippable: false },
  hug: { src: './videos/cutscene_hug.mp4', skippable: false },
};

export const PLAYER = {
  z: 40,              // z-index: above the end screen (30), the speech bubble (20) and the bars (10)
  fadeOut: 0.3,       // s: the player fades out on the game, already in its next state
  loadTimeout: 20,    // s: no picture after this delay, the cutscene is given up (slow or broken file)
  stall: 15,          // s: playback stuck for this long (slow network refilling the buffer), the cutscene is given up
  watchEvery: 1000,   // ms: period of the progress check
};

const CSS = `
.lost-cutscene { position: fixed; inset: 0; z-index: ${PLAYER.z}; display: flex; align-items: center; justify-content: center;
  background: #000; opacity: 0; visibility: hidden; touch-action: none;
  transition: opacity ${PLAYER.fadeOut}s ease, visibility 0s linear ${PLAYER.fadeOut}s; }
.lost-cutscene.on { opacity: 1; visibility: visible; transition: none; }
.lost-cutscene.instant { transition: none; }
.lost-cutscene video { display: block; width: 100%; height: 100%; object-fit: contain; background: #000; }
.lost-cutscene .skip { position: absolute; right: var(--safe-r, 12px); bottom: var(--safe-b, 12px); min-height: 48px; min-width: 48px;
  padding: 10px 22px; font: 700 15px/1.2 var(--font, system-ui, sans-serif); color: #ffffff; background: rgba(0, 0, 0, 0.55);
  border: 2px solid rgba(255, 255, 255, 0.85); border-radius: 999px; cursor: pointer; touch-action: manipulation; }
.lost-cutscene .skip:hover { background: rgba(255, 255, 255, 0.2); }
.lost-cutscene .skip:focus-visible { outline: 3px solid #ffd27a; outline-offset: 2px; }
`;

/** Browser storage, or null when it is missing or blocked (private mode, disabled cookies). */
function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

/** True if the cutscene was watched to the end in this browser. `store`: storage to read (tests). */
export function hasSeen(name, store = browserStorage()) {
  const key = CUTSCENES[name]?.seenKey;
  if (!key || !store) return false;
  try { return store.getItem(key) === '1'; } catch { return false; }
}

/** Remembers that the cutscene was watched to the end; silent if the storage refuses. */
export function markSeen(name, store = browserStorage()) {
  const key = CUTSCENES[name]?.seenKey;
  if (!key || !store) return;
  try { store.setItem(key, '1'); } catch { /* storage full or blocked: the skip button just stays hidden */ }
}

const round = (v) => Math.round(v * 100) / 100;

export class CutscenePlayer {
  constructor(container = document.body) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);

    this.el = document.createElement('div');
    this.el.className = 'lost-cutscene';
    this.el.setAttribute('aria-hidden', 'true');
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.playsInline = true;
    this.video.preload = 'auto';
    this.video.disablePictureInPicture = true;
    this.video.tabIndex = -1;
    this.skipButton = document.createElement('button');
    this.skipButton.type = 'button';
    this.skipButton.className = 'skip';
    this.skipButton.textContent = CUTSCENE.skip.text;
    this.skipButton.hidden = true;
    this.skipButton.addEventListener('click', (e) => { e.stopPropagation(); this._finish('skipped'); });
    this.el.append(this.video, this.skipButton);
    container.append(this.el);

    this._run = null;       // cutscene in progress: { name, resolve, abort, watch, lastTime, lastMove, skippable }
    this._unload = null;    // timer releasing the video file after the fade
  }

  /** @returns {Promise<'ended'|'skipped'|'error'|'cancelled'>} */
  play(name) {
    this.cancel();
    return new Promise((resolve) => {
      const def = CUTSCENES[name];
      if (!def) { console.error(`[cutscene] unknown cutscene "${name}"`); resolve('error'); return; }
      clearTimeout(this._unload);
      const video = this.video, abort = new AbortController();
      const run = {
        name, resolve, abort, lastTime: -1, lastMove: performance.now(),
        skippable: !!def.skippable && hasSeen(name),
      };
      run.watch = setInterval(() => this._watch(run), PLAYER.watchEvery);
      this._run = run;
      const opts = { signal: abort.signal };
      video.addEventListener('ended', () => this._finish('ended'), opts);
      video.addEventListener('error', () => this._fail(run, `cannot load ${def.src} (${video.error?.message || `code ${video.error?.code}`})`), opts);
      this.skipButton.hidden = !run.skippable;
      this.el.className = 'lost-cutscene on';
      video.src = def.src;
      video.currentTime = 0;
      video.play().catch((err) => this._fail(run, `cannot play ${def.src} (${err.name}: ${err.message})`));
    });
  }

  /** Stops at once, no fade: the game state was reset under the video. */
  cancel() { this._finish('cancelled'); }

  /** Debug: the cutscene ends now, as if watched to the end. */
  end() { this._finish('ended'); }

  get state() {
    const r = this._run, d = this.video.duration;
    return {
      active: !!r, name: r?.name ?? null, time: r ? round(this.video.currentTime) : 0,
      duration: r && Number.isFinite(d) ? round(d) : null, skippable: !!r?.skippable,
    };
  }

  /** Progress check: the video must keep advancing (the tab being hidden freezes it, which is not a failure). */
  _watch(run) {
    if (run !== this._run) return;
    const now = performance.now(), t = this.video.currentTime;
    if (t !== run.lastTime || document.hidden) { run.lastTime = t; run.lastMove = now; return; }
    const limit = t > 0 ? PLAYER.stall : PLAYER.loadTimeout;
    if ((now - run.lastMove) / 1000 > limit) this._fail(run, `no progress for ${limit} s at ${round(t)} s`);
  }

  _fail(run, reason) {
    if (run !== this._run) return;
    console.error(`[cutscene] ${run.name}: ${reason}`);
    this._finish('error');
  }

  _finish(outcome) {
    const run = this._run;
    if (!run) return;
    this._run = null;
    run.abort.abort();
    clearInterval(run.watch);
    this.video.pause();
    if (outcome === 'ended') markSeen(run.name);
    // The picture fades out unless the game was reset: then the overlay goes at once.
    this.el.className = outcome === 'cancelled' ? 'lost-cutscene instant' : 'lost-cutscene';
    this._unload = setTimeout(() => { this.video.removeAttribute('src'); this.video.load(); }, PLAYER.fadeOut * 1000 + 100);
    run.resolve(outcome);
  }
}
