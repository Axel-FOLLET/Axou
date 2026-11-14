/**
 * Story methods for cutscene 2, the sword: a click on the planted sword during the fight pauses the duel and plays the
 * video (the music of the boss goes on); when it ends the stone is split, the kitten holds the sword and the duel resumes
 * where it was, the camera untouched.
 */

export const swordCutscene = {
  /**
   * True if a click can take the sword: phase 'fight', sword planted, no pause, knockback or defeat, no boss strike in
   * progress (`swing` before the impact). During the announcement the player clicks to dodge, often right next to the stone,
   * and shrinking the click zone is not enough. The click then passes to the ground (Picker: target refused, `onGround`) and
   * becomes the dodge; on guard, a click on the handle starts the cutscene.
   */
  get swordTakeable() {
    const d = this._duel, c = this._combat;
    return !!(this.sword && d && c?.phase === 'fight' && !this._swordScene && !d.paused && !d.over && !d.lost
      && this.sword.state === 'stone' && d.b.mode !== 'defeat' && d.b.mode !== 'down' && d.c.mode !== 'knock'
      && !(d.b.mode === 'swing' && !d.b.struck));
  },

  /**
   * Click on the planted sword (main.js, Picker; Sword.hit only answers if `swordTakeable`): duel paused (the boss stops
   * attacking, current strike cancelled), kitten held in place (`_combatLock`), cutscene 2.
   */
  pickSword() {
    if (!this.swordTakeable) return false;
    this._duel.dodge();
    this._duel.pause(true);
    this._swordScene = true;
    this._playCutscene('sword', () => this._endSwordScene());
    return true;
  },

  /** End of the cutscene: stone split, sword in the kitten's mouth (guard pose), duel resumed. */
  _endSwordScene() {
    this._swordScene = false;
    this.sword.split();
    this.sword.take();
    this.cat.setSword(true); // current state replayed with the sword clips: guard when still
    this._duel?.pause(false);
  },

  /** Cutscene interrupted (end of combat, victory, step skip): video stopped, duel unpaused, sword back in its whole stone. */
  _abortSwordScene() {
    if (!this._swordScene) return;
    this._swordScene = false;
    this.cutscene?.cancel();
    this._duel?.pause(false);
    this.sword?.reset();
  },
};
