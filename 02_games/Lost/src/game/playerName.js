/**
 * Name of the player's kitten. Entered on the title screen and asked again on every run: it is never stored in
 * the browser, so it only lives in this module. Used by EndScreen (input) and Bubble (display).
 *
 * - `cleanName(raw)`: cleaned name (see below), or `DEFAULT_NAME` if the result is empty.
 * - `setPlayerName(name)` (also cleans) and `getPlayerName()` (`DEFAULT_NAME` until a name is set).
 *   Speech bubbles replace `{name}` with `getPlayerName()` when displayed.
 */
export const DEFAULT_NAME = 'Chavalier';
/** Maximum length, in Unicode code points. */
export const NAME_MAX = 16;

let current = null;

/**
 * NFC-normalises, removes invisible control and format characters (tab, line break, zero-width space...), trims
 * the edges, collapses runs of spaces, and cuts to `NAME_MAX` code points without separating a letter from its
 * combining marks.
 * @param {unknown} raw Raw input.
 * @returns {string} The cleaned name, or `DEFAULT_NAME` if empty.
 */
export function cleanName(raw) {
  let s = String(raw ?? '').normalize('NFC');
  s = s.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim();
  const cps = Array.from(s);
  if (cps.length > NAME_MAX) {
    cps.length = NAME_MAX;
    // If the next code point is a combining mark, the letter that carries it goes too.
    let next = Array.from(s)[NAME_MAX];
    while (cps.length && next && /^\p{M}$/u.test(next)) { next = cps.pop(); }
    s = cps.join('').trim();
  }
  return s || DEFAULT_NAME;
}

export function setPlayerName(name) {
  current = cleanName(name);
}

export function getPlayerName() {
  return current ?? DEFAULT_NAME;
}
