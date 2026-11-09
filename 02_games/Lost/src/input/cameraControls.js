import * as THREE from 'three';

/**
 * Camera input added to OrbitControls: keyboard (arrows orbit, + and - zoom) and touch settings.
 * Used by main.js.
 */

const KEY_ACTIONS = {
  left: { theta: -1 }, right: { theta: 1 }, up: { phi: -1 }, down: { phi: 1 }, in: { zoom: -1 }, out: { zoom: 1 },
};
const HOLD_RATE = { theta: 1.6, phi: 0.9, zoom: 1.2 }; // rad/s, rad/s, log of the radius per second, while a key is held
const PRESS_STEP = { theta: 0.12, phi: 0.08, zoom: 0.1 }; // same units, for one key press
const MIN_POLAR = 0.05; // rad: never exactly above the target

function actionOf(event) {
  switch (event.key) {
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case '+': case '=': return 'in';
    case '-': case '_': return 'out';
  }
  if (event.code === 'NumpadAdd') return 'in';
  if (event.code === 'NumpadSubtract') return 'out';
  return null;
}

/**
 * Listens to the camera keys. Same limits as OrbitControls.
 * @param {object} world provides `controls` and `camera`
 * @returns {(dt: number) => void} per-frame update for held keys, to call before OrbitControls updates
 */
export function installCameraKeys(world) {
  const held = new Map(); // key code → action, so that the release finds it
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();

  function orbit(moves) {
    const controls = world.controls, camera = world.camera;
    let theta = 0, phi = 0, zoom = 0;
    for (const [name, amount] of Object.entries(moves)) {
      const action = KEY_ACTIONS[name];
      theta += (action.theta ?? 0) * amount.theta;
      phi += (action.phi ?? 0) * amount.phi;
      zoom += (action.zoom ?? 0) * amount.zoom;
    }
    if (!theta && !phi && !zoom) return;
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    spherical.theta += theta;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + phi, Math.max(controls.minPolarAngle, MIN_POLAR), controls.maxPolarAngle);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * Math.exp(zoom), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
  }

  addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return; // leaves the browser zoom alone
    const action = actionOf(event);
    if (!action) return;
    event.preventDefault();
    if (event.repeat || held.has(event.code)) return;
    held.set(event.code, action);
    orbit({ [action]: PRESS_STEP });
  });
  addEventListener('keyup', (event) => { held.delete(event.code); });
  addEventListener('blur', () => held.clear());

  return (dt) => {
    if (!held.size) return;
    const moves = {};
    for (const name of new Set(held.values())) {
      moves[name] = { theta: HOLD_RATE.theta * dt, phi: HOLD_RATE.phi * dt, zoom: HOLD_RATE.zoom * dt };
    }
    orbit(moves);
  };
}

/**
 * Touch: one finger orbits, two fingers pinch and rotate. The page itself never zooms: Safari ignores
 * `touch-action` for pinches, so its gesture events are blocked, and so is the browser's double-tap zoom
 * (the game detects double clicks itself, in Picker.js).
 */
export function installTouchControls(world) {
  world.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
}
