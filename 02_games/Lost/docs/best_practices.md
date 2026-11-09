# Lost: best practices

Agreed on 2026-11-09 between the project owner and Claude, the AI agent that writes the code. These rules apply to all new work on Lost. Existing code is brought in line during the cleanup pass that follows this document.

## 1. Goals

The code must be easy to debug, clear to read and organised so that a person who opens the repository for the first time finds what they look for. Four questions test every change:

1. Can a reader tell what this file does from its first lines?
2. If this feature breaks, is there one obvious place to look?
3. Can a value be tuned without reading the logic around it?
4. Has the change been seen working in the game?

## 2. Language

Identifiers, file names, comments and documentation are written in English. Text shown to the player is game content, not code: it stays in the language of the game and lives in its own module.

## 3. Code organisation

- **One responsibility per file.** A file that handles two unrelated things is split. A file is not split only because it is long: there is no line limit, each case is judged on its responsibilities.
- **Folders follow the domains of the game**: `audio`, `cat`, `npc`, `game`, `world`, `scene`, `ui`, `input`, `critters`, `style`.
- **`main.js` wires modules together.** It creates the systems and connects them. Game logic lives in the modules.
- **Modules talk through small interfaces.** A module exposes methods and optional callbacks (for example `duel.onSfx`, `story.onMusicCue`). It does not reach into the internals of another module.
- **No dead code.** Code that is no longer used is removed, not commented out. Git keeps the history.

## 4. Tuning values

- Every value that shapes the feel of the game (volume, speed, delay, damage, distance, colour) lives in a named table, not in the logic. Existing examples: `volumes.js`, `difficulty.js`, `climb.js`.
- One table per domain, exported as a constant.
- Each value has its unit and a one-line reason.
- Changing the feel of the game means editing a table. If it requires editing logic, the value is in the wrong place.

## 5. Comments

- A file starts with a few lines: what it does and who uses it.
- A comment explains why a choice was made when the code alone does not show it, and gives the unit of a value.
- A comment does not repeat the code, tell the history of a change, quote a conversation or store a measurement. History goes to the decision log, measurements go to the journal.
- A comment that no longer matches the code is a bug: it is fixed in the same change.

## 6. Debugging

- **Debug access in one place.** All test handles on `window` are declared in a single module and are active in development builds only.
- **Each system can report its state.** A system with internal state exposes a read-only `state` getter that returns plain data (for example `music.state`).
- **No silent failure.** A caught error is logged with a tag for its module (`[audio]`, `[combat]`) and enough context to find the cause.
- **Deterministic tools.** A script that generates an asset uses fixed seeds: two runs give the same file.

## 7. Performance

An optimisation starts from a measurement and ends with one. The figures before and after go to the decision log with the change. Code is not made harder to read for a gain that was not measured.

## 8. Checks

- `npm run check` runs without extra setup: syntax, production build and a short scripted playthrough.
- Unit tests cover pure logic: combat rules, difficulty tables, terrain height. Rendering and audio output are checked in the game.
- A change is done when it has been seen working in the game, not when it compiles.
- What cannot be checked by the agent (sound by ear, a real graphics card, a real phone) is listed for the owner with the reason.

## 9. Decision log

`docs/decisions.md` records every decision, large or small, in professional English.

| Field | Content |
|---|---|
| Date | Day of the decision |
| Decision | What was chosen, in one or two sentences |
| Reason | Why, including the measurement or the feedback behind it |
| Replaces | The earlier decision it overrides, if any |

Entries are written when the decision is made. An entry is never rewritten: a new entry replaces it.

## 10. Documentation

| File | Content |
|---|---|
| `README.md` | What the game is, how to run it, how the code is organised, where to find the rest. Short. |
| `docs/best_practices.md` | This document |
| `docs/decisions.md` | Decision log |
| `docs/journal/` | Work journal, one file per period: what was done, measured and left open |
| `docs/plan/` | Plans for the remaining sessions |
| `docs/research/` | Reference studies (cat movement, proportions, style) |
| `tools/README.md` | How to install and run the asset tools |

Each piece of information has one home. Other files link to it instead of copying it.

## 11. Version control

- Everything needed to rebuild the game is tracked: source, public assets, tools and their instructions.
- Generated output is not tracked: `dist/`, `node_modules/`.
- Working captures (`.shots/`) are not tracked and are sorted regularly.
- An asset or file that is replaced moves to `archive/` (not tracked) until the owner has validated its replacement. It is deleted after validation.
- The owner makes every commit and push.

## 12. Tools and assets

- A tool states its usage at the top of the file and runs from the project root.
- A tool does not depend on a temporary folder. `tools/README.md` gives the full installation steps for a new machine.
- Every third-party asset has its source and licence recorded in the credits.

## 13. Working with the AI agent

- The owner decides what the game is. The agent proposes, builds and verifies.
- The agent asks for every permission before the work starts, not during it.
- A server started by the agent is announced with its port and stopped at the end.
- A report separates what was observed from what was not verified, and names the missing means.
- An estimate is always given as a number.
