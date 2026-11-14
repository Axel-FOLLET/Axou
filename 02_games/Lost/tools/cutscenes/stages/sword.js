/**
 * Cutscene 2, the sword (roadmap session 11 B, "7 s, triggered as soon as the player clicks the sword"). The
 * Chartiste's brush splits the stone and throws the sword up; the kitten, which has seen it, dashes across the stroke,
 * leaps and catches the sword in mid-air; the last shot is on its face, sword in its mouth, ready to fight. Played by
 * `tools/cutscenes/capture.mjs` (contract of a stage: DURATION, SOUND_CUES, setup, frame, dispose) into
 * `public/videos/cutscene_sword.mp4`.
 *
 * Everything is a function of the story clock (`./sword/plan.js`): actors are posed from it, not advanced by the
 * game, so any frame renders the same whatever came before. The game still runs its normal update (fur, arena
 * shader, helmet); `frame` then overrides the poses of the kitten, the boss, the sword and the camera just before the
 * render. Shots and why: `./sword/shots.js`. Effects: `./sword/fx.js`.
 *
 * Staging facts read from the game: arena built and night fallen (`story.setArena`), boss red and on guard
 * (`story.setBoss`, `npc.bossPlay`), sword and stone from `src/world/Sword.js`, kitten with helmet and no armour (as
 * in combat), brush clip `BrushSwing` and kitten clips from `cat.glb`.
 */

import * as THREE from 'three';
import { COMBAT_CAM, BOSS } from '../../../src/game/combat.js';
import { SwordGlow, ImpactBurst, shakeOffset } from './sword/fx.js';
import { cameraAt, SHOTS } from './sword/shots.js';
import {
  DURATION, SOUND_CUES, EVENTS, STRIKE_CLIP, FLIGHT, LEAP_CLIPS, TAU_END, tauAt, tAt, buildRoute,
} from './sword/plan.js';

export { DURATION, SOUND_CUES };

/**
 * Staging values (m, s, rad). Each one has its reason on its line.
 * - `blend`: crossfade between two kitten clips; short enough to read as a cut of intent, long enough not to pop.
 * - `turnRun`, `turnLand`: heading turn rates; fast while running (a sprint turns on a dime), slow on guard.
 * - `splitTime`: the two halves of the stone open to the game's split state (`sword.halves`, SWORD.split) in this
 *   many seconds after the impact: a crack, not a slide.
 * - `lightRise`: the golden column of light brightens once the kitten notices the sword, to its "pull" intensity.
 * - `lid`: eyelid lowered by the final stare (0 open, 1 closed); a slight narrowing reads as resolve, not sleepiness.
 */
const STAGE = {
  blend: 0.12,
  turnRun: 14,
  turnLand: 5,
  splitTime: 0.15,
  lightRise: 1.0,
  lid: 0.2,
  tableStep: 1 / 240,
};

const ease = (x) => { const c = Math.min(Math.max(x, 0), 1); return c * c * (3 - 2 * c); };
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();

/** Local frame of the scene (see plan.js): origin on the stone, `a` from the boss to the stone, `b` to the right. */
function makeFrame(world, boss, stoneCentre) {
  const O = stoneCentre.clone();
  const u = new THREE.Vector3(O.x - boss.root.position.x, 0, O.z - boss.root.position.z).normalize();
  const right = new THREE.Vector3(-u.z, 0, u.x);
  const ground = (x, z) => world.terrain.heightAt(x, z);
  const frame = {
    O, u, right, ground,
    /** World point of local (a, b) at height h above the ground. */
    w(a, b, h = 0, out = new THREE.Vector3()) {
      out.set(O.x + u.x * a + right.x * b, 0, O.z + u.z * a + right.z * b);
      out.y = ground(out.x, out.z) + h;
      return out;
    },
  };
  return frame;
}

/** Cubic Hermite position at `tau` through timed knots, zero speed at both ends. */
function routeAt(knots, tau, out) {
  const n = knots.length;
  if (tau <= knots[0][0]) return out.set(knots[0][1], knots[0][2]);
  if (tau >= knots[n - 1][0]) return out.set(knots[n - 1][1], knots[n - 1][2]);
  let i = 0;
  while (knots[i + 1][0] < tau) i++;
  const [t0, a0, b0] = knots[i];
  const [t1, a1, b1] = knots[i + 1];
  const tangent = (k, axis) => {
    if (k === 0 || k === n - 1) return 0;
    return (knots[k + 1][axis] - knots[k - 1][axis]) / (knots[k + 1][0] - knots[k - 1][0]);
  };
  const h = t1 - t0;
  const s = (tau - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return out.set(
    h00 * a0 + h10 * h * tangent(i, 1) + h01 * a1 + h11 * h * tangent(i + 1, 1),
    h00 * b0 + h10 * h * tangent(i, 2) + h01 * b1 + h11 * h * tangent(i + 1, 2),
  );
}

/** Table of the kitten's root (x, z, yaw, speed, run-clip phase) every `tableStep` story seconds. */
function buildCatTable(ctx) {
  const { L, leap, knots } = ctx;
  const step = STAGE.tableStep;
  const n = Math.ceil(TAU_END / step) + 2;
  const rows = [];
  const p = new THREE.Vector2();
  const bossYaw = (x, z) => Math.atan2(ctx.boss.root.position.x - x, ctx.boss.root.position.z - z);
  let yaw = 0;
  let phase = 0;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const tau = i * step;
    routeAt(knots, tau, p);
    const base = L.w(p.x, p.y, 0, _v);
    let x = base.x;
    let z = base.z;
    if (i === 0) {
      const to = L.w(0, 0, 0, _w);
      yaw = Math.atan2(to.x - x, to.z - z);
    }
    const speed = prev ? Math.hypot(x - prev.bx, z - prev.bz) / step : 0;
    // Heading: along the velocity while running; after the landing, round to face the boss.
    let want = null;
    let rate = STAGE.turnRun;
    if (tau < leap.tauLaunch && speed > 0.8 && prev) want = Math.atan2(x - prev.bx, z - prev.bz);
    else if (tau > leap.tauLand - 0.1) { want = bossYaw(x, z); rate = STAGE.turnLand; }
    if (want !== null) {
      const d = wrapAngle(want - yaw);
      yaw += Math.sign(d) * Math.min(Math.abs(d), rate * step);
    }
    // The clip is in place: the leap moves the root forward between launch and landing.
    const advance = leap.advance * ease((tau - leap.tauLaunch) / (leap.tauLand - leap.tauLaunch));
    x += Math.sin(yaw) * advance;
    z += Math.cos(yaw) * advance;
    const runRate = THREE.MathUtils.clamp(speed / ctx.runSpeed, 0.35, 1.25);
    if (tau >= EVENTS.run && tau < leap.tauStart + 0.2) phase += runRate * step;
    rows.push({ x, z, yaw, speed, phase });
    prev = { bx: base.x, bz: base.z };
  }
  return rows;
}

function sampleTable(rows, tau) {
  const x = Math.max(0, tau) / STAGE.tableStep;
  const i = Math.min(Math.floor(x), rows.length - 2);
  const f = Math.min(x - i, 1);
  const a = rows[i];
  const b = rows[i + 1];
  return {
    x: a.x + (b.x - a.x) * f,
    z: a.z + (b.z - a.z) * f,
    yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * f,
    speed: a.speed + (b.speed - a.speed) * f,
    phase: a.phase + (b.phase - a.phase) * f,
  };
}

/** Plays `layers` ([action, time, weight]) on a mixer: weights normalised, times set, pose evaluated once. */
function drive(mixer, actions, layers) {
  const total = layers.reduce((s, l) => s + l[2], 0) || 1;
  const used = new Set(layers.map((l) => l[0]));
  for (const a of actions) {
    if (used.has(a)) continue;
    a.stopFading();
    a.setEffectiveWeight(0);
  }
  for (const [a, time, weight] of layers) {
    a.stopFading();
    a.stopWarping();
    a.enabled = true;
    a.paused = false;
    a.time = time;
    a.setEffectiveTimeScale(1);
    a.setEffectiveWeight(weight / total);
  }
  mixer.update(0);
}

export async function setup(game) {
  const { world, cat, npcs, story, sword } = game;
  const boss = npcs.chartiste;
  if (!boss) throw new Error('[sword] the Chartiste is not loaded (npcs.chartiste)');

  // Arena built and boss red, as in the fight; sun shadow box as in combat (the boss is 5 times the hero).
  story.setArena(1);
  story.setBoss(1);
  story._setShadow(COMBAT_CAM.shadow);
  boss.bossPlay('BrushHold', { loop: true, instant: true, fade: 0 });
  boss.bossPlay('BrushSwing', { fade: 0 });
  const bossActions = [boss.actions.get('BrushHold'), boss.actions.get('BrushSwing')];

  cat.brain.setScripted('idle');
  cat.setSword(false);
  cat.lookOverride = null;

  const L = makeFrame(world, boss, sword.stoneCenter);
  const leapName = cat.hasClip('LeapCatch') ? 'LeapCatch' : 'Pounce';
  const clip = LEAP_CLIPS[leapName];
  const leap = {
    name: leapName,
    ...clip,
    tauStart: EVENTS.catch - clip.catch,
    tauLaunch: EVENTS.catch - clip.catch + clip.launch,
    tauLand: EVENTS.catch - clip.catch + clip.land,
    tauEnd: EVENTS.catch - clip.catch + clip.end,
  };
  const knots = buildRoute(leap.tauStart);

  const parent = sword.mesh.parent;
  const ctx = {
    game, world, cat, boss, sword, story, L, leap, knots, parent, bossActions,
    runSpeed: cat.runSpeed,
    lift: cat._lift ?? 0,
    liftRef: 0,
    swordScale: 1,
    last: { tau: -1 },
  };
  ctx.catActions = Object.values(cat.actions);

  // Sword poses: planted (from the game), in the mouth (computed from the catch pose below).
  sword.mesh.matrix.decompose(_v, _q, _w);
  ctx.planted = { p: _v.clone(), q: _q.clone(), s: _w.clone() };
  ctx.aimYaw = Math.atan2(L.u.x, L.u.z);

  // Split stone: the game's own halves (their end state is what the fight resumes with); the stage only opens them
  // progressively from the whole stone. Each half is posed by a z offset along the cut and a lean about its cut edge.
  ctx.halves = sword.halves.children.map((mesh) => ({ mesh, z: mesh.position.z, rx: mesh.rotation.x }));
  ctx.cutZ = ctx.halves.reduce((sum, h) => sum + h.z, 0) / ctx.halves.length;
  ctx.stoneTop = sword.stoneTop.clone();

  ctx.glow = new SwordGlow(parent);
  ctx.burst = new ImpactBurst(parent, L.O, L.u, 11, L.ground);

  // Pre-pass: the cat's root table, then the catch pose (where the sword must be at the catch).
  ctx.table = buildCatTable(ctx);
  poseCat(ctx, EVENTS.catch, 0);
  ctx.catchM = new THREE.Matrix4().multiplyMatrices(cat.rig.head.matrixWorld, sword.L);
  ctx.catchYaw = cat.root.rotation.y;
  poseCat(ctx, TAU_END, 0);
  ctx.endHead = cat.rig.head.getWorldPosition(new THREE.Vector3());
  ctx.endYaw = cat.root.rotation.y;
  ctx.endM = new THREE.Matrix4().multiplyMatrices(cat.rig.head.matrixWorld, sword.L);
  poseCat(ctx, 0, 0);
  ctx.shots = SHOTS;
  return ctx;
}

/** Kitten pose at story time `tau`: root, clips, procedural layers, ground contact. */
function poseCat(ctx, tau, dt) {
  const { cat, leap, world } = ctx;
  const row = sampleTable(ctx.table, tau);
  cat.root.position.set(row.x, 0, row.z);
  cat.root.position.y = world.terrain.heightAt(row.x, row.z);
  cat.root.rotation.y = row.yaw;
  cat.locomotion.heading = row.yaw;
  cat.body.rotation.x = cat.body.rotation.z = 0;

  const B = STAGE.blend;
  const idle = cat.actions.Idle;
  const run = cat.actions.run;
  const guard = cat.actions.SwordPull;
  const lp = cat.actions[leap.name];
  const layers = [];
  const wRun = ease((tau - EVENTS.run) / B) * (1 - ease((tau - leap.tauStart + B) / B));
  const wLeap = ease((tau - (leap.tauStart - B)) / B) * (tau < leap.tauEnd - 0.3 || leap.name === 'LeapCatch' ? 1 : 1 - ease((tau - (leap.tauEnd - 0.3)) / 0.3));
  const wGuard = tau >= leap.tauEnd - 0.3 && leap.name !== 'LeapCatch' ? ease((tau - (leap.tauEnd - 0.3)) / 0.3) : (tau >= leap.tauEnd ? 1 : 0);
  const wIdle = Math.max(0, 1 - wRun - wLeap - wGuard);
  if (wIdle > 0) layers.push([idle, tau % idle.getClip().duration, wIdle]);
  if (wRun > 0) layers.push([run, row.phase % run.getClip().duration, wRun]);
  if (wLeap > 0) layers.push([lp, Math.min(Math.max(tau - leap.tauStart, 0), lp.getClip().duration), wLeap]);
  if (wGuard > 0) layers.push([guard, guard.getClip().duration, wGuard]);

  // Same order as Cat.update: undo the procedural layer, pose the clips, apply the procedural layer again.
  cat.procedural.restore();
  cat.earFollow.restore();
  drive(cat.mixer, ctx.catActions, layers);
  cat.root.updateMatrixWorld(true);

  // Gaze and tail: sword after the notice, forward during the run, tail low while running and up on guard.
  const p = cat.procedural;
  if (tau < EVENTS.notice) p.lookTarget = ctx.L.w(-3, 0, 1.2, _w).clone();
  else if (tau < leap.tauLaunch) p.lookTarget = ctx.stoneTop.clone();
  else p.lookTarget = null;
  p.lookWeight = tau < leap.tauLand ? 1 : 0.3;
  p.focus = tau >= EVENTS.notice;
  p.tailMode = tau < leap.tauStart ? 'low' : tau < leap.tauEnd ? 'clip' : 'up';
  cat.earFollow.begin();
  p.update(dt, cat.body);
  cat.earFollow.apply();

  // Eyes: wide until the catch, a narrowed stare after it.
  cat.eyes.setLid(STAGE.lid * ease((tau - leap.tauLand) / 0.6));

  // Ground contact: feet on the ground except in the air, where the clip lifts the body.
  const airborne = tau > leap.tauLaunch && tau < leap.tauLand;
  cat.body.position.y = cat.pivotY + ctx.lift;
  cat.root.updateMatrixWorld(true);
  if (!airborne) {
    const minY = cat._lowestVertexY();
    const target = ctx.lift - (minY - cat.root.position.y) + 0.004;
    ctx.lift = target;
    cat.body.position.y = cat.pivotY + ctx.lift;
    cat.root.updateMatrixWorld(true);
  }
  cat._lift = ctx.lift;
}

/** Boss pose at story time `tau`: guard, then the brush stroke, then guard again; heading locked on the stone. */
function poseBoss(ctx, tau) {
  const { boss, L } = ctx;
  const [hold, swing] = ctx.bossActions;
  const swingT = tau - EVENTS.windup;
  const swingEnd = swing.getClip().duration;
  const wSwing = ease((swingT + 0.12) / 0.12) * (1 - ease((swingT - (swingEnd - 0.4)) / 0.4));
  const layers = [[hold, tau % hold.getClip().duration, 1 - wSwing]];
  if (wSwing > 0) layers.push([swing, Math.min(Math.max(swingT, 0), swingEnd), wSwing]);
  // Heading: faces the kitten until the wind-up, then locks on the stone for the stroke.
  const kit = sampleTable(ctx.table, Math.min(tau, EVENTS.windup));
  const toKitten = Math.atan2(kit.x - boss.root.position.x, kit.z - boss.root.position.z);
  const lock = ease((tau - (EVENTS.windup - 0.45)) / 0.4);
  const yaw = ctx.aimYaw + wrapAngle(toKitten - ctx.aimYaw) * (1 - lock) * 0.6;
  boss.root.rotation.y = yaw;
  drive(boss.mixer, ctx.bossActions, layers);
  boss._contact(0, true);
  void L;
}

/** Position, rotation and scale of the sword at story time `tau` (planted, flying, or in the mouth). */
function swordAt(ctx, tau, out) {
  const { planted, catchM } = ctx;
  if (tau < EVENTS.impact) { out.p.copy(planted.p); out.q.copy(planted.q); out.s.copy(planted.s); return 'stone'; }
  if (tau < EVENTS.catch) {
    const u = (tau - EVENTS.impact) / (EVENTS.catch - EVENTS.impact);
    catchM.decompose(_v, _q, _w);
    const end = { p: _v.clone(), q: _q.clone(), s: _w.clone() };
    const y0 = planted.p.y;
    const yc = end.p.y;
    const gy = ctx.L.ground(planted.p.x, planted.p.z);
    const top = gy + FLIGHT.apex;
    // Parabola through the start and end heights with its top at `top`: top at u = a.
    const a = 1 / (1 + Math.sqrt((top - yc) / (top - y0)));
    out.p.lerpVectors(planted.p, end.p, u);
    out.p.y = top - (top - y0) * ((u - a) / a) ** 2;
    // Spin: whole turns about the stroke axis that finish at the held orientation.
    _q.copy(planted.q).slerp(end.q, ease(u));
    const spin = new THREE.Quaternion().setFromAxisAngle(ctx.L.right, (1 - u) * FLIGHT.turns * Math.PI * 2);
    out.q.copy(spin).multiply(_q);
    out.s.lerpVectors(planted.s, end.s, u);
    return 'air';
  }
  _m.multiplyMatrices(ctx.cat.rig.head.matrixWorld, ctx.sword.L);
  _m.decompose(out.p, out.q, out.s);
  return 'held';
}

const _pose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };

export function frame(ctx, t, dt) {
  const { world, cat, sword, boss, L } = ctx;
  const tau = tauAt(t);
  ctx.last = { tau, t };

  poseBoss(ctx, tau);
  poseCat(ctx, tau, dt);

  // Sword.
  const state = swordAt(ctx, tau, _pose);
  _m.compose(_pose.p, _pose.q, _pose.s);
  sword.mesh.matrix.copy(_m);
  sword.mesh.matrixWorldNeedsUpdate = true;
  sword.mesh.visible = true;

  // Stone: whole until the impact, then the game's two halves open from the cut to their resting state.
  const age = tau - EVENTS.impact;
  const cut = age >= 0;
  sword.stone.visible = !cut;
  sword.halves.visible = cut;
  const open = ease(age / STAGE.splitTime);
  for (const h of ctx.halves) {
    h.mesh.position.z = ctx.cutZ + (h.z - ctx.cutZ) * open;
    h.mesh.rotation.x = h.rx * open;
  }

  // Light column: brightens at the notice, goes out at the impact (the sword has left the stone).
  const rise = ease((tau - EVENTS.notice) / 0.5);
  const gone = 1 - ease(age / 0.2);
  sword.lightUniforms.uI.value = STAGE.lightRise * rise * gone;
  sword.light.visible = sword.lightUniforms.uI.value > 0.003;

  // Glow and trail while the sword is in the air.
  const glowStrength = tau < EVENTS.impact ? 0 : 1 - ease((tau - EVENTS.catch) / FX_FADE);
  ctx.glow.update((tt, out) => {
    if (tt < EVENTS.impact || tt > EVENTS.catch) return false;
    const saved = ctx.last;
    swordAt(ctx, tt, _pose);
    ctx.last = saved;
    out.copy(_pose.p);
    return true;
  }, tau, glowStrength);
  ctx.burst.update(age, ctx.stoneTop);

  // Camera.
  const cam = cameraAt(ctx, t, tau);
  world.camera.position.copy(cam.pos).add(shakeOffset(age, _w));
  world.camera.lookAt(cam.target);
  world.camera.fov = cam.fov;
  world.camera.updateProjectionMatrix();
  void boss; void state; void STRIKE_CLIP; void BOSS; void tAt;
}

const FX_FADE = 0.4; // s of story time: the glow dies out as the jaws close

export function dispose(ctx) {
  const { sword } = ctx;
  ctx.glow.dispose();
  ctx.burst.dispose();
  sword.reset();
}
