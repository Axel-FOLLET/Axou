// The Chagicien leaves the ruins for the foot of the drawbridge: real walk, waiting at his post, warning to a
// kitten that arrives before beating the Chartiste. Called by Story.

/**
 * Route and waiting settings.
 * - `route`: waypoints between the nave and the post, from an A* search on `ruins.obstacles` (0.125 m step, 0.5 m
 *   margin, path tightened by line of sight) and then frozen, so the route is always the same and can be read here.
 * - `post`: next to the bridge, outside the corridor (|z| < 0.95) and more than 1 m from the moat rim.
 * - `grass` (m): radius of grass removed around him (npc/npcPlacement.js), as at his other places.
 * - `turnRate` (rad/s): smoothed heading, no sharp pivot at the bend.
 * - `sitFade` (s): transition to sitting, visible and without a jump (Npc.settleInto).
 * - `stopAhead`, `stopSide` (m): he waits for a kitten in front of him within this distance and corridor, so he
 *   never walks on it, and sets off as soon as the way is clear.
 * - `push` (m): a kitten walking through him is pushed away (his obstacle is removed during the walk: a moving
 *   obstacle could block the kitten and the Chagicien against each other).
 */
export const WIZARD = {
  post: { x: 29.2, z: 2.4 },
  route: [[-2.5, -8.25], [-2.25, -8.0]],
  turnRate: 3.5,
  sitFade: 0.5,
  stopAhead: 0.7,
  stopSide: 0.45,
  push: 0.42,
  grass: 1.0,
};

/**
 * Warning at the foot of the bridge, around the bridge head (x, z):
 * - `near` (m): the kitten has arrived; the moat starts 0.8 m from this point.
 * - `far` (m): maximum distance to the Chagicien, below TALK.leave (4.5 m), which would close the speech bubble.
 * - `rearm` (m): the kitten has to move clearly away to be warned again, so the warning does not nag.
 */
export const WARN = { x: 29.8, z: 0, near: 3.0, far: 4.2, rearm: 6.5 };

const OBSTACLE = 'npc_chagicien_0';
const POST_YAW = Math.atan2(-WIZARD.post.x, -WIZARD.post.z); // towards the centre of the disc, where the kitten comes from

export class Wizard {
  constructor(story) {
    this.story = story;
    this.npc = story.npcs.chagicien;
    /** 'ruins': at the nave; 'walk': on the way; 'post': at the foot of the bridge. */
    this.state = 'ruins';
    this.warnings = 0;      // warnings opened (for tests)
    this._leg = 0;          // current waypoint
    this._waiting = false;  // stopped (speech bubble, kitten in front): Idle clip
    this._turning = false;  // arrived, turning before sitting
    this._armed = true;
    this._proxyIn = 0;      // s before refitting the click box to the walk
    this._obs = story.world.ruins.obstacles.find((o) => o.name === OBSTACLE) ?? null;
  }

  /** Place to return to after a combat or a step skip (Story._placeNpcs): [x, z, yaw]. */
  get place() {
    if (this.state === 'ruins') return this.story.places.chagicien;
    if (this.state === 'post') return [WIZARD.post.x, WIZARD.post.z, POST_YAW];
    const r = this.npc.root;
    return [r.position.x, r.position.z, r.rotation.y];
  }

  /** Leaves the ruins when the Chartiste's speech bubble opens. No effect if he has already left. */
  depart() {
    if (this.state !== 'ruins') return;
    this.state = 'walk';
    this._leg = 0;
    this._waiting = false;
    this._turning = false;
    const p = this.npc.root.position;
    this._setObstacle(false, p.x, p.z);
    this.npc.startCarry(0.3);
    this._proxyIn = 0.4;
  }

  /** Placed directly at his post: combat started during the walk, or a step skip. */
  arrive() {
    const { x, z } = WIZARD.post;
    this._sit(x, z, POST_YAW);
    this.state = 'post';
    this._setObstacle(true, x, z, POST_YAW);
  }

  /** Immediate state according to game progress: `start`, `skipTo`. */
  sync() {
    const { chartiste, maman } = this.story.met;
    this._armed = true;
    if (chartiste || maman) { this.arrive(); return; }
    const [x, z, yaw] = this.story.places.chagicien;
    this._sit(x, z, yaw);
    this.state = 'ruins';
    this._setObstacle(true, x, z, yaw);
  }

  /** Every frame, in the meadow (Story.update); frozen in zone 2, resumed on return. */
  update(dt) {
    if (this.state === 'walk') this._walk(dt);
    else if (this.state === 'post') this._warn();
  }

  _walk(dt) {
    const s = this.story, npc = this.npc, r = npc.root.position;
    const c = s.cat.root.position;
    const dx = c.x - r.x, dz = c.z - r.z, d = Math.hypot(dx, dz);
    this._pushCat(dx, dz, d);
    if (this._proxyIn > 0 && (this._proxyIn -= dt) <= 0) npc._updateProxy();
    if (this._turning) {
      if (this._turn(POST_YAW, dt)) this._settle();
      return;
    }
    const route = WIZARD.route;
    const [tx, tz] = this._leg < route.length ? route[this._leg] : [WIZARD.post.x, WIZARD.post.z];
    const gx = tx - r.x, gz = tz - r.z, left = Math.hypot(gx, gz) || 1e-6;
    const ux = gx / left, uz = gz / left;
    // Speech bubble with him: he listens, turned to the kitten. Kitten in his way: he waits.
    const talking = s._talking === npc;
    const along = dx * ux + dz * uz, side = Math.abs(dx * uz - dz * ux);
    if (talking || (along > 0 && along < WIZARD.stopAhead && side < WIZARD.stopSide)) {
      if (!this._waiting) { this._waiting = true; npc.setPose('Idle', { loop: true, fade: 0.25 }); }
      if (talking) this._turn(Math.atan2(dx, dz), dt);
      return;
    }
    if (this._waiting) { this._waiting = false; npc.startCarry(0.25); }
    const step = npc.walkSpeed * dt;
    this._turn(Math.atan2(gx, gz), dt);
    if (step < left) {
      const x = r.x + ux * step, z = r.z + uz * step;
      npc.setPosition(x, s._ground(x, z), z, npc.root.rotation.y);
      return;
    }
    npc.setPosition(tx, s._ground(tx, tz), tz, npc.root.rotation.y);
    if (++this._leg > route.length) {
      this._turning = true;
      npc.setPose('Idle', { loop: true, fade: 0.25 });
    }
  }

  /** End of the walk: seated, obstacle placed at the post. */
  _settle() {
    const { x, z } = WIZARD.post, npc = this.npc;
    npc.setPosition(x, this.story._ground(x, z), z, POST_YAW);
    npc.settleInto(npc.def.pose, WIZARD.sitFade);
    this._turning = false;
    this.state = 'post';
    this._setObstacle(true, x, z, POST_YAW);
  }

  /** Opens the warning if the kitten is at the foot of the bridge before the victory. */
  _warn() {
    const s = this.story, c = s.cat.root.position;
    if (s.met.boss || s.met.maman) return;
    const head = Math.hypot(c.x - WARN.x, c.z - WARN.z);
    if (!this._armed) { if (head > WARN.rearm) this._armed = true; return; }
    if (head > WARN.near) return;
    if (Math.hypot(c.x - WIZARD.post.x, c.z - WIZARD.post.z) > WARN.far) return;
    if (s._talking || s.bubble.isOpen || s.crossing.fading || !s._sees('chagicien')) return;
    // Refused (opening, shake, combat, end screen): stays armed, nothing remains pending.
    if (s.talk('chagicien')) { this._armed = false; this.warnings++; }
  }

  /** Pushes aside a kitten walking through him, never one at rest, in the air or carried. */
  _pushCat(dx, dz, d) {
    const cat = this.story.cat, b = cat.brain;
    if (d >= WIZARD.push || d < 1e-4 || !b.target || b.jumping || b.onWall || cat.carrier) return;
    const r = this.npc.root.position, k = WIZARD.push / d;
    cat.root.position.x = r.x + dx * k;
    cat.root.position.z = r.z + dz * k;
  }

  /** Turns towards `yaw`; true once the heading is reached. */
  _turn(yaw, dt) {
    const root = this.npc.root;
    const delta = Math.atan2(Math.sin(yaw - root.rotation.y), Math.cos(yaw - root.rotation.y));
    const max = WIZARD.turnRate * dt;
    root.rotation.y += Math.abs(delta) <= max ? delta : Math.sign(delta) * max;
    return Math.abs(delta) <= max;
  }

  /** Seated at this place, without animation (pose rebuilt only when needed). */
  _sit(x, z, yaw) {
    const npc = this.npc;
    this._waiting = false;
    this._turning = false;
    if (npc.pose !== npc.def.pose || !npc._frozen) npc.setPose(npc.def.pose, { instant: true });
    npc.setPosition(x, this.story._ground(x, z), z, yaw);
  }

  /** Places or removes his obstacle, keeping the navigation grid up to date where he was and where he goes. */
  _setObstacle(on, x, z, yaw = 0) {
    const o = this._obs;
    if (!o) return;
    const list = this.story.world.ruins.obstacles, i = list.indexOf(o);
    const oldX = o.x, oldZ = o.z;
    if (!on && i < 0) return;
    if (on) {
      const g = this.story._ground(x, z);
      Object.assign(o, { x, z, rotY: yaw, ground: g, top: g + o.height });
      if (i >= 0 && oldX === x && oldZ === z) return; // already there: grid unchanged
      if (i < 0) list.push(o);
      this.story._navChanged(x, z, 2);
    } else list.splice(i, 1);
    this.story._navChanged(oldX, oldZ, 2);
  }
}
