/**
 * Lowers the rendering quality one step at a time when the frame rate is too low, and never raises it back.
 * Small or touch devices start one step lower. Used by main.js.
 */

const MIN_FPS = 40;          // below this average over 1 s, one step is dropped
const WARMUP_SECONDS = 2;    // loading frames are ignored
const MAX_PIXEL_RATIO_SMALL = 1.5; // on touch or small screens

const SMALL_SCREEN = '(max-width: 600px), (max-height: 500px)';

export class AdaptiveQuality {
  /** @param {object} o `renderer`, `meadow`, `snowfall`, `fur` (fur of the kitten) */
  constructor({ renderer, meadow, snowfall, fur }) {
    this.renderer = renderer;
    this.coarse = matchMedia('(pointer: coarse)');
    this.smallScreen = matchMedia(SMALL_SCREEN);
    // Step 0 is full quality. Grass density drops before each fur step: the fur on the kitten is what the eye follows.
    this.steps = [
      () => {},
      () => renderer.setPixelRatio(1),
      () => { meadow.setQuality(1); snowfall.setQuality(1); },
      () => fur.setStep(2),
      () => { meadow.setQuality(2); snowfall.setQuality(2); },
      () => fur.setStep(3),
      () => { meadow.setQuality(3); snowfall.setQuality(3); },
    ];
    this.level = 0;
    this.applied = new Set(); // steps already applied at startup, skipped later
    this.fps = 0;
    this.frames = 0;
    this.elapsed = 0;
    this.warmup = WARMUP_SECONDS;
    if (this.coarse.matches || this.smallScreen.matches) {
      renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO_SMALL));
      meadow.setQuality(1);
      snowfall.setQuality(1);
      this.applied.add(2);
    }
    if (renderer.getPixelRatio() <= 1) this.level = 1;
  }

  /** @param {number} rawDt real seconds since the last frame */
  update(rawDt) {
    this.frames++;
    this.elapsed += rawDt;
    if (this.elapsed < 1) return;
    this.fps = Math.round(this.frames / this.elapsed);
    this.frames = 0;
    this.elapsed = 0;
    if (this.warmup > 0) this.warmup--;
    else if (this.fps < MIN_FPS && this.level < this.steps.length - 1) this._lower();
  }

  _lower() {
    while (this.level < this.steps.length - 1) {
      this.level++;
      if (!this.applied.has(this.level)) { this.steps[this.level](); return; }
    }
  }

  /** Number of steps applied, including those of the startup. */
  get appliedCount() {
    let n = this.level;
    for (const step of this.applied) if (step > this.level) n++;
    return n;
  }

  get state() {
    const top = this.steps.length - 1;
    return {
      coarse: this.coarse.matches, smallScreen: this.smallScreen.matches, fps: this.fps,
      pixelRatio: this.renderer.getPixelRatio(), quality: `${top - this.appliedCount}/${top}`,
      viewport: [innerWidth, innerHeight],
    };
  }
}
