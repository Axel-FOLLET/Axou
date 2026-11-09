/**
 * Web Audio context shared by the whole game; every sound in src/audio/ plays on it. Browsers only allow sound after
 * a player gesture, so Story.js calls `unlockAudio()` synchronously inside the handler of the Play button.
 * Without the Web Audio API (old browser, Node) everything returns null without an error.
 */
let ctx = null;

function create() {
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch (err) {
    console.warn('[audio] could not create the audio context:', err);
    ctx = null;
  }
  return ctx;
}

/** Shared context, created on the first call; null if the Web Audio API is missing. */
function audioContext() {
  return ctx ?? create();
}

/**
 * Shared context if it already exists, without creating it (null otherwise). Sounds use it so that no context is
 * created before the player gesture.
 */
export function currentAudioContext() {
  return ctx;
}

/** Creates the context if missing and calls `resume()`; call it inside a gesture handler. */
export function unlockAudio() {
  const c = audioContext();
  if (!c) return null;
  try {
    // `resume()` returns a promise: a possible rejection is caught (no unhandled error).
    c.resume?.()?.catch?.((err) => console.warn('[audio] context resume rejected:', err));
  } catch (err) {
    console.warn('[audio] could not resume the context:', err);
  }
  return c;
}
