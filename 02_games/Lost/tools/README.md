# Tools

Scripts that produce the assets of the game and check the project. All commands run from the root of the project, on Linux or WSL unless stated otherwise.

| Tool | Purpose | Needs |
|---|---|---|
| `check/check.mjs` | `npm run check`: syntax, unit tests, production build, playthrough | Node |
| `check/playthrough.mjs` | Plays one fight in a headless browser | Node, Chromium |
| `render_music.py` | Composes and renders the music | Python 3, ffmpeg, audio environment |
| `render_sfx.py` | Synthesises the combat sound effects | Python 3, ffmpeg |
| `setup_audio.sh` | Installs the audio environment | Python 3, curl, dpkg-deb |
| `anim_cat.py` | Creates the animation clips and exports `public/models/cat.glb` | Blender 4.5, `assets/sources/cat.blend` |
| `export_cat.py`, `inspect_cat.py`, `measure_cat.py`, `rest_bones.py` | Export and inspect the Blender rig | Blender 4.5 |
| `pose_preview.mjs` | Draws kitten poses to a PNG without a browser | Node |
| `vendor/` | Frozen copy of CCapture.js, for the video cutscenes | none |
| `cutscenes/capture.mjs` | Plays a cutscene stage frame by frame in a headless browser and encodes it (see Cutscenes) | Node, ffmpeg, Chromium, dev server |
| `cutscenes/assemble.mjs` | Joins the segments of cutscene 1 into `public/videos/cutscene_arrival.mp4` | Node, ffmpeg |

## Setup on a new machine

```bash
npm install
sudo apt install ffmpeg python3-venv   # Debian or Ubuntu
bash tools/setup_audio.sh              # about 150 MB, installed in tools/.audio-env (not tracked)
```

The playthrough looks for a browser in `CHROME_PATH`, then in the Playwright cache, then in `PATH`. Without a browser, `npm run check` runs the other steps and reports the playthrough as skipped.

## Music

```bash
tools/.audio-env/bin/python3 -B tools/render_music.py --only boss
```

This writes the four boss music files to `public/sounds/` in about 5 minutes. The output is deterministic.

The meadow track also needs its bird recordings: download the CC0 Freesound previews listed in `BIRD_SOURCES` (in `render_music.py`), name them `freesound_<id>.mp3`, and pass their folder with `--birds`.

The mountain track needs only Python and ffmpeg: `python3 -B tools/render_music.py --only mountain`.

## Sound effects

```bash
python3 -B tools/render_sfx.py                       # all effects
python3 -B tools/render_sfx.py --only lava_throw,phase2
```

## Animation clips

The source file `assets/sources/cat.blend` is not tracked: it is the third-party model listed in `docs/credits.md`, modified for this project. Blender 4.5 runs on Windows, from Git Bash:

```bash
B="/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"
"$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- preview <action> <frame>...
"$B" -b assets/sources/cat.blend --python tools/anim_cat.py -- export public/models/cat.glb
```

Previews are written to `.shots/blender/`.

## Pose preview

```bash
node tools/pose_preview.mjs /tmp/pet.png pet 0,0.8,1.6,2.4
```

Scenarios: `idle`, `pet`, `walk`, `stretch`, `groom`, `sit`, `lie`, `sleep`, `wake`, `sitpet`, `liepet`, `bones`.

## Cutscenes

The three video cutscenes of the game are captured from the game itself, image by image, with CCapture.js (frozen copy in `tools/vendor/ccapture.js-2.0.0/`, read only). The dev server must be running (`npm run dev`, port 5173); the tool never starts one. What it loads (`tools/cutscenes/harness.js`, the stages) is imported by the tool alone, never from `src/`, so none of it reaches the production build.

```bash
node tools/cutscenes/capture.mjs test --size 640x360 --every 6 --sheet .shots/cutscenes/test/sheet.png   # quick preview
flock .shots/locks/render.lock node tools/cutscenes/capture.mjs <scene> --encode .shots/cutscenes/<scene>/<scene>.mp4
```

| Option | Meaning |
|---|---|
| `<scene>` | stage `tools/cutscenes/stages/<scene>.js` (or a path to a `.js` file inside the project) |
| `--fps n`, `--size WxH` | frames per second (default 30), picture size with even numbers (default 1280x720) |
| `--from s`, `--to s` | recorded part, in seconds of the scene (the scene is always simulated from 0; default: up to `DURATION`) |
| `--every n` | record one image out of n; the others are simulated but not drawn (previews) |
| `--out dir` | folder of the images, named `<step>_t<seconds>.png` (default `.shots/cutscenes/<scene>/`, with a `stage.json` of the settings and the sound cues) |
| `--encode file.mp4`, `--crf n` | encode the images: H.264 `yuv420p`, `+faststart`, no audio track, BT.709 tags (default crf 20) |
| `--sheet file.png` | contact sheet of up to 30 recorded images, each labelled with its step and time |
| `--url address` | dev server (default `http://localhost:5173/`) |

Exit code: 0 done, 1 failed, 2 no browser found (same lookup as the playthrough). Software rendering draws one 1280x720 image in a few seconds: long captures go under `flock` so that only one runs at a time.

While a scene is captured, the story logic (`story.update`) and the interface are off, the render quality is frozen at its highest level and the clock is virtual (CCapture's TimeWarp): `requestAnimationFrame`, `performance.now` and the game timer all advance by exactly `1 / fps` per image, whatever the time the drawing takes. Vite's hot-reload client is blocked in the capture page, so editing `src/` during a capture does not reload it.

A stage is an ES module served by Vite (`import * as THREE from 'three'` works):

```js
export const DURATION = 45;                                            // s
export const SOUND_CUES = [{ t: 3.2, cue: 'paint explosion, near' }];  // s from the start of the scene, in English
export async function setup(game) { return ctx; }  // game: the debug handles (THREE, world, cat, npcs, story, sword, ...) plus fps, size, settle(seconds)
export function frame(ctx, t, dt) {}               // every image, after the game update, just before the render: camera, actors
export function dispose(ctx) {}                    // optional
```

`frame` sets the camera of the game (`world.camera`: position, orientation, `fov` then `updateProjectionMatrix()`), which wins over the game camera for the image. `settle(seconds)` runs undrawn steps inside `setup` (the game moves, `frame` is not called). `tools/cutscenes/stages/test.js` is a three-second example to copy.

`assemble.mjs` (cutscene 1) joins the chase, a black, the kitten's fall and a final black into `public/videos/cutscene_arrival.mp4`: `node tools/cutscenes/assemble.mjs [--chase f] [--fall f] [--out f] [--black-mid s] [--black-end s] [--crf n] [--maxrate kbit/s] [--json f] [--allow-missing]`. All options are optional; the usage and the format of the result (1280x720, 30 images/s, `yuv420p`, no audio) are at the top of the file.
