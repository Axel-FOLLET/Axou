# Roadmap

The remaining work on Lost, as of 2026-11-09. What is done is in the [journal](../journal/); why it was done is in the [decision log](../decisions.md).

| Session | Content | Estimate |
|---|---|---|
| 11 B | Video cutscenes: the kitten's arrival, the sword, the hug | ≈ 8 h (2 sessions) |
| 12 | Mountain clips and integration; seven adjustments from the 2026-11-09 play session | ≈ 8 h (4 h of clips, ≈ 4 h of adjustments, mini-game not counted) |
| 13 | End screen | 4 h |
| 14 | Credits, final texts | 4 h |
| 15 | Polish and publication | 4 h |

Sum: ≈ 28 h, without the mini-game. These durations are estimates by the AI agent and have not been measured. An earlier work block ran past its estimate. If a session overruns, the next ones slip: the order matters more than the calendar.

## Session 11 B: video cutscenes

Comes after session 11 A, whose snow and firs the cutscenes reuse. Not started.

**Means.** Frame-by-frame capture of the game with CCapture.js 2.0.0, from the frozen copy in `tools/vendor/ccapture.js-2.0.0/`, with no account and no payment. About 5 new Blender clips (cry of rage, Maman stumbling, hopping for joy, kitten and Maman rubbing against each other). The armour has to be created.

**AI trial.** One tumbling fragment only, on a public Hugging Face Space, from a capture of the game. Agreed by the owner on 2026-11-08. Nothing else is sent there.

### Cutscene 1: the kitten's arrival

About 45 s proposed, 1 minute at most. Can be skipped from the second playthrough. Epic music. On 2026-11-08 the theme of boss music version 3 was proposed; on 2026-11-09 it was decided that this cutscene has its own music.

1. First 5 seconds. The cutscene opens zoomed in on Maman. She runs straight ahead, seen from the front. The viewer does not know it yet, but she is fleeing. She runs fast, tired and frightened. She carries her kitten, which wears its helmet and also armour. She runs on a snowy slope, as if coming down a mountain.
2. Paint explosions land close to her and destroy the firs around her. The view zooms out and shows, in the distance, an enormous Chartiste, in his boss form so that the player does not recognise him later in the forest, and much larger than in the game. He holds his brush in his hand, stands on two legs, looks threatening and lets out a cry of rage.
3. The view returns to Maman. Several angles of her flight follow one another, in an epic tone. Maman catches her paws on a rock. Her kitten flies into the air. She panics and sees her kitten, while the viewer does not. A paint explosion separates them. Maman must flee to another side. The screen goes black.
4. Still black, the screen flickers with fragments of a kitten falling and tumbling, its armour coming off piece by piece.
5. The screen goes black again. End of the cutscene.
6. Afterwards: pieces of armour lie scattered and the player finds the cat asleep, as in the current opening and at its current quality. It wakes up and the game starts.

### Cutscene 2: the sword

7 s, triggered as soon as the player clicks the sword. The kitten sees the sword and rushes forward, dodging a brush strike. It leaps and catches the sword in mid-air. The last shot is on its face, with the sword in its mouth and eyes ready to fight. The fight resumes.

### Cutscene 3: the hug

15 s, before the credits. The kitten hops with joy. Maman gets up. They meet, happy, rub against each other as cats do, then hug. Then the end screen.

### Answers from the owner about the scenario

- The Chartiste hunts Maman to finish his masterpiece. This is told by the canvas on his easel, an unfinished female cat that looks like Maman, and by one line of the challenge dialogue: « Il ne manque que toi à mon tableau. » ("All my painting lacks is you.")
- The chase takes place on a different mountain from the snow zone of the game: there are several mountains, and Maman has to flee sideways.
- Maman is slightly hurt, with no blood, and may limp. She has a dried purple paint mark on her flank. At the end she gets up slowly, limps two steps, then forgets everything on seeing her kitten.
- The kitten is carried in the mouth with the `Carried` clip, but it hangs and swings a little because of the run.
- The armour pieces in the meadow are simple scenery.
- The transformation stays in the game: the player realises that the small Chartiste is the enormous one from the opening.

## Session 12: mountain clips and adjustments

**Blender and integration.** Fall in the snow and getting up; the Chavalanche's protection pose; the Bonchats' throw (procedural or clip); integration; the Chavalanche's texts; the owner's feedback on the climb.

**Adjustments from the 2026-11-09 play session:**

1. **Chagicien.** He teleports straight to the drawbridge when the conversation with the Chartiste starts, so that the player no longer arrives before him. Today he walks 36 m to the bridge.
2. **Position before the fight.** The kitten no longer moves visibly into position before fighting. Another way has to be found (camera cut, fade, or the fight starts where the kitten stands), to be proposed before any code.
3. **Defeated Chartiste.** His back deforms during the defeat. To be corrected in the `Defeat` clip, which still starts from the old sitting pose, or in the pose of the shrinking boss.
4. **Snow steps.** Half as loud again: `VOLUMES.snow` from 0.13 to 0.065 (`src/audio/volumes.js`).
5. **Bonchats.** More visible from the start of the climb.
6. **Snowballs.** On the paw strike they roll down the slope instead of being thrown. The player dodges them on the path, and they no longer land on the large platform. The Bonchats' throw clip above follows this choice.
7. **Mini-game: to be specified.** The owner's idea, to define with the owner before the session: what it is for, where it is played, and what is meant by the one mentioned for talking to the Chagicien. Not estimated until it is described.

Accepted on 2026-11-09, nothing to do: the three difficulty levels, the Chavalanche's protection, the music and sound effects of the fight.

**To decide first.** Mountain plan questions 7 and 8 (below), how to position the kitten before the fight (point 2), the description of the mini-game (point 7).

**Done when.** Previews and durations of the clips are read; the full game is played from the opening to the hug at the summit; each adjustment is checked in the game, then judged by the owner.

## Session 13: end screen

A starry space (a single `Points` object). A giant green alien Maman with antennae in the background ([reference image](ref_maman_alien.png)). The kitten with the sword, in its mouth then in its right front paw (clips `SwordToPaw` then `SwordPawHold`, already made, to be played with the tail in `clip` mode). "Star" Chagiciens without fur, 4 to 6 reused, appearing on the sides, spinning as they rise and flashing in rainbow colours. "VIBE CODING", huge, at the top, pulsing on the tempo. Music from 2:20 to 2:57 of *Fancy Footwork* (37 s).

The fight arena's starry night is reused for this screen. The 150 shards once proposed as a base were removed from the arena on 2026-11-09; the disc and the night remain. The cost of several Chagiciens has to be measured. The new scene connects to the `QUALITY` tiers.

**To decide first.** The owner provides the audio file. The tempo is measured on the file.

**Done when.** A series of captures covers the whole ending; the owner checks the synchronisation by ear.

## Session 14: credits, final texts

Survey of all the AI agent roles of the project from the work records, one line per role with its source, the owner first. Credits for the cat model (CC-BY, JonasDichelle), the music and the sounds, from [credits.md](../credits.md). Green scrolling over 37 s. The names appear in the manner of the *Star Wars* crawl: slanted text receding upwards. Only the way the names appear is borrowed: the green, the starry space, the alien Maman and *Fancy Footwork* remain. The owner validates the texts of the whole game, which ends the `draft: true` marks in `src/game/texts.js`.

**To decide first.** Combat plan questions 5 and 6 (below).

**Done when.** Each line of the credits points to a source and no text is left in draft.

## Session 15: polish and publication

Final balance of the volumes. Optional noises (steps, grass). Fallback to CC0 meows only if the current ones are refused. Quality tiers connected to `QUALITY` for the fight and the ending. Final test on the owner's phone. Production build. Static hosting (GitHub Pages or the portfolio) and a link from the portfolio.

**To decide first.** Language of the game (French only, or French and English) and where to host it.

**Done when.** The game is played from start to finish at its public address, on a computer and on a phone.

## Open questions

From the combat plan:

- Does the Chagicien keep his current role in the story before appearing as a "star" at the end?
- The credits last 37 s. If there are too many names, is the scrolling sped up or the music extended?
- Does the kitten's name appear in the credits? (Settled: the default name is Chavalier, Maman does not use the name, and it is asked again for each game.)

From the mountain plan, defaults applied on 2026-11-08 and waiting for the owner's validation:

- Chavalanche at the end: absent from the end screen and the credits for now.
- Chavalanche's texts: bubbles like the other non-player cats, using the kitten's name, in draft.
- A fall is a short slide down the path; help is requested by a click on the Chavalanche; protection lasts up to the summit; the Bonchats are fixed and cannot be destroyed.

Other points, not blocking:

- Climbing the tree and the firefly night: ideas retained on 2026-10-23, never planned. To decide after session 15.
- Eye blinks: the model has no eyelids and its eyes are two separate spheres.
- The cat's credit: whether BlendSwap entries 86110 and 18519 are the same file ([credits](../credits.md)).
- Older points never closed in the notes: score or no score; what becomes of the portfolio part; tail low or raised at walk; walk leg angles narrower than a real cat's; whether to turn the cat towards the camera while petting.

## What only the owner can check

The AI agent cannot hear and has no real graphics card or phone. The tests available to it use software rendering, so the checks below remain with the owner.

**Sound**
- Levels of all the sounds together, and whether the music still seems to cut during a meow.
- To tune by ear if needed: boss music volume (`VOLUMES.music.tracks.boss`, 0.21), dip before the march (`MUSIC.boss.marchSkip`, 0 for the whole dip, 16 for a march that hits at the switch), effect volumes (`VOLUMES.combat`).
- The Chavalanche's voice, borrowed from the Chagicien.
- Audio on Safari, iOS and Firefox.

**Real hardware**
- 60 fps on the owner's graphics card with the current code, the three fur characters included.
- Frame time during the fight; smoothness of the see-through scenery; cost of the rocky mountains in the meadow.
- Flicker and smoothness of the fur at `SPACING` 1.3 mm with 18 shells.
- A real phone: touch, mini-map, framing, the full game.

**Feel of the game**
- Feel and balance of the climb: number of Bonchats, cadence, following distance, slide length (`src/game/climb.js`).
- Fight rhythm, side dodge, camera returning after a manual rotation.
- Sword pull (duration, slow motion, close-up), boss dissolve, double click, carried kitten.
- Gate pivot, camera cuts of the sword pull, victory shot.

**Visual checks in the game**
- Petting at 60 fps, with the closed eyes. Whether the petting now looks natural is still open.
- The seats of the Chagicien and the Chartiste, after they were redone from photos.
- The boss's red and the giant brush; the fight clips of the kitten and the Chartiste.
- Maman's backward step at the drop-off; the helmet falling before the hug.
- Rampart, climb, snowfall, ground and footprints.
- At the bridge, a click on the cat's silhouette pets the cat; the scenery turns translucent in the foreground when the camera is behind a fir.
- Non-player cat colours; ears under the helmet (`EAR_SWIVEL` 0.35); gait thresholds; pounce duration; helmet size; the Chagicien's ears through his hat brim; the camera entering the cat.
- The cat stops about 1.8 m from a non-player cat when a bubble opens; the hat is cut by 48 px at one position at 390 × 844; the Chagicien's tail wraps on 132°; glasses in profile.
- Maman's head cut off at the drop-off at 1280 × 800, her U-turn near the kitten, late frame entry at 390 × 844, flower and butterfly in front of the kitten at 390 × 844, visor hiding the yawn.
- The back still looks hunched at some moments outside petting; the moments have not been identified.

**Texts**
- The draft dialogue in `src/game/texts.js`, read by the owner in session 14.
