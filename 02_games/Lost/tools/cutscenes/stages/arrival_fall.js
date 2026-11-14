import * as THREE from 'three';
import { attachArmor } from '../../../src/cat/Armor.js';
import { OPENING } from '../../../src/game/story/tuning.js';
import { SCATTER } from '../../../src/world/ArmorScatter.js';
import { heightAt } from '../../../src/world/Terrain.js';

/**
 * Cutscene 1, second part: the fall of the kitten (steps 4 and 5 of the roadmap, session 11 B). The screen is black and
 * flickers with fragments of the fall: the kitten tumbles through the air, hits the meadow, rolls and stops asleep where
 * the game opens (`OPENING.drop`), its armour coming off piece by piece. Played by `tools/cutscenes/capture.mjs`
 * (contract of a stage: DURATION, SOUND_CUES, setup, frame, dispose); assembled with the chase by
 * `tools/cutscenes/assemble.mjs`.
 *
 * Time is continuous: the kitten and the pieces keep falling during the black; a fragment only shows a slice of it. The
 * kitten travels towards the right of the opening shot and ends rolling to its resting place, so the last fragment is the
 * opening shot of the game (Story.start) and the game goes on from the same picture.
 */

export const DURATION = 8; // s: first fragment at 0.5 s, last one ends at 7.0 s, black until the end

/** Fall of the kitten (metres, seconds, radians). */
const FALL = {
  landing: 4.1,       // s: instant of the first contact with the meadow
  startSpeed: 8,      // m/s: downward speed at t = 0 (the kitten was thrown up by the explosion and has just passed its top)
  terminal: 16,       // m/s: speed a fluffy kitten reaches in the air; the fall stays readable instead of accelerating
  drift: 3.4,         // m/s: horizontal speed towards the right of the opening shot, kept by the roll
  rollDistance: 2.05, // m: from the impact point to the resting place (`OPENING.drop`); two turns of the clip's 0.163 m roll radius
  hop: { height: 0.3, time: 0.5 }, // m, s: one bounce on the first contact
  airSpin: 7,         // rad/s: corkscrew spin of the kitten in the air (about 1.1 turn per second)
  centreHeight: 0.14, // m: height of the kitten's centre above the ground at the first contact (half the body thickness)
};
const GRAVITY = 9.81; // m/s2: same as `DROP.g` of Armor.js, so the pieces and the kitten share one gravity
const MAX_PUSH = 5;   // m/s: a piece is never thrown harder than this, whatever the distance to its place

/**
 * Armour pieces that come off. `t` (s): instant. `up` (m/s): extra upward speed. `spin` (rad/s): spin when it leaves. The
 * horizontal speed is not written here: it is computed so that the piece lands near its place in the meadow (`SCATTER`),
 * where the game shows the pieces afterwards. Every fragment sees at least one piece leave.
 */
const DETACH = [
  { piece: 'breastplate', t: 0.85, up: 2.2, spin: { x: 4, y: 1, z: 3 } },     // fragment 1
  { piece: 'pauldron_L', t: 1.7, up: 1.6, spin: { x: 3, y: 2, z: -4 } },       // fragment 2
  { piece: 'pauldron_R', t: 1.85, up: 1.2, spin: { x: -3, y: 2, z: 4 } },      // fragment 2
  { piece: 'backplate', t: 2.6, up: 1.8, spin: { x: 2, y: 3, z: 3 } },         // fragment 3
  { piece: 'backlame_1', t: 2.75, up: 1.2, spin: { x: -2, y: 4, z: 2 } },      // fragment 3
  { piece: 'backlame_3', t: 3.68, up: 2.6, spin: { x: -3, y: -2, z: 4 } },     // fragment 4 (the plunge)
  { piece: 'backlame_2', t: 4.12, up: 2.2, spin: { x: 3, y: -3, z: 2 } },      // fragment 5 (impact)
  { piece: 'tailguard_1', t: 4.9, up: 1.2, spin: { x: 2, y: 5, z: 1 } },       // fragment 6 (roll)
  { piece: 'tailguard_2', t: 5.7, up: 0.8, spin: { x: 1, y: 3, z: 2 } },       // fragment 6 (the kitten stops)
];

/** Fog of the meadow is 12 to 46 m; seen from 50 m up it would hide the ground, so the high fragments push it back. */
const HIGH_FOG = { near: 40, far: 170 };

/** Opening shot of the game (`Story.start`: `SHOT.close` and `FOLLOW_HEIGHT`): distance, height above the target, target height. */
const OPENING_SHOT = { dist: 1.6, height: 0.18, targetHeight: 0.22, fov: 42 };

/**
 * `Tumble` clip (task 03, in place, 2.54 s): limbs thrown out in the air, first contact at `contact` s, two turns on the
 * ground slowing down until 2.0 s, lying on its side from `rest` s. In the air it is held on the frame `hold` s and plays on
 * for the last (`contact` - `hold`) s before the first contact.
 */
const TUMBLE = { clip: 'Tumble', hold: 0.4, contact: 0.8, rest: 2.4 };
/** The game puts the kitten down asleep from this time of `Sleep` (`SLEEP_DROP` of Cat.js); `fade` in s. */
const SLEEP = { from: 2.5, fade: 0.6 };

/** Sound cues for the timing sheet of mission 11 B2 (s from the start of the scene, in English). */
export const SOUND_CUES = [
  { t: 0.5, cue: 'first fragment cuts in out of black: wind rushing, kitten spinning high above the mountains' },
  { t: 0.85, cue: 'breastplate pops off: metal clink, then a thin falling whistle' },
  { t: 1.5, cue: 'cut to the sky: kitten whooshes past the camera, wind roar, Doppler-like pass' },
  { t: 1.7, cue: 'left shoulder plate comes off: metal clink' },
  { t: 1.85, cue: 'right shoulder plate comes off: metal clink' },
  { t: 2.4, cue: 'cut: kitten close, tumbling, wind and fur flutter' },
  { t: 2.6, cue: 'backplate comes off: metal clank' },
  { t: 2.75, cue: 'first back lame comes off: light metal rattle' },
  { t: 3.5, cue: 'cut to the ground: plunge from far above, wind rising fast, grass blades whipping' },
  { t: 4.1, cue: 'first impact on the meadow: heavy soft thud in the grass, helmet knock' },
  { t: 3.68, cue: 'third back lame comes off in the plunge: small metal ring in the wind' },
  { t: 4.12, cue: 'last back lame bursts off at the impact: metal ring; kitten bounces once (second, lighter thud near 4.6 s)' },
  { t: 4.6, cue: 'roll through the tall grass starts (two turns until 5.3 s): rustle, fur and helmet thumps' },
  { t: 4.9, cue: 'first tail cuff comes off: ring that rolls and wobbles on the ground' },
  { t: 5.3, cue: 'roll ends, kitten stops lying on its side: grass settles, one last wobble of metal' },
  { t: 5.7, cue: 'second tail cuff comes off and rolls away: ring, wobble, rest' },
  { t: 6.0, cue: 'silence: only a soft breath of the sleeping kitten and distant wind' },
  { t: 6.7, cue: 'picture fades to black: everything stops' },
];

// ------------------------------------------------------------------ geometry of the scene

const LOOK = new THREE.Vector3(OPENING.look.x, 0, OPENING.look.z).normalize(); // direction of the opening camera
const RIGHT = new THREE.Vector3(-LOOK.z, 0, LOOK.x);                           // right of the opening shot: the kitten travels this way
const UP = new THREE.Vector3(0, 1, 0);
const YAW = Math.atan2(-LOOK.x, -LOOK.z); // heading of the kitten: facing the opening camera, as when Maman sets it down
const DROP = new THREE.Vector3(OPENING.drop.x, 0, OPENING.drop.z);
const IMPACT = DROP.clone().addScaledVector(RIGHT, -FALL.rollDistance);

const TAU = FALL.terminal / GRAVITY;                      // s: time constant of the fall
const SCALE = (FALL.terminal * FALL.terminal) / GRAVITY;  // m: distance constant of the fall
const dropped = (s) => SCALE * Math.log(Math.cosh(s / TAU)); // m fallen after s seconds from rest
const S0 = TAU * Math.atanh(FALL.startSpeed / FALL.terminal);
const ROLL_TIME = (2 * FALL.rollDistance) / FALL.drift;   // s: the roll slows down evenly to a stop
const REST = FALL.landing + TUMBLE.rest - TUMBLE.contact; // s: the clip has laid the kitten down; Sleep takes over

/**
 * Kitten state at time `t`: centre `c` (in the air; on the ground only `c.y`, the height above the ground, counts), speed
 * `v`, angle `roll` about its long axis (negative = towards `RIGHT`), `pitch`, and whether it is still in the air.
 */
function kittenAt(t, out = { c: new THREE.Vector3(), v: new THREE.Vector3(), roll: 0, pitch: 0, air: true }) {
  if (t < FALL.landing) {
    const s = S0 + t;
    out.c.copy(IMPACT).addScaledVector(RIGHT, -FALL.drift * (FALL.landing - t));
    out.c.y = FALL.centreHeight + dropped(S0 + FALL.landing) - dropped(s);
    out.v.copy(RIGHT).multiplyScalar(FALL.drift).setY(-FALL.terminal * Math.tanh(s / TAU));
    out.roll = -FALL.airSpin * t;
    out.pitch = 0.5 * Math.sin(2.3 * t) + 0.25;
    out.air = true;
    return out;
  }
  const u = t - FALL.landing;
  const k = Math.min(u, ROLL_TIME);
  const along = FALL.drift * k - (FALL.drift / (2 * ROLL_TIME)) * k * k;
  const w = Math.min(1, u / FALL.hop.time);
  out.c.copy(IMPACT).addScaledVector(RIGHT, along);
  out.c.y = FALL.hop.height * 4 * w * (1 - w);
  out.v.copy(RIGHT).multiplyScalar(u < ROLL_TIME ? FALL.drift * (1 - u / ROLL_TIME) : 0);
  out.roll = 0; // on the ground the roll is in the clip
  out.pitch = 0;
  out.air = false;
  return out;
}

// ------------------------------------------------------------------ fragments

const _pos = new THREE.Vector3(), _target = new THREE.Vector3();
const _shot = { pos: _pos, target: _target, fov: 42 };
const shot = (pos, target, fov) => { _pos.copy(pos); _target.copy(target); _shot.fov = fov; return _shot; };
/** Point `look` m along the opening camera's direction, `right` m to its right and `up` m above `c`. */
const offset = (c, look, right, up) => new THREE.Vector3(c.x + LOOK.x * look + RIGHT.x * right, c.y + up, c.z + LOOK.z * look + RIGHT.z * right);

/**
 * The fragments of the fall: `from` to `to` (s) is lit, the rest is black. `dips`: very short blackouts inside a fragment
 * ([offset, length] in s from `from`), so the picture flickers instead of just appearing. `fog`: fog used (null: the
 * meadow's). `camera(t, k)` returns { pos, target, fov }. The gaps (0.3, 0.25, 0.2, 0.15, 0.2 s) shorten while the fall speeds
 * up, and the image holds longer as it ends.
 */
const FRAGMENTS = [
  { // 1: the kitten from the front and a little above, spinning against the distant mountains; the breastplate leaves.
    from: 0.5, to: 1.2, dips: [[0.18, 0.04]], fog: HIGH_FOG,
    camera: (t, k) => shot(offset(k.c, -2.3, -1.1, 0.5), k.c, 40),
  },
  { // 2: seen from below against the sky, falling towards the camera; both shoulder plates leave.
    from: 1.5, to: 2.2, dips: [[0.3, 0.05], [0.52, 0.03]], fog: HIGH_FOG,
    camera: (t, k) => shot(offset(kittenAt(1.8).c, -0.6, 1.8, -1.0), k.c, 50),
  },
  { // 3: from behind and above, the ground coming up; the back plates leave.
    from: 2.4, to: 2.95, dips: [[0.2, 0.04]], fog: null,
    camera: (t, k) => shot(offset(k.c, 1.4, -0.3, 0.55), offset(k.c, -0.2, 0, 0), 48),
  },
  { // 4: ground-level camera, the kitten plunges into the picture from above.
    from: 3.5, to: 3.9, dips: [[0.2, 0.03]], fog: null,
    camera: (t, k) => shot(new THREE.Vector3(IMPACT.x - LOOK.x * 2.4, 0.35, IMPACT.z - LOOK.z * 2.4), k.c, 60),
  },
  { // 5: the impact seen low and close; the last two back lames burst off.
    from: 4.0, to: 4.45, dips: [[0.28, 0.04]], fog: null,
    camera: (t) => {
      const held = kittenAt(Math.max(t, FALL.landing)).c;
      return shot(offset(IMPACT, -2.0, 0.4, 0.35), _target.set(held.x, 0.2, held.z), 42);
    },
  },
  { // 6: the opening shot of the game; the kitten rolls in from the left and stops among its armour.
    from: 4.6, to: 7.0, dips: [[0.12, 0.04], [0.3, 0.03]], fog: null, fadeOut: 0.3,
    camera: () => {
      const focus = DROP.clone();
      focus.y = heightAt(focus.x, focus.z) + OPENING_SHOT.targetHeight;
      return shot(focus.clone().addScaledVector(LOOK, -OPENING_SHOT.dist).addScaledVector(UP, OPENING_SHOT.height), focus, OPENING_SHOT.fov);
    },
  },
];

/** Opacity of the black cover at time `t`: 1 between fragments and inside a dip, a ramp during the final fade, else 0. */
function coverAt(t) {
  const f = FRAGMENTS.find((entry) => t >= entry.from && t < entry.to);
  if (!f) return 1;
  if (f.dips.some(([a, b]) => t >= f.from + a && t < f.from + a + b)) return 1;
  if (f.fadeOut && t > f.to - f.fadeOut) return (t - (f.to - f.fadeOut)) / f.fadeOut;
  return 0;
}

// ------------------------------------------------------------------ pieces

/** Where a piece lands: its place in the meadow, as `ArmorScatter` lays it. */
function scatterTarget(name) {
  const s = SCATTER.find((entry) => entry.name === name);
  return new THREE.Vector3(DROP.x + Math.cos(s.angle) * s.dist, 0, DROP.z + Math.sin(s.angle) * s.dist);
}

/** Horizontal speed (m/s) to add so that a piece leaving `from` with the kitten's speed lands on `target`. */
function aimedVelocity(from, kittenSpeed, target, up) {
  const climb = kittenSpeed.y + up;
  const height = Math.max(from.y - heightAt(target.x, target.z), 0.02);
  const flight = (climb + Math.sqrt(climb * climb + 2 * GRAVITY * height)) / GRAVITY;
  const push = new THREE.Vector3((target.x - from.x) / flight - kittenSpeed.x, 0, (target.z - from.z) / flight - kittenSpeed.z);
  return push.length() > MAX_PUSH ? push.setLength(MAX_PUSH) : push;
}

// ------------------------------------------------------------------ stage

const BLACK = new THREE.Color(0x000000);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const AXIS_Z = new THREE.Vector3(0, 0, 1), AXIS_X = new THREE.Vector3(1, 0, 0);

export async function setup(game) {
  const { world, cat, npcs } = game;
  world.syncZone?.(DROP.x); // the meadow, wherever the game was left
  const armor = attachArmor(cat);
  armor.setVisible(true);
  world.armorScatter?.setVisible(false); // the pieces of this scene take their place
  const hidden = Object.values(npcs ?? {}).filter((npc) => npc.root.visible);
  hidden.forEach((npc) => { npc.root.visible = false; });
  cat.carry(null);
  cat.lookOverride = null;
  cat.helmet?.reattach();
  cat.brain.setScripted('knock'); // no ground contact while the kitten is in the air (Cat.update)
  const cover = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }),
  );
  cover.scale.set(8, 8, 1);
  cover.renderOrder = 1e6;
  cover.frustumCulled = false;
  world.scene.add(cover);
  const ctx = {
    world, cat, armor, cover, hidden, nextDetach: 0, airborne: true, sleeping: false, k: kittenAt(0),
    fog: world.scene.fog ? { near: world.scene.fog.near, far: world.scene.fog.far } : null,
    fov: world.camera.fov, background: world.scene.background,
  };
  holdPose(ctx, 0);
  return ctx;
}

/**
 * Pose of the clip for the picture of time `t`. The mixer runs in `cat.update`, before `frame`, so the time written here is
 * the one of the next picture: callers pass `t + dt`. The clip is held (timeScale 0) and scrubbed by this function.
 */
function holdPose(ctx, t) {
  const { cat } = ctx;
  const lead = FALL.landing - t; // s until the first contact
  const time = lead > TUMBLE.contact - TUMBLE.hold ? TUMBLE.hold : Math.min(TUMBLE.contact - lead, TUMBLE.rest);
  cat.play(TUMBLE.clip, 0, 0, time);
}

export function frame(ctx, t, dt) {
  const { world, cat, armor } = ctx;
  const k = kittenAt(t, ctx.k);

  // From the first contact on the game's own ground contact places the body on the meadow (state 'sleep': eyes close).
  if (ctx.airborne && !k.air) {
    ctx.airborne = false;
    cat.brain.setScripted('sleep');
  }
  if (!ctx.sleeping && t >= REST) {
    ctx.sleeping = true;
    cat.play('Sleep', SLEEP.fade, 1, SLEEP.from);
  } else if (!ctx.sleeping) holdPose(ctx, t + dt);
  // Rotation of the body: procedural in the air; the clip's own roll takes over for the last stretch before the contact.
  const imposed = THREE.MathUtils.smoothstep((FALL.landing - t) / (TUMBLE.contact - TUMBLE.hold), 0, 1);
  cat.root.rotation.y = YAW;
  _qa.setFromAxisAngle(AXIS_Z, k.roll * imposed);
  _qb.setFromAxisAngle(AXIS_X, k.pitch * imposed);
  cat.body.quaternion.copy(_qa).multiply(_qb);
  if (k.air) {
    cat.root.position.set(k.c.x, k.c.y - cat.pivotY, k.c.z);
    cat.body.position.y = cat.pivotY;
  } else {
    cat.root.position.set(k.c.x, heightAt(k.c.x, k.c.z) + k.c.y, k.c.z);
  }
  cat.root.updateMatrixWorld(true);

  armor.update(dt);
  while (ctx.nextDetach < DETACH.length && t >= DETACH[ctx.nextDetach].t) {
    const d = DETACH[ctx.nextDetach++];
    const from = armor.piece(d.piece).group.getWorldPosition(new THREE.Vector3());
    const push = aimedVelocity(from, k.v, scatterTarget(d.piece), d.up);
    armor.detach(d.piece, { velocity: { x: push.x, y: d.up, z: push.z }, spin: d.spin });
  }

  const fragment = FRAGMENTS.find((f) => t >= f.from && t < f.to);
  const cam = world.camera;
  if (fragment) {
    const s = fragment.camera(t, k);
    cam.position.copy(s.pos);
    cam.up.copy(UP);
    cam.lookAt(s.target);
    cam.fov = s.fov;
    cam.updateProjectionMatrix();
    if (world.scene.fog && ctx.fog) {
      world.scene.fog.near = fragment.fog?.near ?? ctx.fog.near;
      world.scene.fog.far = fragment.fog?.far ?? ctx.fog.far;
    }
  }
  const cover = coverAt(t);
  // Fully black: nothing is drawn but the black background (the capture of a black picture then costs almost nothing).
  world.scene.visible = cover < 1;
  world.scene.background = cover < 1 ? ctx.background : BLACK;
  ctx.cover.visible = cover > 0;
  ctx.cover.material.opacity = cover;
  ctx.cover.position.copy(cam.position).addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 0.5);
  ctx.cover.quaternion.copy(cam.quaternion);
}

export function dispose(ctx) {
  const { world, cat, armor, cover, hidden, fog } = ctx;
  world.scene.visible = true;
  world.scene.background = ctx.background;
  cover.removeFromParent();
  cover.geometry.dispose();
  cover.material.dispose();
  armor.dispose();
  world.armorScatter?.setVisible(true);
  hidden.forEach((npc) => { npc.root.visible = true; });
  if (fog && world.scene.fog) { world.scene.fog.near = fog.near; world.scene.fog.far = fog.far; }
  world.camera.fov = ctx.fov;
  world.camera.updateProjectionMatrix();
  cat.body.quaternion.identity();
  cat.brain.setScripted(null, 'idle');
}
