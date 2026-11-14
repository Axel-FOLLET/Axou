/**
 * Cutscene 1, first part: the chase (about 36 s). Captured by `tools/cutscenes/capture.mjs arrival_chase`, assembled with
 * the kitten's fall by `tools/cutscenes/assemble.mjs` into `public/videos/cutscene_arrival.mp4`.
 *
 * Story (roadmap, session 11 B): Maman runs down a snowy mountain with her armoured kitten in her mouth, close up and
 * seen from the front. Paint blasts fall around her and blow the firs away; the view pulls back and reveals the giant
 * Chartiste in his boss form, brush in the paw, who lets out a cry of rage. Back on Maman, in several angles, the barrage
 * closes in; she catches her paw on a rock, the kitten flies out of her mouth, she panics and sees it (the viewer does
 * not), a violet blast separates them, she bolts away sideways, and the screen goes black.
 *
 * The scene is built from the game's own pieces (Npc, Cat, Armor, snow zone shapes, Mountains) and a few modules of its own
 * in `arrival_chase/`: `tuning.js` (every value, with unit and reason), `ground.js` and `path.js` (slope and Maman's way),
 * `slope.js` (mesh, firs, rocks, peaks), `blasts.js` (paint), `actors.js` (Maman, kitten, Chartiste, snow puffs),
 * `shots.js` (camera). Everything is a function of the clock `t` or an event keyed on it, so a capture started later
 * shows the same pictures as a full one.
 */
import * as THREE from 'three';
import { Snowfall } from '../../../src/world/Snowfall.js';
import { BLASTS, CLOCK, MOOD, RUN } from './arrival_chase/tuning.js';
import { makeGround, smoothstep } from './arrival_chase/ground.js';
import { buildPath } from './arrival_chase/path.js';
import { PaintBlasts, planBlasts } from './arrival_chase/blasts.js';
import { Slope } from './arrival_chase/slope.js';
import { Actors } from './arrival_chase/actors.js';
import { Director } from './arrival_chase/shots.js';

export const DURATION = CLOCK.duration;

/**
 * Sound cues for mission 11 B2 (s from the start of this scene; the assembled video adds nothing before it). Nothing is
 * played by the video itself. The game's music does not play during cutscene 1 (it has its own, 11 B2).
 */
export const SOUND_CUES = [
  { t: 0.0, cue: 'wind on a high snow slope with light snowfall, a bed that stays under everything' },
  { t: 0.0, cue: 'Maman gallop on soft snow, about 5.7 paw falls per second (run clip cycle 0.333 s at rate 0.95), heavy tired breaths between' },
  { t: 0.0, cue: 'kitten armour: faint metal clinks at each stride (plates swinging on a limp body), until the release' },
  { t: 2.4, cue: 'Maman glances back: short frightened breath' },
  ...BLASTS.filter((b) => b.from === 'sky').map((b) => ({ t: b.t - 0.9, cue: `paint shell whistles down (rising whistle, ${b.t - 0.9 < 5 ? 'first' : 'next'} one)` })),
  ...BLASTS.filter((b) => b.from === 'far').map((b) => ({ t: b.t - 2.7, cue: 'thrown paint ball whooshes through the air from very far (long, low whoosh that gets closer)' })),
  ...BLASTS.map((b, i) => ({
    t: b.t,
    cue: `${b.c === 3 ? 'VIOLET ' : ''}paint blast ${i + 1}/${BLASTS.length}: wet burst and low boom, radius ${b.r} m, ${b.from === 'far' ? 'distant origin' : 'close'}`,
  })),
  ...BLASTS.filter((b) => b.trees).map((b) => ({ t: b.t + 0.15, cue: `firs torn away and thrown (wood cracks, branches, tumble thuds) after blast at ${b.t} s` })),
  { t: CLOCK.cry - 0.4, cue: 'the giant takes a huge breath (deep inhale, felt more than heard)' },
  { t: CLOCK.cry, cue: 'Chartiste cry of rage: enormous, hoarse roar of a cat, shakes the valley (long, 2.5 s)' },
  { t: CLOCK.catch + 0.15, cue: 'Maman right front paw catches the rock: stone knock and a sharp gasp' },
  { t: CLOCK.catch + 0.35, cue: 'Maman dives forward and slides on the snow (body scrape, 1.2 s)' },
  { t: CLOCK.release, cue: 'the kitten leaves her mouth: Maman exhales a cry; kitten armour rattles as it flies (1.2 s of tumbling clinks)' },
  { t: CLOCK.release + 0.9, cue: 'Maman panicked meowing, then a long scream-like call (until the separating blast)' },
  { t: CLOCK.fleeStart, cue: 'Maman scrambles and bolts away: snow thrown by the paws, fast steps (to the end), panting' },
  { t: CLOCK.blackFrom, cue: 'everything falls silent with the fade to black (tail of the blast fades, the wind stays a moment)' },
];

/** Times (s) and targets of the head glances, see `gaze`. */
const GLANCES = [
  { from: 2.4, to: 3.2, weight: 0.35, behind: [0.8, 4.0, 0.5] },    // a short flick over her shoulder, small enough to keep her face lit and readable: she is fleeing from something behind
  { from: 16.1, to: 17.4, weight: 0.8, behind: [-1.0, 5.0, 0.5] },
];

/** Smooth in-and-out of a window [from, to] with fades of `fade` s. */
function window01(t, from, to, fade = 0.25) {
  return smoothstep(from, from + fade, t) * (1 - smoothstep(to - fade, to, t));
}

/** Full-screen colour layer over the picture (flash and fade to black), drawn last without a camera. */
class Fade {
  constructor(scene) {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0x000000) }, uAlpha: { value: 0 } },
        vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; void main() { gl_FragColor = vec4(uColor, uAlpha); }',
        transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
      }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
    this.mesh.visible = false;
    this.mesh.raycast = () => {};
    scene.add(this.mesh);
  }

  /** Cream flash after each of the two biggest blasts, then the fade to black. */
  update(t, blasts) {
    const u = this.mesh.material.uniforms;
    let alpha = 0;
    if (t >= CLOCK.blackFrom) {
      u.uColor.value.set(0x000000);
      alpha = smoothstep(CLOCK.blackFrom, CLOCK.blackFull, t);
    } else {
      u.uColor.value.set(0xfff3c4);
      for (const b of blasts) if (b.c === 3 && t >= b.t) alpha = Math.max(alpha, 0.5 * Math.exp(-(t - b.t) * 9));
    }
    u.uAlpha.value = alpha;
    this.mesh.visible = alpha > 0.002;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export async function setup(game) {
  const { world } = game;
  const saved = {
    fog: { near: world.scene.fog.near, far: world.scene.fog.far },
    sky: Object.fromEntries(Object.entries(world.sky.material.uniforms).filter(([k]) => k !== 'sunDir').map(([k, v]) => [k, v.value.clone()])),
    sunDir: world.sky.material.uniforms.sunDir.value.clone(),
    sunOffset: world.sunOffset.clone(),
    sunColor: world.sun.color.clone(),
    sunIntensity: world.sun.intensity,
    shadow: { l: world.sun.shadow.camera.left, r: world.sun.shadow.camera.right, t: world.sun.shadow.camera.top, b: world.sun.shadow.camera.bottom, far: world.sun.shadow.camera.far },
    meadowIn: world.meadowGroup.parent === world.scene,
    mountainIn: world.mountainGroup.parent === world.scene,
    fov: world.camera.fov,
  };

  // The snow zone and the meadow leave the picture: this scene is another mountain.
  world.scene.remove(world.meadowGroup);
  world.scene.remove(world.mountainGroup);
  world.scene.fog.near = MOOD.fog.near;
  world.scene.fog.far = MOOD.fog.far;
  for (const [k, hex] of Object.entries(MOOD.sky)) world.sky.material.uniforms[k].value.set(hex);
  world.sunOffset.set(...MOOD.sunOffset);
  world.sky.material.uniforms.sunDir.value.copy(world.sunOffset).normalize();
  world.sun.color.set(MOOD.sunColor);
  world.sun.intensity = MOOD.sunIntensity;
  const sc = world.sun.shadow.camera;
  sc.left = sc.bottom = -MOOD.shadowHalf;
  sc.right = sc.top = MOOD.shadowHalf;
  sc.far = MOOD.shadowFar;
  sc.updateProjectionMatrix();

  // Maman's speed on the run clip decides where she is at each instant, so the actors are built first (they only read the clip).
  const maman = game.npcs.maman;
  const duration = maman.duration('run');
  if (!duration) throw new Error('[chase] the run clip is missing');
  const runSpeed = (RUN.strideUnits * maman.model.scale.x / duration) * RUN.rate;
  const path = buildPath(runSpeed);
  const ground = makeGround((x, z) => path.distance(x, z));
  const plan = planBlasts(path, ground);

  const root = new THREE.Group();
  root.name = 'ChaseWorld';
  world.scene.add(root);
  const actors = new Actors(game, { path, ground });
  const slope = new Slope(root, { ground, path, plan, sunDir: world.sunOffset });
  const blasts = new PaintBlasts(root, plan, ground, actors.chartistePos);
  const snowfall = new Snowfall(root);
  const fade = new Fade(world.scene);
  const director = new Director({ world, path, ground, blasts, actors });

  console.info('[chase] setup', JSON.stringify({
    runSpeed: Number(runSpeed.toFixed(3)), runCycle: duration, ...slope.stats,
    stumbleRock: slope.stumbleRock, clips: actors.has, chartiste: actors.chartistePos.toArray(),
    catchPoint: path.at(CLOCK.catch), end: path.at(CLOCK.duration),
  }));
  return { game, world, saved, root, actors, slope, blasts, snowfall, fade, director, path, ground, plan };
}

/** Where Maman's head turns and how open her jaw is, at clock t. */
function gaze(ctx, t) {
  const { path, ground, actors, plan } = ctx;
  const p = path.at(t);
  const P = new THREE.Vector3(p.x, ground.heightAt(p.x, p.z), p.z);
  const f = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)), l = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  let target = null, weight = 0, jaw = 0;
  const take = (w, at) => { if (w > weight) { weight = w; target = at(); } };

  for (const g of GLANCES) {
    take(g.weight * window01(t, g.from, g.to), () => P.clone().addScaledVector(l, g.behind[0]).addScaledVector(f, -g.behind[1]).add(new THREE.Vector3(0, g.behind[2], 0)));
  }
  // She hears the big blast burst behind her (the 19.4 s blast).
  const big = plan.find((b) => b.t === 19.4);
  if (big) take(0.45 * window01(t, 19.1, 20.3), () => new THREE.Vector3(big.x, big.y + 2.5, big.z));
  // After the release she follows the kitten, then looks where it went; jaw open on the release, then panicking.
  if (t >= CLOCK.catch) {
    take(window01(t, CLOCK.release + 0.1, CLOCK.kittenGone, 0.2), () => actors.kittenPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)));
    take(0.9 * window01(t, CLOCK.kittenGone - 0.3, CLOCK.separation + 0.5, 0.4), () => {
      const q = path.at(CLOCK.release);
      return new THREE.Vector3(q.x + Math.sin(q.yaw) * 14, ground.heightAt(q.x, q.z) + 3, q.z + Math.cos(q.yaw) * 14);
    });
    const gasp = 0.3 * window01(t, CLOCK.catch, CLOCK.release, 0.1);
    const scream = window01(t, CLOCK.release - 0.05, CLOCK.separation + 0.6, 0.1) * (0.55 + 0.25 * Math.sin(t * 11));
    jaw = Math.max(gasp, scream * (t < CLOCK.release + 0.5 ? 1.2 : 0.8));
  }
  return { target, weight, jaw: Math.min(jaw, 1) };
}

export function frame(ctx, t, dt) {
  const { world, actors, slope, blasts, snowfall, fade, director, plan } = ctx;
  actors.update(t, dt, gaze(ctx, t));
  slope.update(t);
  blasts.update(t);
  snowfall.update(dt);
  director.frame(t);
  fade.update(t, plan);

  // Sun and its shadow box follow Maman (the game's own box follows its kitten and is only 4 m wide).
  const c = actors.maman.root.position;
  world.sun.position.set(c.x, c.y + 0.5, c.z).add(world.sunOffset);
  world.sun.target.position.set(c.x, c.y + 0.5, c.z);
  world.sun.target.updateMatrixWorld();
  world.sun.updateMatrixWorld();
}

export function dispose(ctx) {
  const { world, saved } = ctx;
  ctx.fade.dispose();
  ctx.snowfall.group.removeFromParent();
  ctx.blasts.dispose();
  ctx.slope.dispose();
  ctx.actors.dispose();
  ctx.root.removeFromParent();
  if (saved.meadowIn) world.scene.add(world.meadowGroup);
  if (saved.mountainIn) world.scene.add(world.mountainGroup);
  world.scene.fog.near = saved.fog.near;
  world.scene.fog.far = saved.fog.far;
  for (const [k, v] of Object.entries(saved.sky)) world.sky.material.uniforms[k].value.copy(v);
  world.sky.material.uniforms.sunDir.value.copy(saved.sunDir);
  world.sunOffset.copy(saved.sunOffset);
  world.sun.color.copy(saved.sunColor);
  world.sun.intensity = saved.sunIntensity;
  const sc = world.sun.shadow.camera;
  sc.left = saved.shadow.l; sc.right = saved.shadow.r; sc.top = saved.shadow.t; sc.bottom = saved.shadow.b; sc.far = saved.shadow.far;
  sc.updateProjectionMatrix();
  world.camera.fov = saved.fov;
  world.camera.updateProjectionMatrix();
}

