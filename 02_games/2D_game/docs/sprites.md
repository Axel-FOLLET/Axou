# Game sprites

Which image the game shows for each element, in each state or stage. The elements and stages follow [`rules.md`](rules.md) (§6 to §9). The paths in the code are listed in `core/src/main/java/com/cropa/view/SpriteCatalog.java`.

- **World scale.** World sprites use 2 pixels per world unit.
- **Animation.** The listed file is frame 0. The next files add `-1`, `-2` and so on before `.png`. Frame counts include frame 0. `Animations.java` sets the timing.
- **Atlas.** `tools/atlas/build_atlas.py` packs the catalogue PNGs into `assets/atlas/`. Edit the source PNGs and rebuild the atlas instead of editing it by hand.
- **The direction used in the game.** The file name starts with the direction the element faces:
  - the enemies come from the right and walk towards the farm: `west-`; when they flee, they are seen from behind: `east-`;
  - the farm faces the enemies: `east-`;
  - the crops, the scarecrow, the cat and the bubbles face the player: `south-`; the catapatates face the field (see "Defenses").
- **Packs.** "Team" means the team made the image with Pixel Lab. "Team, redrawn with Codex" marks an existing team image redrawn by a Python program written with Codex. "Codex" marks a new image drawn by a program. For an animation, the table credits frame 0. Added frames are Codex.

## Plants

The four crops have 12 growth stages at 64 x 64. Seven stages have four sway frames at 0.24 s each. Ripe garlic has only frame 0 before it is bitten. Each stage also has a 3-frame bite animation, keyed as `<crop>_<stage>_eaten`. The first two frames last 0.16 s and 0.20 s, then the last frame holds. The game flattens the same image for a crushed crop.

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Carrot | sprout | `assets/vegetables/carrots/south-carrots-seeds.png` | Team, redrawn with Codex |
| Carrot | ripe (4 frames) | `assets/vegetables/carrots/south-carrots-final.png` | Team, redrawn with Codex |
| Pumpkin | seed | `assets/vegetables/pumpkin/south-pumpkin-seeds.png` | Team, redrawn with Codex |
| Pumpkin | sprout (4 frames) | `assets/vegetables/pumpkin/south-pumpkin-stage1.png` | Team, redrawn with Codex |
| Pumpkin | large sprout (4 frames) | `assets/vegetables/pumpkin/south-pumpkin-stage2.png` | Team, redrawn with Codex |
| Pumpkin | ripe (4 frames) | `assets/vegetables/pumpkin/south-pumpkin-final.png` | Team, redrawn with Codex |
| Turnip | seed | `assets/vegetables/turnip/south-turnip-seeds.png` | Team, redrawn with Codex |
| Turnip | sprout (4 frames) | `assets/vegetables/turnip/south-turnip-stage1.png` | Team, redrawn with Codex |
| Turnip | ripe (4 frames) | `assets/vegetables/turnip/south-turnip-final.png` | Team, redrawn with Codex |
| Garlic | seed | `assets/vegetables/garlic/south-garlic-seeds.png` | Team, redrawn with Codex |
| Garlic | sprout (4 frames) | `assets/vegetables/garlic/south-garlic-stage1.png` | Team, redrawn with Codex |
| Garlic | ripe | `assets/vegetables/garlic/south-garlic-final.png` | Team, redrawn with Codex |
| Bramble | seed | `assets/vegetables/brambles/south-brambles-seeds.png` | Team, redrawn with Codex |
| Bramble | grown (it pricks) | `assets/vegetables/brambles/south-brambles-final.png` | Team, redrawn with Codex |
| Carrot bite | in stage order, 3 frames each | `assets/vegetables/carrots/south-carrots-seeds-eaten.png`, `assets/vegetables/carrots/south-carrots-final-eaten.png` | Codex |
| Pumpkin bite | in stage order, 3 frames each | `assets/vegetables/pumpkin/south-pumpkin-seeds-eaten.png`, `assets/vegetables/pumpkin/south-pumpkin-stage1-eaten.png`, `assets/vegetables/pumpkin/south-pumpkin-stage2-eaten.png`, `assets/vegetables/pumpkin/south-pumpkin-final-eaten.png` | Codex |
| Turnip bite | in stage order, 3 frames each | `assets/vegetables/turnip/south-turnip-seeds-eaten.png`, `assets/vegetables/turnip/south-turnip-stage1-eaten.png`, `assets/vegetables/turnip/south-turnip-final-eaten.png` | Codex |
| Garlic bite | in stage order, 3 frames each | `assets/vegetables/garlic/south-garlic-seeds-eaten.png`, `assets/vegetables/garlic/south-garlic-stage1-eaten.png`, `assets/vegetables/garlic/south-garlic-final-eaten.png` | Codex |

## Defenses

Level 1 uses wood, level 2 adds `-reinforced` and level 3 adds `-metal`. The table shows the base defenses at 64 x 64. Upgraded versions and wear overlays are Codex. A new defense has no overlay. With wear, the overlay name starts with the direction and `-wear`, takes the level suffix, then ends in `-worn`, `-very-worn` or `-almost-broken`.

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Catapatate (potato catapult), top slot | on guard | `assets/defenses/shooting_potatoes/south-shooting-potatoes.png` | Team, redrawn with Codex |
| Catapatate, top slot | throwing (5 frames) | `assets/defenses/shooting_potatoes/south-throws-potatoes.png` | Team, redrawn with Codex |
| Catapatate, bottom slot | on guard | `assets/defenses/shooting_potatoes/north-shooting-potatoes.png` | Team, redrawn with Codex |
| Catapatate, bottom slot | throwing (5 frames) | `assets/defenses/shooting_potatoes/north-throws-potatoes.png` | Team, redrawn with Codex |
| Boxing scarecrow | swaying on guard (4 frames) | `assets/defenses/scarecrow/south-scarecrow.png` | Team, redrawn with Codex |
| Boxing scarecrow | punching (6 frames) | `assets/defenses/scarecrow/south-scarecrow-arm-up.png` | Team, redrawn with Codex |
| Bramble | growing (6 frames) | `assets/vegetables/brambles/south-brambles-grow.png` | Codex |
| Bramble | striking (5 frames) | `assets/vegetables/brambles/south-brambles-strike.png` | Codex |
| Potato | in flight (4 frames) | `assets/defenses/shooting_potatoes/potato.png` | Codex |
| Potato | shadow | `assets/defenses/shooting_potatoes/potato-shadow.png` | Codex |
| Potato | splash (5 frames) | `assets/defenses/shooting_potatoes/potato-splash.png` | Codex |
| Catapatate | destroyed, either slot (6 frames each) | `assets/defenses/shooting_potatoes/south-destroyed.png`, `assets/defenses/shooting_potatoes/north-destroyed.png` | Codex |
| Scarecrow and bramble | destroyed (6 frames each) | `assets/defenses/scarecrow/south-destroyed.png`, `assets/vegetables/brambles/south-destroyed.png` | Codex |
| Upgrade | sparkle (6 frames) | `assets/defenses/fx/upgrade-sparkle.png` | Codex |

Top catapatates face south and bottom catapatates face north, towards the field. A shot shows the throw, recoil, return, reload and ready position. See Plants for the bramble seed and grown plant.

## Enemies

The mole and bat use 64 x 64 images. The witch uses 96 x 96 images.

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Mole | mound above the underground mole (3 frames) | `assets/hostiles/mole/south-mole-mound.png` | Codex |
| Mole | emerging (3 frames) | `assets/hostiles/mole/south-mole-emerge.png` | Codex |
| Mole | eating a crop (4 frames) | `assets/hostiles/mole/south-mole-attack.png` | Team, redrawn with Codex |
| Mole | dying (3 frames) | `assets/hostiles/mole/south-mole-death.png` | Codex |
| Bat | flying (4 frames) | `assets/hostiles/bat/west-bat.png` | Team, redrawn with Codex |
| Bat | diving at the farm (3 frames) | `assets/hostiles/bat/west-bat-attack.png` | Team, redrawn with Codex |
| Bat | fleeing (4 frames) | `assets/hostiles/bat/east-bat.png` | Team, redrawn with Codex |
| Bat | falling (4 frames) | `assets/hostiles/bat/west-bat-death.png` | Codex |
| Witch | walking (4 frames) | `assets/hostiles/witch/west-witch.png` | Team, redrawn with Codex |
| Witch | hitting the farm (4 frames) | `assets/hostiles/witch/west-witch-attack.png` | Team, redrawn with Codex |
| Witch | fleeing (4 frames) | `assets/hostiles/witch/east-witch.png` | Team, redrawn with Codex |
| Witch | dying (4 frames) | `assets/hostiles/witch/west-witch-death.png` | Codex |
| Enemy shadow | on the ground (32 x 12) | `assets/hostiles/shadow.png` | Codex |
| Puff | appearing or disappearing (4 frames, 48 x 48) | `assets/hostiles/puff.png` | Codex |

## Characters

The cat and neighbour use 64 x 64 images. Garry can face north, east, south or west at night. His south-facing standing sprite also appears on the end screen. The neighbour walks in eight directions. The table gives one direction for each of these sets.

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Old Garry | dozing in his chair by day (4 frames, 96 x 96) | `assets/farmer/east-farmer-rocking-chair.png` | Team, redrawn with Codex |
| Rocking chair | empty at night | `assets/farmer/east-farmer-chair.png` | Codex |
| Old Garry | standing up (4 frames) | `assets/farmer/east-farmer-stand-up.png` | Codex |
| Old Garry | breathing (2 frames per direction) | `assets/farmer/south-farmer.png` | Team, redrawn with Codex |
| Old Garry | pitchfork hit (3 frames per direction, 0.3 s total) | `assets/farmer/south-farmer-attack.png` | Team, redrawn with Codex |
| Old Garry | hurt (2 frames per direction) | `assets/farmer/south-farmer-hurt.png` | Codex |
| Cat | sitting, moving its tail (4 frames) | `assets/npc/cat/south-cat.png` | Team, redrawn with Codex |
| Cat | grooming (4 frames) | `assets/npc/cat/south-cat-grooming.png` | Codex |
| Cat | fleeing (4 frames) | `assets/npc/cat/west-cat.png` | Team, redrawn with Codex |
| Chatty neighbour | walking (8 directions, 4 frames each) | `assets/neighbour/east-neighbour.png` | Team, redrawn with Codex |
| Mr Chmunks | title screen and walking away on the end screen (2 frames each) | `assets/npc/ms-chmunks/south-chmunks.png`, `assets/npc/ms-chmunks/east-chmunks.png` | Team, redrawn with Codex |
| Garry's wife | ghost on the end screen (3 frames, 72 x 72) | `assets/npc/wife/south-ghost.png` | Team, redrawn with Codex |
| Henchman 1 | frame 0 | `assets/npc/henchman-1/south-henchman-1.png`, `assets/npc/henchman-1/east-henchman-1.png` | Team, redrawn with Codex |
| Henchman 1 | frame 1 | `assets/npc/henchman-1/south-henchman-1-1.png`, `assets/npc/henchman-1/east-henchman-1-1.png` | Codex |
| Henchman 2 | frame 0 | `assets/npc/henchman-2/south-henchman-2.png`, `assets/npc/henchman-2/east-henchman-2.png` | Team, redrawn with Codex |
| Henchman 2 | frame 1 | `assets/npc/henchman-2/south-henchman-2-1.png`, `assets/npc/henchman-2/east-henchman-2-1.png` | Codex |

## Farm and urn

The farm images are 200 x 200. At night the lit windows are drawn over the night shade.

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Farm | above 80% health, chimney smoke (4 frames, 0.18 s each) | `assets/farm/east-farm.png` | Team, redrawn with Codex |
| Farm | over 60% and up to 80%, broken windows (4 frames, 0.18 s each) | `assets/farm/east-farm-broken-windows.png` | Codex |
| Farm | over 40% and up to 60%, falling tiles (6 frames, 0.09 s each) | `assets/farm/east-farm-half-destroyed.png` | Team, redrawn with Codex |
| Farm | over 20% and up to 40%, smoking (4 frames, 0.15 s each) | `assets/farm/east-farm-smoke.png` | Codex |
| Farm | over 0% and up to 20%, burning (4 frames, 0.12 s each) | `assets/farm/east-farm-flames.png` | Codex |
| Farm | destroyed at 0 health | `assets/farm/east-farm-destroyed.png` | Team, redrawn with Codex |
| Lit windows | intact and broken overlays | `assets/farm/east-farm-light.png`, `assets/farm/east-farm-light-broken.png` | Codex |
| Urn | end screen (64 x 64) | `assets/objects/urn/south-urn.png` | Team, redrawn with Codex |

## Scenery

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Pickup truck | parked by the farm (128 x 128) | `assets/objects/pickup/west-pickup.png` | Team, redrawn with Codex |
| Cypress | two by the farm and pickup (4 frames) | `assets/trees/cypress-south.png` | Team, redrawn with Codex |
| Map trees | 5 kinds in 8 directions, 20 of the 40 views sway (4 frames, 0.40 s each) | `assets/trees/bonsai-east.png` | Team, redrawn with Codex |
| Potato rows | defense rows on the flowers layer (32 x 32) | `assets/potato_rows/potato-row-south-small.png`, `assets/potato_rows/potato-row-north-small.png` | Team, redrawn with Codex |
| Butterflies | two colours in flight (4 frames each) | `assets/maps/assets/decor/butterfly.png`, `assets/maps/assets/decor/butterfly_blue.png` | Codex |
| Firefly | light | `assets/maps/assets/decor/firefly.png` | Codex |
| Cloud | shadow on the ground (192 x 96) | `assets/maps/assets/decor/cloud_shadow.png` | Codex |
| Farm splinters | when the farm is hit (3 frames, 0.06 s each) | `assets/maps/assets/decor/farm_splinter.png` | Codex |

The trees are 112 x 112, except for the 96 x 96 cherry trees. A butterfly holds its first frame for 0.12 s and each following frame for 0.08 s.

## Effects and light

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Dirt, leaf and smoke | particles (3 frames each) | `assets/fx/dirt.png`, `assets/fx/leaf.png`, `assets/fx/smoke.png` | Codex |
| Coin | turning (4 frames) | `assets/fx/coin.png` | Codex |
| Light | window halo (64 x 64) and soft halo (32 x 32) | `assets/light/window_glow.png`, `assets/light/soft_glow.png` | Codex |
| Pixel fonts | 15 px and 8 px glyph sheets | `assets/fonts/pixel-15.png`, `assets/fonts/pixel-8.png` | Codex |
| Web loading screen | reuses Garry's rocking chair (4 frames) | `assets/farmer/east-farmer-rocking-chair.png` | Team, redrawn with Codex |

The particles use 8 x 8 and 16 x 16 images. Their keys are `fx_dirt`, `fx_leaf`, `fx_smoke` and `fx_coin`. The halos use `light_window` and `light_soft`. The fonts have new glyphs. Their `.fnt` files use the advances, kerning and line height from libGDX's `lsans-15`.

## Interface

The table groups related images in `assets/ui/`. The cat and neighbour also have their own speech bubbles.

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Buttons and cards | normal, hover, pressed and disabled | `assets/ui/button-frame.png`, `assets/ui/card-frame.png` | Codex |
| Market stall | frame and awning | `assets/ui/stall-frame.png`, `assets/ui/stall-awning.png` | Codex |
| Panels | HUD, panel and tooltip frames | `assets/ui/hud-frame.png`, `assets/ui/panel-frame.png`, `assets/ui/tooltip-frame.png` | Codex |
| Speech bubble | frame and tails pointing up, down, left or right | `assets/ui/bubble-frame.png`, `assets/ui/bubble-tail-down.png` | Codex |
| Speech bubbles | cat's meow | `assets/talk/Speech-bubble-cat/south-bubble-speech-meow.png` | Team |
| Speech bubbles | neighbour's speech | `assets/talk/Speech-bubble-characters/south-speech-bubble.png` | Team, redrawn with Codex |
| Portraits | Garry, the neighbour and the cat, with a shared frame | `assets/ui/portrait-garry.png`, `assets/ui/portrait-neighbour.png`, `assets/ui/portrait-cat.png`, `assets/ui/portrait-frame.png` | Codex |
| HUD icons | coin, heart and day and night dials, also in small sizes | `assets/ui/coin.png`, `assets/ui/heart.png`, `assets/ui/dial-day.png`, `assets/ui/dial-night.png` | Codex |
| Life bar | background and fill | `assets/ui/lifebar-back.png`, `assets/ui/lifebar-fill.png` | Codex |
| Urn gauge | 11 fill levels from empty to full | `assets/ui/urn-gauge.png` | Codex |
| Stars | empty and full | `assets/ui/star-empty.png`, `assets/ui/star-full.png` | Codex |
| Defense upgrades | wear bar with four fills and upgrade arrow | `assets/ui/wearbar-back.png`, `assets/ui/upgrade-arrow.png` | Codex |
| Shop icons | four crops and three defenses | `assets/ui/icon-carrot.png`, `assets/ui/icon-catapatate.png` | Codex |
| Tutorial and field cells | tutorial arrow, normal cell, hover and range | `assets/ui/tutorial-arrow.png`, `assets/ui/cell-frame.png`, `assets/ui/cell-hover.png`, `assets/ui/range-cell.png` | Codex |

## End screens

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Victory | sunrise over the farm (560 x 320) | `assets/objects/end/end-victory.png` | Codex |
| Defeat | farm under the moon (560 x 320) | `assets/objects/end/end-defeat.png` | Codex |

## Cinematics

One image per scene, made with Pixel Lab, 688 x 384, stretched over the 560 x 320 game world (the images come out about 2% narrower).

| Element | File | Pack |
| --- | --- | --- |
| Intro, scenes 1 to 5 | `assets/cinematics/intro/1.png` to `5.png` | Team; in scene 4, the two henchmen redrawn as knights with Codex |
| Victory, scenes 1 to 3 | `assets/cinematics/victory/1.png` to `3.png` | Team; in scene 1, the two henchmen redrawn as knights with Codex |

## Map

The four tile sheets use 32 x 32 pixels per tile. The map sets `pixels_per_unit` to 2, so each tile covers 16 x 16 world units. The four sheets belong to the Codex pack because they were first drawn with Codex for the public release to replace third-party sheets whose licences forbid redistribution. The larger sheets keep the file names and tile positions used by `map_v1.tmx` and its `.tsx` tilesets.

| Element | Layer | File | Sheet | Tiles used | Pack |
| --- | --- | --- | --- | --- | --- |
| Grass | `floor` | `assets/maps/assets/tileset_grass_spring.png` | 48 tiles (384 x 128) | 33 | Codex |
| Field soil and path | `farmland` | `assets/maps/assets/farmland_tile.png` | 9 tiles (96 x 96) | 0 to 8: corners, edges and centre | Codex |
| Fences | `fences` | `assets/maps/assets/fences_copiar.png` | 15 tiles (96 x 160) | 0 and 6 right rails, 2 left rails, 3 and 5 posts, 7 rails on both sides | Codex |
| Decor | `flowers` | `assets/maps/assets/outdoor_decor_free.png` | 84 tiles (224 x 384) | 14 stump, 72 potted pink flower, 80 potted yellow flowers | Codex |

| Element | State or stage | File | Pack |
| --- | --- | --- | --- |
| Grass | tile 33 swaying (4 frames, 0.24 s each) | `assets/maps/assets/tileset_grass_spring_33.png` | Codex |
| Furrows | under each field cell | `assets/maps/assets/field_furrows.png` | Codex |
| Gate | open (64 x 96) | `assets/maps/assets/gate_open.png` | Codex |
