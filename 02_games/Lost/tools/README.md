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
