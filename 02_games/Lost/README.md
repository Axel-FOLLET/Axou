# Lost

A 3D game in the browser: a kitten looks for its mother.

## The game

The player names a kitten on the title screen. The game starts with a video cutscene: Maman flees across a snowy slope with her kitten, helmeted and armoured, in her mouth, hunted by an enormous Chartiste; the kitten is thrown, falls and tumbles, losing its armour piece by piece. It wakes up alone in a meadow, among the pieces of armour. The cutscene can be skipped once it has been watched to the end in the same browser.

1. **Meadow.** The kitten explores by click or touch. The Chagicien, in the ruins, sends it to the Chartiste in the forest. A mini-map is the only permanent element on screen.
2. **Boss fight.** The Chartiste grows to five times the kitten's size, turns red and fights with a huge brush. The arena replaces the forest. The player clicks the boss to claw, clicks the ground to dodge and can take a sword from a stone: a click on it plays a short video cutscene in which the kitten dodges a brush strike and catches the sword in mid-air. Three difficulty levels, chosen in the dialogue before the fight.
3. **Mountain.** Victory opens a drawbridge to the snowy zone. The Chavalanche, a mountain guide, follows the kitten on the climb. The Bonchats, small snow cats, send snowballs that make it slide back down. After a first fall, the Chavalanche can protect it.
4. **Reunion.** Maman waits at the summit. The hug is a third video cutscene and leads to the end screen.

The text shown to the player is in French.

## Status

In development. The game can be played from the title screen to the reunion, with its three video cutscenes (session 11 B1, silent). The remaining work is in the [roadmap](docs/plan/roadmap.md): the music and sound effects of the cutscenes (session 11 B2, whose list of moments is in [cutscene timing](docs/plan/cutscene_timing.md)), mountain animation clips, the final end screen, the credits and the publication.

## How to run it

Requires Node.js and npm.

```bash
npm install
npm run dev     # development server (Vite, also on the local network)
npm run build   # production build in dist/
npm run check   # syntax, unit tests, production build, short scripted playthrough
npm test        # unit tests only
```

`npm run check` reports the playthrough as skipped when no browser is found. The asset tools have their own instructions in [tools/README.md](tools/README.md).

## Stack

- **Three.js** for rendering, **Vite** for the build, **Vitest** for the unit tests.
- **Web Audio** for playback and mixing, and for the sounds synthesised at run time (purrs, the Chagicien's voice).
- **Blender**, driven by script, for the animation clips (`tools/anim_cat.py`, exported to `public/models/cat.glb`).
- **CCapture.js** (frozen copy) and **ffmpeg**, in the tools only, to capture the game frame by frame into the cutscene videos.
- **Python tools** that synthesise the music and the sound effects (`tools/render_music.py`, `tools/render_sfx.py`).

## Code map

| Folder | Content |
|---|---|
| `src/main.js` | Creates the systems and connects them |
| `src/audio/` | Meows, purrs, snow steps, combat effects, music, shared audio context, volume table |
| `src/cat/` | The kitten: model and clips, behaviour, locomotion, procedural layers, fur, eyes, helmet, silver armour (`Armor.js`) |
| `src/critters/` | Butterflies, yarn balls and their launchers |
| `src/debug/` | Test handles on `window` |
| `src/game/` | Story, duel and boss moves, difficulty and climb tables, dialogue, cutscene helpers, end screen |
| `src/game/story/` | The scenes of the `Story` class (dialogue, opening, fight, sword cutscene, victory, ending) and their tuning table |
| `src/input/` | Click and touch picking, camera controls |
| `src/npc/` | Non-player cats: creation, accessories (including the Chartiste's easel and its unfinished portrait of Maman), boss form, sitting pose, placement, Maman's paint mark |
| `src/scene/` | Renderer, cameras, lights and adaptive quality |
| `src/style/` | Shared palette and sky |
| `src/ui/` | Health bars, cinematic bars, mini-map, video cutscene player (`CutscenePlayer.js`) |
| `src/world/` | Terrain, meadow, forest, ruins, rampart, mountains, snow zone, arena, sword, paint, snow cats, scattered armour (`ArmorScatter.js`) |
| `tests/` | Unit tests of the pure logic: combat rules, difficulty, terrain height, mini-map, player name, assets, cutscene files and skip memory |
| `tools/` | Blender scripts and audio rendering scripts |
| `tools/check/` | The `npm run check` script and its playthrough |
| `tools/cutscenes/` | Capture of the video cutscenes: `capture.mjs` and `harness.js` (CCapture.js, frame by frame), `assemble.mjs` (joins the segments of cutscene 1), one scene per file in `stages/`. Development only, not in the build |
| `tools/vendor/` | Frozen copy of CCapture.js, for the video cutscenes |
| `public/videos/` | The three cutscene videos (MP4, H.264, 1280 × 720, 30 images/s, no sound) |

## Documents

- [Best practices](docs/best_practices.md): the rules for all work on the project.
- [Decision log](docs/decisions.md): what was decided, when and why.
- [Work journal](docs/journal/): what was built, measured and left open, [October](docs/journal/2026-10.md) and [November](docs/journal/2026-11.md).
- [Roadmap](docs/plan/roadmap.md): the remaining work and its estimates.
- [Research](docs/research/README.md): the studies behind the cat's movement, proportions, behaviour and style.
- [Credits](docs/credits.md): third-party assets with their licences, and generated assets.

## How it is made

Lost is built with an AI agent (Claude), directed by the owner of the project. The owner decides what the game is and validates the result by playing it. The agent proposes, writes the code, the Blender scripts and the music and sound tools, and verifies them. No agent can hear or use a real graphics card or phone, so the sound, the real frame rate and the feel of the game are judged by the owner.
