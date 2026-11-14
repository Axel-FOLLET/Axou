/*
 * Lost's cat in 3D on its project card: the game model (exported from Lost's cat.blend, frozen in its Sit pose,
 * without skeleton or animation) drawn by a reduced three.js bundle (js/vendor/three-cat.min.js), with the shell
 * fur of the game.
 *
 * Scene of the project wheel, same contract as js/modules/scenes/*: createScene(media, options) returns
 * { prepare(), play(), finish(), dispose() }, media being the .project-card__media of the card.
 * - Until the model is ready, and without WebGL 2, the faceted SVG cat of cat.js (.cat-figure) stays in place.
 * - prepare() (card next to the centre) loads the bundle and the model, once; nothing is downloaded before.
 * - It turns with a finger or the mouse, like the SVG cat, and comes back facing us on release; a press outside the
 *   cat's silhouette is left to the wheel (project-showcase.js).
 * - play(): short arrival toward the camera, then rest; finish(): facing us, still.
 * - A frame is drawn only when something moves: no permanent loop.
 * - The fur is left out where WebGL is drawn without a graphics card, and thinned on a machine too slow for it
 *   (FUR_WATCH); options.furShells (0 to 18) forces a number of shells instead. The canvas tells how many are drawn
 *   (data-fur-shells).
 */
import { drawCatFigure, RETURN_RATE } from "./cat.js";

const LIBRARY_URL = new URL("../vendor/three-cat.min.js", import.meta.url).href;
const MODEL_URL = new URL("../../assets/models/cat-sit.glb", import.meta.url).href;

/*
 * Same gesture as the cubes and the SVG cat (cubes/drag-cube.js): half a degree per pixel, a 10 px threshold.
 */
const DEGREES_PER_PIXEL = 0.5;
const DRAG_THRESHOLD = 10;

/*
 * Framing, in CSS pixels of the media: the top band stays free for the hover sprite of motion.css (6 to 22 px).
 */
const TOP_MARGIN = 24;
const BOTTOM_MARGIN = 4;
const SIDE_MARGIN = 6;
const FIELD_OF_VIEW = 24;
const CAMERA_ELEVATION = 6;
const MAX_PIXEL_RATIO = 2;

/*
 * Arrival played by play(): the cat starts turned three quarters, head slightly lowered, and settles facing us
 * (ease-out). A raised head would bring the ears into the hover band at the top of the media.
 */
const ARRIVAL = { duration: 1300, yaw: -42, pitch: -6 };
const FADE_DURATION = 280;

/*
 * Accessible name of the 3D cat (the SVG keeps the one written in the HTML).
 */
const LABELS = {
    fr: "Chat assis, modèle 3D du jeu Lost",
    en: "Seated cat, 3D model from the game Lost"
};

/*
 * Look of the game (Lost: src/style/palette.js LIGHT and CAT, src/cat/Fur.js, src/cat/Eyes.js): warm black coat whose
 * tint is only modulated by the texture, slightly rufous hair tips, golden rim light, yellow-green eyes with a round
 * pupil and two highlights.
 */
const LIGHTS = {
    sun: { color: 0xffe0b0, intensity: 2.2, position: [-2, 3, 4] },
    hemisphere: { sky: 0xd8e9ff, ground: 0xe0c48e, intensity: 1.1 },
    rim: { color: 0xffd6a8, intensity: 0.5, position: [3, 2, -4] }
};
const CAT = {
    coat: 0x2a2320,
    tip: 0x5c4536,
    coatLit: 0x7a685c,
    coatLitStrength: 0.45,
    sheen: 0xffd9a8,
    sheenStrength: 0.6,
    irisIn: 0xeef27e,
    irisOut: 0x7cc24e,
    eyeRing: 0x3b2a1e
};

/*
 * Shell fur of the game (Fur.js): copies of the body, each pushed a little further along the normal and pierced so
 * that only hair cross-sections remain. The game reads hair length and combing from the skeleton; the static model
 * carries them in its _FUR vertex attribute (four signed bytes: xyz the combing direction of the game turned by the
 * Sit pose, w the hair length factor divided by maskRange), written by the export of the model.
 * - shells: 18, as in the game;
 * - length: the game's 0.022 m in model units (the game scales the model by 0.8 m / 9.2578 units = 0.0864);
 * - density: hairs per model unit (one hair every 0.0013 m in the game);
 * - comb: share of the length the tips lean along the combing direction;
 * - heightMin: shortest hair (share of the length); tipTaper: thinning toward the tip.
 * The wind sway of the game is left out: it would need a frame at every instant.
 */
const FUR = {
    shells: 18,
    length: 0.2546,
    density: 66.47,
    maskRange: 1.6,
    comb: 0.6,
    heightMin: 0.7,
    tipTaper: 0.7
};

/*
 * Fur and slow machines (the game thins its fur on weak machines too: Fur.js, setStep).
 * - software: names of the engines that draw WebGL with the processor, without a graphics card. Eighteen shells take
 *   them about a second per frame: there the cat keeps its bare coat;
 * - elsewhere the cat wears all its shells and its moving frames are watched: after `frames` frames in a row that are
 *   each more than `slow` milliseconds apart, one shell out of 2, then out of 3, is kept (the outer shell always
 *   stays, so the silhouette does not shrink); more than `stalled` milliseconds apart, none is kept.
 * Nothing is timed when the cat appears: while a page loads, even a graphics card draws some frames tens of
 * milliseconds late, and a check made at that moment took the fur off about one time out of five.
 * See thinFur, drawnBySoftware and watchFrame.
 */
const FUR_WATCH = { software: /swiftshader|llvmpipe|softpipe|software|basic render/i, slow: 100, stalled: 300, frames: 3, steps: [1, 2, 3] };

/*
 * Coat colour: the texture only changes the brightness of the black (Fur.js, COAT_GLSL).
 */
const COAT_HEAD = /* glsl */`
uniform vec3 catCoat;
uniform vec3 catCoatLit;
uniform vec3 catSheen;
void catCoatColor(inout vec3 color) {
  float lum = dot(color, vec3(0.3, 0.59, 0.11));
  color = catCoat * (0.8 + 0.4 * lum);
}
`;

const SKIN_COLOR = /* glsl */`
catCoatColor(diffuseColor.rgb);
#include <alphamap_fragment>
`;

/*
 * Coat light (Fur.js, coatLight): grey-brown tint on the sun side, stronger on top; golden rim on the contours; both
 * fade toward the roots. depth is 0 on the skin and rises to 1 on the outer shell.
 * directionalLights[0] is the sun: it is the first light added to the scene.
 */
const coatLight = depth => /* glsl */`
#include <emissivemap_fragment>
{
  vec3 coatNormal = normalize(normal);
  vec3 coatView = normalize(vViewPosition);
  vec3 coatUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float coatSun = smoothstep(-0.1, 0.7, dot(coatNormal, directionalLights[0].direction));
  float coatTop = smoothstep(0.0, 0.85, dot(coatNormal, coatUp));
  float coatRim = 1.0 - abs(dot(coatNormal, coatView));
  totalEmissiveRadiance += catCoatLit * coatSun * (0.55 + 0.45 * coatTop) * mix(0.5, 1.0, ${depth});
  totalEmissiveRadiance += catSheen * coatRim * coatRim * mix(0.3, 1.0, coatSun) * mix(0.6, 1.0, ${depth});
}
`;
const SKIN_LIGHT = coatLight("0.0");
const SHELL_LIGHT = coatLight("furShell");

/*
 * Shell vertex (Fur.js, VERTEX_BODY): pushed along the normal, the tips leaning along the combing direction.
 */
const SHELL_VERTEX_HEAD = /* glsl */`
attribute vec4 _fur;
uniform float furShell;
varying vec3 vFurPosition;
`;

const SHELL_VERTEX_BODY = /* glsl */`
#include <begin_vertex>
{
  vec3 furNormal = normalize(normal);
  vec3 furComb = _fur.xyz - furNormal * dot(_fur.xyz, furNormal);
  float furLength = ${(FUR.length * FUR.maskRange).toFixed(5)} * _fur.w;
  transformed += furNormal * furLength * furShell + furComb * ${FUR.comb.toFixed(2)} * furLength * furShell * furShell;
  vFurPosition = position;
}
`;

const SHELL_FRAGMENT_HEAD = /* glsl */`
uniform float furShell;
uniform vec3 catTip;
varying vec3 vFurPosition;
vec3 furHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

/*
 * Shell fragment (Fur.js, FRAGMENT_BODY): one hair per cell of a 3D grid laid on the model, of random height and
 * thinner toward its tip; between the hairs the fragment is dropped. Roots are darker, tips slightly rufous.
 */
const SHELL_COLOR = /* glsl */`
{
  vec3 p = vFurPosition * ${FUR.density.toFixed(2)};
  vec3 cell = floor(p);
  vec3 o = step(0.5, fract(p)) - 1.0;
  float best = 1e9;
  float height = 1.0;
  for (int x = 0; x < 2; x++)
  for (int y = 0; y < 2; y++)
  for (int z = 0; z < 2; z++) {
    vec3 c = cell + o + vec3(float(x), float(y), float(z));
    vec3 h = furHash(c);
    vec3 d = p - (c + 0.15 + 0.7 * h);
    float dd = dot(d, d);
    if (dd < best) { best = dd; height = mix(${FUR.heightMin.toFixed(2)}, 1.0, fract(h.x * 7.13 + h.z * 3.71)); }
  }
  float r = 0.65 * (1.0 - ${FUR.tipTaper.toFixed(2)} * furShell / height);
  diffuseColor.a = furShell < height ? 1.0 - smoothstep(r * 0.6, r, sqrt(best)) : 0.0;
  if (diffuseColor.a < 0.02) discard;
  catCoatColor(diffuseColor.rgb);
  diffuseColor.rgb = diffuseColor.rgb * mix(0.55, 1.0, furShell) + catTip * furShell * furShell;
}
#include <alphamap_fragment>
`;

/*
 * Opacity of a hair fragment. The game draws on an opaque canvas: a share of the samples of the pixel, equal to this
 * opacity (first two lines, as three.js computes it for alpha to coverage), takes the hair colour. The canvas of the
 * card is transparent: each of those samples must also be blended with its own opacity, or the page would shine
 * through the hairs around the cat. Share and blend multiply, hence the square root, which keeps the opacity of the
 * game.
 */
const SHELL_COVERAGE = /* glsl */`
diffuseColor.a = smoothstep(alphaTest, alphaTest + fwidth(diffuseColor.a), diffuseColor.a);
if (diffuseColor.a == 0.0) discard;
diffuseColor.a = sqrt(diffuseColor.a);
`;

const EYE_VERTEX_HEAD = /* glsl */`
uniform vec3 eyeCenter;
varying vec3 vEyeDirection;
`;

const EYE_VERTEX_BODY = /* glsl */`
#include <begin_vertex>
vEyeDirection = normalize(position - eyeCenter);
`;

const EYE_FRAGMENT_HEAD = /* glsl */`
uniform vec3 eyeForward;
uniform vec3 eyeRight;
uniform vec3 eyeUp;
uniform vec3 eyeIrisIn;
uniform vec3 eyeIrisOut;
uniform vec3 eyeRing;
varying vec3 vEyeDirection;
float eyeLight;
vec3 eyeGlow;
`;

/*
 * Iris, pupil and highlights of Eyes.js, without the eyelids: (u, v) is the direction of the point projected on the
 * plane facing the gaze; the iris covers 0.78 of it, the pupil is a slightly tall ellipse.
 */
const EYE_FRAGMENT_BODY = /* glsl */`
#include <color_fragment>
{
  vec3 d = normalize(vEyeDirection);
  vec2 uv = vec2(dot(d, eyeRight), dot(d, eyeUp));
  float front = step(0.0, dot(d, eyeForward));
  float r = front > 0.5 ? length(uv) : 2.0;
  float a = atan(uv.y, uv.x);
  float t = clamp(r / 0.78, 0.0, 1.0);
  float streak = 0.85 + 0.15 * sin(a * 37.0 + sin(a * 11.0) * 2.0) * (0.4 + t);
  vec3 iris = mix(eyeIrisIn, eyeIrisOut, smoothstep(0.25, 1.0, t)) * streak;
  iris = mix(iris, eyeRing, 0.8 * smoothstep(0.82, 0.98, t));
  vec3 c = mix(iris, eyeRing, smoothstep(0.78, 0.81, r));
  float pupil = length(uv / vec2(0.42, 0.50));
  c = mix(vec3(0.004), c, smoothstep(0.92, 1.02, pupil));
  eyeGlow = c * 0.35 * (1.0 - smoothstep(0.78, 0.81, r)) * smoothstep(0.92, 1.02, pupil);
  eyeLight = 1.0 - smoothstep(0.085, 0.105, length(uv - vec2(-0.2, 0.24)));
  eyeLight += 0.8 * (1.0 - smoothstep(0.03, 0.045, length(uv - vec2(0.17, -0.15))));
  eyeLight *= front;
  diffuseColor.rgb = c;
}
`;

const EYE_EMISSIVE = /* glsl */`
#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(eyeLight) * 2.5 + eyeGlow;
`;


/*
 * WebGL 2 context for the canvas, or null (WebGL disabled or unavailable): three.js r186 needs WebGL 2.
 */
function createContext(canvas) {
    try {
        return canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false });
    } catch {
        return null;
    }
}


/*
 * Downloads the model while the bundle loads, then parses it with the bundle's GLTFLoader.
 */
async function loadModel(THREE) {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`cat model: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    return new Promise((resolve, reject) => new THREE.GLTFLoader().parse(buffer, "", resolve, reject));
}


/*
 * Game coat on the body material (Fur.js) and game iris on the eyes (Eyes.js). Returns the body and its fur shells.
 */
function dressCat(THREE, model, shellCount) {
    const coat = {
        catCoat: { value: new THREE.Color(CAT.coat) },
        catCoatLit: { value: new THREE.Color(CAT.coatLit).multiplyScalar(CAT.coatLitStrength) },
        catSheen: { value: new THREE.Color(CAT.sheen).multiplyScalar(CAT.sheenStrength) },
        catTip: { value: new THREE.Color(CAT.tip) }
    };
    let body = null;
    let skin = null;
    model.traverse(object => {
        if (!object.isMesh) return;
        /*
         * Both eyes share one material in the file: each gets its own copy, since its uniforms depend on its globe.
         */
        const source = object.material;
        const material = source.clone();
        object.material = material;
        if (object.userData.eyeForward) {
            object.geometry.computeBoundingSphere();
            const forward = new THREE.Vector3(...object.userData.eyeForward).normalize();
            const up = new THREE.Vector3(...object.userData.eyeUp);
            const right = new THREE.Vector3().crossVectors(up, forward).normalize();
            up.crossVectors(forward, right).normalize();
            material.color.set(0xffffff);
            material.roughness = 0.05;
            material.onBeforeCompile = shader => {
                Object.assign(shader.uniforms, {
                    eyeCenter: { value: object.geometry.boundingSphere.center.clone() },
                    eyeForward: { value: forward },
                    eyeRight: { value: right },
                    eyeUp: { value: up },
                    eyeIrisIn: { value: new THREE.Color(CAT.irisIn) },
                    eyeIrisOut: { value: new THREE.Color(CAT.irisOut) },
                    eyeRing: { value: new THREE.Color(CAT.eyeRing) }
                });
                shader.vertexShader = EYE_VERTEX_HEAD + shader.vertexShader.replace("#include <begin_vertex>", EYE_VERTEX_BODY);
                shader.fragmentShader = EYE_FRAGMENT_HEAD + shader.fragmentShader
                    .replace("#include <color_fragment>", EYE_FRAGMENT_BODY)
                    .replace("#include <emissivemap_fragment>", EYE_EMISSIVE);
            };
            return;
        }
        /*
         * Body, the root of the fur: matte skin, texture darkened as in Fur.js, then tinted by the coat shader.
         */
        body = object;
        skin = source;
        material.roughness = 1;
        material.color.multiplyScalar(0.7);
        material.onBeforeCompile = shader => {
            Object.assign(shader.uniforms, coat);
            shader.fragmentShader = COAT_HEAD + shader.fragmentShader
                .replace("#include <alphamap_fragment>", SKIN_COLOR)
                .replace("#include <emissivemap_fragment>", SKIN_LIGHT);
        };
    });
    /*
     * A model without the fur attribute (older file still in a cache) keeps its bare coat.
     */
    const shells = [];
    if (!body.geometry.getAttribute("_fur")) return { body, shells };
    for (let index = 1; index <= shellCount; index++) {
        const material = skin.clone();
        /*
         * A little gloss, as in the game: without any highlight a black coat is just a silhouette.
         */
        material.roughness = 0.62;
        /*
         * Hairs are thinner than a pixel: their opacity is spread over the antialiasing samples (alpha to coverage),
         * as in the game, and blended over what is under them (SHELL_COVERAGE), so that the canvas stays right over
         * the card around the cat.
         */
        material.alphaTest = 0.5;
        material.alphaToCoverage = true;
        material.transparent = true;
        const furShell = { value: index / shellCount };
        material.onBeforeCompile = shader => {
            Object.assign(shader.uniforms, coat, { furShell });
            shader.vertexShader = SHELL_VERTEX_HEAD + shader.vertexShader.replace("#include <begin_vertex>", SHELL_VERTEX_BODY);
            shader.fragmentShader = COAT_HEAD + SHELL_FRAGMENT_HEAD + shader.fragmentShader
                .replace("#include <alphamap_fragment>", SHELL_COLOR)
                .replace("#include <alphatest_fragment>", SHELL_COVERAGE)
                .replace("#include <emissivemap_fragment>", SHELL_LIGHT);
        };
        const shell = new THREE.Mesh(body.geometry, material);
        shell.position.copy(body.position);
        shell.quaternion.copy(body.quaternion);
        shell.scale.copy(body.scale);
        /*
         * From the roots outward.
         */
        shell.renderOrder = index;
        shells.push(shell);
    }
    shells.forEach(shell => body.parent.add(shell));
    return { body, shells };
}


/*
 * The body swollen to the tips of its fur (outer shell), as a mesh that is never drawn: it frames the cat and tells
 * whether the pointer is on it.
 */
function furOutline(THREE, body) {
    const geometry = body.geometry.clone();
    const fur = geometry.getAttribute("_fur");
    if (fur) {
        const position = geometry.getAttribute("position");
        const normal = geometry.getAttribute("normal");
        const direction = new THREE.Vector3();
        const comb = new THREE.Vector3();
        for (let index = 0; index < position.count; index++) {
            const length = FUR.length * FUR.maskRange * fur.getW(index);
            direction.fromBufferAttribute(normal, index).normalize();
            comb.fromBufferAttribute(fur, index);
            comb.addScaledVector(direction, -comb.dot(direction)).multiplyScalar(FUR.comb);
            direction.add(comb).multiplyScalar(length);
            position.setXYZ(index, position.getX(index) + direction.x, position.getY(index) + direction.y, position.getZ(index) + direction.z);
        }
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }
    const outline = new THREE.Mesh(geometry, body.material);
    outline.position.copy(body.position);
    outline.quaternion.copy(body.quaternion);
    outline.scale.copy(body.scale);
    return outline;
}


/*
 * Points used to frame the cat (one vertex out of three of its fur outline), in model coordinates.
 */
function framingPoints(THREE, outline) {
    const points = [];
    const position = outline.geometry.attributes.position;
    for (let index = 0; index < position.count; index += 3) {
        points.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(outline.matrixWorld));
    }
    return points;
}


export function createScene(media, options = {}) {
    const language = (options.language || document.documentElement.lang || "fr").startsWith("en") ? "en" : "fr";
    const figure = media.querySelector(".cat-figure");
    if (figure) drawCatFigure(figure);
    const originalLabel = figure?.getAttribute("aria-label") ?? null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shellCount = Math.max(0, Math.min(FUR.shells, Math.round(options.furShells ?? FUR.shells)));

    /*
     * Angles in degrees, same meaning as the SVG cat: rotationY turns around the vertical axis, rotationX tilts.
     */
    const pose = { rotationX: 0, rotationY: 0 };
    let stage = null;
    let loading = null;
    let pendingPlay = false;
    let frameId = null;
    let drag = null;
    let suppressClick = false;
    let hoverQueued = false;
    let resizeObserver = null;
    /*
     * An imposed number of shells (options.furShells) is never thinned.
     */
    const adaptive = options.furShells === undefined;
    let furStep = 1;
    const watch = { last: null, count: 0, fastest: Infinity };

    function stopMotion() {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        watch.last = null;
        watch.count = 0;
        watch.fastest = Infinity;
    }

    function render() {
        if (!stage) return;
        const radians = Math.PI / 180;
        stage.pivot.rotation.set(-pose.rotationX * radians, pose.rotationY * radians, 0, "XYZ");
        stage.renderer.render(stage.scene, stage.camera);
    }

    /*
     * Keeps one fur shell out of `step`, the outer one included (0: none), and writes the number kept on the canvas.
     */
    function thinFur(step) {
        furStep = step;
        stage.shells.forEach((shell, index) => {
            shell.visible = step > 0 && (index + 1) % step === 0;
        });
        stage.canvas.dataset.furShells = String(stage.shells.filter(shell => shell.visible).length);
    }

    /*
     * Is WebGL drawn by the processor? The name of the engine says so. Some browsers hide that name: watchFrame
     * covers them.
     */
    function drawnBySoftware() {
        const context = stage.renderer.getContext();
        const info = context.getExtension("WEBGL_debug_renderer_info");
        return FUR_WATCH.software.test(String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER)));
    }

    /*
     * Called at each frame of a movement (arrival, return to the front) with the time of that frame. A slow frame
     * alone means nothing (a tab coming back, a busy page): only several in a row thin the fur (FUR_WATCH).
     */
    function watchFrame(now) {
        const gap = watch.last === null ? 0 : now - watch.last;
        watch.last = now;
        if (!adaptive || furStep === 0 || gap < FUR_WATCH.slow) {
            watch.count = 0;
            watch.fastest = Infinity;
            return;
        }
        watch.count += 1;
        watch.fastest = Math.min(watch.fastest, gap);
        if (watch.count < FUR_WATCH.frames) return;
        const next = FUR_WATCH.steps[FUR_WATCH.steps.indexOf(furStep) + 1] ?? 0;
        thinFur(watch.fastest > FUR_WATCH.stalled ? 0 : next);
        watch.count = 0;
        watch.fastest = Infinity;
    }

    /*
     * Fits the camera to the media: the cat goes from TOP_MARGIN to BOTTOM_MARGIN in height and stays within
     * SIDE_MARGIN in width, measured on the projected vertices (a perspective view enlarges the front paws).
     */
    function frame() {
        const { renderer, camera, points, height: modelHeight } = stage;
        const width = Math.max(1, media.clientWidth);
        const height = Math.max(1, media.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const top = 1 - 2 * TOP_MARGIN / height;
        const bottom = -1 + 2 * BOTTOM_MARGIN / height;
        const side = 1 - 2 * SIDE_MARGIN / width;
        const elevation = CAMERA_ELEVATION * Math.PI / 180;
        const halfField = camera.fov * Math.PI / 360;
        let distance = 4 * modelHeight;
        let targetY = modelHeight / 2;
        const projected = stage.projected;
        stage.pivot.rotation.set(0, 0, 0);
        stage.pivot.updateMatrixWorld(true);
        for (let step = 0; step < 8; step++) {
            camera.position.set(0, targetY + distance * Math.sin(elevation), distance * Math.cos(elevation));
            camera.lookAt(0, targetY, 0);
            camera.updateMatrixWorld(true);
            let minY = Infinity, maxY = -Infinity, maxX = 0;
            for (const point of points) {
                projected.copy(point).applyMatrix4(stage.pivot.matrixWorld).project(camera);
                minY = Math.min(minY, projected.y);
                maxY = Math.max(maxY, projected.y);
                maxX = Math.max(maxX, Math.abs(projected.x));
            }
            targetY += ((minY + maxY) / 2 - (top + bottom) / 2) * distance * Math.tan(halfField);
            distance *= Math.max((maxY - minY) / (top - bottom), maxX / side);
        }
    }

    /*
     * Is the pointer on the cat itself, fur included? Elsewhere in the media, the press belongs to the wheel.
     */
    function hitsCat(event) {
        const rect = stage.canvas.getBoundingClientRect();
        stage.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        stage.scene.updateMatrixWorld();
        stage.outline.matrixWorld.copy(stage.body.matrixWorld);
        stage.raycaster.setFromCamera(stage.pointer, stage.camera);
        return stage.raycaster.intersectObject(stage.outline, false).length > 0;
    }

    /*
     * Back to the front view after a drag: same exponential return as the SVG cat (RETURN_RATE of cat.js).
     */
    function release() {
        const nearest = angle => angle - 360 * Math.round(angle / 360);
        pose.rotationX = nearest(pose.rotationX);
        pose.rotationY = nearest(pose.rotationY);
        stopMotion();
        if (reducedMotion.matches) {
            pose.rotationX = pose.rotationY = 0;
            render();
            return;
        }
        let previousTime = performance.now();
        const comeBack = currentTime => {
            watchFrame(currentTime);
            const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
            previousTime = currentTime;
            const keep = Math.exp(-RETURN_RATE * deltaTime);
            pose.rotationX *= keep;
            pose.rotationY *= keep;
            const done = Math.abs(pose.rotationX) < 0.2 && Math.abs(pose.rotationY) < 0.2;
            if (done) pose.rotationX = pose.rotationY = 0;
            render();
            frameId = done ? null : requestAnimationFrame(comeBack);
        };
        frameId = requestAnimationFrame(comeBack);
    }

    /*
     * Arrival: from three quarters to facing us, ease-out (cubic), then rest.
     */
    function arrive() {
        stopMotion();
        const start = performance.now();
        const step = now => {
            watchFrame(now);
            const progress = Math.min((now - start) / ARRIVAL.duration, 1);
            const remaining = Math.pow(1 - progress, 3);
            pose.rotationY = ARRIVAL.yaw * remaining;
            pose.rotationX = ARRIVAL.pitch * remaining;
            render();
            frameId = progress < 1 ? requestAnimationFrame(step) : null;
        };
        pose.rotationY = ARRIVAL.yaw;
        pose.rotationX = ARRIVAL.pitch;
        render();
        frameId = requestAnimationFrame(step);
    }

    function listen(canvas) {
        canvas.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !hitsCat(event)) return;
            /*
             * The wheel ignores this press: the cat keeps the gesture, like the .cat-figure of the SVG cat.
             */
            event.stopPropagation();
            canvas.setPointerCapture(event.pointerId);
            stopMotion();
            drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
            canvas.style.cursor = "grabbing";
        });
        canvas.addEventListener("pointermove", event => {
            if (!drag) {
                /*
                 * Mouse over the canvas: the grab cursor only on the cat (one test per frame at most).
                 */
                if (event.pointerType !== "mouse" || hoverQueued) return;
                hoverQueued = true;
                const { clientX, clientY } = event;
                requestAnimationFrame(() => {
                    hoverQueued = false;
                    if (stage && !drag) canvas.style.cursor = hitsCat({ clientX, clientY }) ? "grab" : "";
                });
                return;
            }
            if (event.pointerId !== drag.id) return;
            if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
            drag.moved = true;
            pose.rotationY += (event.clientX - drag.x) * DEGREES_PER_PIXEL;
            pose.rotationX -= (event.clientY - drag.y) * DEGREES_PER_PIXEL;
            drag.x = event.clientX;
            drag.y = event.clientY;
            render();
        });
        const endDrag = event => {
            if (!drag || event.pointerId !== drag.id) return;
            suppressClick = drag.moved;
            drag = null;
            canvas.style.cursor = event.pointerType === "mouse" ? "grab" : "";
            release();
        };
        canvas.addEventListener("pointerup", endDrag);
        /*
         * pointercancel: the browser takes the gesture back, for instance to scroll the page.
         */
        canvas.addEventListener("pointercancel", endDrag);
        /*
         * A drag of the cat is not a click on the card.
         */
        canvas.addEventListener("click", event => {
            if (!suppressClick) return;
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        });
        canvas.addEventListener("webglcontextlost", () => {
            stopMotion();
            showFallback();
        });
        canvas.addEventListener("webglcontextrestored", () => {
            reveal();
            render();
        });
    }

    /*
     * Shows the 3D cat over the media and hides the SVG drawing (the .cat-figure keeps its role and its name).
     */
    function reveal() {
        const svg = figure?.querySelector("svg");
        const { canvas } = stage;
        canvas.hidden = false;
        if (figure) figure.setAttribute("aria-label", LABELS[language]);
        if (!reducedMotion.matches) {
            canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_DURATION, easing: "ease-out" });
            svg?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_DURATION, easing: "ease-out" });
        }
        if (svg) svg.style.visibility = "hidden";
    }

    function showFallback() {
        if (stage) stage.canvas.hidden = true;
        const svg = figure?.querySelector("svg");
        if (svg) svg.style.visibility = "";
        if (figure && originalLabel !== null) figure.setAttribute("aria-label", originalLabel);
    }

    async function load() {
        const canvas = document.createElement("canvas");
        const context = createContext(canvas);
        if (!context) return;
        const THREE = await import(LIBRARY_URL);
        const gltf = await loadModel(THREE);

        const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        /*
         * The sun first: the coat shader reads directionalLights[0].
         */
        const sun = new THREE.DirectionalLight(LIGHTS.sun.color, LIGHTS.sun.intensity);
        sun.position.set(...LIGHTS.sun.position);
        scene.add(sun);
        scene.add(new THREE.HemisphereLight(LIGHTS.hemisphere.sky, LIGHTS.hemisphere.ground, LIGHTS.hemisphere.intensity));
        const rim = new THREE.DirectionalLight(LIGHTS.rim.color, LIGHTS.rim.intensity);
        rim.position.set(...LIGHTS.rim.position);
        scene.add(rim);

        /*
         * The model is exported with its feet at y = 0 and centred on its bounding box; the pivot turns it around the
         * vertical axis through its mean point (the tail lying behind would otherwise make the face swing wide).
         */
        const model = gltf.scene;
        model.updateMatrixWorld(true);
        const { body, shells } = dressCat(THREE, model, shellCount);
        const outline = furOutline(THREE, body);
        outline.matrixWorld.copy(body.matrixWorld);
        const points = framingPoints(THREE, outline);
        const mean = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
        const modelHeight = points.reduce((highest, point) => Math.max(highest, point.y), 0);
        const pivot = new THREE.Group();
        pivot.position.set(0, modelHeight / 2, 0);
        model.position.set(-mean.x, -modelHeight / 2, -mean.z);
        pivot.add(model);
        scene.add(pivot);
        model.updateMatrixWorld(true);

        const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100 * modelHeight);
        stage = {
            canvas, renderer, scene, camera, pivot, body, outline, shells,
            /*
             * Framing points in the pivot frame: frame() places them with the pivot's own matrix.
             */
            points: points.map(point => point.add(model.position)),
            height: modelHeight,
            projected: new THREE.Vector3(),
            raycaster: new THREE.Raycaster(),
            pointer: new THREE.Vector2()
        };

        canvas.setAttribute("aria-hidden", "true");
        canvas.hidden = true;
        Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "pan-y" });
        if (getComputedStyle(media).position === "static") media.style.position = "relative";
        media.append(canvas);
        listen(canvas);
        frame();

        resizeObserver = new ResizeObserver(() => {
            if (!stage) return;
            frame();
            render();
        });
        resizeObserver.observe(media);

        /*
         * Shaders compiled before the first visible frame: no stall when the cat appears.
         */
        renderer.compile(scene, camera);
        thinFur(adaptive && drawnBySoftware() ? 0 : 1);
        render();
        reveal();
        if (pendingPlay && !reducedMotion.matches) arrive();
        pendingPlay = false;
    }

    function prepare() {
        if (!loading) {
            loading = load().catch(() => {
                stage = null;
                showFallback();
            });
        }
        return loading;
    }

    function play() {
        prepare();
        if (reducedMotion.matches) {
            finish();
            return;
        }
        if (drag) return;
        if (!stage) {
            pendingPlay = true;
            return;
        }
        arrive();
    }

    function finish() {
        pendingPlay = false;
        stopMotion();
        pose.rotationX = pose.rotationY = 0;
        render();
    }

    /*
     * Frees the WebGL context (not called by the wheel; for a page that removes the card).
     */
    function dispose() {
        stopMotion();
        resizeObserver?.disconnect();
        if (stage) {
            showFallback();
            stage.renderer.dispose();
            stage.renderer.forceContextLoss();
            stage.canvas.remove();
        }
        stage = null;
        loading = null;
    }

    return { prepare, play, finish, dispose };
}
