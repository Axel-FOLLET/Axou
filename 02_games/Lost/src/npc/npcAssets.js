import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Shared loading of the NPC cat model. Used by Npc.js and main.js.
 *
 * - `cat.glb` is loaded once for all NPCs: the promise is cached, then each NPC clones the GLB scene
 *   (SkeletonUtils.clone, see Npc.js) and shares its geometries.
 * - This load is separate from the hero's (`Cat.load` in main.js): the hero alters its own scene (fur, helmet,
 *   skin weights), so that scene cannot serve as a clean template.
 */
export const NPC_MODEL_URL = './models/cat.glb';

let _promise = null;
let _gltf = null;

/**
 * Loads the GLB once (later calls return the same promise).
 * @param {string} [url]
 * @returns {Promise<object>} GLTFLoader result (`scene`, `animations`)
 */
export function loadNpcAssets(url = NPC_MODEL_URL) {
  if (!_promise) {
    _promise = new GLTFLoader().loadAsync(url).then((gltf) => { _gltf = gltf; return gltf; });
    // On failure, the next call retries the load.
    _promise.catch(() => { _promise = null; });
  }
  return _promise;
}

/** Loaded GLB, or null until `loadNpcAssets` has completed. */
export function getNpcAssets() {
  return _gltf;
}

/**
 * NPCs are enabled unless the URL has `?npc=0`.
 * @param {string} [search] query string (defaults to `location.search`)
 * @returns {boolean}
 */
export function npcsEnabled(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('npc') !== '0';
}
