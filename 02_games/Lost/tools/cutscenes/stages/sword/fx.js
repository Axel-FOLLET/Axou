/**
 * Effects of the sword cutscene, all transient and all functions of the story clock (so a re-render of a frame always
 * gives the same image): the glow and trail that let the viewer follow the small sword, the shock ring and the
 * paint/stone debris of the brush impact. Nothing here persists after the video: the game resumes without them.
 */

import * as THREE from 'three';
import { toonMaterial } from '../../../../src/style/palette.js';

/** Settings (m, s). Each value shapes the look of one effect; the reason is on the line. */
export const FX = {
  glow: { size: 0.34, color: 0xffd98a, trail: 7, trailStep: 0.035, fadeAfterCatch: 0.5 }, // sword is 0.35 m long: a halo of its size keeps it readable from 8 m
  flash: { life: 0.5, peak: 0.12, size: 1.6, color: 0xfff1cf },     // white-gold flash on the stone at the impact; as wide as the brush head seen from 3 m
  ring: { life: 0.55, radius: 2.6, width: 0.22, color: 0xffb7a0 },   // shock ring at the impact; about the brush head width times 4
  drops: { count: 46, life: 0.9, speed: [2.2, 5.4], up: [1.2, 3.8], size: [0.025, 0.06], g: 9.8, color: 0xa8201a, dark: 0x5b0f12 }, // paint: BOSS.red of src/game/combat.js and a darker red
  chips: { count: 16, life: 1.1, speed: [1.2, 3.2], up: [1.5, 3.6], size: [0.03, 0.075], g: 9.8 },
  shake: { amp: 0.07, life: 0.28, freq: 38 },                         // camera shake at the impact: strong and short, as a heavy hit
};

/** Deterministic pseudo-random sequence in [0, 1) (mulberry32): the same frame always renders the same. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Glow around the flying sword plus a short trail of fading copies along its recent path. */
export class SwordGlow {
  constructor(parent) {
    this.tex = radialTexture();
    this.sprites = [];
    for (let i = 0; i <= FX.glow.trail; i++) {
      const m = new THREE.SpriteMaterial({
        map: this.tex, color: FX.glow.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.renderOrder = 8;
      parent.add(s);
      this.sprites.push(s);
    }
  }

  /**
   * @param {(tau:number, out:THREE.Vector3) => boolean} positionAt sword position at a story time, false if hidden
   * @param {number} tau current story time
   * @param {number} strength 0..1, overall intensity
   */
  update(positionAt, tau, strength) {
    const p = new THREE.Vector3();
    this.sprites.forEach((s, i) => {
      const ok = strength > 0.001 && positionAt(tau - i * FX.glow.trailStep, p);
      s.visible = ok;
      if (!ok) return;
      s.position.copy(p);
      const k = 1 - i / (FX.glow.trail + 1);
      s.scale.setScalar(FX.glow.size * (i === 0 ? 1.6 : 1) * (0.5 + 0.5 * k));
      s.material.opacity = strength * k * (i === 0 ? 0.9 : 0.55);
    });
  }

  dispose() {
    for (const s of this.sprites) { s.removeFromParent(); s.material.dispose(); }
    this.tex.dispose();
  }
}

/** Shock ring on the ground, paint droplets and stone chips thrown by the impact. */
export class ImpactBurst {
  /**
   * @param {THREE.Object3D} parent
   * @param {THREE.Vector3} origin impact point (ground)
   * @param {THREE.Vector3} dir horizontal unit vector along the brush stroke (boss to stone)
   * @param {number} seed
   * @param {(x:number, z:number) => number} ground ground height
   */
  constructor(parent, origin, dir, seed, ground) {
    this.origin = origin.clone();
    this.ground = ground;
    const rand = rng(seed);

    this.flashTex = radialTexture();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flashTex, color: FX.flash.color, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    this.flash.renderOrder = 9;
    this.flash.visible = false;
    parent.add(this.flash);

    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: FX.ring.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }));
    this.ring.renderOrder = 7;
    this.ring.visible = false;
    parent.add(this.ring);

    const make = (conf, geometry, material) => {
      const mesh = new THREE.InstancedMesh(geometry, material, conf.count);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.visible = false;
      parent.add(mesh);
      const items = [];
      for (let i = 0; i < conf.count; i++) {
        // Spray: mostly sideways to the stroke (the brush flattens against the ground), some forward and up.
        const ang = rand() * Math.PI * 2;
        const hs = conf.speed[0] + rand() * (conf.speed[1] - conf.speed[0]);
        const v = new THREE.Vector3(Math.cos(ang) * hs, conf.up[0] + rand() * (conf.up[1] - conf.up[0]), Math.sin(ang) * hs);
        v.x += dir.x * 0.6; v.z += dir.z * 0.6;
        items.push({
          v,
          size: conf.size[0] + rand() * (conf.size[1] - conf.size[0]),
          spin: new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6),
          start: new THREE.Vector3((rand() - 0.5) * 0.5, 0.05 + rand() * 0.2, (rand() - 0.5) * 0.5),
          tint: rand(),
        });
      }
      return { conf, mesh, items };
    };
    const drop = new THREE.IcosahedronGeometry(1, 1);
    this.drops = make(FX.drops, drop, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    this.drops.items.forEach((it, i) => {
      this.drops.mesh.setColorAt(i, new THREE.Color(it.tint < 0.7 ? FX.drops.color : FX.drops.dark));
    });
    this.chips = make(FX.chips, new THREE.TetrahedronGeometry(1, 0), toonMaterial(0x8d8780, { flatShading: true }));
    this.chips.items.forEach((it, i) => {
      this.chips.mesh.setColorAt(i, new THREE.Color(0x8d8780).multiplyScalar(0.75 + it.tint * 0.5));
    });
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  /**
   * @param {number} age story seconds since the impact (negative before)
   * @param {THREE.Vector3} top point of the stone where the flash is centred
   */
  update(age, top) {
    const Fl = FX.flash;
    const e = age / Fl.life;
    this.flash.visible = e >= 0 && e < 1;
    if (this.flash.visible) {
      this.flash.position.copy(top).y += 0.06;
      this.flash.scale.setScalar(Fl.size * (0.6 + 0.6 * e));
      this.flash.material.opacity = Math.min(1, e < Fl.peak ? e / Fl.peak : 1 - (e - Fl.peak) / (1 - Fl.peak));
    }
    const R = FX.ring;
    const k = age / R.life;
    this.ring.visible = k >= 0 && k < 1;
    if (this.ring.visible) {
      const r = R.radius * (1 - (1 - k) ** 3);
      this.ring.position.copy(this.origin).y += 0.03;
      this.ring.scale.set(r, 1, r);
      this.ring.material.opacity = (1 - k) ** 2 * 0.8;
    }
    for (const group of [this.drops, this.chips]) {
      const { conf, mesh, items } = group;
      mesh.visible = age >= 0 && age < conf.life;
      if (!mesh.visible) continue;
      items.forEach((it, i) => {
        const t = age;
        const p = this._p.copy(this.origin).add(it.start).addScaledVector(it.v, t);
        p.y += -0.5 * conf.g * t * t;
        const g = this.ground(p.x, p.z) + it.size * 0.6;
        let alive = 1;
        if (p.y < g) { p.y = g; alive = 0; }     // landed: gone (the arena floor stays clean for the game that resumes)
        const fade = Math.min(1, (conf.life - t) / 0.2) * alive;
        this._e.set(it.spin.x * t, it.spin.y * t, it.spin.z * t);
        this._q.setFromEuler(this._e);
        this._s.setScalar(Math.max(it.size * fade, 1e-4));
        this._m.compose(p, this._q, this._s);
        mesh.setMatrixAt(i, this._m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    this.flash.removeFromParent();
    this.flash.material.dispose();
    this.flashTex.dispose();
    for (const o of [this.ring, this.drops.mesh, this.chips.mesh]) {
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

/** Camera shake offset (m) at `age` seconds after the impact: decaying noise on the three axes. */
export function shakeOffset(age, out = new THREE.Vector3()) {
  const S = FX.shake;
  if (age < 0 || age > S.life) return out.set(0, 0, 0);
  const k = (1 - age / S.life) ** 2 * S.amp;
  return out.set(Math.sin(age * S.freq) * k, Math.sin(age * S.freq * 1.3 + 1.7) * k, Math.sin(age * S.freq * 0.9 + 3.1) * k);
}
