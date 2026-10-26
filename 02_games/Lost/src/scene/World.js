import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Meadow } from '../world/Meadow.js';
import { Terrain } from '../world/Terrain.js';
import { Mountains } from '../world/Mountains.js';
import { Ruins } from '../world/Ruins.js';
import { FOG, LIGHT, RENDER, SHADOW, color } from '../style/palette.js';
import { createSky } from '../style/sky.js';

/**
 * Rendu, caméra, lumières, sol à relief et montagnes du prototype.
 * Mission catgame_monde (2026-10-26) : l'ancien plan de 200 m qui suivait la caméra (dégradé
 * radial dessiné en mémoire) est remplacé par le terrain fixe de src/world/Terrain.js
 * (`world.terrain`, maillage `world.ground`) ; montagnes au loin (src/world/Mountains.js).
 * Style (2026-10-25, docs/recherche/style.md) : ciel peint en dégradé chaud, brouillard pastel,
 * soleil doré, hémisphère tendre, contre-jour chaud, ombres douces et légères ; tone mapping
 * « Neutral » (pas de décalage de teinte, les couleurs de palette.js restent celles choisies).
 * Aucun post-traitement : le navigateur de test rend en logiciel.
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
    // Fond uni = couleur d'horizon : visible seulement si le ciel peint ne couvre pas un pixel.
    this.scene.background = color(RENDER.background);
    // Brouillard pastel crème, 8-34 m : il cache le bord de la couche d'herbe lointaine et fond
    // le sol dans l'horizon du ciel (couleurs voisines).
    this.scene.fog = new THREE.Fog(color(FOG.color), FOG.near, FOG.far);

    // Caméra basse (0,42 m) : à hauteur de chat, l'herbe et les fleurs le dominent.
    // `far` 400 m (200 avant la mission catgame_monde) : montagnes jusqu'à 260 m de l'origine.
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 400);
    this.camera.position.set(1.45, 0.42, 2.05);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.7;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.target.set(0, FOLLOW_HEIGHT, 0);

    // Ciel peint (src/style/sky.js) : sphère centrée sur la caméra à chaque image.
    this.sky = createSky();
    this.scene.add(this.sky);

    // Hémisphère tendre : bleu très pâle d'en haut, miel d'en bas ; c'est elle qui éclaire les
    // zones à l'ombre, donc elle donne leur teinte aux ombres (claires, jamais noires).
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
    // Ombres douces : bord flou (PCF, rayon en texels) et ombre partielle (0,55 au lieu de 1).
    sun.shadow.radius = 4;
    sun.shadow.intensity = SHADOW.intensity;
    this.scene.add(sun);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(...LIGHT.sun.offset);
    this.sky.material.uniforms.sunDir.value.copy(this.sunOffset).normalize();
    // Contre-jour chaud venant de l'arrière : détache la silhouette noire du chat sans bleuir.
    const rim = new THREE.DirectionalLight(color(LIGHT.rim.color), LIGHT.rim.intensity);
    rim.position.set(-3, 2, -4);
    this.scene.add(rim);

    // Sol à relief, fixe dans le monde (src/world/Terrain.js) : mat (Lambert, couleurs par sommet).
    // `world.terrain` : heightAt(x, z) = hauteur du SOL, normalAt(x, z, out).
    // `world.ground` : son maillage, visé par Picker.js avec les ruines (raycast analytique).
    this.terrain = new Terrain();
    this.ground = this.terrain.mesh;
    this.scene.add(this.ground);

    // Montagnes au loin, hors d'atteinte, sans brouillard (couleurs atmosphériques maison).
    this.mountains = new Mountains({ sunDir: this.sunOffset });
    this.scene.add(this.mountains.group);

    // Ruines (src/world/Ruins.js, agent R) : église et murets posés sur le relief du terrain.
    this.ruins = new Ruins(this.scene, { heightAt: (x, z) => this.terrain.heightAt(x, z) });

    // Prairie : herbe haute au vent et fleurs (src/world/). Pas d'herbe dans l'emprise des murs,
    // herbe courte à leur pied (empreintes `ruins.obstacles`). Jamais touchée par Picker.js
    // (les meshes de la prairie ignorent le Raycaster).
    this.meadow = new Meadow(this.scene, { exclusions: this.ruins.obstacles });

    // Cibles du clic (Picker.js) : le sol et le dessus marchable des ruines (proxy invisible
    // `RuinsWalkable`). Le Raycaster trie les points par distance : le dessus d'un muret passe
    // devant le sol qu'il cache.
    this.pickables = [this.ground, ...this.ruins.pickables];

    this._target = new THREE.Vector3(0, this.terrain.heightAt(0, 0) + FOLLOW_HEIGHT, 0);
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  /**
   * La caméra orbite autour du chat : la cible suit sa position en douceur, à hauteur de chat.
   * La prairie suit aussi : vent, herbe écartée par le chat et la caméra, couloir de vue.
   */
  update(dt, followPosition) {
    // Point visé : FOLLOW_HEIGHT au-dessus du sol sous le chat, ou du chat lui-même s'il est plus
    // haut (bond, dessus d'un mur bas).
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
    // La caméra ne passe jamais sous le sol (une bosse derrière elle) : borne simple.
    const cam = this.camera.position;
    const floor = this.terrain.heightAt(cam.x, cam.z) + CAMERA_CLEARANCE;
    if (cam.y < floor) cam.y = floor;
    this.sky.position.copy(this.camera.position);
    this.ruins.update?.(dt);
    this.meadow.update(dt, followPosition, this.camera, this._target);
    this.renderer.render(this.scene, this.camera);
  }
}

const _follow = new THREE.Vector3();
// Hauteur du point visé au-dessus du sol sous le chat (0,25 m avant la prairie).
const FOLLOW_HEIGHT = 0.22;
// Hauteur minimale de la caméra au-dessus du sol (m).
const CAMERA_CLEARANCE = 0.2;
