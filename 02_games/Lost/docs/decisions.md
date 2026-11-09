# Decision log

Every decision on Lost, large or small, in chronological order. An entry is never rewritten: a later entry replaces it, and its last column names what it replaces. Frame times and frame rates were measured in software rendering (Playwright) unless stated otherwise. The tuning values live in the code; the figures below are those of the date of the decision.

When a source gives only a span of days, the entry gives that span. Decisions with no date are at the end.

## October 2026

| Date | Decision | Reason | Replaces |
|---|---|---|---|
| 2026-10-15 | No purchased assets. | Owner's constraint. | |
| 2026-10-15 | Cat animation is the first priority. Realism is negotiable. The low-poly direction is not retained. | Owner's choice to keep the original idea. | |
| 2026-10-15 | Stack: three.js 0.186, Vite 8, static site. | | |
| 2026-10-15 | Cat source: "Rigged and animated Cat" from BlendSwap, CC-BY, after a check of the file for suspect content. | Most promising free model found: fully rigged, with walk and run cycles. | |
| 2026-10-15 | Blender 4.5 LTS installed and used to inspect the rig and export the GLB. | The model is a `.blend` file. | |
| 2026-10-19 | No decompilation or extraction of the cat of *Stray* (model, textures, animations), even modified. Public videos and images may inspire the work. | Derived work without the rights holders' agreement; the French decompilation exception (L122-6-1 of the intellectual property code) covers interoperability only. | |
| 2026-10-19 | Attachment to the cat becomes the first criterion of the prototype. | Owner's feedback: the cat did not look real and did not invite petting. | |
| 2026-10-19 | The video material of the *Stray* study stays out of the repository. | | |
| 2026-10-20 | Improvements taken from the *Stray* study: ground contact, three-stage petting, tail by state, lively holds, idle activities and sleep, synthesised purr. | Study findings, approved by the owner. | |
| 2026-10-20 | Aesthetics are recorded as a weak point. First gains on light, ground, sky and framing. | Owner's feedback. | |
| 2026-10-20 | All poses come from GLB clips. `src/cat/poses.js` is deleted. | | Hand-written three.js animations |
| 2026-10-20 | `public/models/cat.glb` is produced by `tools/anim_cat.py`, clips baked bone by bone at 24 fps, 258 tracks each. | Clip duration = (last key × 24 + 1) / 24, because the export bakes one extra frame. | |
| 2026-10-20 | Look of `src/scene/World.js`: orbit camera following the cat (fov 42), warm sun with 2048 shadows, bluish backlight, gradient ground, sky and fog 0xc9dcec. | Quick aesthetic gains. | |
| 2026-10-20 | `.playwright-mcp/` added to `.gitignore`. | | |
| 2026-10-22 | No kitten proportions: a young cat is enough to look cute. Fur is the retained aesthetic work. | Owner's choice. | |
| 2026-10-22 | 18 fur shells and drawn eyes. The model is reshaped by script, then the poses are redone. | Owner's choice after feedback on walk, lying, sitting and the head. | |
| 2026-10-22 | Black cat with much more fur. The original texture only slightly modulates the black. | Owner's request, to look cute. | Ginger cat of the pitch; calico coat of the model |
| 2026-10-22 | `reshape()` deforms the rest mesh before any pose: smaller ears, thicker legs (`LEG_THICK`), wider cheeks, muzzle shortened about 30 % with chin moved back (`MUZZLE` 0.3, `CHIN` 0.6), skull ×1.08, ×1.35 on each eye. | Cute look; the earlier setting gave a flat face and protruding chin. | Muzzle 50 % without chin recession |
| 2026-10-22 | One-bone IK (`IK1`) on `Foot_Back_L/R`, poses use it, `run` keeps the original 3-bone IK. | The 3-bone rear-foot IK overrode the hock IK and folded the leg; with IK1 the original run goes under ground (−0.63 unit). | 3-bone IK for poses |
| 2026-10-22 | Walk speed derived from the clip so that feet do not slide (corrected 2026-10-23). | | Fixed 0.9 m/s |
| 2026-10-22 | `tools/measure_cat.py` measures the head raw and after `reshape()` against the CAT Dataset medians and the literature. | | |
| 2026-10-22 | Eyes drawn in a shader: striated green-yellow iris, dark ring, large round pupil, two emissive highlights. | | |
| 2026-10-22 | Shell fur: 18 shells sharing the geometry and skeleton, hair 22 mm at most, spacing 1.8 mm, combing toward the tail, wind ripple, dark roots and lighter tips. | Reduced after the owner's feedback. | 24 shells |
| 2026-10-22 | Fur length per bone (`LENGTH_BY_BONE`: ears 0.06, muzzle 0.14, head 0.35, toes 0.12, legs 0.2-0.45, body 0.85, neck and tail 1), none around the eyes, shells outside `cat.meshes`. | | |
| 2026-10-22 | Pink skin detection removed from the fur. | It caught the red and white boundaries of the calico texture. | Pink skin detection |
| 2026-10-22 | Early exit between hairs in the fur shader. | Gain noted as not measurable in this setup, 10 %. | |
| 2026-10-22 | Head yaw on the back set to 20° (10-20° while paddling). | The head was turned 55°, at a right angle to the neck. | 55° |
| 2026-10-22 | Adaptive quality: after 2 s, under 40 fps, one tier down per second, never back up: resolution to 1, then one fur shell in 2, then in 3. | | |
| 2026-10-23 | The project becomes a cat game: the cat first, then the game. The portfolio scenes of the pitch are no longer the goal. | Owner's change of objective. | New portfolio site |
| 2026-10-23 | Retained for the game: hunting in the grass, yarn, free cat life. No hunger or sleep gauges. Hide-and-seek in the tall grass is discarded. | Owner's answers to a proposed list. | |
| 2026-10-23 | Folder renamed from `portfolio2` to `catGame`. | Change of objective. | `portfolio2` |
| 2026-10-23 | `EAR_SCALE` 0.85. | Ear-tip height 1.487 against target 1.589, spread 2.486 against 2.511. Accepted gaps: ears below the median (cute bias, within the real range), short wide ear, big head, large spread eyes, short leg segments. | 0.75 |
| 2026-10-23 | Head: `MUZZLE` 0, `CHIN` 0, `HEAD_SCALE` 1.12, `EYE_SCALE` 1.45, `CHEEK` 0.18, new `EAR_STRETCH` 1.45. | Six comparative Blender renders, combination chosen by the owner. | Muzzle 0.3, chin 0.6 |
| 2026-10-23 | `WALK_DUTY` 0.67. Walk speed = `WALK_STRIDE` (3.2 / 0.67 ≈ 4.776 units) × scale × `WALK_RATE` 1.25 (0.8 s cycle) / `Walk` 1.00 s ≈ 0.51 m/s (computed). | Observed 0.42 m per 0.8 s cycle ≈ 0.52 m/s, no visible slide within 0.02 m (0.25 m/s backward slip before). | 3.2 × 0.086 × 1.4 / 1.0 ≈ 0.39 m/s |
| 2026-10-23 | Clips redone: `Lie` (sit 0.9 s, lying 1.5 s, settled 2.0 s), petting without paddling (calm on the back 3.0 to 7.0 s), sleep ball at 3.8 s, wake in 6.2 s, one lick every 0.5 s, new stretch. | Real-cat measurements. | Clip with paddling |
| 2026-10-23 | Longer body fur: trunk 0.85 → 1.3, neck 1.0 → 1.3, tail 1.0 → 1.2, calves 0.45 → 0.6. Fluffier head (`headFactor`: skull 1.0, cheeks 1.45, muzzle 0.15), collar 1.6. | Owner's request. The head stayed bare because 907 vertices are weighted on `Nose` against 38 on `Head`. | Earlier length factors |
| 2026-10-23 | Pupils 15 % larger (0.36 × 0.44 → 0.42 × 0.50). | Owner's request. | 0.36 × 0.44 |
| 2026-10-23 | Head tuft dropped, more hair on skull and face (`HEAD_SKULL` 1.2, `HEAD_CHEEK` 1.6, `HEAD_MUZZLE` 0.22). | Owner found the tuft badly placed and too long. | Five-strand tuft |
| 2026-10-23 | Hair spacing 1.8 → 1.5 mm with root width 0.6 → 0.65, then 1.3 mm. | About 45 % more hairs at 1.5 mm; owner's requests. | 1.8 mm |
| 2026-10-24 | Project set aside for later, animation as the work in progress. | Owner's choice. | |
| 2026-10-24 | Back legs redone (`BACK_LEGS`), keys `ROLL45` and `ROLL135` with a straight `Root` path. | Paws stayed folded on the belly; the body went under ground by −0.63 unit. | `TUCK_LEGS` rolled 180° |
| 2026-10-25 | Art direction: soft cartoon, cosy and cute. 3-step toon material, shadows never black, round shapes, golden late-afternoon light, large masses, pastel, no post-processing. Colours in `src/style/palette.js`. | Owner-validated brief; see [research](research/README.md). Discarded: pointed blades, straw and olive tones, physical `Sky`, global `OutlineEffect`, pixelated rendering, toon on the fur. | |
| 2026-10-25 | Petting on the flank, head raised and face visible, eyes half closed. A click on the ground interrupts it. | Owner's request. | Petting on the back |
| 2026-10-25 | `BACK_ROLL` 165°, `BACK_YAW` −30. | +30 turned the head away from the camera. | Roll of 180° |
| 2026-10-25 | `pole()`, `twisted()`, keys `PET_LEAN`, `PET_SIDE`, `PET_OVER`, back at 175° for the shoulders and 155° for the pelvis. | Elbow and hock targets folded the joints backwards; `rolled()` turned the body in one block. | `rolled()` |
| 2026-10-25 | Twelve clips in `cat.glb`, with `Stalk` 2.00 s and `Pounce` 2.54 s (on the spot, forward motion in code). `Pet` redone from the study of cats on their backs. | | 10-clip GLB |
| 2026-10-25 | Meadow that makes the cat look small: 3 instanced grass layers, 82 000 blades, ≈ 430 000 triangles, 239 flowers of 5 species, quality tiers of 100 / 75 / 55 / 40 % of the blades. | | |
| 2026-10-25 | Clearing of 2.2 m of short grass around the start, 0.8 to 1.2 m grass beyond 6 m, lowered bowl and camera corridor. | | |
| 2026-10-25 | `World.js`: olive ground, fog 9-36 m, start camera (1.45; 0.42; 2.05). | | |
| 2026-10-25 | Six butterflies of 4 species that perch on flowers and fly off. | Tested under Node only; render not seen. | |
| 2026-10-25 | Yarn of 11 cm with its own physics. | Tested under Node only; render not seen. | |
| 2026-10-25 | Hunt: a calm filler is a hunt with chance 0.4 if a perched butterfly is under 4 m; pounce at 0.8 m; catch chance 0.3. Timings read from the GLB. | | |
| 2026-10-25 | Yarn play: `chase` at 1.5 m/s, 1 to 3 pushes, fatigue +1 per throw, the cat lies 15 s at 5. | | |
| 2026-10-25 | Click order: butterfly, cat, yarn, ground. Seven quality tiers. | | |
| 2026-10-25 to 26 | Style pass: `palette.js`, painted sky `sky.js`, Neutral rendering, background `#ffe9cc`, glowing iris, cream interface. | | |
| 2026-10-25 to 26 | Grass tufts of leaves with a half-circle tip in the shader. | 514 628 triangles at high tier. | 518 165 triangles |
| 2026-10-25 to 26 | `Brain` run state beyond 2.5 m; arrows and + / − for the camera, limits 0.7 and 10 m. | | |
| 2026-10-26 | Tiny Glade atmosphere as inspiration, soft relief (about 1 m at most), distant mountains, ruins of a church, knight's helmet with a visor, controls usable on phone, tablet and computer, petting continued on the flank, jump onto low ruins. | Owner's feedback. | |
| 2026-10-26 | The game is named Lost. The goal is to find Maman. A wizard cat in the ruins, an artist cat in a forest to the left of the start, Maman lying at the foot of the mountain. | Owner's decisions. | |
| 2026-10-26 | No more yarn thrown by the player: yarn launchers on the map. End screen with the credits. | Owner's choice. | Throw button and key |
| 2026-10-26 | Play area of 40 m radius at most. Non-player cats with the hero's fur, cost reduced by distance. | Owner's answers. | |
| 2026-10-26 | Maman on a spur inside the area. | Owner's answer. | |
| 2026-10-26 | Helmet remade as an armet from a reference image. Clicking a wall makes the cat climb it. Opening: Maman holds the kitten by the neck, sets it down, leaves, and the kitten sleeps. The hug triggers the end screen, as an overlay with "stay" or "quit". | Owner's answers. | |
| 2026-10-26 | Non-player cats at scale 1.25, names shown: Chagicien, Chartiste, Maman. Chagicien: pastel mauve, round red glasses, deep purple hat. Chartiste: brick red, teal beret, mustard scarf, paint stains. Maman: black, rounder and fluffier. | Owner's details. | |
| 2026-10-26 | Visor always open. Mini-map at the top left in place of a compass. No on-screen hints at all: only the cat and the mini-map. Chagicien and Chartiste seated, large glasses, stiff wide hat, wand and brush in the mouth. | Owner's feedback after playing. | Compass |
| 2026-10-26 | Grass bends where the cat passes instead of being crushed in a circle; flowers follow the same logic. | Owner's feedback. | `uPushA` disc |
| 2026-10-26 | Everything is built at startup, with no loading by zones. | For the 40 m play area. | |
| 2026-10-26 | Helmet with no plume, light brushed steel in toon style. Quit leads to the title screen. The Chagicien's hints are short rhymed poems. | Defaults, not contested. | |
| 2026-10-26 | Folder renamed `Lost`, npm package `lost`. | Owner's request; npm refuses capitals. | `catGame` |
| 2026-10-26 | Petting left out of the scenario work until the owner says exactly what is wrong. | Seventh negative feedback. | |
| 2026-10-26 | Combat plan: the second interaction with the Chartiste starts the fight. Arena in blue, in the style of the *Code Lyoko* loading screen (inspiration only). | Owner's decisions. | |
| 2026-10-26 | Combat plan: boss five times the kitten's size, red coat, outfit scaled. Attacks are brush strikes. The kitten is immortal and is only pushed back. Click on the Chartiste to claw, click elsewhere to move and dodge. The boss's red health bar is the only exception to the clean screen. | Owner's decisions. | |
| 2026-10-26 | Combat plan: sword in a stone, visible before the fight, taken only during it, Arthurian cutscene, held in the mouth. Victory: red and huge back to ginger and small, disappears dancing, sword dropped, arena undone. | Owner's decisions. | |
| 2026-10-26 | End screen: *Fancy Footwork* (Chromeo) 2:20 to 2:57, starry space, giant green alien Maman, kitten with the sword in the mouth then right front paw, flashing Chagiciens, huge "VIBE CODING" on the tempo, green credits, owner first then AI agents by role. | Owner's decisions. Legal reservation noted: crediting does not remove the copyright. | |
| 2026-10-26 | The player names the kitten at the start; Chagicien and Chartiste use the name. Maman does not. The name is asked again for each game. | Owner's decisions. | |
| 2026-10-26 | Performance guidelines accepted: decor really hidden in the arena and end screen, fur-less star Chagiciens (4 to 6, reused), reduced shells or none for the alien Maman, stars in a single `Points`. | Owner's choice among proposed advice. | |
| 2026-10-26 | `Terrain.js`: `heightAt`, `normalAt`, `GLSL_TERRAIN` shared with the grass shaders; distant domes in `Mountains.js`. | | |
| 2026-10-26 | `Ruins.js`: church near (−3.65; −11.95), four walls, two low walls of 0.39 to 0.43 m, 35 332 triangles in one draw call. Four grass kinds, 14 grass-free zones. | | |
| 2026-10-26 | Cat on terrain, A* around high walls, jump on low walls (`Jump` 1.625 s, `JumpDown` 1.29 s). Rubble steps of up to 0.4 m. | | |
| 2026-10-26 | Forest: 44 trees and 9 bushes in 1 draw call, clearing at (−24; 3), radius 4.5 m. | | |
| 2026-10-26 | `MEADOW_LIMIT` 40 m (`NAV.limit` 39.5), spur joined to the mountain, `LEDGE` at (34; 0), fog 12 to 46 m, ground slope ≤ 19.9°. | | `MEADOW_LIMIT` 18 m, fog 9-36 m |
| 2026-10-26 | Non-player cats: `NPC_SCALE` 1.25, fur level of detail 18 shells to 6 m, 9 to 12 m, 6 to 20 m, 3 beyond. | Read 18, 9, 6, 3 at 3, 9, 15, 25 m. | |
| 2026-10-26 | Four yarn launchers on the map. | | P key, throw button |
| 2026-10-26 | Armet with 6 slits, visor open at 53.2°, ears follow, own swivel 35 % (`EAR_SWIVEL` 0.35). | To be validated. | |
| 2026-10-26 | Round mini-map at the top left, no text, 120 px (112 px on phone), rotates with the camera. | | `Compass.js` |
| 2026-10-26 | Interface, help, frame counter, wake prompt, visor key and button removed. Adaptive quality kept with no display. | Owner's feedback. | |
| 2026-10-26 | Gaits: `Trot` clip, slide-free speeds `Walk` 0.516, `Trot` 1.843, `run` 4.148 m/s, click distance thresholds 3 and 10 m. `Pounce` 2.5417 → 1.5417 s. | | |
| 2026-10-26 | Opening: drop point, Maman arrives 3.2 m left, framed shots, no shrink while carried, wake without a click, mini-map hidden until the end. | | Wake on touch |
| 2026-10-26 | See-through occlusion (`src/game/Occlusion.js`): rays to 8 points of the cat and to the speaking cat, 0.2 s fade to opacity 0.25. | Under Node 1.54 ms per frame on average, 2.3 ms worst; not measured on the owner's graphics card. | |
| 2026-10-26 | Bubble framing `talkShot`: picks among fixed distances, heights and angles with real line of sight. | | |
| 2026-10-26 | Wizard's hat brim 0.225 m, ears folded under; eye weights moved from `Ear` to `Head`; tail wrapped on 132° only. | 16.5 % of eye weights sit on `Ear` in the GLB; the tail is too short for 180°. | |
| 2026-10-26 | `Pet` block mirrored (`PET_SIDE = -1`), ears low and spread. | The flank shown was the back; the ear read as a long point. | |
| 2026-10-26 | Chartiste turned so that he no longer hides the hero. Eye closed when the kitten is carried and when it sleeps. | First playthrough. | |
| 2026-10-27 | Snowy mountain, Chavalanche and Bonchats. Maman is at the top of the mountain. The Chavalanche waits at the foot and accompanies the kitten. Bonchats throw snowballs that make it fall. After at least one fall, the Chavalanche can protect it at the player's request. | Owner's request. | Maman on the spur |
| 2026-10-27 | The remaining work is planned in sessions of about 4 hours. | Owner's request. | |
| 2026-10-27 | Work split into a phase without Blender and a phase with Blender (opening, `cat.glb` with `Carried` and `Yawn`). | | |
| 2026-10-28 | During working sessions the development server is started by the AI agent. | | |
| 2026-10-29 | Audio: meows generated in code, ambient music, boss music in an epic, operatic, soulslike style. Fallback to CC0 or CC-BY if the synthesis is not convincing. | Owner's request. | |
| 2026-10-29 | The kitten meows according to the situation, with no player control. Comic voices for non-player cats: Chartiste low and suave, Chagicien scholarly, Chavalanche energetic, Maman adult and reassuring. | Owner's details. | |
| 2026-10-29 | Credits: names appear in the manner of *Star Wars*. Only the way names appear changes. | Owner's request. | |
| 2026-10-29 | Title screen at launch (title, name field, Play button). Default name Chavalier, 16 characters at most. Black bars at top and bottom during the opening. | Owner's decisions. The first gesture also unlocks the audio. | |
| 2026-10-29 | Petting diagnosis on comparison boards shown before any eighth attempt. | The owner described the defect as the sequence of movements; the back study no longer matches the flank pose. | |
| 2026-10-29 | The coordinating AI model is set to Opus 5.5 and chooses the model of each agent, a stronger one only when needed. | Owner's choice. | |
| 2026-10-29 to 30 | One shared Web Audio context (`src/audio/context.js`), unlocked at the Play gesture. | | |
| 2026-10-29 to 30 | Synthesised meows in four voices. `Purr` configurable per instance. Two purrs during the hug. | | |
| 2026-10-29 to 30 | Opening bars of 12 % height. Player name as `{nom}` in the texts. Title screen and sober dialogue window. | | |
| 2026-10-29 to 30 | Opening values: `pause` 0.35, `dip` 0.9, `dipMax` 1.6, `dropAt` 0.01 m, `hold` 0.25, `rise` 0.6, `settle` 0.4 s; drop at contact. | From the study of the carry. | `pause` 0.7, `settle` 1.5 |
| 2026-10-29 to 30 | Seated non-player cats use a `SitNpc` clip. `setHeadDip` with `HEAD_DIP` 1.3 rad. Hug camera on the belly side. | From photo comparisons. | |
| 2026-10-29 to 30 | Grass: `catBend` = body capsule + paws, capped at 1.0; dither to see the cat. | From the grass study. | Trail, `uCorridor`, wake |
| 2026-10-30 | `Pet` clip of 8.625 s with new entries and exit, timings read from the GLB (`PET_LOOP` [3.0; 6.0], `PET_RISE` from 7.0 up to 8.44, rate 1.8). | Petting diagnosis. | `Pet` of 9.042 s |
| 2026-10-30 | Rise uses a second playback of `Pet` with a 0.25 s crossfade. | Clean exit from petting. | |
| 2026-10-30 | Test method: time driven in fixed steps of 0.125 s with a fixed seed. | The test browser renders at 1-2 fps. | |
| 2026-10-30 | Hug of 7 s, then the end screen. During a bubble the cat does not move; speaker and kitten meow in turns. | Owner's feedback. | Cat free to move during a bubble |
| 2026-10-30 | Accepted without a new export: `Sleep` deviation (9 tail channels, at most 0.836°), seat gaps at the thigh top and the visible rear foot. Meadow grass height unchanged. | | |
| 2026-10-31 | Arena: a disc laid on the ground, scenery hidden with `visible = false`, `src/world/Terrain.js` and `field.js` untouched. Construction inspired by the creation of the virtual world in *Code Lyoko*. | Owner's choice among the options. | Flattened ground |
| 2026-10-31 | Boss fur may be changed for the red colour; the health bar uses the same red, in the manner of *Dark Souls*; a huge brush is held in the paw. | Owner's decisions. | |
| 2026-10-31 | The brush strongly pushes the kitten back and heals the boss by 10 % of its health per hit. | Owner's decision. | |
| 2026-10-31 | Target fight duration: 2 min with claws only, 30 s with the sword, attacks chained without being hit, dodging not counted. The sword can be taken by a click from the start of the fight, or never. | Owner's decision. | Proposal of about 2 min 30 |
| 2026-10-31 | The boss disappears in the manner of a soulslike, and the epic music fades to the base music. | Owner's decision. | Disappearance dance |
| 2026-10-31 | Reference measurement on the owner's machine: 60 fps at quality 3/6, 1280 × 800. | The margin is small, so the boss's cost has to be measured. | |
| 2026-10-31 | Arena: `BUILD_TIME` 5 s, disc, wall and 40 pillars instanced, 3 draw calls. | | |
| 2026-10-31 | Boss kept at 18 shells, scale 5, red 0xa8201a, through non-player uniforms, `src/cat/Fur.js` unchanged. Name Chartiste écarlate. | Worst frame-time ratio fight / before 1.29; CPU 3.1 ms per frame in the fight, 3.0 ms with 12 shells, 2.8 ms with 9. | |
| 2026-10-31 | Boss bar: `hold` 0.8 s, `shrink` 0.5 per second, delay segment `#f0e2a0`. | | |
| 2026-10-31 | Duel camera `fight.frame` fits the boss and the kitten; retreat on its axis. No bubble in the fight. | | |
| 2026-10-31 | Bush hiding the shot before the fight left unchanged. | It existed before this work. | |
| 2026-10-31 | Recorded meows per voice from `public/sounds/`, the wizard stays synthesised and was accepted by the owner. Decoded at import, synth fallback until decoded. Gain 0.75. | | Synthesis only |
| 2026-10-31 | Maman backs away by playing `Walk` in reverse once. Half-turn on the hindquarters. | | |
| 2026-10-31 | Hug head shake drops the helmet (clip `HeadShake`, rigid-body fall). Eyes close while petted. | Keeps the hug pose judged good, instead of handling the helmet collision. | |
| 2026-10-31 | Stay and play keeps the kitten without its helmet. Play again restores it. | | |
| 2026-10-31 | The GLB is never a raw export: reference clips are copied byte for byte and new clips grafted. | Export noise and bake order. 19 + 6 clips, 4 902 and 1 548 channels, 0 difference. | |
| 2026-10-31 | Clip names chosen against the bake order (`HeadShake`, `Swipe`). | "Shake" shifted `Sit` by 16.6°. | "Shake", "Scratch" |
| 2026-10-31 | Airborne clips built with margins above the ground. | Game ground contact resets feet to ≈ 4 mm. | |
| 2026-10-31 | Sword and stone are preview-only props in Blender, not exported. | The sword is written in code since 2026-11-01. | |

## November 2026

| Date | Decision | Reason | Replaces |
|---|---|---|---|
| 2026-11-01 | Clips added for the fight and the ending: `BrushHold`, `BrushSwing`, `Flinch`, `Defeat`, `SwordToPaw`, `SwordPawHold`, and `StepBack` for Maman. 32 clips in total. | 25 reference clips identical byte for byte (6 450 channels, 0 difference). | |
| 2026-11-01 | `Defeat` clip for the Chartiste: he sways, drops the brush and falls sitting. It replaces the disappearance dance. | Owner's validation. | Disappearance dance |
| 2026-11-01 | The Chartiste returns to ginger and small first, then dissolves in particles. | Owner's validation. | Disappearance in boss form |
| 2026-11-01 | After the victory the objective is Maman, until the Chavalanche exists. | Owner's agreement. | |
| 2026-11-01 | Tail seam repaired during the graft (45 of 1 806 channels, frames 0 to 7, Tail chain only). | Jolt of up to 10.27° on `Tail.002`; residual loop seam ≤ 0.038°. | |
| 2026-11-01 | Boss brush hold as a bone layer without a second mixer action (13 bones). | Avoids three.js 50/50 blending. | |
| 2026-11-01 | Tail mode `clip` mandatory for `SwordToPaw` and `SwordPawHold`. | In `up` mode the tail tip was under ground in 6 of 8 draws; 0 of 8 in `clip`. | |
| 2026-11-01 | Duel: the boss loops `BrushHold`; click on the boss to attack at least at a trot, click on the ground to dodge. A boss hit heals 10 % of its maximum health. At 0 health, `Defeat`, then victory. | | |
| 2026-11-01 | `FIGHT` claw: cooldown 1.2 s, damage 1 health point, `stand` 0.35 s, `hitReach` 0.95 m, `hitAngle` 1.05 rad, `contact` 0.33 s, `reach` 0.7 m. Boss health 100 = 120 s / 1.2 s. | Owner's target of 2 min. | |
| 2026-11-01 | `FIGHT` boss: first strike 2.5 s, cadence 4.5 s, wind-up 0.75 s, announce 1.2 s, strike 0.88 s, reach 4.7 m, angle 0.35 rad. Knockback 3.0 m in 0.45 s. `defeatHold` 1.0 s. | Walk at 0.52 m/s is too slow to dodge; trot at 1.84 m/s is enough. | |
| 2026-11-01 | Dodge is sideways. | Backing along the axis needs 1.97 s against 1.33 s of announce; sideways exits the cone in 0.43 to 0.57 s. | |
| 2026-11-01 | A received hit cancels the claw in progress. The first boss hit may land during the approach. | | |
| 2026-11-01 | `Flinch` no longer delays the next boss hit. | Before: 2 boss hits in 129.07 s and a win with no dodge; after: one wind-up every 4.50 to 4.60 s. | |
| 2026-11-01 | Click depth rule: a ground point at least 0.1 m closer than the target is a walk; the boss box counts only if the animated body is hit before the ground. | Dodge clicks under the boss silhouette became claws. | |
| 2026-11-01 | Duel camera azimuth pulled to within 0.5 rad of the boss-to-kitten axis, at 0.9 rad/s at most. | Without it the camera reached −131° and the kitten was hidden; with it, hidden 0 times. | |
| 2026-11-01 | `claw.reach` 0.85 m. | With 0.7 the piloted fight lasted 332.97 s with 72 boss hits; with 0.85, 233.87 s with 50 hits. | 0.7 m |
| 2026-11-01 | Boss turns at 0.3 rad/s in guard and aims 0.8 s before its hit, at 5 rad/s. The boss can be attacked from all sides. | Owner's feedback: at 1.6 rad/s it always faced the kitten. | `boss.turn` 1.6 |
| 2026-11-01 | Sword in `src/world/Sword.js`, in the Chartiste's clearing, takeable only during the fight. Pull cutscene with a close-up, a column of light and slow motion at 0.25 around the moment the blade comes free. Sword in the mouth. | | |
| 2026-11-01 | Sword: 4.17 health points per hit, cooldown 1.25 s, for 30 s. | Target of 30 s. | |
| 2026-11-01 | Victory: `Defeat`, ginger and small in 2 s, dissolve in 600 particles (`src/game/Dissolve.js`), sword dropped, bar removed, arena undone in 3 s, scenery restored. | 7.5 s measured, with and without the sword. | Temporary ending at 0 health |
| 2026-11-01 | `src/game/Story.js` creates no sound: `onMusicCue` signals `boss-transform`, `victory`, `explore`. | | |
| 2026-11-01 | Double click means run in the whole game, within 400 ms and 24 px (mouse), 32 (stylus), 48 (finger). | Owner's feedback. | |
| 2026-11-01 | Arena: 150 shards animated in the shader in one draw call. Night shell around the arena (starry sky and ground), only the disc stays blue. | Owner's feedback. 141 → 142 draw calls for the shards; 135 draw calls at night. | |
| 2026-11-01 | Opening shortened: `arrive` 2.2, `pause` 0.25, `alone` 1.0, `search` 2.4, `sit` 1.3, `widen` 2.3 s. | Owner's feedback. 29.2 → 23.417 s measured. | Longer durations |
| 2026-11-01 | Non-player seat redone (`SIT_NPC_V2`) and grafted alone. `Carried` redone: front paws through the body 6.3 cm → 0. | Owner's photos and feedback. | Earlier `SitNpc`, `Carried` |
| 2026-11-01 | Maman retreats with `StepBack` at rate 1.069 (0.4259 m/s). | Foot sliding reduced on all four feet, for example BL 0.3715 → 0.1005 m. | `Walk` at −0.83 |
| 2026-11-01 | Correction of the fight: real pace `clawPace` 1.70 s and `swordPace` 1.77 s; boss health 71 = 120 / 1.70 × 1; sword 4.19 per hit = 71 × 1.77 / 30 (17 hits); heal 7.1 health points. | Cooldown alone gave +41 %. Claw 120.75 s excluding dodge (+0.6 %), sword 29.67 s (−1.1 %). | Health 100, sword 4.17, heal 10 |
| 2026-11-01 | The sword cannot be taken during the boss's announce. | A dodge click near the stone started the pull. | |
| 2026-11-01 | Pull cutscene reframed: run shot, close-up at 1.7 m, flash with four rays, mini-map hidden. Dropped sword larger. | Flash invisible on capture; dropped sword read as a line. | Flash 0.9 m, 0.5 s; `cam.dist` 1.4 |
| 2026-11-01 | Butterflies hidden in the arena. The giant brush shrinks with the boss then hides. Bar reset at 0 health. | Butterflies were yellow dots in the night. | |
| 2026-11-01 | Clicking the lying cat uses a box of the current pose, outside the arena only. Talking to the Chartiste again after his defeat starts no new fight. A click on the starry ground aims at the edge of the disc. | Correction round. | Mesh ray only |
| 2026-11-03 | The mountain is a new zone, behind a keep rampart with an iron portcullis and a drawbridge. One zone is loaded at a time. The bridge can be crossed back. Rampart and bridge are closed until the victory over the Chartiste. | Owner's answer. | Mountain as decor |
| 2026-11-03 | Distant mountains redone in both zones, rocky and credible in the soft style. Snow ground with crunchy steps, snowfall, thin snow with tracks. Work split into two parts. | Owner's answer. | |
| 2026-11-03 | The Chagicien moves to the foot of the bridge when the dialogue with the Chartiste opens. If the kitten arrives before beating the Chartiste, he warns it. | Owner's answer. | |
| 2026-11-03 | Meows redone from new sources (CC0 or public domain, see [credits](credits.md)), same names and gain. | Owner found them frightening, with background noise. Old sources failed the thresholds: kitten background −28.5 to −33.7 dB (limit −45), `maman_2` −40.5 dB, Chartiste too high without a transposition. | Sources of 2026-10-31 |
| 2026-11-03 to 04 | Music as mono 64 kb/s mp3 rendered by `tools/render_music.py`: meadow D major 72 bpm, loop 53.333 s; boss D minor 60 bpm, 48 s, two synchronised layers; mountain G major 90 bpm, 48 s. | | |
| 2026-11-03 to 04 | Decode on `OfflineAudioContext`, no `AudioContext` before Play. Meadow and boss preloaded, mountain on request. | | |
| 2026-11-03 to 04 | Victory is a 4 s crossfade to the meadow, with no victory theme. Silence at the title and end screens. | Owner's decision of 2026-10-31. | |
| 2026-11-03 to 04 | Boss intensity follows the boss's health: track gain × (0.15 + 0.85 × min(1, (1 − life) / 0.7)). Fades 2.5 / 1.5 / 1.2 / 4 / 1.2 s. | | |
| 2026-11-04 | Two zones: the other zone is neither drawn nor computed but stays in memory. Rampart at +X, short fade on the bridge. Rejected: `heightAt` with a global state, a second `THREE.Scene`. | Owner's validation of the recommendations. | |
| 2026-11-04 | Snow steps come from CC0 Freesound recordings. No listening during agent work: the owner listens later and a refusal is corrected afterwards. | Owner's decision. | |
| 2026-11-04 | All volumes centralised in `src/audio/volumes.js`. | | Scattered gains |
| 2026-11-04 | Volumes round 2, with each music at least 3 dB below every cat sound. | Kitten hug purr (−32.0 dBFS) was under the meadow (−31.5). | Tracks 0.18, 0.35, 0.2 |
| 2026-11-05 | The meadow music gains birds, 12.00 dB below the music; the music itself is unchanged. | Owner's listening verdict: all sounds accepted except the meadow music and the intense boss layer. | Meadow without birds |
| 2026-11-05 | The intense boss layer is recomposed with sampled instruments rendered locally (Fluid (R3)). | Same listening verdict. Attacks within 3 dB near the grid 31 % → 70 %, grid deviation 60 → 10 ms. | Earlier layer |
| 2026-11-05 | Volume rule replaced: meows play over the music, not too loud, nothing lowers the music. `meow.file` 0.38, purrs 0.6 / 0.46 / 0.68, tracks meadow 0.16, boss 0.30, mountain 0.19, `bossBase` 1.6. Mix changes are limited to volume, no pitch changes. | Owner's request. Worst-case peak sum 0.974 (computed). The music was masked, not cut: gain and playback stay constant. | Round 2 values and the 3 dB rule |
| 2026-11-05 | Cat click reworked on bounds recomputed from the pose, screen distance to the edge, and a pocket between the legs (`CAT_PICK`). | `SkinnedMesh.raycast` bounds were stale: 357 hits / 342 misses before, 569 / 130 with fresh bounds. | Pose box of 2026-11-01 |
| 2026-11-05 | Camera pivots to the gate if it opens out of frame within 6 m, then control returns where it is. A simple click lets the pivot continue; a camera gesture stops it. | Recommendation applied without an answer from the owner, to be reviewed in play. | |
| 2026-11-05 | Duel camera keeps the kitten in frame near the edge by rising almost to vertical (`fightPitch` 1.45 rad, against 1.1 elsewhere), then returns. Cuts for the sword run and the exit from the close-up. | Recommendation applied without an answer from the owner. Exit needed a cut: 1.76 m at 19 m fits no readable glide. | |
| 2026-11-05 | One `THREE.Scene` with the groups `world.prairie` and `world.mountainGroup`, only one in the scene. `Brain.setZone()` clears paths, targets, hunt and play. The dropped helmet returns at each switch. | | |
| 2026-11-05 | `heightAt` stays pure, with an `x > ZONE2.switchX` test. | 598 ns per call in zone 2, 77.2 ns in the meadow against 85.4 before. | |
| 2026-11-05 | Zone 2 at x = 1000, summit plateau for Maman, path in turns, `MOUNTAIN_FOG` 14 to 80. `SNOW` colours separate from `MOUNTAIN.snow`. | `MOUNTAIN.snow` looked sand-coloured under the warm sun. | `LEDGE` removed; spur flattened from x 22 to the 40 m limit |
| 2026-11-05 | Rampart in `src/world/Rampart.js` with moat, gatehouse and portcullis. Gate opening played once, within sight: bridge 2.6 s, portcullis 2.2 to 4.4 s. Open if the boss is beaten. | | Ledge and spur |
| 2026-11-05 | Crossing by fade: `rise` 0.35, `hold` 0.1, `fall` 0.45 s. Refused during talk, combat, jump, carry, petting and sequences. | | |
| 2026-11-05 | The Chagicien walks from the ruins to the bridge at the first Chartiste bubble (measured 36.353 m). A kitten at the bridge before he departs gets no warning. | | |
| 2026-11-05 | Snow steps on each paw contact of the active clip (`src/audio/SnowSteps.js`), `VOLUMES.snow` 0.26. | | |
| 2026-11-05 | One music rule, `applyMusic`: silent at title and end, boss during the fight, otherwise mountain in zone 2 and meadow elsewhere. | | Per-step wiring |
| 2026-11-05 | Audio bench: run the browser with `--disable-audio-output` and no 3D rendering except for captures. | The WSLg audio output makes `currentTime` drift after 65 to 125 s, and software rendering cannot hold real time. | |
| 2026-11-06 | Distant mountains as stacked contour rows around each peak, flat facets, one static mesh per chain, one `MeshBasicMaterial`, haze baked per vertex. Sharp facets are kept. | Owner asked for rocky peaks, which is an exception to the round shapes of the style guide. | Cones and snow rings |
| 2026-11-06 | One horizon per zone. The drawn mesh only is lowered from x 66 to 82 (`visualHeightAt`), `heightAt` unchanged. | A ridge rose to 19.7 m and read as a smooth dome; `heightAt` difference 0 on 134 130 points. | |
| 2026-11-06 | `camera.far` 500 m. | Vertex distance up to 482.4 m in the meadow, 484.9 m in zone 2. | 400 m |
| 2026-11-06 | Snowfall in zone 2 only: one `THREE.Points`, 5000 to 1300 flakes by quality tier, 2 boxes around the camera. | One large box left 3 or 4 flakes between the camera and the ground. | |
| 2026-11-06 | Thin snow by vertex colour only: earth and rock show through. | Geometry unchanged: 37 009 vertices, 73 160 triangles. | |
| 2026-11-06 | Footprints: one `InstancedMesh`, 320 at most, 150 s life, cleared at title and opening; none in the meadow. | `depthBias` because the mesh differs from `heightAt` by −0.0453 to 0.15 m. | |
| 2026-11-06 | `onPaw` fires per paw contact, delayed 0.04 cycle at walk and trot. | At exact phase the paw is still 2.5 to 3.6 cm up. | |
| 2026-11-06 | Back faces removed at build for every horizon camera. | Image unchanged; −3.1 ms in the meadow, −3.1 ms at the foot, −2.75 ms at the summit. | Full mesh |
| 2026-11-06 | The +9 ms cost of the mountains is left as it is. No compensation through `QUALITY` for snowfall and footprints. | Reducing it needs a changed image. Several other levers were tried and rejected, the image being required to stay identical. | |
| 2026-11-08 | Session 11 A created: three difficulty levels, full defeat, boss music version 3, bridge, shorter mountain, zone 2 style. Cutscenes in 11 B, the mountain characters in 11 C. | Feedback from a game played on the owner's machine. | |
| 2026-11-08 | Three difficulty levels, chosen in the dialogue before the fight, with delayed strikes, combos of 2 or 3 strikes, paint attacks (puddles, trails, zones to flee), and a phase 2 at 50 % of the boss's health. Values in `src/game/difficulty.js`, tuned by the owner in play. | The Chartiste was too easy. | Kitten immortal, on Normal and Hard |
| 2026-11-08 | The sword can be taken from the start at every level. | Owner's wish to reward curiosity. | A sword to be earned on Normal and Hard |
| 2026-11-08 | On defeat the kitten returns before the choice of level. | Owner's decision, for players who want a lower level. | |
| 2026-11-08 | Health bars: boss bar in the style of *Elden Ring*; a smaller copy for the kitten at the top left, with a paw icon. | Owner's decision. | |
| 2026-11-08 | Boss music starts just before the transformation: the meadow stops when the challenge opens, the fight music starts when it closes. | Owner's feedback: the music came too late. | Music at the transformation |
| 2026-11-08 | Boss music version 3, in sampled instruments, inspired by *Elden Ring* boss themes (inspiration only). The previous files are saved. | Owner's feedback: not epic enough. | Boss layers of 2026-11-03 and 2026-11-05 |
| 2026-11-08 | Drawbridge: grass up to the gate, zone change under the arch, a real rampart on the snow side with a piece of meadow visible through the gate. | Owner's feedback: the transition made no sense. | Switch on the bridge band |
| 2026-11-08 | Mountain path about halved, with varied passages (irregular turns, ledge, rock corridor, clearing) and a lower summit. | Owner's feedback: too long and repetitive. | Seven switchbacks |
| 2026-11-08 | Zone 2 style brought to the level of the meadow: firs, rocks and ground redone. Distant mountains kept. | Owner's feedback. | Firs and rocks of 2026-11-05 |
| 2026-11-08 | `VOLUMES.snow` 0.13 (−6 dB). | Owner's feedback: too loud. | 0.26 |
| 2026-11-08 | No performance measurements in this work; one shorter documentation pass at the end. | Owner's agreement. | |
| 2026-11-08 | Session 11 C (Chavalanche, Bonchats, falls, help) added to the same work. | Owner's request. | Separate session |
| 2026-11-08 | Defaults for the mountain plan questions, in the absence of an answer: short slide with `Knockback`, then up; a click on the Chavalanche to get help, no button; protection up to the summit; Bonchats fixed and indestructible; Chavalanche absent from the end screen and the credits; bubbles like the other cats, using the kitten's name, in draft. | The owner can change these in play. | |
| 2026-11-08 | Video cutscenes in session 11 B, captured frame by frame with CCapture.js 2.0.0 from a frozen copy in `tools/vendor/`, with no account or payment. | Owner's request for a copy that is never updated. | |
| 2026-11-08 | One trial only on a public Hugging Face Space, from a capture of the game. | Owner's agreement. | |
| 2026-11-08 | Story of the opening cutscene: the Chartiste hunts Maman to finish his masterpiece, told by the canvas on his easel and a line of the challenge. Maman is slightly hurt, without blood, with a dried purple paint mark. The chase takes place on another mountain. Full scenario in the [roadmap](plan/roadmap.md). | Owner's answers. | |
| 2026-11-08 to 09 | `src/world/snowLook.js` split from `Mountain.js`; `src/game/bossMoves.js` and `difficulty.js` split from `combat.js`; `src/game/climb.js` and `src/world/SnowCats.js` added. | To make the tasks independent. | Code in `Mountain.js` and `combat.js` |
| 2026-11-08 to 09 | Facile cannot be lost (`canLose` false, `floor`). Level chosen on the last page of the challenge bubble, `story.level` defaults to `facile`. | | |
| 2026-11-08 to 09 | Starting values per level, as read in `src/game/difficulty.js` on 2026-11-09 (hits that empty the kitten's bar, boss cadence, announce): Facile 12 (the bar never empties), 4.5 s, 1.2 s; Normal 5, 3.5 s, 0.9 s; Difficile 3, 2.5 s, 0.6 s. Delayed strikes on Normal and Difficile; combos of 2 or 3 strikes on Difficile; paint every 11 s on Normal and 8 s on Difficile; phase 2 at 50 % on Difficile. A brush hit heals 10 % of the boss's health at every level. | Starting values, tuned by the owner in play. | |
| 2026-11-08 to 09 | Defeat at Normal and Hard: `Knockback`, veil, arena removed, boss back to the Chartiste, sword back in the stone, bubble reopened on the choice. No new clip. | | |
| 2026-11-08 to 09 | Music cues: `defi-open` silences, `defi-cancel` restores, `boss-start` at bubble close, `boss-phase2`, `defeat` silent. | | `boss-transform` |
| 2026-11-08 to 09 | Boss moves behind per-level switches. Paint is placed so that a kitten reacting after `paint.reaction` escapes at a trot before the announce ends; a paint hit does not heal the boss. | | |
| 2026-11-08 to 09 | Brush sector half-angle is the largest from which a kitten reacting after `brush.reaction` can exit before impact. A delayed hit locks the aim `announce` s before impact. | On Hard the sector is of the order of 4° in phase 1, under 1° in phase 2, so difficulty comes from cadence, combos, delays and paint. | |
| 2026-11-08 to 09 | One health bar component: boss variant at the bottom with its name, loss trail and a 50 % notch; kitten variant small, with a paw icon, in the duel only. | | |
| 2026-11-08 to 09 | Boss music version 3: D minor, 150 quarter notes per minute, 64 s loop, both layers with the Fluid bank. `VOLUMES.music.bossBase` 0.5. | Keeps the boss entry at meadow level. | 60 bpm, 48 s version; `bossBase` 1.6 |
| 2026-11-08 to 09 | Fake scenery per gate side: snow along the rampart on the meadow side; a rampart and painted meadow on the snow side. | | |
| 2026-11-08 to 09 | Mountain relaid as nodes (`ROUTE`) with varied legs, walkable slope under 19.9°, decor per section. Measured: shortest path 117.38 m (221.45 m before), maximum slope 16.63°. | | |
| 2026-11-08 to 09 | Zone 2 style in `snowLook.js`: bell firs, rounded rocks, drifts and colour marbling, merged small details. | | Shapes in `Mountain.js` |
| 2026-11-08 to 09 | Chavalanche states `home`, `rise`, `wait`, `follow`; he follows the kitten's steps and takes the snowballs in its place up to the summit ledge. Help is offered once after the first fall. He uses the Chagicien's voice. | | |
| 2026-11-09 | Chavalanche designed by the owner: a mountain guide with the body and clips of the other cats, scale 1.25, beige coat with a white belly, blue helmet with ear holes, multicoloured ski mask, khaki bag, two blue poles. | Owner's design. | Cream coat, bonnet and scarf |
| 2026-11-09 | Bonchats: real small white cats at half the scale of the other cats, a bonnet of a different colour each. One snowball every 5 s per cat in range: it grows for 4 s up to their size and a paw strike (`Swipe`) sends it at the 5th second. Eight cats, set in `src/game/climb.js`. | Owner's design; number left to balance the game. | Stacked snowballs with a cat's head |
| 2026-11-09 | Objective after the victory moves to the Chavalanche (`Story._goalAfterVictory`). | He now exists. | Objective Maman of 2026-11-01 |
| 2026-11-09 | Three difficulty levels and the Chavalanche's protection are accepted after playing. | Owner's feedback. | |
| 2026-11-09 | Adjustments for session 12: Chagicien teleports to the bridge; no visible repositioning before the fight; Chartiste's back in defeat; `VOLUMES.snow` 0.065; Bonchats easier to see; snowballs that roll down the slope; a mini-game, to be specified with the owner. | Owner's feedback after playing. | |
| 2026-11-09 | Boss music version 4, "dark requiem": choir, strings, percussion and organ, slow and heavy, then a march at 50 % of the boss's health, at every level. 12 s intro, 96 s slow loop; at the switch, a 16 s voice-only dip, a hit, then an 85 s march loop. Three trials (requiem, colossus, drums), requiem kept, two retouches. Track volume 0.21. | Owner's request for epic, dramatic music that evolves during the fight and does not loop. Accepted after listening. | Boss music version 3 |
| 2026-11-09 | Eleven combat sound effects synthesised by `tools/render_sfx.py` and played by `src/audio/CombatSfx.js`: brush, paint, phase 2, claw, sword. | Owner's request: the Chartiste's attacks had no sound. | |
| 2026-11-09 | The three paint sounds are remade as lava sounds. | Owner's feedback after listening. The set is accepted. | First paint sounds |
| 2026-11-09 | The arena is reduced to the floor and the starry night: the 150 floating shards, the wall of light and the 40 pillars are removed (`src/world/Arena.js`). | Owner's request. | Arena of 2026-10-31 and shards of 2026-11-01 |
| 2026-11-09 | Best practices adopted (`docs/best_practices.md`), with a cleanup pass on the existing code. | Code easy to debug, clear to read and organised for a first-time reader. | |
| 2026-11-09 | Documentation moved to English: README, decision log, journal, roadmap, research summary, credits, tools. | A repository that a recruiter can open and understand. | French notebook and notes |
| 2026-11-09 | French notes archived out of the tracked files. | The English documents replace them. | |
| 2026-11-09 | Identifiers, file names, object names and sound files are in English. Text shown to the player stays in French, in `game/texts.js` and `game/labels.js`. | One language in the code. Files renamed by script, checked by comparing the syntax trees. | French names in the code |
| 2026-11-09 | `Story`, `Npc` and `Brain` are split by theme and joined with a small `mixin` helper. Their tuning tables move to `game/story/tuning.js`, `npc/npcTuning.js` and `cat/brainTuning.js`; `NavGrid` gets its own file. | Classes of 2,113, 2,147 and 1,208 lines held several responsibilities. Keeping one class and one `this` allowed a mechanical check: 210 methods and 120 declarations identical, node by node, before and after. | One file per class |
| 2026-11-09 | `Helmet`, `Ruins` and `Rampart` stay in one file each. | Long, but each has a single responsibility (best practices, section 3). | |
| 2026-11-09 | Shared modules replace copies: `world/random.js` (the seeded generator, ten copies), `audio/loadSound.js` (four copies of the loading code), `isDescendant` and `pawHolder` in `CatRig.js`. | Duplicated code. The three spellings of the generator gave the same output over 1.2 million values. | |
| 2026-11-09 | Dead code removed: unused methods, fields and options, the fixed helmet visor animation, the unused pet poses of `anim_cat.py`. Tuning tables stay exported even when one file reads them; functions are exported only when another file imports them. | Best practices, sections 3 and 4. | |
| 2026-11-09 | Diagnostic fields with no reader in the code are kept (`Story.lastShot`, `lastDrop`, `Npc.hatInfo`, `SnowCats.fire`...). | They are read from the browser console through the development handles. | |
| 2026-11-09 | `tools/render_music.py` keeps only the three tracks of the game (meadow, mountain, boss); the earlier boss versions are removed, about 850 lines. | Tracks no longer used. After the cleanup the four boss files, the mountain track and the eleven effects render byte-identical to the shipped files; the meadow music without birds is sample-identical. | Tracks `boss_v2`, `boss_v3`, `boss_avant`, `prairie_musique` |
| 2026-11-09 | three.js is built as its own chunk. Build warning limit raised to 800 kB. | Measured with Vite 8: one chunk of 1,231.83 kB (369.93 kB gzip) becomes `index` 532.03 kB (192.68 kB gzip) and `three` 700.39 kB (177.48 kB gzip). The game can change without invalidating the three.js cache; three.js alone is over the default limit. | One chunk |
| 2026-11-09 | Mini-map filter matches the English obstacle names, and a unit test now covers it. | Obstacle names had changed during the renaming while the filter kept the French prefixes: launchers and rampart pieces would have been drawn as stones. | |

## Undated

| Date | Decision | Reason | Replaces |
|---|---|---|---|
| Undated | No deadline. | Owner's statement. | |
| Undated | Poses are authored by absolute positions of the IK controllers. `Root` carries roll and translation. Each frame is grounded from the lowest evaluated vertex. | | |
| Undated | `Sit` body tilted 28° around the shoulder. `Walk` computed cycle of 24 frames, stride 3.2 units, front paw 0.15 cycle after the hind. | 0.15 from the filmed cat. | 0.25 |
| Undated | Cat hierarchy root > body > model, scale 0.8 m. Clips cycle or hold their last frame. Standing up is a reverse replay. Petting roll is in the clip. | | Rigid body rotation |
| Undated | Idle fillers (stretch, groom, sit 8 s, lie 12 s) randomly after 8 to 20 s of calm; meow after 30 s; sleep after 60 s. | | |
| Undated | Procedural layers after the mixer: breathing, tail by state, ear twitches, head saccades, head following the pointer. | | |
| Undated | `dt` capped at 0.1 s. | Slowdown only under 10 fps. | |
| Undated | Off-browser preview `tools/pose_preview.mjs` and `tools/rest_bones.py`. Browser checks through Playwright, captures kept in an untracked folder. | | |
| Undated | No agent can hear: every audio judgement by an agent is a measurement, and listening belongs to the owner. | Stated at each audio step. | |
