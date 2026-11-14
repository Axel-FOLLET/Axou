/**
 * Cutscene 3, the hug (about 15 s), captured by `tools/cutscenes/capture.mjs hug` into `public/videos/cutscene_hug.mp4`.
 *
 * Starts where the in-game hug starts today (`Story._startHug`, right after the helmet has fallen): top of zone 2, Maman
 * lying (`Lie`), the kitten standing in front of her, the helmet on the ground, no armour. Story told in the roadmap
 * (session 11 B, cutscene 3 and the owner's answers): the kitten hops with joy, Maman gets up slowly and limps two steps,
 * forgets her pain on seeing her kitten, they meet, rub against each other as cats do, then hug. The last shot is the
 * in-game hug pose (`Npc.startHug`) seen from the in-game hug camera (`Story._hugShot`), so the end screen, a translucent
 * veil over the game scene, takes over from the same picture.
 *
 * Contract of a scene: see `tools/cutscenes/README` section of `tools/README.md`. The scene is driven by absolute time `t`
 * (every pose is a function of `t` or a one-shot event keyed on a phase), so a capture started with `--from` or `--every`
 * shows the same picture as a full run.
 *
 * Frame of the scene: origin `O` = Maman's place at the summit, axis `a` = Maman's heading (towards the kitten), axis `b`
 * = her belly side (local -X, where the kitten curls in the hug and where the camera stands: the dried paint mark is on
 * her right flank, the belly side). Positions are `[u along a, w along b]` in m.
 */
import * as THREE from 'three';

export const DURATION = 15; // s, roadmap: "15 s, before the credits"

/**
 * Sound cues for mission 11 B2 (times in s from the start of the scene, English). Nothing is played by the video itself.
 * Times follow TIMING and the contact times of the clips (HopJoy: landings at 0.5 s + 0.667 s per hop; LimpRise: paw lifts
 * 4.3 s and 4.75 s, steps down 4.5 s and 4.95 s; Rub: head contact 0.75 s and flank 1.1 s into the 3 s cycle, from 6.8 s;
 * Sleep: sits at 0.5 s, lies at 1.5 s, settles at 2.0 s, curled at 3.8 s).
 */
export const SOUND_CUES = [
  { t: 0.0, cue: 'mountain wind and light snowfall bed continues (the music of the game continues, no change)' },
  { t: 0.5, cue: 'kitten hop 1: soft paw landing in snow, tiny happy trill' },
  { t: 1.17, cue: 'kitten hop 2: soft paw landing in snow' },
  { t: 1.83, cue: 'kitten hop 3: soft paw landing in snow, happy chirp' },
  { t: 2.5, cue: 'kitten hop 4: soft paw landing in snow' },
  { t: 3.17, cue: 'kitten hop 5: soft paw landing in snow' },
  { t: 3.83, cue: 'kitten hop 6: soft paw landing in snow, higher happy meow' },
  { t: 4.5, cue: 'kitten hop 7: soft paw landing in snow' },
  { t: 1.0, cue: 'Maman starts to get up: fur and snow rustle, low tired breath' },
  { t: 1.9, cue: 'Maman lifts her head: small pained exhale (no blood, no scream)' },
  { t: 2.7, cue: 'Maman pushes her chest up on stretched front legs: effort, snow shifting' },
  { t: 4.5, cue: 'Maman limping step 1: uneven soft snow crunch (front paw spared)' },
  { t: 4.95, cue: 'Maman limping step 2: uneven soft snow crunch' },
  { t: 5.0, cue: 'Maman sees her kitten: sharp inhale, then a warm call meow ("forgets everything")' },
  { t: 5.2, cue: 'kitten answers Maman: excited trilled meow, then fast trot steps in snow until 6.8 s' },
  { t: 5.2, cue: 'Maman quick steps in snow, no limp (one soft crunch about every 0.4 s until 6.8 s)' },
  { t: 6.8, cue: 'the two cats meet: tiny bump of heads, soft fur contact, first purr of the kitten starts' },
  { t: 7.55, cue: 'head rubbing: fur on fur, slow soft brushing, both cats' },
  { t: 7.9, cue: 'flank rubbing: longer fur brushing, purr grows' },
  { t: 9.0, cue: 'the rub ends: soft release, a happy short meow from Maman' },
  { t: 10.3, cue: 'Maman sits down then lies: snow compresses, fur rustle, content sigh (settled at 11.8 s)' },
  { t: 10.0, cue: 'kitten trots round Maman\'s head to her belly: fast light crunches until 10.8 s' },
  { t: 11.3, cue: 'kitten sits then lies against her belly: fur rustle, tiny contented squeak' },
  { t: 12.0, cue: 'hug: Maman deep slow purr (game HUG_PURR_MOTHER) joins the kitten purr' },
  { t: 14.9, cue: 'purr continues under the end screen' },
];

/**
 * Schedule (s). Every duration is a slot: the clip played in it is time-scaled to fit, so the cues above do not move when a
 * clip is re-exported with a slightly different length.
 */
const TIMING = {
  riseStart: 1.0,     // Maman starts to get up: 1 s to read the lying Maman and the hopping kitten
  riseLen: 4.0,       // LimpRise slot (task 04: 4 s): rise, then two limping steps
  limpFrom: 3.7,      // within the slot, the limping steps start (fallback without the clip only)
  sees: 5.0,          // end of the limp: Maman sees the kitten, the limp stops, the camera cuts
  surprise: 0.2,      // s, the kitten waits this long after Maman has seen it, then runs
  meet: 6.8,          // the two cats touch
  rubEnd: 9.8,        // end of the rubbing (Rub slot 3 s)
  lieStart: 9.8,      // Maman starts the Sleep clip: goes down
  lieLen: 3.0,        // Sleep clip time reached at HUG.at (Npc.startHug freezes there)
  kittenSleep: 10.8,  // the kitten's Sleep clip starts 1 s after Maman's (it trots round her head to her belly meanwhile)
  crossFade: 0.3,     // s, fade LimpRise -> Walk (the baked displacement of the clip is handed over to the root in this time)
};

/** Where things stand, in the frame of the scene (see the header). */
const LAYOUT = {
  kittenDist: 2.6,    // m, kitten in front of Maman at the start (game: bubble opens at 2.2 m, TALK.approachMaman; the kitten may stand a little further)
  limpDist: 0.6,      // m, covered by the two limping steps without the LimpRise clip (with it: baked in the clip)
  limpUnits: 1.9,     // rig units travelled by LimpRise (task 04 block); x model scale = m
  meetShare: 0.45,    // share of the gap left after the limp that Maman covers herself; the kitten covers the rest
  rubSide: 0.38,      // m, spacing between the two spines; the kitten stands on Maman's LEFT (the Rub clip expects its partner on the left)
  rubFwd: 0.0,        // m, kitten ahead of Maman's root during the rub (side by side, head to flank)
  aroundFront: 0.75,  // m, the kitten goes round Maman's nose (this far ahead of her root) to reach her belly side
  helmetToss: [0.9, 0.5], // m/s, [sideways, up]: same family as HUG.shake.toss (src/game/story/tuning.js)
};

/** Gaits and fallbacks. */
const GAIT = {
  hopArc: 0.16,       // m, fallback hop height without the HopJoy clip (the Jump clip has no height of its own)
  hopPeriod: 1.0,     // s, fallback hop
  kittenRate: [0.6, 1.4], // allowed Trot playback rate range: keeps the paws from sliding too visibly
};

/** In-game hug camera, mirrors `HUG` in src/game/story/tuning.js (dist, tilt, half, angle 0.5 rad from the belly axis). */
const HUG_CAM = { dist: 1.9, tilt: 0.44, half: 0.45, angle: 0.5, follow: 0.22 };

/** Camera of the first two shots (before the cut), in the scene frame: p position [u, w, h above ground], l look-at. */
const CAMERA = [
  // 1: wide, low, from the belly side. Both cats and the helmet read; the hop arcs read against the sky from a low angle.
  { t: 0.0, p: [1.30, 4.2, 0.80], l: [1.30, 0, 0.30], fov: 42 },
  { t: 2.8, p: [1.30, 3.7, 0.72], l: [1.25, 0, 0.30], fov: 42 },
  // 2: slow push on Maman while she rises and limps; the kitten stays in the frame at the right.
  { t: 5.0, p: [1.30, 3.1, 0.62], l: [1.20, 0, 0.36], fov: 42 },
];
/** Shot 3 (rub and run, left side of Maman): offset from the middle of the two cats [u, w, h]; shot 4 (lying down) likewise. */
// `run` starts low (the trot reads in profile) and rises to a high three-quarter view by the rub: seen from the side the near cat hides the far one.
const FOLLOW = { run: { p: [0.2, -2.6, 0.55], to: [0.3, -1.9, 1.25], by: 7.2, look: 0.22, fov: 38 }, lie: { p: [0.4, 3.0, 0.75], look: 0.18, fov: 42 } };

const smooth = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => smooth((t - a) / (b - a));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export async function setup(game) {
  const { world, cat, npcs, story } = game;
  const maman = npcs.maman;
  if (!maman) throw new Error('[hug] Maman is not built (npcsEnabled is false?)');
  const o = maman.root.position.clone();
  const yaw = maman.root.rotation.y;
  const a = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));         // heading
  const b = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));        // belly side (Npc.hugSpot)
  const ground = (x, z) => world.terrain.heightAt(x, z);
  const at = (u, w) => new THREE.Vector3(o.x + a.x * u + b.x * w, 0, o.z + a.z * u + b.z * w);

  // Maman: lying at her place, paint mark on; the Chavalanche (home on the mountain) is kept out of the shots.
  maman.setPaintMark?.(true);
  maman.setPosition(o.x, ground(o.x, o.z), o.z, yaw);
  maman.setPose('Lie', { instant: true });
  game.npcs.chavalanche?.setVisible(false);

  // Kitten: in front of Maman, facing her, brain scripted so nothing but the scene moves it.
  const k0 = at(LAYOUT.kittenDist, 0);
  const kYaw = Math.atan2(-a.x, -a.z);
  story._placeCat(k0.x, k0.z, kYaw);
  cat.setSword?.(false);
  cat.brain.setHold(false);
  cat.brain.setScripted('idle');
  cat.lookOverride = null;

  // Helmet fallen on the ground beside the kitten, thrown away from Maman and towards the camera side.
  const helmet = cat.helmet;
  let helmetRest = null;
  if (helmet?.onHead) {
    helmet.detach({ side: { x: b.x, z: b.z }, toss: LAYOUT.helmetToss, spin: 5, ground });
    for (let i = 0; i < 480 && !helmet._body?.rest; i++) helmet.update(1 / 60);
    helmetRest = helmet.group.position.clone();
  }

  const has = { hop: cat.hasClip('HopJoy'), rise: !!maman.clips.LimpRise, rubCat: cat.hasClip('Rub'), rubMaman: !!maman.clips.Rub };
  // Maman's route. With LimpRise the displacement is baked in the clip (root stays), handed to the root at the cross-fade.
  const limp = has.rise ? LAYOUT.limpUnits * maman.model.scale.x : LAYOUT.limpDist;
  const gap = LAYOUT.kittenDist - limp;
  const uMeet = limp + LAYOUT.meetShare * gap;
  const walkSecs = TIMING.meet - TIMING.sees;
  const ctx = {
    game, o, a, b, yaw, kYaw, ground, at, maman, cat, world, helmetRest, has, limp, uMeet,
    mamanRate: Math.max(0.4, (1.4 * (uMeet - limp)) / walkSecs / (maman.walkSpeed || 0.5)),
    phase: '', hugged: false, kittenSleeping: false, path: null,
  };
  console.info('[hug] setup', JSON.stringify({ o: o.toArray(), yaw, helmetRest: helmetRest?.toArray() ?? null, has, limp, uMeet, mamanRate: ctx.mamanRate, scale: maman.model.scale.x }));
  return ctx;
}

/** Root position of Maman along `a` (m) at time t. */
function mamanU(ctx, t) {
  const T = TIMING, L = LAYOUT;
  const handOver = ctx.has.rise ? ctx.limp * clamp01((t - T.sees) / T.crossFade) : 0; // baked displacement now carried by the root
  const fallbackLimp = ctx.has.rise ? 0 : L.limpDist * seg(t, T.riseStart + T.limpFrom, T.riseStart + T.riseLen);
  const x = clamp01((t - T.sees) / (T.meet - T.sees));
  const walk = (ctx.uMeet - ctx.limp) * (1 - (1 - x) * (1 - x)); // eased out: she lunges, then slows to reach the kitten
  return ctx.has.rise ? handOver + (t >= T.sees ? walk : 0) : fallbackLimp + (t >= T.sees ? walk : 0);
}

/** Kitten route [u, w] and heading. Before `sees` in place; then to the rub spot; then round Maman's nose to her belly. */
function kittenAt(ctx, t) {
  const T = TIMING, L = LAYOUT;
  const start = [L.kittenDist, 0];
  const rub = [ctx.uMeet + L.rubFwd, -L.rubSide];
  if (t < T.sees + T.surprise) return { u: start[0], w: start[1], yaw: ctx.kYaw, speed: 0 };
  if (t < T.meet) {
    const x = (t - T.sees - T.surprise) / (T.meet - T.sees - T.surprise);
    const e = 1 - (1 - clamp01(x)) * (1 - clamp01(x));
    const u = lerp(start[0], rub[0], e), w = lerp(start[1], rub[1], e);
    const dir = Math.atan2((rub[0] - start[0]) * ctx.a.x + (rub[1] - start[1]) * ctx.b.x, (rub[0] - start[0]) * ctx.a.z + (rub[1] - start[1]) * ctx.b.z);
    return { u, w, yaw: lerp(dir, ctx.kYaw, smooth((x - 0.6) / 0.4)), speed: 1 };
  }
  if (t < T.rubEnd) return { u: rub[0], w: rub[1], yaw: ctx.kYaw, speed: 0 };
  // Round the nose: waypoints in the scene frame, the last one is the hug spot read when the route is built.
  if (!ctx.path) {
    const sp = ctx.maman.hugSpot();
    const d = new THREE.Vector3(sp.x - ctx.o.x, 0, sp.z - ctx.o.z);
    const mu = mamanU(ctx, T.rubEnd);
    ctx.path = [rub, [mu + L.aroundFront, -L.rubSide * 0.8], [mu + L.aroundFront, L.rubSide], [d.dot(ctx.a), d.dot(ctx.b)]];
    ctx.hugYaw = sp.yaw;
  }
  const pts = ctx.path;
  const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const x = clamp01((t - T.rubEnd) / (T.kittenSleep - T.rubEnd)), s = smooth(x) * lens[lens.length - 1];
  let i = 1; while (i < pts.length - 1 && s > lens[i]) i++;
  const k = (s - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
  const u = lerp(pts[i - 1][0], pts[i][0], k), w = lerp(pts[i - 1][1], pts[i][1], k);
  const du = pts[i][0] - pts[i - 1][0], dw = pts[i][1] - pts[i - 1][1];
  const dir = Math.atan2(du * ctx.a.x + dw * ctx.b.x, du * ctx.a.z + dw * ctx.b.z);
  return { u, w, yaw: x >= 1 ? ctx.hugYaw : dir, speed: 1 };
}

export function frame(ctx, t) {
  const { cat, maman } = ctx;
  const T = TIMING;
  const phase = t < T.riseStart ? 'hop' : t < T.sees ? 'rise' : t < T.meet ? 'run' : t < T.lieStart ? 'rub' : t < T.kittenSleep ? 'lie' : 'sleep';
  if (phase !== ctx.phase) { enter(ctx, phase); ctx.phase = phase; }
  if (t >= T.lieStart + T.lieLen && !ctx.hugged) {
    ctx.hugged = true;
    if (!maman.startHug(cat)) console.warn('[hug] startHug refused: Sleep clip missing on Maman');
  }

  const u = mamanU(ctx, t);
  const mp = ctx.at(u, 0);
  maman.setPosition(mp.x, ctx.ground(mp.x, mp.z), mp.z, ctx.yaw);

  if (phase !== 'sleep') {
    const k = kittenAt(ctx, t);
    const kp = ctx.at(k.u, k.w);
    cat.root.position.set(kp.x, ctx.ground(kp.x, kp.z) + hopHeight(ctx, t), kp.z);
    cat.root.rotation.y = k.yaw;
    cat.locomotion.heading = k.yaw;
    cat.lookOverride = phase === 'lie' ? null : maman.rig.head.getWorldPosition(new THREE.Vector3());
  } else {
    if (!ctx.kittenSleeping) {
      ctx.kittenSleeping = true;
      const sp = maman.hugSpot();
      cat.root.position.set(sp.x, ctx.ground(sp.x, sp.z), sp.z);
      cat.root.rotation.y = sp.yaw;
      cat.locomotion.heading = sp.yaw;
      cat.lookOverride = null;
      cat.brain.setScripted('sleep');
    }
  }
  cameraAt(ctx, t);
}

/** Fallback hop height (m) when the HopJoy clip is not in the GLB. */
function hopHeight(ctx, t) {
  if (ctx.has.hop || t >= TIMING.sees + TIMING.surprise) return 0;
  const ph = (t % GAIT.hopPeriod) / GAIT.hopPeriod;
  return GAIT.hopArc * Math.sin(Math.PI * ph);
}

/** Makes a clip of the kitten loop (Cat.js sets LoopOnce on every clip that is not listed as a cycle in its CLIPS table). */
function loopAction(cat, name) {
  const action = cat.actions[name];
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
}

/** One-shot actions at the start of a phase. */
function enter(ctx, phase) {
  const { cat, maman, has } = ctx;
  const T = TIMING;
  if (phase === 'hop') {
    if (has.hop) { cat.play('HopJoy', 0.2); loopAction(cat, 'HopJoy'); } // Cat.js plays unlisted clips once: this one is a loop until Maman sees the kitten
    else cat.play('Idle', 0.2);
  }
  if (phase === 'rise') {
    if (has.rise) maman.setPose('LimpRise', { fade: 0.3, timeScale: maman.duration('LimpRise') / T.riseLen });
    else maman.setPose('Walk', { loop: true, fade: 2.2, timeScale: 0.4 });
  }
  if (phase === 'run') {
    maman.setPose('Walk', { loop: true, fade: T.crossFade, timeScale: ctx.mamanRate });
    const dist = Math.hypot(LAYOUT.kittenDist - ctx.uMeet, LAYOUT.rubSide);
    const v = dist / (T.meet - T.sees - T.surprise) * 1.5; // peak speed of the eased run
    const rate = Math.min(GAIT.kittenRate[1], Math.max(GAIT.kittenRate[0], v / (cat.trotSpeed || 1.8)));
    cat.play(cat.hasClip('Trot') ? 'Trot' : 'Walk', 0.2, rate);
  }
  if (phase === 'rub') {
    if (has.rubMaman) maman.setPose('Rub', { loop: true, fade: 0.3 });
    else maman.setPose('Idle', { loop: true, fade: 0.3 });
    cat.play(has.rubCat ? 'Rub' : 'Idle', 0.3);
    if (has.rubCat) loopAction(cat, 'Rub');
  }
  if (phase === 'lie') {
    maman.setPose('Sleep', { fade: 0.4, freezeAt: T.lieLen });
    cat.play(cat.hasClip('Trot') ? 'Trot' : 'Walk', 0.2, 1);
  }
}

/** Camera: two keyed shots, a cut to the follow shot on the left of Maman, a cut to the belly side, then the game's hug camera. */
function cameraAt(ctx, t) {
  const cam = ctx.world.camera;
  const T = TIMING;
  let s;
  if (t < T.sees) s = keyedCamera(ctx, t);
  else {
    const mid = new THREE.Vector3().addVectors(ctx.maman.root.position, ctx.cat.root.position).multiplyScalar(0.5);
    const F = t < T.rubEnd ? FOLLOW.run : FOLLOW.lie;
    const e = F.to ? seg(t, T.sees, F.by) : 0;
    const P = F.to ? F.p.map((v, i) => lerp(v, F.to[i], e)) : F.p;
    const off = ctx.a.clone().multiplyScalar(P[0]).addScaledVector(ctx.b, P[1]);
    s = { pos: new THREE.Vector3(mid.x + off.x, mid.y + P[2], mid.z + off.z), look: new THREE.Vector3(mid.x, mid.y + F.look, mid.z), fov: F.fov };
    // Slow drift in during each shot (a fixed camera over 4 s would feel dead).
    const t0 = t < T.rubEnd ? T.sees : T.rubEnd, len = t < T.rubEnd ? T.rubEnd - T.sees : T.lieLen + 0.4;
    const drift = 1 - 0.12 * clamp01((t - t0) / len);
    s.pos.sub(s.look).multiplyScalar(drift).add(s.look);
  }
  const k = seg(t, T.lieStart + 0.6, T.lieStart + T.lieLen + 0.4);
  if (k > 0) {
    const h = hugCamera(ctx);
    s = { pos: s.pos.clone().lerp(h.pos, k), look: s.look.clone().lerp(h.look, k), fov: lerp(s.fov, h.fov, k) };
  }
  cam.position.copy(s.pos);
  cam.fov = s.fov;
  cam.updateProjectionMatrix();
  cam.lookAt(s.look);
  cam.updateMatrixWorld(true);
}

function keyedCamera(ctx, t) {
  let i = 0;
  while (i < CAMERA.length - 1 && t >= CAMERA[i + 1].t) i++;
  const A = CAMERA[i], B = CAMERA[Math.min(i + 1, CAMERA.length - 1)];
  const k = A === B ? 0 : seg(t, A.t, B.t);
  const base = ctx.ground(ctx.o.x, ctx.o.z);
  const pt = (arr) => {
    const p = ctx.at(lerp(A[arr][0], B[arr][0], k), lerp(A[arr][1], B[arr][1], k));
    p.y = base + lerp(A[arr][2], B[arr][2], k);
    return p;
  };
  return { pos: pt('p'), look: pt('l'), fov: lerp(A.fov, B.fov, k) };
}

/** Same construction as `Story._hugShot`: belly-side camera, three-quarter front, aimed between the two heads. */
function hugCamera(ctx) {
  const { maman, cat, world } = ctx;
  const H = HUG_CAM;
  maman.root.updateMatrixWorld(true);
  const head = maman.rig.head.getWorldPosition(new THREE.Vector3());
  const kit = cat.root.position;
  const cx = (head.x + kit.x) / 2, cz = (head.z + kit.z) / 2;
  const tanX = Math.tan(THREE.MathUtils.degToRad(42) / 2) * world.camera.aspect;
  const span = Math.hypot(head.x - kit.x, head.z - kit.z) / 2 + H.half;
  const dist = Math.max(H.dist, span / tanX), height = dist * Math.tan(H.tilt);
  const dx = ctx.b.x * Math.cos(H.angle) + ctx.a.x * Math.sin(H.angle);
  const dz = ctx.b.z * Math.cos(H.angle) + ctx.a.z * Math.sin(H.angle);
  const ty = Math.max(kit.y, ctx.ground(cx, cz)) + H.follow;
  return {
    pos: new THREE.Vector3(cx + dx * dist, ty + height, cz + dz * dist),
    look: new THREE.Vector3(cx, ty, cz),
    fov: 42,
  };
}

export function dispose(ctx) {
  ctx.cat.lookOverride = null;
  ctx.cat.brain.setScripted(null);
  ctx.game.npcs.chavalanche?.setVisible(true);
}
