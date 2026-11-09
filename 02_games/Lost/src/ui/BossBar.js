/**
 * Combat life bars, created by main.js. Two variants of one component:
 *
 * - `boss`: long thin bar at the bottom centre, boss name above it, left-aligned and followed by a fading gold
 *   line, dark gold frame (thin double line, a diamond at each end) and, if the level has a phase 2, a notch at
 *   50%. Inspired by the boss bars of Elden Ring (long thin bar, name, restrained frame, trailing recent loss)
 *   without copying their look: no logo or image, only CSS lines.
 * - `cat`: the same bar in small, without a name, a paw on its left, top left, to the right of the minimap
 *   (MiniMap.js: 120 px circle, 112 px on small screens) without covering it. It follows the kitten's life
 *   (Duel.catHp, combat.js).
 *
 * The fill uses the exact `color` (no opacity or gradient: only an inner shadow line at the top and bottom, so the
 * middle of the bar keeps the exact coat colour), on a dark background. Behind the fill, a light segment keeps the
 * old value for `BAR.hold` s after damage, then shrinks at `BAR.shrink` (fraction/s). Shown in combat only: outside
 * combat, `display: none` and `update` does nothing. Above the letterbox (10), below the speech bubble (20), the
 * veil (25) and the screens (30). Captures no clicks.
 *
 * - `new BossBar({ name, color, variant = 'boss', marks = [] })`: `color` is a three.js integer (e.g. `0xa8201a`,
 *   BOSS.red in combat.js); `marks` are fractions of the bar (0 to 1) carrying a notch (phase 2: 0.5).
 * - `show(fade = BAR.fade)`, `hide(fade = BAR.fade)`: fade in seconds (`hide(0)` is immediate).
 * - `set(fraction)`: 0 to 1. `setMarks(list)`. `update(dt)` every frame.
 * - `state`: `{ variant, visible, value, lag, alpha, marks }` (read-only, for tests).
 * - `dispose()`.
 */
export const BAR = {
  z: 12,
  maxWidth: 760,        // px: cap on desktop
  widthFrac: '60vw',    // width on desktop
  phoneMax: 600,        // px: below this, full-width bar (minus the safe margins)
  height: 11,           // px: thickness of the boss fill
  bottom: 22,           // px above the bottom safe margin
  hold: 0.8,            // s: delay before the damage segment shrinks
  shrink: 0.5,          // fraction of the bar per second at which it shrinks
  fade: 0.5,            // s: default fade
  lagColor: '#f0e2a0',  // recent-damage segment: pale yellow
  back: 'rgba(20, 12, 12, 0.86)',
  gold: 'rgba(214, 178, 104, 0.9)',    // dark gold: line, diamonds, phase notch
  goldDim: 'rgba(214, 178, 104, 0.5)', // dimmed gold: frame
  text: '#f6ece0',
  // Kitten: small, to the right of the minimap (120 px, 112 px on small screens), plus a 10 px gap.
  cat: { height: 7, width: 150, minimap: 120, minimapSmall: 112, gap: 10, top: 10, icon: 22 },
};

const STYLE_ID = 'lost-bossbar-style';
const PAW = '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" focusable="false">'
  + '<ellipse cx="12" cy="16.2" rx="5.2" ry="4.4"/><ellipse cx="5" cy="11" rx="2.1" ry="2.8"/>'
  + '<ellipse cx="9.4" cy="6.6" rx="2.2" ry="3"/><ellipse cx="14.6" cy="6.6" rx="2.2" ry="3"/>'
  + '<ellipse cx="19" cy="11" rx="2.1" ry="2.8"/></svg>';
const CSS = `
.lost-bossbar { position: fixed; left: 50%; bottom: calc(max(12px, env(safe-area-inset-bottom)) + ${BAR.bottom}px); z-index: ${BAR.z};
  transform: translateX(-50%); box-sizing: border-box; width: min(${BAR.widthFrac}, ${BAR.maxWidth}px);
  display: none; pointer-events: none; user-select: none; opacity: 0; }
.lost-bossbar .head { display: flex; align-items: center; gap: 12px; margin: 0 0 7px 1px; }
.lost-bossbar .name { flex: none; max-width: 70%; font: 700 14px/1.3 Georgia, "Times New Roman", serif;
  letter-spacing: 0.24em; text-transform: uppercase; color: ${BAR.text}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lost-bossbar .rule { flex: 1; height: 1px; background: linear-gradient(90deg, ${BAR.gold}, rgba(214, 178, 104, 0)); }
.lost-bossbar .frame { position: relative; padding: 3px; background: ${BAR.back}; border: 1px solid ${BAR.goldDim};
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55), 0 3px 10px rgba(0, 0, 0, 0.35); }
.lost-bossbar .cap { position: absolute; top: 50%; width: 9px; height: 9px; margin-top: -5px; box-sizing: border-box;
  background: #1b1010; border: 1px solid ${BAR.gold}; transform: rotate(45deg); }
.lost-bossbar .cap.l { left: -6px; }
.lost-bossbar .cap.r { right: -6px; }
.lost-bossbar .track { position: relative; height: ${BAR.height}px; background: #160d0d; overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.7); }
.lost-bossbar .lag, .lost-bossbar .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; }
.lost-bossbar .lag { background: ${BAR.lagColor}; }
.lost-bossbar .fill { box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.16), inset 0 -3px 0 rgba(0, 0, 0, 0.2); }
.lost-bossbar .mark { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: ${BAR.gold}; opacity: 0.85; }
@media (max-width: ${BAR.phoneMax}px) {
  .lost-bossbar { width: calc(100vw - max(12px, env(safe-area-inset-left)) - max(12px, env(safe-area-inset-right))); }
  .lost-bossbar .name { font-size: 12px; letter-spacing: 0.2em; }
}
/* Kitten variant: small, top left, to the right of the minimap (MiniMap.js). */
.lost-bossbar.cat { left: calc(var(--safe-l, 12px) + ${BAR.cat.minimap + BAR.cat.gap}px); top: calc(var(--safe-t, 12px) + ${BAR.cat.top}px); bottom: auto;
  transform: none; width: min(${BAR.cat.width}px, calc(100vw - var(--safe-l, 12px) - var(--safe-r, 12px) - ${BAR.cat.minimap + BAR.cat.gap}px));
  align-items: center; gap: 8px; }
.lost-bossbar.cat .paw { flex: none; width: ${BAR.cat.icon}px; height: ${BAR.cat.icon}px; fill: ${BAR.text}; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)); }
.lost-bossbar.cat .frame { flex: 1; min-width: 0; padding: 2px; }
.lost-bossbar.cat .track { height: ${BAR.cat.height}px; }
.lost-bossbar.cat .cap { width: 6px; height: 6px; margin-top: -3px; }
.lost-bossbar.cat .cap.l { left: -4px; }
.lost-bossbar.cat .cap.r { right: -4px; }
.lost-bossbar.cat .fill { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), inset 0 -2px 0 rgba(0, 0, 0, 0.2); }
@media (max-width: 600px), (max-height: 500px) {
  .lost-bossbar.cat { left: calc(var(--safe-l, 12px) + ${BAR.cat.minimapSmall + BAR.cat.gap}px);
    width: min(${BAR.cat.width}px, calc(100vw - var(--safe-l, 12px) - var(--safe-r, 12px) - ${BAR.cat.minimapSmall + BAR.cat.gap}px)); }
}
`;

const clamp01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

export class BossBar {
  constructor({ name = '', color = 0xa8201a, variant = 'boss', marks = [] } = {}) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.variant = variant === 'cat' ? 'cat' : 'boss';
    this.el = el('div', 'lost-bossbar ' + this.variant);
    this.el.setAttribute('aria-hidden', 'true');
    this.nameEl = el('span', 'name');
    this.nameEl.textContent = name;
    const frame = el('div', 'frame');
    const track = el('div', 'track');
    this.lagEl = el('div', 'lag');
    this.fillEl = el('div', 'fill');
    // Fill colour: #rrggbb, unaltered.
    this.fillEl.style.background = '#' + (color & 0xffffff).toString(16).padStart(6, '0');
    this.marksEl = track;
    track.append(this.lagEl, this.fillEl);
    frame.append(el('span', 'cap l'), el('span', 'cap r'), track);
    if (this.variant === 'boss') {
      const head = el('div', 'head');
      head.append(this.nameEl, el('span', 'rule'));
      this.el.append(head, frame);
    } else {
      const paw = el('span', 'paw');
      paw.innerHTML = PAW;
      this.el.append(paw, frame);
    }
    document.body.append(this.el);
    this._value = 1;
    this._lag = 1;
    this._hold = 0;
    this._alpha = 0;
    this._rate = 0;        // opacity change per second (0: no fade in progress)
    this._target = 0;
    this._visible = false;
    this._marks = [];
    this.setMarks(marks);
    this._draw();
  }

  get state() {
    return { variant: this.variant, visible: this._visible, value: this._value, lag: this._lag, alpha: this._alpha, marks: [...this._marks] };
  }

  /** Notches on the bar (fractions from 0 to 1, e.g. [0.5] for phase 2); empty list: none. */
  setMarks(list) {
    this._marks = (list ?? []).map(Number).filter((m) => m > 0 && m < 1);
    for (const m of [...this.marksEl.querySelectorAll('.mark')]) m.remove();
    for (const m of this._marks) {
      const e = el('div', 'mark');
      e.style.left = (m * 100).toFixed(2) + '%';
      this.marksEl.append(e);
    }
  }

  show(fade = BAR.fade) {
    this._visible = true;
    this.el.style.display = this.variant === 'cat' ? 'flex' : 'block';
    this._fadeTo(1, fade);
  }

  hide(fade = BAR.fade) {
    if (!this._visible) return;
    this._visible = false;
    this._fadeTo(0, fade);
  }

  /** New value from 0 to 1. On a drop, the fill follows at once and the segment keeps the old value. */
  set(fraction) {
    const v = clamp01(Number(fraction) || 0);
    if (v < this._value) {
      if (this._lag < this._value) this._lag = this._value; // no segment in progress: it starts from the old value
      this._hold = BAR.hold;                                // each hit restarts the delay
    } else if (v > this._value) {
      this._lag = v;                                        // heal: the segment does not stay ahead
    }
    // Final blow (0): bar empty at once, with no damage segment, so no sliver of it stays on the Defeat pose.
    if (v === 0) { this._lag = 0; this._hold = 0; }
    this._value = v;
    this._draw();
  }

  /** Every frame. No effect (no DOM access) when the bar is hidden and no fade is in progress. */
  update(dt) {
    if (!this._visible && this._rate === 0) return;
    if (this._rate !== 0) {
      this._alpha += this._rate * dt;
      if ((this._rate > 0 && this._alpha >= this._target) || (this._rate < 0 && this._alpha <= this._target)) {
        this._alpha = this._target;
        this._rate = 0;
        if (this._target === 0) this.el.style.display = 'none';
      }
      this.el.style.opacity = String(this._alpha);
    }
    if (this._lag > this._value) {
      if (this._hold > 0) this._hold -= dt;
      else this._lag = Math.max(this._value, this._lag - BAR.shrink * dt);
      this._draw();
    }
  }

  dispose() {
    this.el.remove();
  }

  _fadeTo(target, fade) {
    this._target = target;
    if (!(fade > 0) || this._alpha === target) {
      this._alpha = target;
      this._rate = 0;
      this.el.style.opacity = String(target);
      if (target === 0) this.el.style.display = 'none';
      return;
    }
    this._rate = (target - this._alpha) / fade;
  }

  _draw() {
    this.fillEl.style.width = (this._value * 100).toFixed(2) + '%';
    this.lagEl.style.width = (this._lag * 100).toFixed(2) + '%';
  }

}
