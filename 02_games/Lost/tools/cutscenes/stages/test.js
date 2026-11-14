/**
 * Demonstration and check stage of the cutscene tool (tools/cutscenes/capture.mjs): the camera turns around the
 * kitten, which wakes up in the meadow. Copy it to start a scene. The contract of a stage is in tools/README.md.
 */

export const DURATION = 3; // s

/** Sound cues for the timing sheet of the sound mission: `t` in seconds from the start of the scene. */
export const SOUND_CUES = [
  { t: 0.0, cue: 'soft meadow ambience, kitten breathing asleep' },
  { t: 1.5, cue: 'small yawn as the kitten wakes' },
];

const STAGE = {
  radius: 1.1,          // m: camera distance from the kitten
  height: 0.45,         // m: camera height above the ground at the kitten
  lookHeight: 0.15,     // m: point looked at, above the ground (a kitten is about 0.25 m high)
  turn: (2 * Math.PI) / 3, // rad: angle covered by the camera over the whole scene
  startAngle: 0.6,      // rad: where the camera starts, around the vertical axis
  fov: 40,              // degrees
};

/** The kitten is put to sleep at the spot where the game starts, and left alone to wake up. */
export async function setup({ story, cat, world, settle }) {
  story.skipTo('wakeup');
  await settle(0.2);
  return { cat, camera: world.camera };
}

/** Camera on a circle around the kitten, looking at it. */
export function frame({ cat, camera }, t) {
  const angle = STAGE.startAngle + (t / DURATION) * STAGE.turn;
  const { x, y, z } = cat.root.position;
  camera.position.set(x + Math.sin(angle) * STAGE.radius, y + STAGE.height, z + Math.cos(angle) * STAGE.radius);
  camera.lookAt(x, y + STAGE.lookHeight, z);
  camera.fov = STAGE.fov;
  camera.updateProjectionMatrix();
}
