# Roadmap

The remaining work on Lost, as of 2026-11-13. What is done is in the [journal](../journal/); why it was done is in the [decision log](../decisions.md).

| Session | Content | Estimate |
|---|---|---|
| 11 B1 | Video cutscenes: the kitten's arrival, the sword, the hug (silent) | Done on 2026-11-12 to 13 (≈ 4.5 h of agent work up to 00:55 according to the mission report, then the finishing, not summed) |
| 11 B, rest | The owner's corrections of 11 B1 (to be listed by the owner) and cutscene 4, the transformation (moved from session 12 on 2026-11-13) | ≈ 1 h for cutscene 4; the corrections are not estimated until they are listed |
| 11 B2 | Music of cutscene 1 and sound effects of the three cutscenes, from the [timing sheet](cutscene_timing.md) | ≈ 4 h (half of the 8 h once planned for 11 B) |
| 12 | Mountain clips and integration; six adjustments from the 2026-11-09 play session; two fight changes requested on 2026-11-12 | ≈ 11 h (4 h of clips, ≈ 4 h of adjustments, ≈ 3 h of fight changes, mini-game not counted) |
| 13 | End screen | 4 h |
| 14 | Credits, final texts | 4 h |
| 15 | Polish and publication | 4 h |

Sum of what remains: ≈ 28 h, without the mini-game. These durations are estimates by the AI agent and have not been measured. An earlier work block ran past its estimate. If a session overruns, the next ones slip: the order matters more than the calendar.

## Session 11 B: video cutscenes

Comes after session 11 A, whose snow and firs the cutscenes reuse. Split on 2026-11-12 by the owner: 11 B1 "the cutscenes", 11 B2 "the sounds and music".

### Session 11 B1: done (2026-11-12 to 13)

The three silent videos are in the game (`public/videos/`), with the armour, seven new clips, the unfinished portrait on the Chartiste's easel, the new line of the challenge, the purple mark on Maman and one AI trial. What was built, measured and left open is in the [journal of 2026-11-12 to 13](../journal/2026-11.md); the choices are in the [decision log](../decisions.md). Open after 11 B1: the points listed under "What only the owner can check" below, the owner's choice between the captured fall and the AI fall, and the validation of the line added by the agent.

### Rest of session 11 B: the owner's corrections and cutscene 4

The owner's words of 2026-11-13: cutscene 4 was missing (« il manque une cinématique, celle du boss ») and has to be added to session 11 B (« ajoute la à la session 11 B ») ; « il y a de nombreuse corrections à apporter mais c'est un bon début », the corrections to be given by the owner later.

1. **The owner's corrections of 11 B1.** To be listed by the owner before the work starts.
2. **Cutscene 4: the transformation.** Chosen by the owner on 2026-11-12, among four proposals. An in-game cutscene, not a video, because it depends on where the kitten stands and chains into the live fight: when the Chartiste grows and turns red, the blast of his transformation throws the kitten back; it rolls in the grass, gets up with its fur bristling and stands on guard at its fight spot (`BOSS.catDist`, 5.5 m from the boss's centre, `src/game/combat.js`). Being thrown back is the move to the spot, so nothing has to be hidden. Today the kitten walks to the spot in view during the 5 s of the arena construction (`_startCombat`, `src/game/story/fight.js`). Needs a new Blender clip: thrown back, rolling, getting up. About 8 to 10 s in total instead of 7.5 s today (estimate). The distance thrown depends on where the kitten stands when the challenge bubble closes: about 1.8 m from a non-player cat when a bubble opens, according to the visual checks below, not read in the code.

### Session 11 B2: music and sound effects of the cutscenes

The owner's words of 2026-11-12: the music and sounds tied to cutscene 1 are made in a second mission; for cutscenes 2 and 3 the music does not change and the sound effects are added. The [timing sheet](cutscene_timing.md) lists, for each video, the moments that need a sound, read on the finished videos. To do: the music of cutscene 1 (its own, epic, nothing plays during it today); the sound effects of the three cutscenes; the purrs of the hug, which already play during cutscene 3 (decision of 2026-11-12) and have to be balanced with the new sounds; the volumes in `src/audio/volumes.js`; then the owner listens. No agent can hear: the checks are measurements, and listening belongs to the owner.

The text below is the scenario of the three cutscenes as it stood when the session was planned.

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
The former point 2, the position before the fight, became cutscene 4 of session 11 B on 2026-11-13.

2. **Defeated Chartiste.** His back deforms during the defeat. To be corrected in the `Defeat` clip, which still starts from the old sitting pose, or in the pose of the shrinking boss.
3. **Snow steps.** Half as loud again: `VOLUMES.snow` from 0.13 to 0.065 (`src/audio/volumes.js`).
4. **Bonchats.** More visible from the start of the climb.
5. **Snowballs.** On the paw strike they roll down the slope instead of being thrown. The player dodges them on the path, and they no longer land on the large platform. The Bonchats' throw clip above follows this choice.
6. **Mini-game: to be specified.** The owner's idea, to define with the owner before the session: what it is for, where it is played, and what is meant by the one mentioned for talking to the Chagicien. Not estimated until it is described.

Accepted on 2026-11-09, nothing to do: the three difficulty levels, the Chavalanche's protection, the music and sound effects of the fight.

**Fight changes requested on 2026-11-12:**

1. **Brush strike: area damage.** The brush strike hurts the kitten over an area, not only in its current narrow sector. Today the hit zone is a cone of ± 0.35 rad at most, 4.7 m in front of the boss (`FIGHT.boss` in `src/game/combat.js`, `brush` in the `LEVELS` of `src/game/difficulty.js`). The sideways dodge (decision of 2026-11-01) relies on this narrow cone and has to be reviewed with the area. Shape chosen by the owner on 2026-11-12: a round splash where the brush head hits the ground, about 1.5 m in radius (proposed value), in addition to the cone; it can still be dodged sideways, further. Its size per difficulty level goes to `LEVELS` in `src/game/difficulty.js`.
2. **The Chartiste moves after each strike.** After every strike he goes to another place in the arena, so that he is harder to beat and the kitten can no longer hide on the edges of the arena. Today he never leaves his spot: he only turns towards the kitten (`turn` 0.3 rad/s, and `aimTurn` 5 rad/s before a strike, `FIGHT.boss`), and he only attacks when the kitten is within 9 m of his centre (`engage`), in an arena of 11 m radius: the edge of the arena is out of his reach. Way chosen by the owner on 2026-11-12: after each strike he leaps and lands within brush reach of the kitten, never against the edge; the 9 m limit goes, so the kitten can hide nowhere. The effect on the combat camera and on the kitten's avoidance grid is part of the work. The values go to the difficulty tables.

**To decide first.** The description of the mini-game (point 6), which the owner gives for session 12.

**Commit.** The owner commits the boss music version 5 (trial 1, made on 2026-11-11): the four `music_boss_*.mp3` files, `tools/render_music.py`, `docs/journal/2026-11.md` and `docs/decisions.md`. Postponed to this session by the owner on 2026-11-11.

**Done when.** Previews and durations of the clips are read; the full game is played from the opening to the hug at the summit; each adjustment and each fight change is checked in the game, then judged by the owner.

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

From the mountain plan, defaults applied on 2026-11-08. The first two (questions 7 and 8) were kept by the owner on 2026-11-12; the third still waits for the owner's validation:

- Chavalanche at the end: absent from the end screen and the credits.
- Chavalanche's texts: bubbles like the other non-player cats, using the kitten's name, in draft until session 14.
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
- Boss dissolve, double click, carried kitten.
- Gate pivot, victory shot.

**The three video cutscenes (session 11 B1)**
- Watch them in the game: the story is told as intended, the rhythm of the chase, the cry of rage, the stumble and the fall, the dodge and the catch of the sword, the hug.
- Choose between the captured fall and the AI fall (`videos/essai_ia/` in the mission folder; the replacement command is in the decision log of 2026-11-12). The AI clip changes the kitten's shape and the ground; it makes cutscene 1 about 4 s shorter.
- The line « Ta mère courait trop vite pour mon pinceau. », added by the agent before « Il ne manque que toi à mon tableau. », and the unfinished portrait on the easel.
- The rule of the "Passer" button (after one complete view in this browser).
- Playing on Safari and Firefox, and on a phone: the videos were played only in Chromium.

**Visual checks in the game**
- Petting at 60 fps, with the closed eyes. Whether the petting now looks natural is still open.
- The seats of the Chagicien and the Chartiste, after they were redone from photos.
- The boss's red and the giant brush; the fight clips of the kitten and the Chartiste.
- The helmet falling before the hug.
- Rampart, climb, snowfall, ground and footprints.
- At the bridge, a click on the cat's silhouette pets the cat; the scenery turns translucent in the foreground when the camera is behind a fir.
- Non-player cat colours; ears under the helmet (`EAR_SWIVEL` 0.35); gait thresholds; pounce duration; helmet size; the Chagicien's ears through his hat brim; the camera entering the cat.
- The cat stops about 1.8 m from a non-player cat when a bubble opens; the hat is cut by 48 px at one position at 390 × 844; the Chagicien's tail wraps on 132°; glasses in profile.
- Flower and butterfly in front of the kitten at 390 × 844, visor hiding the yawn (wake-up among the pieces of armour).
- The back still looks hunched at some moments outside petting; the moments have not been identified.

**Texts**
- The draft dialogue in `src/game/texts.js`, read by the owner in session 14.
