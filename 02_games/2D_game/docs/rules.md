# Game rules

> [!NOTE]
> Version 1 of 2 November 2026, updated on 3 November 2026 after the team review, then after the class diagram, then on 16 November 2026 (first hit on the farm as soon as the enemy arrives).

## Contents

- [I. Pitch](#1-pitch)
- [II. Goal of the game](#2-goal-of-the-game)
- [III. How a game runs](#3-how-a-game-runs)
- [IV. Board](#4-board)
- [V. Controls](#5-controls)
- [VI. Plants](#6-plants)
- [VII. Defenses](#7-defenses)
- [VIII. Enemies](#8-enemies)
- [IX. Characters](#9-characters)
- [X. Balance numbers](#10-balance-numbers)
- [XI. Shop](#11-shop)
- [XII. Out of MVP scope](#12-out-of-mvp-scope)

---

## 1. Pitch

**Title:** _Un vieil homme riche a volé l'urne de ma défunte femme, je compte la racheter en vendant mes récoltes mais des monstres attaquent ma plantation. 1_ (A rich old man stole my late wife's urn, I plan to buy it back by selling my crops but monsters are attacking my plantation. 1), shortened to **UVHRAVLUDMDFJCLREVMRMDMAMP1**. It is long and absurd on purpose.

An old farmer, **old Garry**, lives on a poor, run-down farm. The rich and greedy **Mr Chmunks** spotted a beautiful pot in his home and sent his henchmen, **Henchman 1** and **Henchman 2**, to steal it. But the pot is an urn: it holds the ashes of old Garry's late wife. Mr Chmunks does not care and will only give it back for an outrageous price of **10,000 coins**.

The player helps the farmer: farm by day, defend the farm by night, and raise the sum before Mr Chmunks sells the urn to someone else.

**Genre:** farm simulator by day, tower defense by night. Top-down view, in 2D, on a fixed screen.

---

## 2. Goal of the game

|                | Condition                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Victory**    | Buy the urn in the shop for 10,000 coins.                                                          |
| **Defeat 1**   | The farm drops to 0 HP.                                                                            |
| **Defeat 2**   | At the dawn after night 8, the player has not bought the urn: Mr Chmunks sells it to someone else. |

A game lasts **8 days and 8 nights** and takes about **10 minutes on average**.

---

## 3. How a game runs

```text
Day 1 → Night 1 → Day 2 → Night 2 → … → Day 8 → Night 8 → dawn: victory or defeat
```

### The day (60 s maximum)

- The player plants, harvests, buys and upgrades.
- The **"Lancer la nuit"** (Start the night) button ends the day before the timer runs out.
- No enemies are present.

### The night (45 s maximum)

- A wave of enemies comes from the right, **5 s** after the night starts: no enemy appears before that.
- When all the enemies of the wave are dead or gone, the day breaks at once, without waiting for the timer to end.
- The shop can still be viewed, but nothing can be bought in it. The player can neither harvest nor upgrade.
- **At daybreak:**
  - the enemies still present flee;
  - the plants grow by one stage.

---

## 4. Board

```text
┌──────────────────────────── Command bubble ─────────────────────────┐
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│               ◇      ◇      ◇      ◇      ◇      (top defenses)       │
│ ┌──────┐    [1,1]  [1,2]  [1,3]  [1,4]  [1,5]   ← row 1              │
│ │FARM  │ 🧑  [2,1]  [2,2]  [2,3]  [2,4]  [2,5]   ← row 2              │
│ │150 HP│    [3,1]  [3,2]  [3,3]  [3,4]  [3,5]   ← row 3              │
│ └──────┘      ◇      ◇      ◇      ◇      ◇      (bottom defenses)    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Command bubble**: HUD bar at the top of the screen.
- **Farm**: on the left, with **150 HP that are never repaired** (100 before the D10 rebalance, see §10; D10 means day 10 of the project).
- **Farmer**: in front of the farm, level with row 2.
- **Field**: 3 rows × 5 columns, so 15 tiles. Column 1 touches the farm; enemies enter through column 5.
- **Enemy path**: enemies appear on the right, 2 tiles before column 5, cross the field, then 3 tiles separate column 1 from the farm. An enemy therefore travels 10 tiles to reach the farm.
- **Defense slots**: 10 in total, 5 above the field and 5 below, one per column.

---

## 5. Controls

The game is played entirely with the mouse.

**The player does not fight.** The defenses and the farmer attack on their own, each at its own rate. The player handles management and placement: they take no active part in defense.

> ℹ️ Actions are only possible during the day.

**No inventory:** a purchase is placed at once; nothing is kept aside.

**A tile or slot that is already taken receives nothing:** the placement is refused and nothing is paid.

| Action              | How                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Plant               | Click an empty tile, then choose the seed: it is paid for and planted at once                                                      |
| Buy a defense       | Click the defense in the shop, then click a defense slot, or a field tile for the scarecrow: it is paid for and placed at once |
| Harvest             | Click a plant: it is sold immediately, at the value of its stage                                                                   |
| Upgrade             | Click a defense, then "Améliorer" (Upgrade)                                                                                        |
| Start the night     | Button                                                                                                                             |
| Skip a bubble of the chatty neighbour | Click                                                                                                                              |
| Change the language | On the title screen, the "English" (or "Français") button at the top right                                                         |

---

## 6. Plants

Each plant has its own stages. It grows one stage per night, and its value depends on the stage reached.

| Plant       | No. of stages | Stages                              | Effect                                                                  |
| ----------- | ------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| **Carrot**  | 2             | sprout → ripe                       | None. Grows fast.                                                       |
| **Pumpkin** | 4             | seed → sprout → large sprout → ripe | None. Worth the most.                                                   |
| **Turnip**  | 3             | seed → sprout → ripe                | Blocks the witch (see §8).                                              |
| **Garlic**  | 3             | seed → sprout → ripe                | Blocks the bat (see §8).                                                |
| **Bramble** | 2             | seed → ripe                         | Defense (see §7). Cannot be sold, but can be harvested to free the tile. |

**The risk/reward choice:** a plant sold early earns little. Kept one more night, it is worth more, but a mole can eat it or a witch can crush it.

---

## 7. Defenses

All defenses are bought during the day, in the shop.

- **Durability:** each defense has a durability. At 0%, it is destroyed.
- **Only one wear per crossing, never added together:** on a field tile, the defense's wear counts (bramble -20%, scarecrow -10%); on a defense slot, the enemy's wear counts (bat -10%, witch -20%). A witch that crosses a bramble therefore takes 20% off it, not 40%.
- **Upgrade:** a single action, with 3 levels at most. Each upgrade increases damage and **resets durability to 100%**.
- **Targeting:** a defense only hits enemies **in range**, **one at a time**.

| Defense                          | Where                           | Effect                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Catapatate** (potato catapult) | Defense slot                    | Range of 2 tiles: up to 2 tiles in a straight line (up, down, left, right) and the diagonal tiles (one tile forward, then one to the right or to the left). Fires at the first enemy in range. A top catapatate targets row 1, then row 2 if row 1 is empty. A bottom catapatate targets row 3, then row 2. |
| **Boxing scarecrow**             | Field tile (instead of a plant) | Punches, in melee, the enemies on its tile and on the neighbouring tiles in a cross (up, down, left, right): range of one tile.                                                                                                                                                                                |
| **Bramble**                      | Field tile                      | Stings after 1 night of growth: planted on day 1, it stings from night 2. Hurts every enemy that crosses it. The mole does not eat it.                                                                                                                                                                         |

**Row 2 is the weakest (on purpose):** when a catapatate is busy with an enemy in row 1 or 3, it does not fire at row 2. The farmer protects this row.

---

## 8. Enemies

Killing an enemy earns coins. An enemy that reaches the farm stops in front of it and hits it at its own rate (see §10), until it dies, destroys the farm or the day breaks.

### Mole

- Ignores the farm: it never causes any HP loss; its only danger is costing money or defenses (garlic / turnip).
- Attacks a **random plant** in the field, then waits **11 s** before the next one. It attacks **2 times at most** (3 before D10), then it leaves.
- Moves underground. It comes out on the plant it eats: during its **3 s meal**, it is visible and the defenses and the farmer can attack it. Then it goes back underground, where nothing can hit it.
- Can eat turnips and garlic: defense by plants is therefore not perfect. Does not eat brambles.

### Witch

- Moves along her row and crushes the plants in her path.
- **In front of a turnip, she stops moving forward.** She turns to the **nearest** free row in the same column, even two rows away from her own, then continues. If two free rows are equally close, she picks one **at random**. A row is free if its tile holds no turnip: a carrot does not stop her, she crushes it.
- **If all 3 rows of the column have a turnip**, she turns to the nearest defense row and flees along it, going back the way she came: row 1 flees through the top, row 3 through the bottom, row 2 at random.
- Damages the defenses she crosses (along the whole row).

### Bat

- Flies and moves fast towards the farm.
- It does not attack plants, **only the farm**.
- **Same rule with garlic**: it turns to the nearest free row; if all 3 rows of the column have garlic, it flees through the nearest defense row, going back the way it came.
- Because it flies, it triggers neither the bramble nor the scarecrow. It only damages the defenses of the defense row it flees through (see §10).

---

## 9. Characters

| Character                       | Role                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Old Garry**                   | Does not move. He dozes in front of the farm, night and day, and hits with his pitchfork the enemies in rows 1 to 3 that are 3 tiles or less from the farm.                                                                                                  |
| **The farmer's cat**            | Does not attack. Runs away when an enemy reaches it. Says "miaou" (meow) at random in a bubble, with no sound. Purely decorative.                                                                                                                            |
| **The chatty neighbour** (NPC)            | Appears **only once per game**, on a random day, **never the first one**. She reels off lame, useless fun facts, in several bubbles whose text is written out slowly. The player clicks to skip each bubble, and the day timer keeps running. Her purpose: to waste the player's time and stress them. |
| **Mr Chmunks, Henchman 1 and Henchman 2** | Characters from the pitch. They only appear in the opening and ending cutscenes, generated by AI, never during play.                                                                                                                                         |

---

## 10. Balance numbers

These values were set by the team on 2 November 2026, after a simulation of the economy of one game (average values, not a played game), then tuned on D9 (Axel's test) and on D10 (simulated full games). They will be tuned further in playtesting.

Starting money: **250 coins** (200 before D10).

Rebalance of 13-14 November 2026 (D10), based on simulated full games (see "Simulation results" below): starting money 250 (instead of 200), farm at 150 HP (instead of 100), farmer's pitchfork at 4 damage (instead of 5), half as many moles and 2 meals at most (instead of 3), ripe pumpkin at 1,000 (instead of 800). The bats, the witches, the defenses, the other plants and the urn price do not change.

### Enemies

| Enemy | HP | Speed                            | Damage per hit on the farm | Rate on the farm | Reward | Other                                              |
| ----- | -- | -------------------------------- | -------------------------- | ---------------- | ------ | -------------------------------------------------- |
| Mole  | 5  | underground, from plant to plant | 0                          | —                | 20     | Takes 3 s to eat a plant, 2 meals at most          |
| Bat   | 20 | 0.35 tile/s                      | 10                         | 1 hit / 5 s      | 30     | Takes 10% durability off the defenses it crosses  |
| Witch | 45 | 0.3 tile/s                       | 20                         | 1 hit / 5 s      | 80     | Takes 20% durability off the defenses she crosses |

The first hit lands as soon as the enemy arrives in front of the farm, then one hit every 5 s. Before 16 November (D11), it landed 5 s after arrival: this delay was removed to make the game harder; the defenses and the farmer must stop the enemy before it reaches the farm.

Rebalance of 12 November 2026 (D9), decided by Axel after his test ("they come at us far too fast", with Plants vs Zombies as the model): the bat and the witch move more slowly, have more HP and hit harder, but they are still fast enough to reach the farm within the 45 s of the night. Before: bat 9 HP, 0.75 tile/s, 5 damage; witch 20 HP, 0.5 tile/s, 15 damage; 1 hit / 10 s; enemies spread over 20 s; ripe pumpkin 700. The simulation of the 8 waves (farmer and catapatates, no plants) gives: with no catapatate, the farm loses 290 HP over the game, so it falls around night 5; with 4 catapatates, it loses 30; with 10, none.

### Defenses

| Defense          | Price     | Damage (lvl 1 / 2 / 3) | Rate          | Wear                           | Upgrade (lvl 2 / 3) |
| ---------------- | --------- | ---------------------- | ------------- | ------------------------------ | ------------------- |
| Catapatate       | 150       | 2 / 3 / 5              | 1 shot/s      | -2% per shot                   | 100 / 200           |
| Boxing scarecrow | 120       | 4 / 6 / 9              | 1 hit / 1.5 s | -10% per enemy that crosses it | 80 / 160            |
| Bramble          | 40 (seed) | 3 / 5 / 8 per crossing | —             | -20% per crossing              | 60 / 120            |
| Farmer           | —         | 4 (5 before D10)       | 1 hit/s       | —                              | —                   |

### Plants

| Plant   | Seed price | Nights to ripen | Value per stage                                                  |
| ------- | ---------- | --------------- | ---------------------------------------------------------------- |
| Carrot  | 10         | 1               | sprout 5, ripe 40                                                |
| Turnip  | 20         | 2               | seed 0, sprout 25, ripe 90                                       |
| Garlic  | 20         | 2               | seed 0, sprout 25, ripe 90                                       |
| Pumpkin | 50         | 3               | seed 0, sprout 70, large sprout 210, ripe 1,000 (800 before D10) |
| Bramble | 40         | 1               | cannot be sold                                                   |

### Waves

Moles arrive late: during the first nights, the player puts all their money into seeds and does not yet have a defense to protect the field.

In each wave, the enemies of the same type arrive spread over 10 s (20 s before 12 November), starting at second 5 of the night: the last one appears before 15 s, and even a slow one can reach the farm before day.

| Night | Moles | Bats      | Witches                         | Intent                                                                               |
| ----- | ----- | --------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| 1     | 0     | 2 (row 2) | 0                               | The farmer defends alone; the first harvest grows.                                   |
| 2     | 1     | 4         | 0                               | First mole.                                                                          |
| 3     | 1     | 5         | 1 (row 2)                       | First witch: the bramble and the turnip become useful.                               |
| 4     | 2     | 6         | 2                               | Moles arrive in numbers: catapatates, paid for by the first pumpkins, become necessary. |
| 5     | 2     | 8         | 2                               | Upgrades become necessary.                                                           |
| 6     | 3     | 8         | 3                               | The pressure rises.                                                                  |
| 7     | 3     | 10        | 4                               | —                                                                                    |
| 8     | 4     | 12        | 5 (2 of them together in row 2) | Final night.                                                                         |

Moles before D10: 0, 1, 2, 4, 5, 6, 6, 8. With 3 meals each, they emptied the field every night from night 4.

**Reference calculations:**

- A witch spends about 3.3 s per column: each level 1 catapatate that has her in range fires at her 4 times, so 8 damage per column.
- In row 2, only one top catapatate has her in range per column (2 tiles straight ahead): the 5 top catapatates leave a row 2 witch at 5 HP (8 damage × 5 columns = 40 for 45 HP); a sixth one, at the bottom, finishes her off.
- In row 1, each top catapatate covers 3 columns (its own and the two diagonals), about 10 s of travel: 10 shots, 20 damage. Two neighbouring catapatates leave a witch at 5 HP; it takes three to kill her.
- A bat spends about 2.9 s per column: in row 1, a single catapatate fires at it 9 times (18 damage) and leaves it at 2 HP; two neighbouring catapatates kill it.
- An enemy that nothing stops hits the farm until daybreak (45 s). It travels 10 tiles (§4) and the wave starts at 5 s. Spawned at 5 s, a bat (about 28.6 s of flight) arrives around 33.6 s and hits 3 times (on arrival, then around 38.6 s and 43.6 s), so 30 HP. A witch (about 33.3 s of walking) arrives around 38.3 s and hits 2 times (on arrival, then around 43.3 s), so 40 HP: her next hit would come after daybreak. Two witches let through on the same night take 80 HP out of 150.
- The farmer hits an enemy as soon as it is 3 tiles or less from the farm, in rows 1 to 3: a lone witch takes 10 s to cover these 3 tiles and takes about 10 hits of 4 there, so 40 HP out of 45. She therefore reaches the farm with about 5 HP and hits once on arrival (first hit on arrival since D11), then dies under the pitchfork before her second hit, 5 s later. With 5 damage (before D10), the farmer killed her alone before she arrived.
- A mole dies during its 3 s meal on a covered tile: 6 damage from a level 1 catapatate, 8 from a scarecrow, for 5 HP. The farmer never reaches it: it only comes out in the field, more than 3 tiles from the farm.
- Killing every enemy in the game earns 3,330 coins (16 moles, 55 bats, 17 witches; 3,650 with the 32 moles from before D10).

**Simulation results** (13-14 November 2026, D10). Full games played by the real game code (`GameSession`, waves, farmer, rewards), without a screen, by programmed players. Each profile plays 10 games, with 10 different random draws; this is repeated on a second series of 10 draws to check that the result holds.

| Profile        | What the player does                                                                                       | Result (series 1 / series 2)                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Good player    | The best of 136 strategies tried (catapatates, turnips in column 5 against the witches, pumpkins)          | wins 10/10 and 10/10, on average on day 7.0 and 6.2                              |
| Average player | One catapatate per day, turnips in column 5 from day 4                                                     | wins 5/10 and 4/10, around day 7 to 8                                            |
| Average +      | Two catapatates per day, turnips from day 3                                                                | wins 9/10 and 6/10, around day 7 to 8                                            |
| Beginner       | One catapatate per day, no turnips                                                                         | never wins: without turnips, the witches get through and the farm falls on night 8 |
| Passive        | Plants carrots, buys no defense                                                                            | never wins: the farm falls around night 6                                        |

With the numbers from before D10, the best player found won only 5 games out of 10 and the average player never won: the witches crushed their whole row (more than 40 plants per game) and the moles emptied the field late in the game.

What the simulation shows:

- **Without turnips, you cannot win.** A column of turnips (column 5) makes the witches go around it: this is the counter that protects the pumpkins.
- The average player wins on about the same day as the good player, but only one game in two, and their farm takes more hits: the difference between the two lies in consistency, not in the day of victory.

The old reference points (economy simulation of 2 November, average values and not played games) gave about 11,800 coins to the good player and 9,200 to the average player after night 8.

The pumpkin earns 20 times its seed price, but stays exposed for 3 nights: it is what drives the economy, and it is what the moles and the witches threaten.

---

## 11. Shop

- **Buying during the day only.** At night, the shop can be viewed but nothing can be bought.
- Contents: seeds of the 5 plants, 3 defenses, upgrades, and **the urn (10,000 coins)**.
- **No inventory:** each purchase is placed at once (see §5).

---

## 12. Out of MVP scope

What the game does not do:

| Element | Reason |
| --- | --- |
| A farmer who moves | The farmer stays in place |
| General plant preferences (attracting or repelling enemies) | Only the turnip and the garlic have an effect |
| A separate "Repair" action | Merged into "Améliorer" (Upgrade) |
| Saving, several farms | Out of the project's time |
| Inventory of harvests | A harvest is sold at once |
| Inventory of purchases | Each purchase is placed at once |
| Active fighting by the player (clicking on enemies) | Only the defenses and the farmer attack |
