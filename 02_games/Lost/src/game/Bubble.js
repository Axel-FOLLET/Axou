import { getPlayerName } from './playerName.js';
import { UI_LABELS } from './labels.js';

/**
 * Speech bubble, used by Story: translucent cream panel at the bottom centre, speaker name in spaced small
 * capitals, thin rule, text, then an n/N counter and an outlined next button. One page at a time: a click or touch
 * on the bubble or the button moves to the next page, and the last page closes the bubble and calls `onDone`.
 * Readable at 390 × 844: at most 460 px wide, or the screen width minus the safe margins (--safe-l, --safe-r),
 * 64 px above the bottom margin (--safe-b). No other HUD element sits at the bottom of the screen.
 *
 * - `open(text, { onDone, onPage })`: `text` is a TEXTS entry (`speaker`, `pages`, `choices`). `onPage(index, count)`
 *   is called each time a page shows, the first included (`index` from 0).
 * - Choices: if `text.choices` is a list of `{ key, label }`, the last page replaces the close button with one
 *   button per choice, in order. A click or touch on a button closes the bubble and calls `onDone(key)`; a click
 *   elsewhere on the bubble does nothing (it does not close without a choice). Without `choices`, `onDone()` takes
 *   no argument. The buttons carry `data-key`, for tests.
 * - `{name}` in a page is replaced by `getPlayerName()` on each render, inserted as text, never as HTML.
 * - `next()` (click), `close()` (without `onDone`). Read: `isOpen`, `text`, `page`.
 */
const STYLE_ID = 'lost-bubble-style';
const CSS = `
.lost-bubble { position: fixed; left: 50%; bottom: calc(var(--safe-b) + 64px); z-index: 20; box-sizing: border-box;
  width: min(460px, calc(100vw - var(--safe-l) - var(--safe-r))); transform: translate(-50%, 12px);
  padding: 14px 18px 12px; font: 500 15px/1.5 var(--font); color: var(--hud-text); background: rgba(255, 244, 228, 0.82);
  border: 1px solid rgba(90, 67, 53, 0.22); border-radius: 6px;
  overflow-wrap: anywhere; white-space: pre-line; cursor: pointer; touch-action: manipulation;
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0s linear 0.25s; }
.lost-bubble.on { opacity: 1; visibility: visible; transform: translate(-50%, 0); pointer-events: auto;
  transition-delay: 0s; }
.lost-bubble .who { display: block; font: 700 12px/1.3 var(--font); letter-spacing: 0.22em; text-transform: uppercase; }
.lost-bubble .rule { display: block; width: 100%; height: 1px; margin: 6px 0 8px; background: currentColor; opacity: 0.3; }
.lost-bubble .foot { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 8px; white-space: normal; }
.lost-bubble .count { font-size: 12px; letter-spacing: 0.08em; opacity: 0.7; }
.lost-bubble .next { min-height: 40px; min-width: 40px; padding: 6px 22px; font: 700 14px/1.2 var(--font); color: var(--hud-text);
  background: transparent; border: 2px solid var(--hud-text); border-radius: 999px; box-shadow: none; cursor: pointer;
  touch-action: manipulation; }
.lost-bubble .choices { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.lost-bubble .choices[hidden] { display: none; }
.lost-bubble .next:hover { background: var(--btn-bg); }
.lost-bubble .next:active { background: var(--btn-accent); transform: scale(0.97); }
.lost-bubble .next:focus-visible { outline: 3px solid var(--btn-accent); outline-offset: 2px; }
@media (max-width: 600px), (max-height: 500px) {
  .lost-bubble { font-size: 14px; padding: 12px 14px 10px; }
  .lost-bubble .next { min-height: 36px; padding: 4px 18px; font-size: 13px; }
  .lost-bubble .choices { gap: 6px; }
  .lost-bubble .choices .next { padding: 4px 14px; }
  .lost-bubble .foot { margin-top: 6px; }
}
/* Low screen (phone in landscape): the bubble moves down so the cat stays visible. */
@media (max-height: 500px) {
  .lost-bubble { bottom: calc(var(--safe-b) + 8px); }
}
`;

export class Bubble {
  constructor(container = document.body) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'lost-bubble';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this._who = document.createElement('span'); this._who.className = 'who';
    this._rule = document.createElement('span'); this._rule.className = 'rule';
    this._line = document.createElement('span');
    this._foot = document.createElement('div'); this._foot.className = 'foot';
    this._count = document.createElement('span'); this._count.className = 'count';
    this._next = document.createElement('button'); this._next.className = 'next'; this._next.type = 'button';
    this._choices = document.createElement('div'); this._choices.className = 'choices'; this._choices.hidden = true;
    this._foot.append(this._count, this._next, this._choices);
    this.el.append(this._who, this._rule, this._line, this._foot);
    container.append(this.el);
    // A click on the bubble does not reach the canvas (the cat does not walk to that point).
    for (const type of ['pointerdown', 'pointerup']) this.el.addEventListener(type, (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
    // The button also moves to the next page, once only (its click does not bubble up to the speech bubble).
    this._next.addEventListener('click', (e) => { e.stopPropagation(); this._next.blur(); this.next(); });

    this.text = null;
    this.page = 0;
    this.isOpen = false;
    this._onDone = null;
    this._onPage = null;
  }

  open(text, { onDone = null, onPage = null } = {}) {
    this.text = text;
    this.page = 0;
    this._onDone = onDone;
    this._onPage = onPage;
    this.isOpen = true;
    this._render();
    this.el.classList.add('on');
  }

  /** True on the last page of a text with choices: only a choice button closes the bubble. */
  get choosing() {
    return !!(this.isOpen && this.text?.choices?.length && this.page >= this.text.pages.length - 1);
  }

  /** Next page; after the last one, closes and calls `onDone` (never on a choice page). */
  next() {
    if (!this.isOpen || this.choosing) return;
    if (this.page < this.text.pages.length - 1) { this.page++; this._render(); return; }
    const done = this._onDone;
    this.close();
    done?.();
  }

  /** Choice `key` (button on the last page): closes the bubble and calls `onDone(key)`. */
  choose(key) {
    if (!this.choosing || !this.text.choices.some((c) => c.key === key)) return false;
    const done = this._onDone;
    this.close();
    done?.(key);
    return true;
  }

  close() {
    this.isOpen = false;
    this._onDone = null;
    this._onPage = null;
    this.el.classList.remove('on');
  }

  _render() {
    const t = this.text;
    const count = t.pages.length;
    this._who.textContent = t.speaker ?? '';
    this._who.hidden = !t.speaker;
    this._rule.hidden = !t.speaker;
    // `{name}`: replacement function so that `$&` or `$'` in a name are not interpreted.
    // textContent: the name is never read as HTML.
    const name = getPlayerName();
    // Non-breaking space before "? ! : ;" and closing guillemets, and after opening ones: no punctuation alone at the start of a line.
    this._line.textContent = t.pages[this.page].replaceAll('{name}', () => name)
      .replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
    const last = this.page >= count - 1;
    this._count.textContent = count > 1 ? `${this.page + 1}/${count}` : '';
    this._count.hidden = count <= 1;
    this._next.textContent = last ? UI_LABELS.bubbleClose : UI_LABELS.bubbleNext;
    // Last page of a text with choices: one button per choice instead of the next button.
    const choices = last && t.choices?.length ? t.choices : null;
    this._next.hidden = !!choices;
    this._choices.hidden = !choices;
    this._choices.replaceChildren();
    if (choices) {
      for (const c of choices) {
        const b = document.createElement('button');
        b.className = 'next'; b.type = 'button'; b.textContent = c.label; b.dataset.key = c.key;
        b.addEventListener('click', (e) => { e.stopPropagation(); b.blur(); this.choose(c.key); });
        this._choices.append(b);
      }
    }
    this._onPage?.(this.page, count);
  }
}
