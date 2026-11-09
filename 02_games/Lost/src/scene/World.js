import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Meadow } from '../world/Meadow.js';
import { Terrain } from '../world/Terrain.js';
import { Mountain } from '../world/Mountain.js';
import { ZONE2 } from '../world/zone2.js';
import { Mountains, ZONE2_HORIZON } from '../world/Mountains.js';
import { Ruins } from '../world/Ruins.js';
import { Forest, CLEARING } from '../world/Forest.js';
import { Rampart } from '../world/Rampart.js';
import { Arena, BUILD_TIME as ARENA_BUILD_TIME, HIDE_MARGIN as ARENA_HIDE_MARGIN, NIGHT } from '../world/Arena.js';
import { FOG, LIGHT, RENDER, SHADOW, color } from '../style/palette.js';
import { createSky } from '../style/sky.js';

/**
 * Renderer, camera, lights and the two zones of the game (meadow and mountain), plus the arena entered from the
 * meadow. Created by main.js; read by Brain.js, Picker.js and the story code.
 *
 * Style: painted warm-gradient sky, pastel fog, golden sun, soft hemisphere light, warm backlight, light soft
 * shadows; Neutral tone mapping (no hue shift, palette.js colours stay as chosen). No post-processing: the test
 * browser renders in software.
 */
export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = RENDER.toneMapping;
    this.renderer.toneMappingExposure = RENDER.exposure;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Flat background = horizon colour: visible only if the painted sky misses a pixel.
    this.scene.background = color(RENDER.background);
    // Cream pastel fog: hides the edge of the far grass layer and melts the ground into the sky horizon (similar
    // colours). palette.js FOG (8-34 m) is stretched here to FOG_NEAR-FOG_FAR (12-46 m) for the 40 m zone, same
    // colour; the edge of the ground mesh (±96 m) stays beyond FOG_FAR seen from the edge of the zone.
    this.scene.fog = new THREE.Fog(color(FOG.color), FOG_NEAR, FOG_FAR);

    // Low camera (0.42 m): at cat height, grass and flowers tower above it.
    // `far` 500 m: the stretched peaks reach up to 485 m from a camera on the opposite edge.
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 500);
    this.camera.position.set(1.45, 0.42, 2.05);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.7;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.target.set(0, FOLLOW_HEIGHT, 0);

    // Painted sky (src/style/sky.js): sphere centred on the camera every frame.
    this.sky = createSky();
    this.scene.add(this.sky);

    // Soft hemisphere light: very pale blue from above, honey from below. It lights the shaded areas, so it gives
    // shadows their hue (light, never black).
    const hemi = new THREE.HemisphereLight(color(LIGHT.hemiSky), color(LIGHT.hemiGround), LIGHT.hemiIntensity);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(color(LIGHT.sun.color), LIGHT.sun.intensity);
    sun.position.set(...LIGHT.sun.offset);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
    sun.shadow.camera.right = sun.shadow.camera.top = 4;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 20;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.015;
    // Soft shadows: blurred edge (PCF, radius in texels) and partial darkness (SHADOW.intensity).
    sun.shadow.radius = 4;
    sun.shadow.intensity = SHADOW.intensity;
    this.scene.add(sun);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(...LIGHT.sun.offset);
    this.sky.material.uniforms.sunDir.value.copy(this.sunOffset).normalize();
    // Warm backlight: separates the black silhouette of the cat without turning it blue.
    const rim = new THREE.DirectionalLight(color(LIGHT.rim.color), LIGHT.rim.intensity);
    rim.position.set(...LIGHT.rim.offset);
    this.scene.add(rim);

    // Two zones in the same scene and coordinate system: everything belonging to a zone is in its group; only one
    // group is in the scene, the other stays in memory without being drawn or traversed. At the root: sky, lights,
    // cat. See `enterMountain`.
    this.meadowGroup = new THREE.Group();
    this.meadowGroup.name = 'MeadowZone';
    this.scene.add(this.meadowGroup);
    this.mountainGroup = new THREE.Group();
    this.mountainGroup.name = 'MountainZone';
    this.mountain = null;   // built on first entry (`enterMountain`)
    this.inMountain = false;
    this.mountainBuilds = 0;
    this.mountainBuildMs = 0;
    this._mountainObstacles = [];
    // Update counters per zone, to prove the other one is idle (`window.__zone`, main.js).
    this.zoneUpdates = { meadow: 0, mountain: 0 };

    // Relief ground, fixed in the world (src/world/Terrain.js): matte (Lambert, vertex colours).
    // `world.terrain`: heightAt(x, z) = GROUND height, normalAt(x, z, out).
    // `world.ground`: its mesh, targeted by Picker.js along with the ruins (analytic raycast).
    this.terrain = new Terrain();
    this.ground = this.terrain.mesh;
    this.meadowGroup.add(this.ground);

    // Distant mountains, out of reach, no fog (custom atmospheric colours). Horizon of the meadow, in its group; the
    // zone 2 horizon (`mountainHorizon`) is built with that zone.
    this.mountains = new Mountains({ sunDir: this.sunOffset });
    this.meadowGroup.add(this.mountains.group);
    this.mountainHorizon = null;

    // Ruins (src/world/Ruins.js): church and low walls set on the terrain relief.
    this.ruins = new Ruins(this.meadowGroup, { heightAt: (x, z) => this.terrain.heightAt(x, z) });

    // Meadow: tall grass in the wind and flowers (src/world/). No grass on wall footprints, short grass at their foot
    // (`ruins.obstacles` footprints). Never hit by Picker.js (meadow meshes ignore the Raycaster).
    this.meadow = new Meadow(this.meadowGroup, { exclusions: [...this.ruins.obstacles] });

    // Click targets (Picker.js): the ground and the walkable tops of the ruins (invisible `RuinsWalkable` proxy). The
    // Raycaster sorts hits by distance: the top of a low wall comes before the ground it hides.
    this._pickables = [this.ground, ...this.ruins.pickables];

    // Added scenery (forest, NPCs…): see `addProp`.
    this.props = [];

    // Forest (src/world/Forest.js): grove at −X, built on the final relief (heightAt read once). Its trunks and
    // bushes join `ruins.obstacles` (read by Brain.js: resolve, blockedSegment, NavGrid) before any cat path;
    // its `grassExclusions` discs remove the grass under the trunks.
    this.forest = this.addProp(new Forest(this.meadowGroup, { heightAt: (x, z) => this.terrain.heightAt(x, z) }));

    // East rampart, portcullis and drawbridge (src/world/Rampart.js). The return end of the bridge lives in the zone
    // 2 group. The gate obstacle comes and goes in the live `ruins.obstacles` list.
    this.rampart = this.addProp(new Rampart());
    this.rampart.blockList = this.ruins.obstacles;
    this.mountainGroup.add(this.rampart.returnGroup);

    // Occluders: see the `occluders` getter.
    this._occluders = [];

    // Combat arena (src/world/Arena.js): nothing is added or drawn before `enterArena`; see `enterArena` /
    // `leaveArena`.
    this.arena = new Arena(this.meadowGroup, { heightAt: (x, z) => this.terrain.heightAt(x, z) });
    this._arenaState = null;
    // Daytime objects outside World's scenery (main.js butterflies), hidden during the whole arena: a function
    // returning the current list. See enterArena.
    this.arenaExtras = null;

    this._target = new THREE.Vector3(0, this.terrain.heightAt(0, 0) + FOLLOW_HEIGHT, 0);
    addEventListener('resize', () => this.resize());
  }

  /**
   * Adds obstacles to `this.ruins.obstacles`, which Brain.js (resolve, blockedSegment, obstacleAt, NavGrid)
   * scans on every call. Call BEFORE the first path of the cat: the Brain NavGrid is built once, on the first blocked
   * path.
   * @param {object[]} [list] obstacles in `Ruins.obstacles` format: { name, x, z, hx, hz, rotY, top, ground,
   *   height, climbable }
   * @param {object} [opts] `grass` (default true): their footprints also remove grass (Meadow.addExclusions)
   */
  addObstacles(list = [], { grass = true } = {}) {
    if (!list.length) return;
    this.ruins.obstacles.push(...list);
    if (grass) this.meadow.addExclusions(list);
  }

  /** Additional grass-free areas: rectangles { x, z, hx, hz, rotY } or discs { x, z, r }. */
  addGrassExclusions(list = []) { this.meadow.addExclusions(list); }

  /** Additional click targets in the meadow (Picker.js reads `world.pickables`). */
  addPickables(list = []) { this._pickables.push(...list); }

  /** Click targets of the active zone. */
  get pickables() { return this.inMountain ? this.mountain.pickables : this._pickables; }

  /** Obstacles and limits of the active zone, read by Brain.js: `Ruins` in the meadow, `Mountain` in zone 2. */
  get navZone() { return this.inMountain ? this.mountain : this.ruins; }

  /** Trees of the active zone, Forest.trees format (dialogue framing). */
  get zoneTrees() { return this.inMountain ? this.mountain.trees : (this.forest?.trees ?? []); }

  /** Zone 2 obstacles known before the zone is built (Maman, main.js). */
  addMountainObstacles(list = []) {
    if (this.mountain) this.mountain.addObstacles(list);
    else this._mountainObstacles.push(...list);
  }

  /**
   * Switches to zone 2, built once on the first call. The meadow leaves the scene: neither drawn nor updated
   * (`update`, main.js loop), but kept in memory. Leaves the arena first if there was one. The caller places the cat
   * in the same frame; prefer `syncZone`, except when crossing the bridge.
   * @returns {Mountain} the mountain
   */
  enterMountain() {
    if (this.inMountain) return this.mountain;
    if (this._arenaState) this.leaveArena();
    if (!this.mountain) {
      const t0 = performance.now();
      this.mountain = new Mountain(this.mountainGroup);
      this.mountain.addObstacles(this._mountainObstacles);
      // Snow side of the rampart: built with the mountain, its obstacles go to the mountain's navigation.
      this.rampart.buildReturn();
      this.mountain.addObstacles(this.rampart.returnObstacles);
      this.mountainHorizon = new Mountains({ sunDir: this.sunOffset, horizon: ZONE2_HORIZON });
      this.mountainGroup.add(this.mountainHorizon.group);
      this.mountainBuilds++;
      this.mountainBuildMs = performance.now() - t0;
    }
    this.scene.remove(this.meadowGroup);
    this.scene.add(this.mountainGroup);
    this.inMountain = true;
    this.scene.fog.near = MOUNTAIN_FOG.near;
    this.scene.fog.far = MOUNTAIN_FOG.far;
    this._zoneChanged();
    return this.mountain;
  }

  /** Switches to the meadow, rendered as it was. The mountain stays in memory. */
  leaveMountain() {
    if (!this.inMountain) return;
    this.scene.remove(this.mountainGroup);
    this.scene.add(this.meadowGroup);
    this.inMountain = false;
    this.scene.fog.near = FOG_NEAR;
    this.scene.fog.far = FOG_FAR;
    this._zoneChanged();
  }

  /** After a switch: a dropped helmet returns to the head (it is at the root, visible everywhere); paths reset. */
  _zoneChanged() {
    const helmet = this.cat?.helmet;
    if (helmet && !helmet.onHead) helmet.reattach();
    this.cat?.brain?.setZone?.();
    this.onZoneChange?.(this.inMountain); // music (main.js)
  }

  /**
   * Puts the world in the zone of abscissa `x`, no effect if already there: the only function to call when placing
   * the cat (`Story._placeCat`, `start`).
   * @param {number} x world X (m)
   * @returns {boolean} true if `x` is in zone 2
   */
  syncZone(x) {
    const mountain = x > ZONE2.switchX;
    if (mountain) this.enterMountain();
    else this.leaveMountain();
    return mountain;
  }

  /**
   * Plugs in a prop with the interface { mesh | group, obstacles?, grassExclusions?, pickables?, update?(dt) }
   * (Forest.js, NPCs…): added to the scene if not already there, obstacles and grass exclusions applied (the grass
   * texture is recomputed once per call), `update(dt)` called every frame.
   * @param {object} prop
   * @returns {object} the prop
   */
  addProp(prop) {
    const node = prop.group ?? prop.mesh;
    if (node && !node.parent) this.meadowGroup.add(node);
    this.addObstacles(prop.obstacles ?? [], { grass: false });
    this.addGrassExclusions(prop.grassExclusions ?? prop.obstacles ?? []);
    this.addPickables(prop.pickables ?? []);
    this.props.push(prop);
    return prop;
  }

  /**
   * Objects that can hide the cat from the camera, to be faded out (detection and fade: Occlusion.js, wired in
   * main.js). Concatenates the `occluders` lists of the ruins, forest and rampart, read on each call: a missing list
   * counts as empty. Never the ground, relief, mountains, grass, flowers or NPCs. Always returns the same array,
   * refilled on each call (no per-frame allocation): do not keep it from one frame to the next.
   * @returns {THREE.Object3D[]}
   */
  get occluders() {
    const out = this._occluders;
    out.length = 0;
    // Zone 2: rock and fir pieces of `mountain.occluders`, plus the rampart's return side.
    if (this.inMountain) { pushAll(out, this.mountain.occluders); pushAll(out, this.rampart?.returnOccluders); return out; }
    pushAll(out, this.ruins?.occluders);
    pushAll(out, this.forest?.occluders);
    pushAll(out, this.rampart?.occluders);
    return out;
  }

  /**
   * Enters the combat arena: hides the scenery in the disc (plus ARENA_HIDE_MARGIN for the edge pillars), then places
   * the disc and starts the build. Undone by `leaveArena`, which restores the exact previous state. A second call
   * without leaving first leaves automatically.
   * - Trees, bushes (one Mesh each, Forest.js) and ruin pieces whose box touches the disc: `visible = false`
   *   (Occlusion.js skips invisible objects).
   * - Grass and flowers: an exclusion disc added to the meadow (Meadow.addExclusions), removed on exit.
   * - Obstacles (`ruins.obstacles`, read by Brain.js) whose footprint touches the disc, except NPCs (`npc_…`):
   *   removed during the arena, restored on exit; the cat's avoidance grid is rebuilt both times (`brain.setWorld`).
   * @param {{x: number, z: number}} [center] disc centre (m)
   * @param {number} [radius] disc radius (m)
   * @param {object} [opts] `duration` build time (s); `build` false: disc placed at progress 0, nothing drawn
   *   before `arena.build`
   * @returns {Arena} `this.arena`
   */
  enterArena(center = CLEARING, radius = ARENA_RADIUS, { duration = ARENA_BUILD_TIME, build = true } = {}) {
    if (this._arenaState) this.leaveArena();
    const cx = center.x, cz = center.z, R = radius + ARENA_HIDE_MARGIN;
    // Starry night (Arena.js NIGHT): scenery and grass are removed up to the shell (RS), so that no trunk or blade
    // pierces the starry floor; obstacles are removed within radius R only.
    const RS = radius + NIGHT.margin;
    const hidden = [];
    const box = _arenaBox;
    const hide = (obj) => {
      if (!obj || !obj.visible) return;
      box.setFromObject(obj);
      if (circleTouchesBox(cx, cz, RS, box.min.x, box.min.z, box.max.x, box.max.z)) {
        obj.visible = false;
        hidden.push(obj);
      }
    };
    for (const m of this.forest?.occluders ?? []) hide(m);
    for (const m of this.ruins?.meshes ?? []) hide(m);
    // Butterflies (arenaExtras): hidden wherever they are (they fly all over the camera view, above the starry void),
    // restored with the scenery (showArenaDecor) or on exit.
    for (const o of this.arenaExtras?.() ?? []) if (o?.visible) { o.visible = false; hidden.push(o); }
    // Obstacles touched by the disc (oriented boxes), NPCs excluded.
    const removed = [];
    const obs = this.ruins.obstacles;
    const before = obs.slice(); // original order, restored on exit
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      if (String(o.name ?? '').startsWith('npc_')) continue;
      if (circleTouchesObstacle(cx, cz, R, o)) { removed.push(o); obs.splice(i, 1); }
    }
    const grass = { x: cx, z: cz, r: RS, arena: true };
    this.meadow.addExclusions([grass]);
    this._arenaState = { hidden, removed, before, grass, night: 0, day: null };
    this.cat?.brain?.setWorld?.(this);
    this.arena.place(cx, cz, radius);
    if (build) this.arena.build(duration);
    return this.arena;
  }

  /** Leaves the arena: arena removed; scenery, grass, flowers and obstacles restored as they were. */
  leaveArena() {
    const st = this._arenaState;
    this.arena.clear();
    if (!st) return;
    this._setNight(0);
    for (const obj of st.hidden) obj.visible = true;
    // Original order, then obstacles added during the arena (boss…): same array (referenced by Brain.js,
    // MiniMap.js…).
    const obs = this.ruins.obstacles;
    const added = obs.filter((o) => !st.before.includes(o));
    obs.length = 0;
    obs.push(...st.before, ...added);
    if (st.grass) this.meadow.setExclusions(this.meadow.exclusions.filter((e) => e !== st.grass));
    this._arenaState = null;
    this.cat?.brain?.setWorld?.(this);
  }

  /**
   * Victory: scenery hidden in the shell (trees, ruins) and the grass of the disc return before leaving the arena, as
   * soon as the night starts lifting during `arena.unbuild` (called by `update`). Obstacles wait for `leaveArena`. No
   * effect outside the arena or on a second call.
   */
  showArenaDecor() {
    const st = this._arenaState;
    if (!st) return;
    for (const obj of st.hidden) obj.visible = true;
    st.hidden.length = 0;
    if (st.grass) {
      this.meadow.setExclusions(this.meadow.exclusions.filter((e) => e !== st.grass));
      st.grass = null;
    }
  }

  /** True between `enterArena` and `leaveArena`. */
  get inArena() { return !!this._arenaState; }

  /**
   * Arena night (`n` 0 to 1, Arena.js `nightLevel`): fog and background go from their daytime colour to NIGHT.fog; at
   * full night (n = 1) the daytime scenery (painted sky, mountains, meadow, forest, ruins), entirely behind the
   * starry shell, is no longer drawn (saves draw calls). n = 0 restores the exact previous state.
   */
  _setNight(n) {
    const st = this._arenaState;
    if (!st || n === st.night) return;
    st.night = n;
    this.scene.fog.color.copy(color(FOG.color)).lerp(_nightColor.set(NIGHT.fog), n);
    this.scene.background.copy(color(RENDER.background)).lerp(_nightColor, n);
    const full = n >= 1;
    if (full && !st.day) {
      const day = [this.sky, this.mountains?.group, this.meadow?.group, this.forest?.group, ...(this.ruins?.meshes ?? [])];
      st.day = day.filter((o) => o && o.visible);
      for (const o of st.day) o.visible = false;
    } else if (!full && st.day) {
      for (const o of st.day) o.visible = true;
      st.day = null;
    }
  }

  /**
   * Cat followed by the grass: its paws flatten the blades, its body parts them (Grass.js `setCat`). Called once by
   * main.js after `world.scene.add(cat.root)`.
   */
  setCat(cat) {
    this.cat = cat ?? null;
    this.meadow.grass.setCat(this.cat);
  }

  /**
   * Zone 2: the slope rises behind the cat and can cut the view, which the flat meadow never does (relief has no
   * occluder to fade). The camera rises just enough for the line to the target to pass above the ground, at
   * SIGHT.samples points.
   */
  _clearSight() {
    const t = this._target, c = this.camera.position;
    for (const k of SIGHT.samples) {
      const h = this.terrain.heightAt(t.x + (c.x - t.x) * k, t.z + (c.z - t.z) * k) + SIGHT.clearance;
      const y = t.y + (h - t.y) / k;
      if (c.y < y) c.y = y;
    }
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  /**
   * The camera orbits the cat: the target follows its position smoothly, at cat height. The meadow follows too: wind,
   * grass parted by the cat (body, paws) and camera, dithering of blades between camera and cat. The grass follows
   * the cat given to `setCat`, or `followPosition` without a cat.
   * @param {number} dt seconds
   * @param {THREE.Vector3} followPosition point followed by the camera
   */
  update(dt, followPosition) {
    // Target point: FOLLOW_HEIGHT above the ground under the cat, or above the cat itself if higher (jump, low wall
    // top).
    const ground = this.terrain.heightAt(followPosition.x, followPosition.z);
    _follow.copy(followPosition).y = Math.max(followPosition.y, ground) + FOLLOW_HEIGHT;
    this._target.lerp(_follow, 1 - Math.exp(-4 * dt));
    const delta = this._target.clone().sub(this.controls.target);
    this.controls.target.copy(this._target);
    this.camera.position.add(delta);
    this.sun.position.copy(this._target).add(this.sunOffset);
    this.sun.target.position.copy(this._target);
    this.sun.target.updateMatrixWorld();
    this.controls.update();
    // The camera never goes below the ground (a bump behind it): simple clamp.
    const cam = this.camera.position;
    const floor = this.terrain.heightAt(cam.x, cam.z) + CAMERA_CLEARANCE;
    if (cam.y < floor) cam.y = floor;
    if (this.inMountain) this._clearSight();
    this.sky.position.copy(this.camera.position);
    if (this.inMountain) {
      this.zoneUpdates.mountain++;
      this.mountain.update(dt);
    } else {
      this.zoneUpdates.meadow++;
      this.ruins.update?.(dt);
      for (const p of this.props) p.update?.(dt);
      // The grass follows the cat itself, even when the camera follows another point (opening scene).
      const catPos = this.cat?.root.position ?? followPosition;
      this.meadow.update(dt, catPos, this.camera, this._target);
      // Cat passing through the grass (body and paws, Grass.js `update`): after Meadow (uTime).
      this.meadow.grass.update(catPos);
      this.arena.update(dt); // nothing until the arena is shown
      if (this._arenaState) {
        this._setNight(this.arena.nightLevel);
        // Victory: daylight partly back, the scenery of the shell returns (once).
        if (this.arena.unbuilding && this.arena.nightLevel < 1) this.showArenaDecor();
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}

/** Appends the non-empty items of `list` to `out`; missing or non-array `list`: nothing. */
function pushAll(out, list) {
  if (Array.isArray(list)) for (const o of list) if (o) out.push(o);
}

/** Does the disc (cx, cz, r) touch the rectangle [x0, x1] × [z0, z1]? */
function circleTouchesBox(cx, cz, r, x0, z0, x1, z1) {
  const dx = Math.max(x0 - cx, 0, cx - x1), dz = Math.max(z0 - cz, 0, cz - z1);
  return dx * dx + dz * dz <= r * r;
}

/** Does the disc touch the footprint of an obstacle (box { x, z, hx, hz, rotY }, Ruins.js)? */
function circleTouchesObstacle(cx, cz, r, o) {
  const c = Math.cos(o.rotY ?? 0), s = Math.sin(o.rotY ?? 0);
  const dx = cx - o.x, dz = cz - o.z;
  // Local frame of the box (same convention as the Brain.js NavGrid).
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return circleTouchesBox(lx, lz, r, -o.hx, -o.hz, o.hx, o.hz);
}

const _arenaBox = new THREE.Box3();
const _nightColor = new THREE.Color();
const _follow = new THREE.Vector3();
// Height of the target point above the ground under the cat (m).
const FOLLOW_HEIGHT = 0.22;
// Minimum camera height above the ground (m).
const CAMERA_CLEARANCE = 0.2;
// Fog (m): palette.js FOG stretched for the 40 m zone.
const FOG_NEAR = FOG.near + 4;
const FOG_FAR = FOG.far + 12;
// Zone 2 fog (m): the switchbacks above and below stay readable, the mesh edge (about 90 m past the corridor,
// Mountain.js) stays hidden. Same colour as the meadow: only near and far change, with no shader recompilation.
const MOUNTAIN_FOG = { near: 14, far: 80 };
// View clearing in zone 2 (`_clearSight`): fractions of the target-to-camera segment, ground margin (m).
const SIGHT = { samples: [0.25, 0.5, 0.75], clearance: 0.15 };
// Radius of the combat arena (m), centred on the Chartiste's clearing.
const ARENA_RADIUS = 11;
