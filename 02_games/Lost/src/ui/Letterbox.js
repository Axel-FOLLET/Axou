/**
 * Cinematic black bars: one at the top and one at the bottom, for the whole opening. Used by Story.
 * `show()` sets them at once. `hide(s)` slides them off screen in `s` seconds (soft retreat when the shot has
 * widened and the player regains control, Story._release). `hide(0)` removes them at once.
 * Above the canvas and the minimap (5, hidden during the opening), below the speech bubble (20), the veil (25) and
 * the screens (30). They capture no clicks.
 * `BARS`: `height` (CSS height of each bar), `z` (z-index), `hide` (default slide time, s).
 */
export const BARS = { height: '12%', z: 10, hide: 1.2 };

const CSS = `
.lost-bars { position: fixed; inset: 0; z-index: ${BARS.z}; pointer-events: none; visibility: hidden; overflow: hidden; }
.lost-bars.on { visibility: visible; }
.lost-bars > div { position: absolute; left: 0; right: 0; height: ${BARS.height}; background: #000; transform: translateY(0); }
.lost-bars > .top { top: 0; }
.lost-bars > .bottom { bottom: 0; }
.lost-bars.off > .top { transform: translateY(-100%); }
.lost-bars.off > .bottom { transform: translateY(100%); }
`;

export class Letterbox {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.el = document.createElement('div');
    this.el.className = 'lost-bars';
    this.el.setAttribute('aria-hidden', 'true');
    this.top = document.createElement('div');
    this.top.className = 'top';
    this.bottom = document.createElement('div');
    this.bottom.className = 'bottom';
    this.el.append(this.top, this.bottom);
    document.body.append(this.el);
    this._timer = null;
    /** 'on' (bars in place), 'hiding' (sliding out) or 'off'. */
    this.state = 'off';
  }

  /** Sets the bars immediately (start of the cinematic). */
  show() {
    clearTimeout(this._timer);
    this._bars(0);
    this.el.className = 'lost-bars on';
    this.state = 'on';
  }

  /** Removes the bars in `seconds` s (sliding up and down); 0 removes them at once. */
  hide(seconds = BARS.hide) {
    clearTimeout(this._timer);
    if (this.state === 'off') return;
    if (!(seconds > 0)) { this._bars(0); this.el.className = 'lost-bars'; this.state = 'off'; return; }
    this._bars(seconds);
    void this.el.offsetHeight; // transition applied from the resting position
    this.el.className = 'lost-bars on off';
    this.state = 'hiding';
    this._timer = setTimeout(() => { this.el.className = 'lost-bars'; this.state = 'off'; }, seconds * 1000 + 50);
  }

  _bars(seconds) {
    const t = seconds > 0 ? `transform ${seconds}s cubic-bezier(0.45, 0, 0.25, 1)` : 'none';
    this.top.style.transition = t;
    this.bottom.style.transition = t;
  }
}
