# Sounds

The sound of the game: three music loops, four stings, and the sounds of the defenses, the enemies, the farm work, the interface and the chatty neighbour. The day music is a track by Anto, made with Suno; the night and the last night are made from it. Every other sound is **synthesised by code** in [`tools/sounds/`](../tools/sounds/) with the Python standard library, then encoded into mp3 by ffmpeg: no recording, no sample bank, no third-party sound.

## Contents

- [Direction](#direction)
- [Music](#music)
- [Sound list](#sound-list)
- [In the game](#in-the-game)
- [Technical rules](#technical-rules)
- [Rendering the sounds](#rendering-the-sounds)

---

## Direction

- **Day: Anto's track**, as it is.
- **Night: the same tune, frightening and mysterious**: slower, on a worn tape, with notes that drift out of tune and a late, flat double.
- **Last night: a boss fight**, epic and dramatic: the night loop with drums only, from its first second (no arrival of a boss).
- **The music never speeds up**, and **does not change at the end**: victory and defeat only play a sting over it.
- **A sting at dusk and at dawn.** No dawn sting on day 1 (the start of the game), nor at the last dawn (the sting of the end plays alone).
- **One sound per action**, no variants.
- **No sound** for the cat (its "meow" bubble is enough), for the arrival of an enemy, for a hit on the farm (enough noise already), and no ticking at the end of the day.
- **Old Garry has no voice:** only his pitchfork, sharp like a sword stroke.
- **The chatty neighbour babbles:** short sung syllables while her bubble is written. No real words.

## Music

| File | Made from | Length | Loop |
| --- | --- | --- | --- |
| `music_day.mp3` | Anto's whole track ([`sources/musique-jour.m4a`](../tools/sounds/sources/)), its last chord folded onto its start | 162.63 s | yes |
| `music_night.mp3` | 27 s to 85 s of the same track, slowed to 0.875 (pitch kept), worn tape, drifting pitch, dark echoes | 45.035 s | yes |
| `music_final_night.mp3` | the night loop, with synthesised drums on its beat (87.9 BPM): big drums, toms and a deep bass from the first second, heavier after 4 bars, a fill every 4 bars, doubled hits in the last 4 | 45.035 s | yes |

Lengths measured by `render_sounds.py` (`tools/sounds/manifest_sounds.json`).

## Sound list

33 files. "Vol." is the playback volume in the game (0 to 1, in `Cue.java`); the music plays at 0.45 (`Jukebox.MUSIC_VOLUME`). "Trigger" names what the code watches.

### Stings

| File | Trigger | Length | Vol. |
| --- | --- | --- | --- |
| `sting_dawn.mp3` | a day starts, from day 2 (`GameListener.onDayStarted`) | 1.95 s | 0.6 |
| `sting_dusk.mp3` | a night starts (`onNightStarted`) | 4.24 s | 0.6 |
| `sting_victory.mp3` | the urn is bought (`onGameOver`, victory) | 2.51 s | 0.7 |
| `sting_defeat.mp3` | the game is lost (`onGameOver`, any defeat) | 2.79 s | 0.7 |

### Defenses and old Garry

| File | Trigger | Length | Vol. |
| --- | --- | --- | --- |
| `catapatate_fire.mp3` | a catapatate shoots (`Defense.isAttacking` turns true) | 0.245 s | 0.35 |
| `scarecrow_punch.mp3` | the scarecrow punches (`isAttacking` turns true) | 0.205 s | 0.4 |
| `bramble_sting.mp3` | a bramble stings (its durability goes down) | 0.145 s | 0.35 |
| `defense_destroyed.mp3` | a defense worn down to 0 % leaves its place | 0.65 s | 0.55 |
| `garry_fork.mp3` | old Garry hits (`Farmer.isAttacking` turns true) | 0.49 s | 0.35 |

### Enemies

| File | Trigger | Length | Vol. |
| --- | --- | --- | --- |
| `mole_munch.mp3` | a mole comes out to eat (`Mole.isTargetable` turns true) | 0.78 s | 0.45 |
| `mole_death.mp3` | a dead mole leaves the game | 0.4 s | 0.45 |
| `witch_attack.mp3` | a witch hits the farm (its sprite turns to the attack pose) | 0.31 s | 0.4 |
| `witch_death.mp3` | a dead witch leaves the game | 1.04 s | 0.45 |
| `bat_attack.mp3` | a bat hits the farm (attack pose) | 0.215 s | 0.4 |
| `bat_death.mp3` | a dead bat leaves the game: three soft wing beats slowing down and a muffled landing, low and peaceful | 0.62 s | 0.45 |

An enemy that flees at dawn leaves in silence.

### Farm work and interface

| File | Trigger | Length | Vol. |
| --- | --- | --- | --- |
| `plant.mp3` | a seed is planted | 0.245 s | 0.45 |
| `harvest.mp3` | a plant is sold ("Vendre") | 0.465 s | 0.5 |
| `defense_place.mp3` | a defense is bought and placed | 0.33 s | 0.5 |
| `defense_upgrade.mp3` | a defense is upgraded | 0.68 s | 0.5 |
| `ui_click.mp3` | a button: title screen, cutscenes, a list closed, a line picked, "Retirer", the sound button, the end screen | 0.06 s | 0.3 |
| `ui_shop_open.mp3` | a list or a panel of the shop opens | 0.294 s | 0.35 |
| `ui_refused.mp3` | the shop refuses: not enough money, a grey line, a taken cell, the urn too expensive | 0.252 s | 0.35 |

The buttons of the tutorial and of the neighbour ("Passer à la suite") make no sound.

### The chatty neighbour

| File | Trigger | Length | Vol. |
| --- | --- | --- | --- |
| `neighbour_voice_1.mp3` to `neighbour_voice_8.mp3` | while her bubble is written (`Neighbour.isTalking`, not `isBubbleWritten`): one syllable every 0.1 s, drawn at random, never the same twice in a row | 0.08 to 0.116 s | 0.4 |

---

## In the game

The code is in `core/src/main/java/com/cropa/view/audio/`; the model is not changed for the sound.

| Class | Role |
| --- | --- |
| `Cue`, `Track` | the names of the files, and the volume of each short sound |
| `Jukebox` | which loop plays, the cross-fade from one loop to the next (1.5 s), the short sounds, the sound cut. Created once by `CropaGame`, so the music goes on across "Rejouer" and the language button |
| `AudioDirector` | listens to the session (dusk, dawn, end) and compares each frame with the one before (attack poses, durability, enemies gone, the neighbour writing) |
| `GdxSpeaker` | plays the files with libGDX; the tests use a fake speaker instead |

- **The first click starts the sound**: a browser plays nothing before it. The day music then plays from the title screen and the cutscenes on.
- **The sound button** ("Son : oui" / "Son : non", in the bottom right corner, right of the urn button) cuts the music and the sounds at any time of the game (not on the title screen nor in the cutscenes, which take every click); the music goes on at volume 0, so it comes back where it would be.
- A loop that has faded out starts from its beginning the next time.

## Technical rules

Checked on every file by `render_sounds.py`, which writes its measures to `tools/sounds/manifest_sounds.json` (out of the assets, so the game does not ship it):

| Rule | Value |
| --- | --- |
| Format | mp3 44.1 kHz; short sounds mono 96 kbit/s, music stereo 112 kbit/s |
| Peak before encoding | -1.5 dBFS (short sounds), -3 dBFS (music) |
| True peak of the mp3 | -1.5 dBTP or lower on every file (measured) |
| Total size | 3 799 649 bytes for the 33 files (measured), of which 2 277 668 for the day music |

The loudness of each sound against the others is set by the playback volume ("Vol."), not in the file.

## Rendering the sounds

Only Python 3 and ffmpeg (5 or later, with rubberband) are needed. In WSL (or Linux), from the `2D_game` folder:

```sh
sudo apt install ffmpeg
python3 -B tools/sounds/render_sounds.py
```

[`synth.py`](../tools/sounds/synth.py) holds the shared synthesis helpers; each group module (`music.py`, `stings_neighbour.py`, `defenses.py`, `enemies.py`, `farm_ui.py`) builds its sounds with them. `music.py` reads Anto's track in `tools/sounds/sources/`.

`--only name1,name2` renders some sounds again; `--groups music` renders one group; `--out` and `--work` choose the folders of the mp3 and of the wav. Two runs give the same files (fixed seeds).
