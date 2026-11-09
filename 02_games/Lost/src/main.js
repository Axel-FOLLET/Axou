import * as THREE from 'three';
import { World } from './scene/World.js';
import { AdaptiveQuality } from './scene/AdaptiveQuality.js';
import { Cat } from './cat/Cat.js';
import { Picker } from './input/Picker.js';
import { installCameraKeys, installTouchControls } from './input/cameraControls.js';
import { Purr } from './audio/Purr.js';
import { VOLUMES } from './audio/volumes.js';
import { Music } from './audio/Music.js';
import { connectSoundtrack } from './audio/soundtrack.js';
import { SnowSteps } from './audio/SnowSteps.js';
import { CombatSfx } from './audio/CombatSfx.js';
import { Butterflies } from './critters/Butterflies.js';
import { WALL_CLEARANCE } from './critters/Butterfly.js';
import { keepInsideRampart, RETURN_LOOK } from './world/Rampart.js';
import { Yarn } from './critters/Yarn.js';
import { Launchers } from './critters/Launcher.js';
import { Npc } from './npc/Npc.js';
import { loadNpcAssets, npcsEnabled } from './npc/npcAssets.js';
import { NPC_PLACES, addNpcObstacles, npcHome } from './npc/npcPlacement.js';
import { MiniMap } from './ui/MiniMap.js';
import { BossBar } from './ui/BossBar.js';
import { Story } from './game/Story.js';
import { EndScreen } from './game/EndScreen.js';
import { Occlusion } from './game/Occlusion.js';
import { BOSS } from './game/combat.js';
import { Chavalanche } from './game/Chavalanche.js';
import { Dissolve } from './game/Dissolve.js';
import { CAT } from './style/palette.js';
import { Sword } from './world/Sword.js';
import { ZONE2 } from './world/zone2.js';
import { Snowfall } from './world/Snowfall.js';
import { Footprints } from './world/Footprints.js';
import { SnowCats } from './world/SnowCats.js';

/**
 * Entry point: creates the systems of the game, connects them and runs the frame loop.
 * Game logic lives in the modules. Address options: `?fur=0` hides the kitten's fur, `?npc=0` removes the
 * other cats and the story.
 */

const MAX_FRAME_SECONDS = 0.1; // longer frames slow the game down instead of making it jump
const HUG_PURR_MOTHER = { chop: 22, lowpass: 100, tone: 40, breath: 0.42 }; // deeper than the kitten's purr

// ---------------------------------------------------------------- world and kitten

const world = new World(document.getElementById('app'));

const cat = await Cat.load('./models/cat.glb');
world.scene.add(cat.root);
world.setCat(cat);
if (new URLSearchParams(location.search).get('fur') === '0') cat.fur.setStep(Infinity);

// ---------------------------------------------------------------- creatures of the meadow

const meadow = world.meadow;
// Flower tops move with the wind and the kitten: these vectors are refreshed every frame.
const flowerTops = meadow.flowerList.map((flower) => flower.top.clone());
const flowerOfTop = new Map(flowerTops.map((top, i) => [top, meadow.flowerList[i]]));
const butterflies = new Butterflies(world.meadowGroup, flowerTops, {
  landable: (top) => !flowerOfTop.get(top).hidden && !keepInsideRampart({ x: top.x, z: top.z }, WALL_CLEARANCE),
});
cat.brain.setButterflies(butterflies);
world.arenaExtras = () => butterflies.list.map((butterfly) => butterfly.group);

const yarn = new Yarn(world.meadowGroup, { heightAt: (x, z) => meadow.grassHeightAt(x, z) });
cat.brain.setYarn(yarn);

const launchers = new Launchers(world.meadowGroup, {
  yarn,
  heightAt: (x, z) => world.terrain.heightAt(x, z),
  ruins: world.ruins,
  canTrigger: () => yarn.state !== 'air' && !cat.brain.scripted && !cat.brain.hold && !story.npcTrip,
});
launchers.addObstaclesTo(world.ruins);
launchers.onLaunch = () => cat.brain.yarnThrown();

// ---------------------------------------------------------------- other cats

const npcs = {};
if (npcsEnabled()) {
  await loadNpcAssets();
  for (const kind of ['chagicien', 'chartiste', 'maman', 'chavalanche']) {
    const [x, z, yaw] = NPC_PLACES[kind];
    npcs[kind] = await Npc.create(kind, npcHome(kind, world), { position: [x, world.terrain.heightAt(x, z), z, yaw] });
  }
}
const npcList = Object.values(npcs);
addNpcObstacles(world, npcs, launchers.exclusions);

const sword = new Sword(world.meadowGroup, cat);
sword.place(world);
const dissolve = new Dissolve(world.meadowGroup);
cat.brain.setWorld(world); // after every obstacle: builds the path-finding grid

// ---------------------------------------------------------------- interface and story

const minimap = new MiniMap(document.body, { world });
const endScreen = new EndScreen();
const bossBar = new BossBar({ name: BOSS.name, color: BOSS.red });
const catBar = new BossBar({ variant: 'cat', color: CAT.eyeIrisOut });
const story = new Story({ world, cat, npcs, minimap, endScreen, places: NPC_PLACES, bossBar, catBar, sword, dissolve });

// ---------------------------------------------------------------- pointer

const picker = new Picker(world, cat, butterflies, yarn);
picker.blocked = () => story.bubble.isOpen; // the speech bubble stays clickable: it sits above the canvas
picker.onGround = (point, wall, options) => {
  story.duel?.dodge();
  if (world.inArena) world.arena.clampInside(point);
  cat.brain.walkTo(point, options);
};
picker.onWall = (wall) => { story.duel?.dodge(); cat.brain.walkTo(wall.top); };
picker.onCat = () => cat.brain.pet();
picker.onYarn = () => cat.brain.yarnThrown();
picker.addTarget(launchers.pickables, (hit) => launchers.handlePick(hit), { priority: 1 });
picker.addTarget(sword, () => story.pickSword(), { priority: 2 });
// The boss's click box is wider than its body: in a fight, a click on the ground beside the body stays a dodge.
const bossConfirm = (npc) => (ray, hit, ground) => !story.duel || hit.object !== npc.proxy
  || (ray.intersectObject(npc.bodyMesh, false)[0]?.distance ?? Infinity) < ground.distance;
for (const [kind, npc] of Object.entries(npcs)) {
  picker.addTarget(npc, () => story.pickNpc(kind), { priority: 2, confirm: bossConfirm(npc) });
}
installTouchControls(world);
const updateCameraKeys = installCameraKeys(world);

// ---------------------------------------------------------------- sound

const purr = new Purr();
cat.onState = (state) => { if (state === 'pet') purr.start(); else purr.stop(); };
const hugPurrs = [
  new Purr({ gain: VOLUMES.purr.hugKitten }),
  new Purr({ ...HUG_PURR_MOTHER, gain: VOLUMES.purr.hugMaman }),
];

const music = new Music();
music.preload(['meadow', 'boss', 'bossMarch']);
const applyMusic = connectSoundtrack({ music, story, world });

const snowSteps = new SnowSteps();
snowSteps.preload();
const combatSfx = new CombatSfx();
combatSfx.preload();
const playCombatSfx = (name, options) => combatSfx.play(name, options);

// ---------------------------------------------------------------- mountain zone

const snowfall = new Snowfall(world.mountainGroup);
const footprints = new Footprints(world.mountainGroup, {
  // No snow on the planks of the way back.
  keepOff: (x, z) => x < ZONE2.x + RETURN_LOOK.x1 + 0.05 && Math.abs(z) < RETURN_LOOK.half + 0.05,
});
snowSteps.onPaw = (leg) => footprints.addPaw(leg, cat.rig.legs[leg].paw, cat.root.rotation.y);
const snowCats = new SnowCats(world.mountainGroup, { world, cat, story });
const chavalanche = npcs.chavalanche ? new Chavalanche({ npc: npcs.chavalanche, world, cat, story, snowCats }) : null;
story.chavalanche = chavalanche;

story.onStep = (step) => {
  for (const hugPurr of hugPurrs) { if (step === 'hug') hugPurr.start(); else hugPurr.stop(); }
  if (step === 'title' || step === 'opening') { footprints.reset(); snowCats.reset(); } // new game
  applyMusic();
};

// ---------------------------------------------------------------- frame loop

const occlusion = new Occlusion({
  camera: world.camera,
  cat: cat.root,
  getOccluders: () => world.occluders ?? [...(world.ruins?.occluders ?? []), ...(world.forest?.occluders ?? [])],
  getTargets: () => story.talkTargets,
});
const quality = new AdaptiveQuality({ renderer: world.renderer, meadow, snowfall, fur: cat.fur });
const timer = new THREE.Timer();

story.showTitle();
world.renderer.setAnimationLoop(() => {
  timer.update();
  const rawDt = timer.getDelta();
  quality.update(rawDt);
  const dt = Math.min(rawDt, MAX_FRAME_SECONDS) * story.timeScale;

  // Story and other cats before the kitten: when it is carried, the mother's mouth is already in place.
  story.update(dt);
  chavalanche?.update(dt);
  const zoneGroup = world.inMountain ? world.mountainGroup : world.meadowGroup;
  for (const npc of npcList) if (npc.root.parent === zoneGroup || npc.root.parent === world.scene) npc.update(dt, world.camera);
  cat.update(dt, world, picker.pointerWorld);

  snowSteps.update(dt, cat, world.inMountain && !story.crossing.fading);
  if (world.inMountain) {
    snowfall.update(dt);
    footprints.update(dt);
    snowCats.update(dt);
  } else {
    sword.update(dt, world.camera);
    dissolve.update(dt, world.renderer, world.camera);
    launchers.update(dt, cat.root.position);
    yarn.update(dt, cat.root.position);
    for (let i = 0; i < flowerTops.length; i++) meadow.flowerTop(i, flowerTops[i]);
    butterflies.update(dt, cat.root.position, { pouncing: cat.brain.pouncing });
  }

  updateCameraKeys(dt);
  world.update(dt, story.followPoint ?? cat.root.position); // also renders the frame
  minimap.update(world.camera, cat.root.position, cat.root.rotation.y, dt);
  bossBar.update(dt);
  catBar.update(dt);

  const duel = story.duel;
  music.setBossFraction(duel ? duel.hp / duel.maxHp : 1);
  if (duel && duel.onSfx !== playCombatSfx) duel.onSfx = playCombatSfx; // the story creates one Duel per fight
  occlusion.update(dt);
});

if (import.meta.env.DEV) {
  const { installDebugHandles } = await import('./debug/handles.js');
  installDebugHandles({
    cat, world, butterflies, yarn, story, music, hugPurrs, npcs, launchers, minimap, endScreen, bossBar, catBar,
    sword, dissolve, occlusion, quality, snowSteps, combatSfx, snowfall, footprints, snowCats, chavalanche,
  });
}
