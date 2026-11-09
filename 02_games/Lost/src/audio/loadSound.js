import { currentAudioContext } from './context.js';

/**
 * Download and decoding of the files of `public/sounds/`, shared by the music, the meows, the snow steps and the combat
 * sound effects. Everything here works before the first player gesture: no audio context is created.
 */

/** Sound folder: `public/sounds/`, served at the root by Vite (relative base './' in the build). */
const SOUND_DIR = `${import.meta.env?.BASE_URL ?? './'}sounds/`;

let decoder;

/** False outside a browser (unit tests under Node). */
export function canLoadSounds() {
  return typeof globalThis.fetch === 'function' && typeof globalThis.document !== 'undefined';
}

/** Offline context, created once, used only for decoding (no player gesture required); null if the browser has none. */
function offlineDecoder() {
  if (decoder !== undefined) return decoder;
  const Ctor = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
  try { decoder = Ctor ? new Ctor(1, 1, 44100) : null; } catch { decoder = null; }
  return decoder;
}

/** Context to decode on: the offline one, otherwise the shared context if it already exists. */
export function decodingContext() {
  return offlineDecoder() ?? currentAudioContext();
}

/** decodeAudioData as a promise, including the callback form (older Safari). */
export function decode(ctx, data) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    p?.catch?.(() => { /* rejection already passed on by the error callback */ });
  });
}

/** Downloads a file of `public/sounds/` and resolves with its bytes. */
export function fetchSound(name) {
  return fetch(SOUND_DIR + name).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.arrayBuffer();
  });
}

/** Downloads a file of `public/sounds/` and decodes it on `ctx`. */
export function loadSound(ctx, name) {
  return fetchSound(name).then((data) => decode(ctx, data));
}
