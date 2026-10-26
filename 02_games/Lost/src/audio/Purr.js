/**
 * Ronronnement synthétisé (Web Audio, aucun fichier) : grondement grave (bruit brun filtré
 * à 140 Hz) haché à ~26 Hz comme le vrai ronron, avec une enveloppe de respiration lente.
 * Le contexte audio est créé au premier appel, qui doit suivre un geste de l'utilisateur.
 */
export class Purr {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  _init() {
    const ctx = new AudioContext();
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 140;
    lowpass.Q.value = 0.8;

    // Hachage à 26 Hz : gain modulé par un oscillateur (0,5 ± 0,5).
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const chopOsc = ctx.createOscillator();
    chopOsc.frequency.value = 26;
    const chopDepth = ctx.createGain();
    chopDepth.gain.value = 0.5;
    chopOsc.connect(chopDepth).connect(chop.gain);

    // Respiration : enveloppe lente, inspiration un peu plus aiguë que l'expiration.
    const breath = ctx.createGain();
    breath.gain.value = 0.7;
    const breathOsc = ctx.createOscillator();
    breathOsc.frequency.value = 0.55;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.3;
    breathOsc.connect(breathDepth).connect(breath.gain);
    const pitchDepth = ctx.createGain();
    pitchDepth.gain.value = 3;
    breathOsc.connect(pitchDepth).connect(chopOsc.frequency);

    // Corps : fondamentale douce à 52 Hz, elle aussi hachée.
    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = 52;
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.12;

    const master = ctx.createGain();
    master.gain.value = 0;
    noise.connect(lowpass).connect(chop);
    tone.connect(toneGain).connect(chop);
    chop.connect(breath).connect(master).connect(ctx.destination);
    noise.start(); chopOsc.start(); breathOsc.start(); tone.start();
    this.ctx = ctx;
    this.master = master;
  }

  start() {
    if (!this.ctx) this._init();
    this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.4, now, 0.3);
  }

  stop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.35);
  }
}
