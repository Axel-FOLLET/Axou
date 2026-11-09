# Lost

A 3D game in the browser: a kitten looks for its mother.

## The game

The player names a kitten on the title screen. Maman carries it by the scruff, sets it down in a meadow and disappears. The kitten wakes up alone.

1. **Meadow.** The kitten explores by click or touch. The Chagicien, in the ruins, sends it to the Chartiste in the forest. A mini-map is the only permanent element on screen.
2. **Boss fight.** The Chartiste grows to five times the kitten's size, turns red and fights with a huge brush. The arena replaces the forest. The player clicks the boss to claw, clicks the ground to dodge and can pull a sword from a stone. Three difficulty levels, chosen in the dialogue before the fight.
3. **Mountain.** Victory opens a drawbridge to the snowy zone. The Chavalanche, a mountain guide, follows the kitten on the climb. The Bonchats, small snow cats, send snowballs that make it slide back down. After a first fall, the Chavalanche can protect it.
4. **Reunion.** Maman waits at the summit. The hug leads to the end screen.

The text shown to the player is in French.

## Status

In development. The game can be played from the title screen to the reunion. The remaining work is in the [roadmap](docs/plan/roadmap.md): three video cutscenes, mountain animation clips, the final end screen, the credits and the publication.

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
- **Python tools** that synthesise the music and the sound effects (`tools/render_music.py`, `tools/render_sfx.py`).

## Code map

| Folder | Content |
|---|---|
| `src/main.js` | Creates the systems and connects them |
| `src/audio/` | Meows, purrs, snow steps, combat effects, music, shared audio context, volume table |
| `src/cat/` | The kitten: model and clips, behaviour, locomotion, procedural layers, fur, eyes, helmet |
| `src/critters/` | Butterflies, yarn balls and their launchers |
| `src/debug/` | Test handles on `window` |
| `src/game/` | Story, duel and boss moves, difficulty and climb tables, dialogue, cutscene helpers, end screen |
| `src/game/story/` | The scenes of the `Story` class (dialogue, opening, fight, sword, victory, ending) and their tuning table |
| `src/input/` | Click and touch picking, camera controls |
| `src/npc/` | Non-player cats: creation, accessories, boss form, sitting pose, placement |
| `src/scene/` | Renderer, cameras, lights and adaptive quality |
| `src/style/` | Shared palette and sky |
| `src/ui/` | Health bars, cinematic bars, mini-map |
| `src/world/` | Terrain, meadow, forest, ruins, rampart, mountains, snow zone, arena, sword, paint, snow cats |
| `tests/` | Unit tests of the pure logic: combat rules, difficulty, terrain height, mini-map, player name, assets |
| `tools/` | Blender scripts and audio rendering scripts |
| `tools/check/` | The `npm run check` script and its playthrough |
| `tools/vendor/` | Frozen copy of CCapture.js, for the video cutscenes |

## Documents

- [Best practices](docs/best_practices.md): the rules for all work on the project.
- [Decision log](docs/decisions.md): what was decided, when and why.
- [Work journal](docs/journal/): what was built, measured and left open, [October](docs/journal/2026-10.md) and [November](docs/journal/2026-11.md).
- [Roadmap](docs/plan/roadmap.md): the remaining work and its estimates.
- [Research](docs/research/README.md): the studies behind the cat's movement, proportions, behaviour and style.
- [Credits](docs/credits.md): third-party assets with their licences, and generated assets.

## How it is made

Lost is built with an AI agent (Claude), directed by the owner of the project. The owner decides what the game is and validates the result by playing it. The agent proposes, writes the code, the Blender scripts and the music and sound tools, and verifies them. No agent can hear or use a real graphics card or phone, so the sound, the real frame rate and the feel of the game are judged by the owner.
