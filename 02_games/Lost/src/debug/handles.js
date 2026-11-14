import * as THREE from 'three';
import { meowLog } from '../audio/Meow.js';
import { MUSIC } from '../audio/Music.js';
import { CHAVALANCHE } from '../game/Chavalanche.js';
import { BOSS, FIGHT, LEVELS } from '../game/combat.js';
import { LEVEL_ORDER } from '../game/difficulty.js';
import { SUMMIT, ZONE2, ZONE2_ENTRY } from '../world/zone2.js';

/**
 * All the debug handles on `window`, loaded in development only (see main.js). They let the browser console
 * and the scripted playthrough (`tools/check/playthrough.mjs`) read the state of the game and jump to a
 * moment of it. Each handle starts with two underscores.
 */

/** Throws the yarn ball towards a ground point, from 0.9 m high and 0.3 m in front of the camera. */
function throwYarn({ world, yarn, cat }, x, z) {
  const camera = world.camera.position;
  const dx = x - camera.x, dz = z - camera.z;
  const k = Math.min(0.3, Math.hypot(dx, dz) || 1) / (Math.hypot(dx, dz) || 1);
  const fromX = camera.x + dx * k, fromZ = camera.z + dz * k;
  yarn.throwTo(new THREE.Vector3(fromX, world.terrain.heightAt(fromX, fromZ) + 0.9, fromZ), new THREE.Vector3(x, 0, z));
  return cat.brain.yarnThrown();
}

/** @param {object} game the systems created by main.js */
export function installDebugHandles(game) {
  const {
    cat, world, butterflies, yarn, story, music, hugPurrs, npcs, launchers, minimap, endScreen, bossBar, catBar,
    sword, dissolve, occlusion, quality, snowSteps, combatSfx, snowfall, footprints, snowCats, chavalanche, cutscene,
  } = game;

  Object.assign(window, {
    __cat: cat,
    __world: world,
    __butterflies: butterflies,
    __yarn: yarn,
    __throwYarn: (x, z) => throwYarn(game, x, z),
    __story: story,
    __meowLog: meowLog,
    __hugPurrs: hugPurrs,
    __npcs: npcs,
    __launchers: launchers,
    __minimap: minimap,
    __endScreen: endScreen,
    __occlusion: occlusion,
    __snowSteps: snowSteps,
    __sfx: combatSfx,
    __snowfall: snowfall,
    __footprints: footprints,
    __snowCats: snowCats,
    __ui: () => quality.state,
    __camera: () => ({
      dist: world.controls.getDistance(),
      azimuth: world.controls.getAzimuthalAngle(),
      polar: world.controls.getPolarAngle(),
    }),
  });

  window.__music = {
    play: (name, options) => music.play(name, options),
    stop: (fade) => music.stop(fade),
    get state() { return music.state; },
    music,
    MUSIC,
  };

  window.__combat = {
    get duel() { return story.duel?.state ?? null; },
    get lastDuel() { return story.lastDuel ?? null; },
    get level() { return story.level; },
    get state() { return story.combatState; },
    attack: () => story.duel?.attack() ?? false,
    dodge: () => { story.duel?.dodge(); return story.duel?.state ?? null; },
    setHp: (hp) => story.duel?.setHp(hp) ?? null,        // 0 starts the boss defeat
    setCatHp: (hp) => story.duel?.setCatHp(hp) ?? null,  // 0 to 1
    challenge: (key) => story.bubble.choose(key),             // clicks a level button of the open challenge
    start: () => story.skipTo('combat'),
    setBoss: (k) => story.setBoss(k),
    setArena: (p) => story.setArena(p),
    bar: (value) => { bossBar.set(value); bossBar.show(0); return bossBar.state; },
    end: () => { story._endCombat(); bossBar.hide(0); if (story.step === 'combat') story._goal('maman'); return story.combatState; },
    bossBar, catBar, LEVELS, LEVEL_ORDER, FIGHT, BOSS,
  };

  window.__sword = {
    get info() { return sword.info; },
    take: () => story.pickSword(),
    sword,
    dissolve,
  };

  // Video cutscenes (src/ui/CutscenePlayer.js): `state` { active, name, time, duration, skippable }; `end()` plays the one in
  // progress to its end at once, the story goes on as after a watched cutscene.
  window.__cutscene = {
    get state() { return cutscene.state; },
    end: () => cutscene.end(),
    player: cutscene,
  };

  window.__chavalanche = chavalanche && {
    get info() { return chavalanche.info; },
    protect: (on) => chavalanche.protect(on),
    startFollow: () => chavalanche.startFollow(),
    npc: chavalanche.npc,
    CHAVALANCHE,
    chavalanche,
  };

  window.__gate = {
    get state() { return world.rampart.state; },
    setOpen: () => world.rampart.setOpen(),
    setClosed: () => world.rampart.setClosed(),
    open: () => world.rampart.startOpening(),
    rampart: world.rampart,
    wizard: story.wizard,
    crossing: story.crossing,
  };

  window.__zone = {
    enter: () => { story._placeCat(ZONE2_ENTRY.x, ZONE2_ENTRY.z, ZONE2_ENTRY.yaw); return window.__zone.state; },
    leave: (x = 0, z = 0, yaw = 0) => { story._placeCat(x, z, yaw); return window.__zone.state; },
    get state() {
      return {
        inMountain: world.inMountain, builds: world.mountainBuilds, buildMs: world.mountainBuildMs,
        updates: { ...world.zoneUpdates }, bakeCount: minimap.bakeCount,
        triangles: world.mountain?.triangles ?? 0, decor: world.mountain?.decorCount ?? 0,
      };
    },
    ZONE2, ZONE2_ENTRY, SUMMIT,
  };

  // Cutscene capture (tools/cutscenes/harness.js): frozen at its highest level while the video frames are drawn.
  window.__quality = quality;
}
