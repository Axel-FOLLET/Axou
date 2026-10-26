// Aperçu hors navigateur des poses du chat : charge le GLB avec le vrai code de `src/cat`,
// fait avancer la simulation et dessine le nuage de sommets + le squelette en vues
// de côté / de face / de dessus, dans un PNG (une ligne par instant demandé).
//
// Usage (dans WSL) : node tools/pose_preview.mjs <sortie.png> <scénario> [t1,t2,...]
//   scénarios : idle | pet | walk | stretch | groom | sit | lie | sleep | wake | sitpet | liepet | bones
//               (wake : sommeil, puis clic au sol à t = 7 s → réveil puis marche ;
//                sitpet / liepet : assis ou couché, puis papouilles à t = 3 s / 4 s)
//   instants  : secondes depuis le début du scénario (défaut 0,0.5,1,...).
// Exemple : node tools/pose_preview.mjs /tmp/pet.png pet 0,0.8,1.6,2.4,3.2,4,6.4,8,9

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Cat } from '../src/cat/Cat.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const [outFile, scenario = 'idle', timesArg] = process.argv.slice(2);
if (!outFile) { console.error('usage : pose_preview.mjs <sortie.png> <scénario> [t1,t2,...]'); process.exit(1); }
const times = (timesArg ?? '0,0.5,1,1.5,2').split(',').map(Number);

// --- GLB sans matériaux ni images (Node n'a pas de chargeur d'images) ---------------------
function stripGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binStart = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binStart);
  const bin = buf.subarray(binStart + 8, binStart + 8 + binLen);
  delete json.materials; delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.meshes) for (const p of m.primitives) delete p.material;
  let jsonStr = JSON.stringify(json);
  while (jsonStr.length % 4) jsonStr += ' ';
  const jsonBuf = Buffer.from(jsonStr, 'utf8');
  const head = Buffer.alloc(12 + 8);
  head.write('glTF', 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binLen, 8);
  head.writeUInt32LE(jsonBuf.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const binHead = Buffer.alloc(8); binHead.writeUInt32LE(binLen, 0); binHead.writeUInt32LE(0x004e4942, 4);
  const out = Buffer.concat([head, jsonBuf, binHead, bin]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

const glb = stripGlb(fs.readFileSync(path.join(here, '../public/models/cat.glb')));
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(glb, '', res, rej));
const cat = new Cat(gltf);
const root = cat.root;
root.updateMatrixWorld(true);
console.log('clips :', Object.entries(cat.clips).map(([n, c]) => `${n} ${c.duration.toFixed(2)} s`).join(', '));

// `bones` : liste la hiérarchie des os et leurs positions monde au repos, puis s'arrête.
if (scenario === 'bones') {
  const p = new THREE.Vector3();
  const walk = (o, depth) => {
    if (o.isBone) {
      o.getWorldPosition(p);
      console.log(`${'  '.repeat(depth)}${o.name}  (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`);
    }
    o.children.forEach((c) => walk(c, o.isBone ? depth + 1 : depth));
  };
  walk(cat.model, 0);
  process.exit(0);
}

// --- Scénario ------------------------------------------------------------------------------
const pointer = new THREE.Vector3(0.6, 0.3, 1.5);
const start = {
  idle: () => {},
  pet: () => cat.brain.pet(),
  walk: () => cat.brain.walkTo(new THREE.Vector3(0, 0, 3)),
  stretch: () => cat.brain.startFiller('stretch'),
  groom: () => cat.brain.startFiller('groom'),
  sit: () => cat.brain.startFiller('sit'),
  lie: () => cat.brain.startFiller('lie'),
  sleep: () => cat.brain.startFiller('sleep'),
  wake: () => cat.brain.startFiller('sleep'),
  sitpet: () => cat.brain.startFiller('sit'),
  liepet: () => cat.brain.startFiller('lie'),
};
// Seconde action à un instant donné (clic simulé).
const second = {
  wake: [7, () => cat.brain.walkTo(new THREE.Vector3(0, 0, 3))],
  sitpet: [3, () => cat.brain.pet()],
  liepet: [4, () => cat.brain.pet()],
};
if (!start[scenario]) { console.error('scénario inconnu :', scenario); process.exit(1); }

// --- Dessin ----------------------------------------------------------------------------------
const PX = 260;            // pixels par mètre
const VW = 420, VH = 300;  // taille d'une vue
const views = [
  { name: 'côté', px: (p) => [VW / 2 + p.z * PX, VH - 40 - p.y * PX] },
  { name: 'face', px: (p) => [VW / 2 + p.x * PX, VH - 40 - p.y * PX] },
  { name: 'dessus', px: (p) => [VW / 2 + p.x * PX, VH / 2 - p.z * PX] },
];
const W = VW * views.length, H = VH * times.length;
const img = new Uint8Array(W * H * 3).fill(255);
function dot(x, y, r, g, b) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; img[i] = r; img[i + 1] = g; img[i + 2] = b;
}
function line(x0, y0, x1, y1, r, g, b) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) dot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, g, b);
}
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _box = new THREE.Box3();
const lines = [];

let t = 0;
let ti = 0;
let secondDone = false;
start[scenario]();
const DT = 1 / 60;
for (const target of times) {
  while (t < target - 1e-6) {
    if (second[scenario] && !secondDone && t >= second[scenario][0]) { secondDone = true; second[scenario][1](); }
    cat.update(DT, null, pointer); t += DT;
  }
  if (t === 0) cat.update(0, null, pointer);
  root.updateMatrixWorld(true);
  cat.meshes.forEach((m) => m.skeleton.update()); // ce que fait le renderer avant de dessiner
  _box.setFromObject(cat.model, true);
  const oy = ti * VH;
  views.forEach((view, vi) => {
    const ox = vi * VW;
    // sol et cadre
    for (let x = 0; x < VW; x++) { dot(ox + x, oy, 200, 200, 200); dot(ox + x, oy + VH - 1, 200, 200, 200); }
    if (view.name !== 'dessus') for (let x = 0; x < VW; x++) dot(ox + x, oy + VH - 40, 60, 160, 60);
    // nuage de sommets
    for (const m of cat.meshes) {
      const n = m.geometry.getAttribute('position').count;
      for (let i = 0; i < n; i += 2) {
        m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld);
        const [x, y] = view.px(_v); dot(ox + x, oy + y, 170, 170, 170);
      }
    }
    // squelette
    for (const bone of cat.rig.bones.values()) {
      if (!bone.parent?.isBone) continue;
      bone.getWorldPosition(_v); bone.parent.getWorldPosition(_w);
      const [x0, y0] = view.px(_w); const [x1, y1] = view.px(_v);
      line(ox + x0, oy + y0, ox + x1, oy + y1, 200, 30, 30);
    }
    // repères : tête (bleu), hanche (vert)
    for (const [bone, c] of [[cat.rig.head, [30, 60, 220]], [cat.rig.hip, [20, 150, 20]]]) {
      bone.getWorldPosition(_v); const [x, y] = view.px(_v);
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) dot(ox + x + dx, oy + y + dy, ...c);
    }
  });
  const paws = Object.entries(cat.rig.legs).map(([k, l]) => `${k} ${l.paw.getWorldPosition(_v).y.toFixed(3)}`).join('  ');
  // Sommet le plus bas du corps et os qui l'influence le plus (pour comprendre ce qui touche le sol).
  let low = { y: Infinity };
  for (const m of cat.meshes) {
    const n = m.geometry.getAttribute('position').count;
    if (n < 5000) continue;
    const si = m.geometry.getAttribute('skinIndex'); const sw = m.geometry.getAttribute('skinWeight');
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld);
      if (_v.y < low.y) {
        let best = 0; for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
        low = { y: _v.y, x: _v.x, z: _v.z, bone: m.skeleton.bones[si.getComponent(i, best)].name };
      }
    }
  }
  lines.push(`   plus bas : y=${low.y.toFixed(3)} x=${low.x.toFixed(2)} z=${low.z.toFixed(2)} os=${low.bone}`);
  // Articulations des pattes gauches (y, z monde) pour régler les poses.
  const yz = (b) => { b.getWorldPosition(_v); return `(${_v.y.toFixed(2)},${_v.z.toFixed(2)})`; };
  for (const side of ['FL', 'BL']) {
    const l = cat.rig.legs[side];
    lines.push(`   ${side} cuisse ${yz(l.thigh)} tibia ${yz(l.calf)} pied ${yz(l.foot)} patte ${yz(l.paw)}  hanche ${yz(cat.rig.hip)}`);
  }
  const clip = cat.current?.getClip().name;
  lines.push(`t=${target.toFixed(2)} état=${cat.brain.state} clip=${clip} ${cat.current?.time.toFixed(2)}s boîte y=[${_box.min.y.toFixed(3)}, ${_box.max.y.toFixed(3)}] ` +
    `x=[${_box.min.x.toFixed(2)}, ${_box.max.x.toFixed(2)}] z=[${_box.min.z.toFixed(2)}, ${_box.max.z.toFixed(2)}] ` +
    `tête y=${cat.rig.head.getWorldPosition(_v).y.toFixed(3)} sol min=${cat.debug.minY.toFixed(3)} lift=${cat.debug.lift.toFixed(3)} | pattes y : ${paws}`);
  ti++;
}

// --- PNG ---------------------------------------------------------------------------------------
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(b) { let c = -1; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(outFile, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log(lines.join('\n'));
console.log(`écrit ${outFile} (${W}x${H}, vues : ${views.map((v) => v.name).join(' / ')})`);
