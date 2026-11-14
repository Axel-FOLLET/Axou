# Cutscene timing sheet

For session 11 B2 (music and sound effects of the cutscenes). One table per video: the moments that need a sound, in seconds from the start of the video, and what the picture shows at that moment.

## How to read this sheet

- The three videos are silent (`public/videos/`, no audio track). Nothing in this sheet is played yet.
- Times are read on the finished videos, not simply copied from the scene code: the moments were checked by extracting the frame at the time cited with ffmpeg and looking at it (several frames around it when the moment is fast). Where the scene code (`SOUND_CUES` exported by the stage files in `tools/cutscenes/stages/`) disagreed with the picture, the picture wins and the difference is said in the table. Frame rate 30 images/s, so one image is 0.033 s.
- The cues are written for sound design: a moment, the sound it needs and the picture. They are not a score. The words of the owner (2026-11-12): the music of cutscene 1 and its sounds are made in 11 B2; for cutscenes 2 and 3 "the music does not change, only the sound effects are added".
- Contact sheets of the checks are in the working folder of the mission (`captures/13_*`); they are not in the repository.

| Video | Length | Music while it plays | Sounds that already play |
|---|---|---|---|
| 1. Arrival (`cutscene_arrival.mp4`) | 45.600 s, 1368 images | None: step `arrival` is silent (`src/audio/soundtrack.js`). 11 B2 gives it its own music. | None |
| 2. Sword (`cutscene_sword.mp4`) | 7.000 s, 210 images | The boss music goes on, the duel is paused. | None |
| 3. Hug (`cutscene_hug.mp4`) | 15.000 s, 450 images | The music of the moment goes on (the summit). | The two hug purrs, from 0 s to the end of the video: see below |

**The hug purrs start too early for the picture.** The step `hug` begins when the video starts (`Story._setUpHug`) and the two purrs follow the step (`story.onStep` in `src/main.js`: start at `hug`, stop at the next step). So the kitten's purr (`VOLUMES.purr.hugKitten` 0.46) and Maman's low purr (`VOLUMES.purr.hugMaman` 0.68) fade in over about 1 s from 0 s (time constant 0.3 s in `Purr.start`) and run for the whole 15 s (they fade out when the end screen appears), while Maman is still lying down with a limp. The picture only shows a hug from about 11.3 s. This is the behaviour decided on 2026-11-12 (no sound added or removed in 11 B1); 11 B2 chooses either to keep it, or to start the purrs later in code (for example when the cats touch at 5.7 s, and Maman's at the hug at about 11.3 s).

## Cutscene 1: the arrival (45.600 s)

Checked on `cutscene_arrival.mp4` (h264, 1280 × 720, 30 images/s, 1368 images, 15,183,456 bytes, no audio stream). It is the chase (0 to 36.0 s), 0.6 s of black, the fall (36.6 to 44.6 s) and 1.0 s of black, as printed by `tools/cutscenes/assemble.mjs` (offsets 0, 36.0, 36.6 and 44.6 s). Nothing plays during the whole video today: the music of 11 B2 starts at 0.00 s, and the cues below are the sound effects that go with it.

### Part 1: the chase (0 to 36 s)

Times are those of the video (the chase starts at 0). Looked at on the picture, within about 0.1 s except where a difference is said: the three layers, blasts 1 to 4, 14 and 15, the giant's cry, the stumble, the release of the kitten, the violet blast and the blackout. The other blasts, whooshes and fir throws follow the table of the scene code (`SOUND_CUES` of `tools/cutscenes/stages/arrival_chase.js`, which uses the same blast times) and were not each looked at. Fifteen paint blasts fall in all: blasts 1 to 4 are close, the others are thrown by the Chartiste from far away and have a long whoosh before them.

| Time (s) | Sound moment | What the picture shows |
|---|---|---|
| 0.00 | Three layers that stay until the end of the part: wind on a high snow slope with light snowfall; Maman's gallop in soft snow, about 5.7 paw falls per second (run cycle 0.333 s at rate 0.95) with heavy tired breaths; faint metal clinks of the kitten's armour at every stride (until the kitten leaves her mouth at 24.2 s) | Close-up of Maman from the front and a little above, running with her kitten, helmeted and armoured, swinging under her chin; her green eyes are visible |
| 2.40 | Maman glances back: a short frightened breath | The scene turns her head over her shoulder for a moment (2.4 to 3.2 s); it is slight in the close-up |
| 4.50 | First paint shell whistles down (a rising whistle) | Still the close-up; the cut to the wide shot of the slope comes at about 4.7 to 5.0 s |
| 5.40 | Paint blast 1: a wet burst and a low boom (radius 2 m); firs torn away and thrown 0.15 s later (wood cracks, branches, tumble thuds) | Wide shot, Maman a small figure on the slope; the burst is clear at 5.55 s: red paint, firs turned red and thrown aside |
| 5.60, 6.60, 8.00 | Shell whistles before blasts 2 to 4 | The slope with paint puddles growing (red at 6.5 s, yellow at 7.5 s) |
| 6.50, 7.50, 8.90 | Blasts 2, 3 and 4 (radius 2.4, 2.2 and 2.6 m), each with the firs thrown 0.15 s later | 8.90 s is a return to the close-up of Maman, a yellow splash behind her |
| 10.20 | The giant takes a huge breath: a deep inhale, felt more than heard | The Chartiste, red and enormous, stands on his hind legs far down the valley, brush raised, over a forest of firs |
| 10.60 | Chartiste's cry of rage: an enormous hoarse roar of a cat that shakes the valley, about 2.5 s | The same shot is held to about 13.5 s: the giant at the horizon, paint balls flying in the sky |
| 11.10, 11.90, 12.70, 13.60, 14.50 | Thrown paint balls whoosh from very far (a long low whoosh that gets closer), one before each of blasts 5 to 9 | Round paint balls cross the sky in the shot of the giant, then in the shots of the slope |
| 13.80, 14.60, 15.40, 16.30, 17.20 | Blasts 5 to 9 (radius 2.2 to 2.6 m, distant origin), each with the firs thrown 0.15 s later | Several angles of the flight: Maman running low across the frame with the kitten, paint balls and red, orange and yellow pillars around her |
| 16.70, 17.70, 18.90, 19.80 | Whooshes before blasts 10 to 13 | Same angles |
| 19.40, 20.40, 21.60, 22.50 | Blasts 10 to 13 (radius 3.4, 2.4, 2.4 and 2.2 m), each with the firs thrown 0.15 s later | 19.40 s is a close-up of Maman and the kitten; 21.60 and 22.50 s are close shots of her running past red and yellow paint |
| 23.85 | Maman's right front paw catches the rock: a stone knock and a sharp gasp | The rock under her front paw as she pitches forward |
| 24.05 | She dives forward and slides on the snow: a body scrape, about 1.2 s | She lands on the slope, sliding |
| 24.20 | The kitten leaves her mouth: Maman exhales a cry; the armour rattles as it flies (about 1.2 s of tumbling clinks) | The kitten is thrown free; at 24.60 s it is high in the air above the slope, at 25.10 s tumbling far away |
| 25.10 | Maman's panicked meowing, then a long scream-like call, until the blast at 29.6 s | She slides and rises, then (26.9 to 29.0 s) a close-up of her face looking up and back after the kitten |
| 26.90 | Long whoosh of the violet throw, the longest of the video | Her close-up continues |
| 29.60 | Violet paint blast 14 (radius 4.4 m, the loudest): a wet burst and a low boom; firs thrown 0.15 s later | A violet column rises behind her (small at 29.60 s, huge at 29.75 s); she sits in front of it |
| 30.50 | Maman scrambles and bolts away: snow thrown by her paws, fast steps and panting until the end | She stays crouched until about 30.4 s (the scene code said 30.10 s), then runs off to the side |
| 29.50 and 32.20 | A whoosh, then violet blast 15 (radius 3.4 m) with thrown firs at 32.35 s | A cream flash over the whole frame at 32.20 s; Maman tiny in the distance |
| 34.60 | The sounds fall silent with the fade to black: the tail of the blast fades and the wind stays a moment | An aerial shot of the slope with Maman a dot running; the picture darkens from about 34.6 s and is fully black from 35.33 s |

### Part 2: the black and the fall (35.3 to 45.6 s)

Black from 35.33 to 37.10 s (the end of the chase plus the 0.6 s joint). The fall is told in six flickering fragments, and the picture is also black for 1 to 16 images inside some of them. The black gaps are (s): 37.30 (one image), 37.80 to 38.10, 38.40 to 38.47, 38.63 to 38.67, 38.80 to 39.00, 39.20 to 39.27, 39.57 to 40.10, 40.50 to 40.60, 40.90 to 40.93, 41.07 to 41.20, 41.33 to 41.37 and 41.50 to 41.53 (`ffmpeg blackdetect`, `d=0.03`). A sound that starts on a cut can be placed on the first image after the black. The fall segment starts at 36.6 s: the times below are the video's. The nine pieces of armour come off one at a time; the helmet stays on.

| Time (s) | Sound moment | What the picture shows |
|---|---|---|
| 37.10 | First fragment cuts in out of black: wind rushing, the kitten spinning high above the mountains | The kitten, armoured, in a spiral in front of snowy mountains |
| 37.45 | Breastplate pops off: a metal clink, then a thin falling whistle | The kitten tumbles with its armour loosening (frame at 37.45 s) |
| 38.10 | Cut to the sky: the kitten whooshes past the camera, a wind roar | Blue sky, the kitten small and tumbling, a piece of armour in the air at 38.30 s |
| 38.30 | Left shoulder plate comes off: a metal clink | A plate at the top of the frame |
| 38.45 | Right shoulder plate comes off: a metal clink | Mountains again, the kitten large, a plate beside it |
| 39.00 | Cut: the kitten close and tumbling, wind and fur flutter | The kitten large in the frame over a pale mist |
| 39.20 | Backplate comes off: a metal clank | Two images of black (39.20 to 39.27 s), then the kitten without it |
| 39.35 | First back lame comes off: a light metal rattle | The kitten tumbling over tree tops, plates in the air |
| 40.10 | Cut to the ground: a plunge from far above, wind rising fast, grass blades whipping | Sky seen between tall grass blades, the kitten a dot |
| 40.28 | Third back lame comes off in the plunge: a small metal ring in the wind | The kitten tiny, pieces of armour around it |
| 40.72 | Last back lame bursts off: a metal ring | A new shot at ground level (from 40.60 s): the kitten tumbles in the air above the grass |
| 41.20 | First impact on the meadow: a heavy soft thud in the grass, a helmet knock; a second, lighter bounce about 0.5 s later | The kitten is still in the air at 41.0 s and the contact itself is hidden by the cut at 41.07 to 41.20 s (the scene code said 40.70 s). The roll starts at once |
| 41.20 to 41.90 | Roll through the tall grass, two turns: rustle, fur and helmet thumps | The kitten rolls towards the camera, helmet on |
| 41.50 | First tail cuff comes off: a ring that rolls and wobbles on the ground | A ring on the grass beside the kitten (visible from about 41.45 s) |
| 41.90 | The roll ends, the kitten lies on its side: the grass settles, one last wobble of metal | The kitten slows and lies down |
| 42.30 | Second tail cuff comes off and rolls away: a ring, a wobble, rest | A second ring on the grass |
| 42.60 | Silence: a soft breath of the sleeping kitten and distant wind | The kitten lies still among the pieces of armour: the opening shot of the game |
| 43.30 | The picture fades to black: everything stops | The fade runs from 43.30 to 43.60 s, black from 43.60 to 45.60 s. The game then shows the same meadow with the sleeping kitten among the pieces of armour, so no sound is needed to join the two |

## Cutscene 2: the sword (7.000 s)

Checked on `cutscene_sword.mp4` (h264, 1280 × 720, 30 images/s, 210 images, 5,074,973 bytes). The strike of the brush is at 2.00 s; around the catch, between about 3.4 and 3.9 s, the picture is in slow motion (0.45×, `SLOW` in `tools/cutscenes/stages/sword/plan.js`), so sounds there can be stretched or layered. The boss music goes on under the whole video.

| Time (s) | Sound moment | What the picture shows |
|---|---|---|
| 0.70 | Sword glint, a rising chime: the stone's light starts | The kitten, seen from behind, faces the stone; a faint column of light rises from it (visible from 0.70 s, not yet at 0.30 s, where the scene code placed it). The red boss stands beyond |
| 0.85 | Kitten starts running, paws on the arena floor (loop until the dash at 1.8 s) | The kitten turns and runs towards the stone (the code said 0.60 s; at 0.60 s it still stands) |
| 1.05 | Giant brush lifted: fur and air whoosh (wind-up) | The brush head rises at the top right of the frame (frames at 1.05 s and 1.20 s). The code said 1.12 s |
| 1.60 | Giant brush falling, air whistle, peak 0.4 s before the impact | The boss stands upright, the brush is out of frame: the sound leads the picture and the strike lands at 2.00 s |
| 1.80 | Kitten dashes across the line of the strike, a skid on the floor | Close shot: the kitten passes right beside the stone (frames 1.80 to 1.95 s). The code said 1.75 s |
| 2.00 | Brush hits the ground, heavy paint impact | The brush tip on the floor, a bright flash, red paint drops, a pale shock ring (frames 2.00 and 2.05 s) |
| 2.00 | Stone cracks and splits in two, rock crack | The stone opens at the same instant (0.15 s opening) |
| 2.05 | Sword torn out of the stone, metal ring and whoosh | The sword leaves the stone in a burst of light |
| 2.15 | Stone chips and paint droplets falling | Chips and red drops in the air around the split stone |
| 2.70 | Sword spinning in the air, soft whirr (during the rise) | A glint at the boss's collar; the kitten runs low towards the camera |
| 3.00 | Kitten crouches (from about 2.8 s), then leaps: a push-off | Crouched at 2.95 s, hind legs pushing at 3.00 s, in the air at 3.05 s. The code said 2.80 s for the push-off |
| 3.70 | Jaws close on the sword grip, metal clack (slow motion from about 3.4 s) | The sword comes down to the kitten's head at 3.40 to 3.60 s and lies across its mouth at 3.70 s (the code said 3.68 s) |
| 4.40 | Kitten lands with the sword, light paw landing | In the air at 4.30 s, four paws on the floor at 4.40 s. The code said 4.26 s |
| 5.40 | Blade settles in the mouth, a short steel ring | Cut to a close-up of the face between 5.10 and 5.30 s; the blade lies across the mouth towards the right edge |
| 6.20 | Low determined growl or breath: the fight resumes | The same close-up, the eyes steady, until the video ends at 7.00 s. The game goes on with the duel resumed, the stone split and the sword in the kitten's mouth |

The existing combat effects (`combat_brush_air`, `combat_brush_ground`, `combat_sword_air`, `combat_sword_hit`, listed in [credits](../credits.md)) are candidates for 2.00 s and 1.60 s, to be judged by ear.

## Cutscene 3: the hug (15.000 s)

Checked on `cutscene_hug.mp4` (h264, 1280 × 720, 30 images/s, 450 images, 7,025,224 bytes). The music of the moment goes on. Maman has the purple mark on her right flank. The hug purrs of the game already play from 0 s (see above).

| Time (s) | Sound moment | What the picture shows |
|---|---|---|
| 0.00 | Mountain wind and light snowfall, a quiet bed that continues (the music goes on) | Snow summit, Maman lying on her side at the left, the kitten near the fallen helmet at the right |
| 0.50 | Kitten hop 1: soft paw landing in snow, a tiny happy trill | The kitten stands up and starts bouncing on the spot |
| 1.17, 1.83, 2.50, 3.17, 3.83, 4.50 | Kitten hops 2 to 7, one every 0.667 s: soft paw landings (a happy chirp on the third, a higher meow on the sixth) | Contact times come from the cycle of the `HopJoy` clip. The bounce is low and the landings cannot be told apart image by image: follow the cycle, not a visible landing |
| 1.00 | Maman starts to get up: fur and snow rustle, a low tired breath | She lies still, her flank rising and falling; she only starts to move at about 1.4 s |
| 1.50 | Maman lifts her head: a small pained exhale (no blood, no scream) | Her head comes up between 1.4 and 1.6 s (the code said 1.90 s) |
| 2.70 | Maman pushes her chest up on stretched front legs: effort, snow shifting | Front legs stretched and chest rising from 2.4 to 3.0 s |
| 4.50 | Maman limping step 1: uneven soft crunch in the snow (front paw spared) | She is up, head low, and walks with a short step (standing from about 4.0 s) |
| 4.95 | Maman limping step 2 | Second step of the limp |
| 5.00 | Maman sees her kitten: a sharp inhale, then a warm call ("forgets everything") | A new wide side shot: the two cats already run towards each other |
| 5.20 | The kitten answers with an excited trill; fast trot steps until about 5.7 s (the kitten); Maman's quick steps, no limp, about one crunch every 0.4 s | Both cats cross the frame at a trot |
| 5.70 | The two cats meet: a tiny bump of heads, soft fur contact | Nose to nose at 5.7 s (the code said 6.8 s); they then walk flank to flank until 6.8 s |
| 6.80 | The rubbing starts: fur on fur, slow soft brushing, both cats (head contact about 7.55 s, flank contact about 7.90 s) | The two cats stand side by side, the kitten in front, rubbing; the movement is small. Head and flank times come from the cycle of the `Rub` clip |
| 9.80 | The rub ends: a soft release, a short happy meow from Maman | Cut to a lower side shot; Maman begins to lie down. The code said the rub ends at 9.00 s: the cats keep the same pose until the cut at 9.80 s |
| 10.20 | Maman sits, then lies: snow compresses, fur rustle, a content sigh (settled at about 11.8 s) | Her hind legs go down at 10.2 s, sitting at 10.4 s |
| 10.20 to 10.80 | The kitten trots round Maman's head to her belly: fast light crunches | The kitten passes her nose and the helmet and reaches her side |
| 11.30 | The kitten sits, then lies against her belly: fur rustle, a tiny contented squeak | Both lying at 11.2 to 11.5 s |
| 12.00 | The hug: Maman's deep slow purr joins the kitten's | Curled together in the pose of the game's hug, camera on the pair; almost still until the end |
| 15.00 | End of the video, the end screen appears. The scene code wished the purr to go on under it; as the game stands, the step changes to `end` and both existing purrs fade out (time constant 0.35 s in `Purr.stop`) | The last image is the hug camera of the game; the end screen is a translucent cream veil (35 % opacity) with its card over the same scene, so the scene itself does not change (`src/game/EndScreen.js`) |
