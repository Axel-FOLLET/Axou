import { END } from './texts.js';
import { NAME_MAX, cleanName, setPlayerName } from './playerName.js';

/**
 * End screen (overlay on the scene, which keeps running) and "Lost" title screen, created by main.js. Styled with the
 * HUD's CSS variables from index.html (--hud-bg, --hud-text, --btn-bg...). End screen: card at most 92 vw wide, scrolling
 * inside if the height is short. Title screen: no card, translucent cream background over the scene, spaced
 * title, rule, underlined name field, outlined play button.
 *
 * - `new EndScreen()`; `onStay`, `onQuit`: callbacks of the end-screen buttons.
 * - `onReplay(name)`: play button or Enter in the field. `name` is `cleanName(field)` (the default name if empty),
 *   already stored by `setPlayerName`. Called synchronously inside the gesture handler (audio unlocks there).
 * - `showEnd()` / `showTitle()` / `hide()`. Read: `mode` ('end' | 'title' | null).
 *   `showTitle()` empties the field and focuses it except on a touch pointer (no virtual keyboard by default). Field
 *   keys do not reach the game (input/cameraControls.js takes the arrows, `+` and `-`, and a name such as Jean-Luc
 *   must be typable).
 */
const STYLE_ID = 'lost-endscreen-style';
const CSS = `
.lost-screen { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l); box-sizing: border-box;
  opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }
.lost-screen.on { opacity: 1; pointer-events: auto; }
.lost-screen.end { background: rgba(255, 233, 204, 0.35); }
.lost-screen.title { background: rgba(255, 233, 204, 0.6); }
.lost-card { box-sizing: border-box; width: min(520px, 92vw); max-height: calc(100% - 8px); overflow-y: auto;
  padding: 20px 20px 18px; font: 600 14px/1.5 var(--font); color: var(--hud-text); background: var(--hud-bg);
  border: 2px solid var(--hud-border); border-radius: 22px; box-shadow: var(--hud-shadow); text-align: center;
  overflow-wrap: anywhere; -webkit-user-select: text; user-select: text; touch-action: pan-y; }
.lost-card h1 { margin: 0 0 4px; font: 800 30px/1.15 var(--font); letter-spacing: 0.02em; }
.lost-card p { margin: 0 0 12px; }
.lost-card h2 { margin: 16px 0 6px; font: 800 14px/1.3 var(--font); }
.lost-credits { margin: 0; padding: 0; list-style: none; font-size: 12px; line-height: 1.45; text-align: left; }
.lost-credits li { margin: 0 0 6px; }
.lost-credits a { color: inherit; }
.lost-buttons { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 16px; }
.lost-buttons button { min-height: 48px; min-width: 48px; padding: 10px 22px; font: 700 15px/1.2 var(--font);
  color: var(--hud-text); background: var(--btn-bg); border: 2px solid #ffffff; border-radius: 999px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(150, 100, 60, 0.25); touch-action: manipulation; }
.lost-buttons button:hover { background: var(--btn-bg-hover); }
.lost-buttons button:active { background: var(--btn-accent); transform: scale(0.97); }
.lost-buttons button:focus-visible { outline: 3px solid #ffd27a; outline-offset: 2px; }
/* Title screen: no card, everything sits on the cream veil. */
.lost-title { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 14px;
  width: min(560px, 100%); max-height: 100%; overflow-y: auto; padding: 24px; text-align: center; color: var(--hud-text);
  font-family: var(--font); touch-action: manipulation; }
.lost-title h1 { margin: 0; font: 700 clamp(44px, 7vw, 76px)/1 var(--font); letter-spacing: 0.5em; padding-left: 0.5em;
  text-transform: uppercase; }
.lost-title .rule { width: 160px; height: 2px; background: currentColor; opacity: 0.5; flex: none; }
.lost-title .field { box-sizing: border-box; width: min(320px, 80%); padding: 10px 12px; font: 600 18px/1.2 var(--font);
  color: var(--hud-text); text-align: center; background: transparent; border: 0; border-bottom: 2px solid var(--hud-text);
  border-radius: 0; outline: none; -webkit-appearance: none; appearance: none; -webkit-user-select: text; user-select: text; }
.lost-title .field::placeholder { color: #6b5242; opacity: 0.9; }
.lost-title .field:focus { border-bottom-color: var(--btn-accent); box-shadow: 0 2px 0 var(--btn-accent); }
.lost-title .play { min-height: 48px; min-width: 48px; padding: 12px 34px; font: 700 17px/1.2 var(--font); color: var(--hud-text);
  background: transparent; border: 2px solid var(--hud-text); border-radius: 999px; box-shadow: none; cursor: pointer;
  touch-action: manipulation; }
.lost-title .play:hover { background: var(--btn-bg); }
.lost-title .play:active { background: var(--btn-accent); transform: scale(0.97); }
.lost-title .play:focus-visible { outline: 3px solid var(--btn-accent); outline-offset: 3px; }
@media (max-width: 600px), (max-height: 500px) {
  .lost-card { padding: 16px 14px 14px; font-size: 13px; }
  .lost-card h1 { font-size: 24px; }
  .lost-title { gap: 12px; padding: 16px; }
}
`;

/**
 * Fills `el` with `text`, http(s) addresses turned into links opened in a new tab. Trailing punctuation stays
 * outside the link.
 */
function linkify(el, text) {
  const parts = text.split(/(https?:\/\/[^\s]*[^\s.,;:!?)»])/);
  for (const p of parts) {
    if (/^https?:\/\//.test(p)) {
      const a = document.createElement('a');
      a.href = p; a.textContent = p; a.target = '_blank'; a.rel = 'noopener';
      el.append(a);
    } else if (p) el.append(p);
  }
}

function button(text, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', (e) => { e.stopPropagation(); b.blur(); onClick(); });
  return b;
}

export class EndScreen {
  constructor(container = document.body) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.onStay = null;
    this.onQuit = null;
    this.onReplay = null;
    this.mode = null;

    // End screen: title, sentence, credits, two buttons.
    this.end = document.createElement('div');
    this.end.className = 'lost-screen end';
    this.end.setAttribute('role', 'dialog');
    this.end.setAttribute('aria-label', END.title.text);
    const card = document.createElement('div');
    card.className = 'lost-card';
    const h1 = document.createElement('h1'); h1.textContent = END.title.text;
    const p = document.createElement('p'); p.textContent = END.line.text;
    const h2 = document.createElement('h2'); h2.textContent = END.creditsTitle.text;
    const ul = document.createElement('ul'); ul.className = 'lost-credits';
    for (const line of [END.game.text, ...END.cat.lines]) {
      const li = document.createElement('li');
      linkify(li, line);
      ul.append(li);
    }
    const row = document.createElement('div'); row.className = 'lost-buttons';
    row.append(button(END.stay.text, () => this.onStay?.()), button(END.quit.text, () => this.onQuit?.()));
    card.append(h1, p, row, h2, ul);
    this.end.append(card);

    // Title screen: title, rule, name field, play button.
    this.title = document.createElement('div');
    this.title.className = 'lost-screen title';
    this.title.setAttribute('role', 'dialog');
    this.title.setAttribute('aria-label', 'Lost');
    const panel = document.createElement('div');
    panel.className = 'lost-title';
    const th1 = document.createElement('h1'); th1.textContent = 'Lost';
    const rule = document.createElement('div'); rule.className = 'rule';
    const field = document.createElement('input');
    field.className = 'field';
    field.type = 'text';
    field.name = 'kitten';
    field.maxLength = NAME_MAX;
    field.placeholder = END.titleName.text;
    field.setAttribute('aria-label', END.titleName.text);
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('autocapitalize', 'words');
    field.setAttribute('enterkeyhint', 'go');
    field.spellcheck = false;
    this.field = field;
    const play = document.createElement('button');
    play.className = 'play';
    play.type = 'button';
    play.textContent = END.play.text;
    panel.append(th1, rule, field, play);
    this.title.append(panel);

    // Field keys do not reach the game (input/cameraControls.js: arrows, +, -, = and _ use preventDefault).
    for (const type of ['keydown', 'keyup', 'keypress']) field.addEventListener(type, (e) => e.stopPropagation());
    // A single path for the play button and Enter: the callback fires inside the gesture handler.
    field.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this._play(); } });
    play.addEventListener('click', (e) => { e.stopPropagation(); play.blur(); this._play(); });

    // Clicks on the screens do not reach the canvas (the cat does not walk behind them).
    for (const el of [this.end, this.title]) {
      for (const type of ['pointerdown', 'pointerup', 'click']) el.addEventListener(type, (e) => e.stopPropagation());
    }
    container.append(this.end, this.title);
    this.end.inert = this.title.inert = true; // no focus and no Tab while a screen is hidden
  }

  showEnd() { this._show('end'); }

  /** The field is emptied each time it shows; focused only outside touch pointers. */
  showTitle() {
    this.field.value = '';
    this._show('title');
    if (!matchMedia('(pointer: coarse)').matches) this.field.focus({ preventScroll: true });
  }

  hide() { this._show(null); }

  /** Cleans and stores the name, then calls `onReplay(name)` at once (same turn as the gesture). */
  _play() {
    const name = cleanName(this.field.value);
    setPlayerName(name);
    this.onReplay?.(name);
  }

  _show(mode) {
    this.mode = mode;
    this.end.inert = mode !== 'end';
    this.title.inert = mode !== 'title';
    this.end.classList.toggle('on', mode === 'end');
    this.title.classList.toggle('on', mode === 'title');
  }
}
