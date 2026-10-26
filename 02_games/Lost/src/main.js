import * as THREE from 'three';
import { World } from './scene/World.js';
import { Cat } from './cat/Cat.js';
import { Picker } from './input/Picker.js';
import { Purr } from './audio/Purr.js';
import { Butterflies } from './critters/Butterflies.js';
import { Yarn } from './critters/Yarn.js';

const hud = document.getElementById('hud');
const world = new World(document.getElementById('app'));

const cat = await Cat.load('./models/cat.glb');
world.scene.add(cat.root);
// Diagnostic : `?fourrure=0` dans l'adresse masque les coques de fourrure (comparer la fluidité).
if (new URLSearchParams(location.search).get('fourrure') === '0') cat.fur.setStep(Infinity);

// Papillons posés sur le sommet des fleurs de la prairie. Les sommets bougent au vent et quand le
// chat écarte les tiges : ces Vector3 (passés par référence) sont recalculés à chaque image.
const meadow = world.meadow;
const flowerTops = meadow.flowerList.map((f) => f.top.clone());
const butterflies = new Butterflies(world.scene, flowerTops);
cat.brain.setButterflies(butterflies);

// Pelote (C, src/critters/Yarn.js) : l'herbe haute la freine.
// Hauteur de l'herbe seule au-dessus du sol (D, fiche 08) : `meadow.heightAt` compte aussi le sol.
const yarn = new Yarn(world.scene, { heightAt: (x, z) => meadow.grassHeightAt(x, z) });
cat.brain.setYarn(yarn);

const purr = new Purr();
const picker = new Picker(world, cat, butterflies, yarn);
picker.onGround = (point) => cat.brain.walkTo(point);
picker.onCat = () => cat.brain.pet();
picker.onYarn = () => cat.brain.yarnThrown();

/**
 * Tactile (mission catgame_monde, P). OrbitControls (three 0.186) : un doigt = rotation (défaut),
 * deux doigts = pincer pour zoomer ; la rotation à deux doigts (DOLLY_ROTATE) remplace le
 * panoramique par défaut (DOLLY_PAN), que World.update annule de toute façon en recentrant la
 * cible sur le chat. OrbitControls pose déjà `touch-action: none` sur le canvas ; index.html le pose
 * aussi sur la page. Safari iOS ignore `touch-action` pour le pincement de page : ses événements
 * `gesture*` (propres à WebKit) sont bloqués ici, ainsi que le double-toucher hors du canvas.
 */
world.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// Lancer vers un point du sol (console : `__throwYarn(x, z)`) : la pelote part de la main du joueur,
// à 0,9 m de haut, 0,3 m devant la caméra en direction du point (horizontalement), et retombe dessus.
const _from = new THREE.Vector3();
function throwYarn(point) {
  const cam = world.camera.position;
  const dx = point.x - cam.x, dz = point.z - cam.z;
  const d = Math.hypot(dx, dz) || 1;
  const k = Math.min(0.3, d) / d;
  _from.set(cam.x + dx * k, world.terrain.heightAt(cam.x + dx * k, cam.z + dz * k) + 0.9, cam.z + dz * k);
  yarn.throwTo(_from, new THREE.Vector3(point.x, 0, point.z));
  return cat.brain.yarnThrown();
}

/**
 * Lancer de la touche P et du bouton (mission catgame_style, fiche 05 points a et phase 2) : la
 * pelote part du chat (`ahead` m devant lui, à `height` m, hors du rayon de contact de son corps)
 * vers l'avant de la caméra (direction horizontale), par `Yarn.throwDir` (C) sans point visé.
 * Force tirée dans `force` : premier impact à force × THROW_RANGE (3,2 m), soit 2,6 à 4,0 m du
 * départ ; la pelote reste dans la prairie (bornes de Yarn, FIELD_RADIUS).
 */
const THROW = { force: [0.8, 1.25], ahead: 0.35, height: 0.45 };
const _fwd = new THREE.Vector3();
const _tFrom = new THREE.Vector3();
function throwForward() {
  world.camera.getWorldDirection(_fwd).setY(0);
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1); // caméra à la verticale (exclu par maxPolarAngle)
  _fwd.normalize();
  const c = cat.root.position;
  const force = THROW.force[0] + Math.random() * (THROW.force[1] - THROW.force[0]);
  _tFrom.set(c.x + _fwd.x * THROW.ahead, c.y + THROW.height, c.z + _fwd.z * THROW.ahead);
  yarn.throwDir(_tFrom, _fwd, force);
  return cat.brain.yarnThrown();
}

// Bouton du HUD et touche P : chaque appui lance aussitôt (une touche tenue ne relance pas :
// `e.repeat` n'est vrai que pour la répétition automatique, pas pour un nouvel appui).
// Bouton déclaré dans index.html (#btn-yarn, style crème/pêche, ≥ 48 px), affiché une fois le
// chat chargé.
const throwBtn = document.getElementById('btn-yarn');
throwBtn.addEventListener('click', () => { throwForward(); throwBtn.blur(); });
throwBtn.hidden = false;

/**
 * Visière du casque (mission catgame_monde : H écrit `src/cat/Helmet.js` avec `setVisor(open)`,
 * D le branche dans Cat.js). Fonction unique pour le bouton et la touche V ; sans casque (pas
 * encore branché), elle ne fait rien et rend `null`. L'état ouvert est lu dans `helmet.visorOpen`
 * s'il existe, sinon suivi ici.
 */
const visorBtn = document.getElementById('btn-visor');
let visorOpenLocal = false;
function visorIsOpen(h) { return typeof h.visorOpen === 'boolean' ? h.visorOpen : visorOpenLocal; }
function toggleVisor() {
  const h = cat.helmet;
  if (!h || typeof h.setVisor !== 'function') return null;
  const open = !visorIsOpen(h);
  h.setVisor(open);
  visorOpenLocal = open;
  updateVisorBtn();
  return open;
}
function updateVisorBtn() {
  const h = cat.helmet;
  const has = !!h && typeof h.setVisor === 'function';
  if (visorBtn.hidden === has) visorBtn.hidden = !has; // bouton seulement si le casque existe
  if (!has) return;
  const label = visorIsOpen(h) ? 'Baisser la visière' : 'Lever la visière';
  if (visorBtn.dataset.label !== label) {
    visorBtn.dataset.label = label;
    visorBtn.innerHTML = `${label} <kbd>(V)</kbd>`;
  }
}
visorBtn.addEventListener('click', () => { toggleVisor(); visorBtn.blur(); });
updateVisorBtn();

/**
 * Caméra au clavier (fiche 05 point c), en plus d'OrbitControls (glisser, molette) : flèches
 * gauche / droite = tourner autour du chat (gauche : la caméra part vers sa gauche), haut / bas =
 * monter / descendre l'angle, + / − (et pavé numérique) = zoom. Un appui donne un cran (`step`),
 * une touche tenue tourne en continu (`rate`, par seconde). Les limites d'OrbitControls
 * (minDistance, maxDistance, min/maxPolarAngle) sont appliquées ici aussi.
 */
const CAM_KEYS = {
  left: { theta: -1 }, right: { theta: 1 }, up: { phi: -1 }, down: { phi: 1 }, in: { zoom: -1 }, out: { zoom: 1 },
};
const CAM_RATE = { theta: 1.6, phi: 0.9, zoom: 1.2 }; // rad/s, rad/s, log du rayon par seconde
const CAM_STEP = { theta: 0.12, phi: 0.08, zoom: 0.1 };
const camHeld = new Map(); // code de touche → action (le relâchement est retrouvé par le code)
const _off = new THREE.Vector3();
const _sph = new THREE.Spherical();
function camAction(e) {
  switch (e.key) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case '+': case '=': return 'in';
    case '-': case '_': return 'out';
  }
  if (e.code === 'NumpadAdd') return 'in';
  if (e.code === 'NumpadSubtract') return 'out';
  return null;
}
function orbitCamera(k) {
  const c = world.controls, cam = world.camera;
  let theta = 0, phi = 0, zoom = 0;
  for (const [name, f] of Object.entries(k)) {
    const a = CAM_KEYS[name];
    theta += (a.theta ?? 0) * f.theta; phi += (a.phi ?? 0) * f.phi; zoom += (a.zoom ?? 0) * f.zoom;
  }
  if (!theta && !phi && !zoom) return;
  _off.copy(cam.position).sub(c.target);
  _sph.setFromVector3(_off);
  _sph.theta += theta;
  _sph.phi = THREE.MathUtils.clamp(_sph.phi + phi, Math.max(c.minPolarAngle, 0.05), c.maxPolarAngle);
  _sph.radius = THREE.MathUtils.clamp(_sph.radius * Math.exp(zoom), c.minDistance, c.maxDistance);
  cam.position.copy(c.target).add(_off.setFromSpherical(_sph));
}
function camHeldUpdate(dt) {
  if (!camHeld.size) return;
  const k = {};
  for (const name of new Set(camHeld.values())) {
    k[name] = { theta: CAM_RATE.theta * dt, phi: CAM_RATE.phi * dt, zoom: CAM_RATE.zoom * dt };
  }
  orbitCamera(k);
}

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl + / − : zoom du navigateur, pas du jeu
  if (e.key === 'p' || e.key === 'P') {
    if (!e.repeat) throwForward();
    return;
  }
  if (e.key === 'v' || e.key === 'V') {
    if (!e.repeat) toggleVisor();
    return;
  }
  const action = camAction(e);
  if (!action) return;
  e.preventDefault();
  if (e.repeat || camHeld.has(e.code)) return;
  camHeld.set(e.code, action);
  orbitCamera({ [action]: CAM_STEP });
});
addEventListener('keyup', (e) => { camHeld.delete(e.code); });
addEventListener('blur', () => camHeld.clear());

cat.onState = (state) => { if (state === 'pet') purr.start(); else purr.stop(); };

const STATES = {
  idle: 'au repos', walk: 'marche', run: 'court', pet: 'papouilles', sit: 'assis', lie: 'couché', stretch: 'étirement',
  groom: 'toilette', sleep: 'dort', wake: 'se réveille',
  approach: 'repère un papillon', stalk: "à l'affût", pounce: 'bondit',
  chase: 'court après la pelote', bat: 'joue avec la pelote',
};
const HUNT_TEXT = { caught: 'attrapé… il s’échappe', missed: 'raté !' };
let meowUntil = 0, huntText = '', huntUntil = 0, playText = '', playUntil = 0;
cat.brain.onPlay = (what) => {
  if (what !== 'tired') return;
  playText = 'lassé de la pelote';
  playUntil = performance.now() + 2000;
};
cat.brain.onMeow = () => { meowUntil = performance.now() + 1500; };
cat.brain.onHunt = (result) => {
  if (!HUNT_TEXT[result]) return; // abandon : rien à afficher
  huntText = HUNT_TEXT[result];
  huntUntil = performance.now() + 2000;
};

/**
 * HUD toutes plateformes (mission catgame_monde, P) : ligne d'état toujours visible, aide en liste
 * repliable (bouton « Aide »), images par seconde sous l'aide. Aide souris/clavier ou tactile :
 * mode de départ par `matchMedia('(pointer: coarse)')`, puis celui du dernier appui sur le canvas
 * (Picker.onPointerType). Petit écran (≤ 600 px de large ou ≤ 500 px de haut) : aide repliée au
 * départ pour ne pas cacher la scène.
 */
const HELP = {
  mouse: [
    ['clic sol', 'marcher (loin : courir)'],
    ['clic chat', 'papouilles'],
    ['clic papillon', 'chasser'],
    ['clic pelote', 'jouer'],
    ['P ou bouton', 'lancer la pelote'],
    ['V ou bouton', 'visière du casque'],
    ['glisser ou flèches', 'tourner la caméra'],
    ['molette ou + / −', 'zoomer'],
  ],
  touch: [
    ['toucher le sol', 'marcher (loin : courir)'],
    ['toucher le chat', 'papouilles'],
    ['toucher un papillon', 'chasser'],
    ['toucher la pelote', 'jouer'],
    ['bouton pelote', 'lancer la pelote'],
    ['bouton visière', 'casque'],
    ['glisser un doigt', 'tourner la caméra'],
    ['pincer', 'zoomer'],
  ],
};
const hudState = document.getElementById('hud-state');
const hudHelp = document.getElementById('hud-help');
const hudFps = document.getElementById('hud-fps');
const hudToggle = document.getElementById('hud-toggle');
const coarse = matchMedia('(pointer: coarse)');
const smallScreen = matchMedia('(max-width: 600px), (max-height: 500px)');
let inputMode = coarse.matches ? 'touch' : 'mouse';
function renderHelp() {
  hudHelp.replaceChildren(...HELP[inputMode].map(([k, v]) => {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = k;
    li.append(b, ` : ${v}`);
    return li;
  }));
  document.body.classList.toggle('touch', inputMode === 'touch');
}
function setInputMode(mode) {
  const m = mode === 'mouse' ? 'mouse' : 'touch'; // stylet : aide tactile
  if (m === inputMode) return;
  inputMode = m;
  renderHelp();
}
function setHelpOpen(open) {
  hud.classList.toggle('collapsed', !open);
  hudToggle.setAttribute('aria-expanded', String(open));
  hudToggle.textContent = open ? 'Masquer' : 'Aide';
}
picker.onPointerType = setInputMode;
hudToggle.addEventListener('click', () => {
  setHelpOpen(hud.classList.contains('collapsed'));
  hudToggle.blur();
});
renderHelp();
setHelpOpen(!smallScreen.matches);
hudToggle.hidden = false;
let hudStateText = '', hudFpsText = '';

const timer = new THREE.Timer();
// Images par seconde, moyennées sur 1 s et affichées dans le HUD. Qualité adaptative : sous
// 40 i/s (après 2 s de chargement), on baisse d'un cran par seconde, sans jamais remonter.
// Ordre : résolution ramenée à 1, puis on alterne prairie et fourrure, la prairie d'abord à chaque
// palier : à densité 0,75 l'herbe reste dense à l'œil (brins serrés, brouillard) alors qu'une coque
// de fourrure sur 2 se voit sur le chat, sujet du jeu. La fourrure reste la principale charge
// (retour de l'utilisateur, 2026-10-22 : « bcp mieux » avec `?fourrure=0`) ; la prairie (B)
// propose 4 niveaux sans recompilation (densité 1 ; 0,75 ; 0,55 ; 0,4).
const QUALITY = [
  () => {},
  () => world.renderer.setPixelRatio(1),
  () => meadow.setQuality(1),
  () => cat.fur.setStep(2),
  () => meadow.setQuality(2),
  () => cat.fur.setStep(3),
  () => meadow.setQuality(3),
];
let quality = 0;
/**
 * Petits appareils (mission catgame_monde, P) : écran tactile (`pointer: coarse`) ou petit écran
 * au chargement. Résolution plafonnée à 1,5 au lieu de 2 (World.js) et prairie au cran 1 dès le
 * départ ; la qualité adaptative continue ensuite à baisser si besoin (crans déjà appliqués sautés).
 */
const lowStart = coarse.matches || smallScreen.matches;
const preApplied = new Set();
if (lowStart) {
  world.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  meadow.setQuality?.(1);
  preApplied.add(2); // QUALITY[2] = meadow.setQuality(1)
}
if (world.renderer.getPixelRatio() <= 1) quality = 1;
/** Nombre de crans de QUALITY appliqués (y compris ceux du départ réduit). */
function qualityApplied() {
  let n = quality;
  for (const i of preApplied) if (i > quality) n++;
  return n;
}
function lowerQuality() {
  while (quality < QUALITY.length - 1) {
    quality++;
    if (!preApplied.has(quality)) { QUALITY[quality](); return; }
  }
}
let fps = 0, fpsFrames = 0, fpsTime = 0, warmup = 2;
world.renderer.setAnimationLoop(() => {
  timer.update();
  const raw = timer.getDelta();
  fpsFrames++; fpsTime += raw;
  if (fpsTime >= 1) {
    fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0;
    if (warmup > 0) warmup--;
    else if (fps < 40 && quality < QUALITY.length - 1) lowerQuality();
  }
  // Plafond de 0,1 s : sous 10 i/s seulement, le chat passe au ralenti (0,05 s auparavant :
  // ralenti dès 20 i/s).
  const dt = Math.min(raw, 0.1);
  cat.update(dt, world, picker.pointerWorld);
  yarn.update(dt, cat.root.position); // après le chat : poussée de cette image, contact avec son corps
  // Sommets des fleurs de cette image (vent et tiges écartées de l'image précédente : la prairie
  // est mise à jour dans world.update, après), puis les papillons, puis le rendu.
  for (let i = 0; i < flowerTops.length; i++) meadow.flowerTop(i, flowerTops[i]);
  butterflies.update(dt, cat.root.position, { pouncing: cat.brain.pouncing });
  camHeldUpdate(dt); // touches de caméra tenues, avant OrbitControls (world.update)
  world.update(dt, cat.root.position);
  const now = performance.now();
  const meow = now < meowUntil ? '  —  miaou !' : '';
  const hunt = now < huntUntil ? `  —  ${huntText}` : '';
  const play = now < playUntil ? `  —  ${playText}` : '';
  // Le DOM n'est réécrit que si le texte change (pas de mise en page à chaque image).
  const stateText = `chat : ${STATES[cat.brain.state] ?? cat.brain.state}${meow}${hunt}${play}`;
  if (stateText !== hudStateText) hudState.textContent = hudStateText = stateText;
  const fpsText = `${fps} i/s, qualité ${QUALITY.length - 1 - qualityApplied()}/${QUALITY.length - 1}`;
  if (fpsText !== hudFpsText) hudFps.textContent = hudFpsText = fpsText;
  updateVisorBtn(); // le casque peut être branché après le chargement (D)
});

// Accès de débogage (console, Playwright)
window.__cat = cat;
window.__world = world;
window.__butterflies = butterflies;
window.__yarn = yarn;
window.__throwYarn = (x, z) => throwYarn({ x, z });
window.__pressThrow = () => throwForward(); // équivalent de la touche P ; retourne yarnThrown()
// Caméra : distance au point visé, azimut et angle polaire (rad) d'OrbitControls.
window.__camera = () => ({
  dist: world.controls.getDistance(),
  azimuth: world.controls.getAzimuthalAngle(),
  polar: world.controls.getPolarAngle(),
});
// Mission catgame_monde (P), commandes de test du chef : même lecture avec des noms longs (rad),
// visière, et état de l'interface (mode d'aide, aide ouverte, petit écran, qualité).
window.__camState = () => ({
  distance: world.controls.getDistance(),
  azimuth: world.controls.getAzimuthalAngle(),
  polar: world.controls.getPolarAngle(),
});
window.__toggleVisor = () => toggleVisor(); // null sans casque, sinon true (ouverte) / false
window.__ui = () => ({
  inputMode,
  coarse: coarse.matches,
  smallScreen: smallScreen.matches,
  helpOpen: !hud.classList.contains('collapsed'),
  visorButton: !visorBtn.hidden,
  pixelRatio: world.renderer.getPixelRatio(),
  quality: `${QUALITY.length - 1 - qualityApplied()}/${QUALITY.length - 1}`,
  viewport: [innerWidth, innerHeight],
});
