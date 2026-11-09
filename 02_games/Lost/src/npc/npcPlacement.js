import { CHAVALANCHE } from '../game/Chavalanche.js';
import { WIZARD } from '../game/Wizard.js';
import { CLEARING } from '../world/Forest.js';
import { CHURCH } from '../world/Ruins.js';
import { SUMMIT, ZONE2 } from '../world/zone2.js';

/**
 * Where each non-player cat starts, and the ground it blocks. Used by main.js once the cats are created.
 * Footprints are estimates, not measured on the mesh.
 */

const CHURCH_YAW = Math.atan2(-CHURCH.x, -CHURCH.z);
const ARTIST_YAW = Math.atan2(CLEARING.z, -CLEARING.x);
const WIZARD_FORWARD = 1.0; // m ahead of the centre of the nave, towards the door

/** Start of each cat: [x, z, heading in rad]. */
export const NPC_PLACES = {
  chagicien: [CHURCH.x + Math.sin(CHURCH_YAW) * WIZARD_FORWARD, CHURCH.z + Math.cos(CHURCH_YAW) * WIZARD_FORWARD, CHURCH_YAW],
  chartiste: [CLEARING.x, CLEARING.z, ARTIST_YAW],
  maman: [ZONE2.x + SUMMIT.x, SUMMIT.z, -Math.PI / 2],
  chavalanche: [ZONE2.x + CHAVALANCHE.home.x, CHAVALANCHE.home.z, CHAVALANCHE.home.yaw],
};

/** Local boxes [lx, lz, hx, hz] in m (body, and the Chartiste's easel) and radius of grass removed around the cat. */
const NPC_FOOTPRINTS = {
  chagicien: { boxes: [[0, 0, 0.22, 0.4]], grass: 1.0 },
  chartiste: { boxes: [[0, 0, 0.22, 0.4], [-0.25, 0.62, 0.3, 0.18]], grass: 1.3 },
  maman: { boxes: [[0, 0, 0.32, 0.65]], grass: 1.3 },
};

const OBSTACLE_HEIGHT = 0.6; // m

/** Group that holds a cat: the mountain zone or the meadow. */
export function npcHome(kind, world) {
  return kind === 'maman' || kind === 'chavalanche' ? world.mountainGroup : world.meadowGroup;
}

/**
 * Adds the obstacles of the cats to the world and removes the grass under them.
 * The Chavalanche is skipped: it stands up and manages its own obstacle.
 * @param {object} world
 * @param {Record<string, object>} npcs cats by kind
 * @param {object[]} grassExclusions other zones without grass, sent to the grass texture in the same update
 */
export function addNpcObstacles(world, npcs, grassExclusions) {
  const meadowObstacles = [], mountainObstacles = [], grassOff = [...grassExclusions];
  for (const kind of Object.keys(npcs)) {
    if (kind === 'chavalanche') continue;
    const [x, z, yaw] = NPC_PLACES[kind];
    const ground = world.terrain.heightAt(x, z);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const onMountain = x > ZONE2.switchX;
    NPC_FOOTPRINTS[kind].boxes.forEach(([lx, lz, hx, hz], i) => {
      (onMountain ? mountainObstacles : meadowObstacles).push({
        name: `npc_${kind}_${i}`, x: x + lx * c + lz * s, z: z - lx * s + lz * c, hx, hz, rotY: yaw,
        top: ground + OBSTACLE_HEIGHT, ground, height: OBSTACLE_HEIGHT, climbable: false,
      });
    });
    if (!onMountain) grassOff.push({ x, z, r: NPC_FOOTPRINTS[kind].grass });
  }
  world.addObstacles(meadowObstacles, { grass: false });
  world.addMountainObstacles(mountainObstacles);
  grassOff.push({ x: WIZARD.post.x, z: WIZARD.post.z, r: WIZARD.grass }); // the Chagicien's post at the drawbridge
  world.addGrassExclusions(grassOff);
}
