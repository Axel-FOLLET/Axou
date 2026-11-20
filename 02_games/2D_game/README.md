# Cropa

A 2D farm and defense game in Java with libGDX: by day, you plant and sell; by night, you defend old Garry's farm.

Epitech project (module T-JAV-501), November 2026, made by a team of three. The game is in French and in English: it starts in the language of the computer (French if it is French, English otherwise), and a button at the top right of the title screen switches to the other one.

## Contents

- [The game in a few lines](#the-game-in-a-few-lines)
- [Install and run](#install-and-run)
- [Web version](#web-version)
- [Tests, coverage and Javadoc](#tests-coverage-and-javadoc)
- [Documentation](#documentation)
- [Credits](#credits)
- [Team](#team)

---

## The game in a few lines

Full title: _Un vieil homme riche a volé l'urne de ma défunte femme, je compte la racheter en vendant mes récoltes mais des monstres attaquent ma plantation. 1_ (A rich old man stole my late wife's urn, I plan to buy it back by selling my crops but monsters are attacking my plantation. 1), shortened to **UVHRAVLUDMDFJCLREVMRMDMAMP1**. It is long and absurd on purpose.

The rich Mr Chmunks had the urn stolen: it holds the ashes of old Garry's late wife. He will only give it back for **10,000 coins**. The player helps old Garry for **8 days and 8 nights**:

- **by day** (60 s at most), he plants and harvests carrots, pumpkins, turnips and garlic, buys and upgrades his defenses (catapatate, a potato catapult; boxing scarecrow; bramble), then starts the night;
- **by night** (45 s at most), a wave of moles, witches and bats attacks; the defenses and old Garry fight on their own.

| End | Condition |
| --- | --- |
| Victory | buy the urn for 10,000 coins |
| Defeat | the farm drops to 0 HP, or the urn is not bought at the dawn after night 8 |

The game is played entirely with the mouse. In the first game, a tutorial in five bubbles guides the first day. The full rules, with the balance numbers: [`docs/rules.md`](docs/rules.md).

---

## Install and run

The game builds into a single file, `Cropa-1.0.0.jar`, which runs with Java. It contains the images, the map, the cutscenes and the libraries for Windows, Linux and macOS (never tried on macOS): once built, it can be copied and run from any folder.

### What you need

| What | Why |
| --- | --- |
| **Java 21** (a JDK, not only a JRE) or newer | the game is compiled for Java 21 |
| An internet connection, the first time | Gradle downloads itself, then the game's libraries (about 230 MB in all) |

Gradle does not need to be installed: the folder contains `gradlew` (Linux) and `gradlew.bat` (Windows), which download it.

### 1. Install Java 21

First check whether it is already there, in a terminal (PowerShell on Windows):

```
java -version
```

The first line must show a version that starts with `21` or higher (for example `openjdk version "21.0.12"`). Otherwise:

- **Windows**: download **Temurin 21 (LTS)**, the `.msi` file for Windows x64, from https://adoptium.net. During the installation, choose **"Set JAVA_HOME variable"** ("Will be installed on local hard drive"). Close and reopen the terminal, then run `java -version` again.
- **Linux (Debian, Ubuntu)**:
  ```
  sudo apt install openjdk-21-jdk
  ```

### 2. Get the project

The game is in the `02_games/2D_game/` folder of the [Axou](https://github.com/Axel-FOLLET/Axou) repository.

- **With git**:
  ```
  git clone https://github.com/Axel-FOLLET/Axou.git
  cd Axou/02_games/2D_game
  ```
- **Without git**: on the GitHub page of the repository, click **Code**, then **Download ZIP**. Extract the archive, then open a terminal in its `02_games/2D_game/` folder (the one that contains `gradlew` and `gradlew.bat`).

### 3. Build the game

In the project folder:

- **Windows**:
  ```
  .\gradlew.bat lwjgl3:jar
  ```
- **Linux**:
  ```
  sh gradlew lwjgl3:jar
  ```

The first time, the command shows the download of Gradle (`Downloading https://services.gradle.org/...`, up to `100%`), then nothing more: the project asks Gradle to stay quiet. The next times, it shows nothing at all. The game is built in `lwjgl3/build/libs/Cropa-1.0.0.jar`:

- Windows: `dir lwjgl3\build\libs` must list `Cropa-1.0.0.jar`;
- Linux: `ls lwjgl3/build/libs` must list `Cropa-1.0.0.jar`.

### 4. Run the game

- **Windows**:
  ```
  java -jar lwjgl3\build\libs\Cropa-1.0.0.jar
  ```
- **Linux**:
  ```
  java -jar lwjgl3/build/libs/Cropa-1.0.0.jar
  ```

The window opens on the title screen: the "English" (or "Français") button at the top right changes the language, a click anywhere else starts the opening cutscene, then each click moves to the next scene, up to the first day. The game has no sound.

### Troubleshooting

| Message | Cause | Fix |
| --- | --- | --- |
| "… `java` … is not recognized …" (Windows) or `java: command not found` (Linux) | Java is not installed, or the terminal was opened before the installation | step 1, then reopen the terminal |
| `UnsupportedClassVersionError … class file version 65.0` | the Java found is older than 21 | install Java 21 (step 1); `java -version` must show 21 or higher |
| `EGL: Library not found` (Linux without a full desktop, WSL) | the EGL graphics libraries are missing | `sudo apt install libegl1 libegl-mesa0` |
| step 3 stops on a download error (`services.gradle.org`, `Could not resolve…`) | no internet connection | connect, then run step 3 again |

### Tested on

| System | Java | How | Result |
| --- | --- | --- | --- |
| Debian 13 (trixie), on WSL 2 (Windows 11), 16 November 2026 | OpenJDK 21.0.12 | project extracted from a ZIP archive into a new folder, without a Gradle cache (like a machine where the project was never installed); the build and run steps of this guide, Linux commands | `.jar` built in 27 s, copied alone to another folder, run: title screen shown |

---

## Web version

The `teavm` module builds the same game for a web browser, with [gdx-teavm](https://github.com/xpenatan/gdx-teavm) 1.6.1: TeaVM turns its Java into JavaScript, without Java on the player's side. In the project folder:

```
sh gradlew teavm:gdx_teavm_web_js_build
```

The page is written in `teavm/build/dist/js/webapp/` (`index.html`, `app.js`, the images in `assets/`, about 4 MB). Any web server can serve this folder. The game takes the whole page and starts in the language given in the address, `index.html?lang=fr` or `index.html?lang=en`; without it, in the language of the browser.

On the web, "Quitter" (Quit) at the end of a game closes the card of the portfolio when the game runs in it (the game sends the message `game-quit` to the page of the site). Opened alone, it closes the tab, when the browser allows it: only for a tab opened by a link or a script.

---

## Tests, coverage and Javadoc

In the project folder (Linux commands; on Windows, `.\gradlew.bat` instead of `sh gradlew`):

| Command | What it does | Result |
| --- | --- | --- |
| `sh gradlew build` | compiles, runs the 787 JUnit tests, then writes the JaCoCo coverage report | `core/build/reports/jacoco/test/html/index.html` |
| `sh gradlew core:javadoc` | generates the code documentation | `core/build/docs/javadoc/index.html` |

As with `lwjgl3:jar`, Gradle shows nothing when everything goes well: `echo $?` (Linux) must show `0`. The test report is in `core/build/reports/tests/test/index.html`.

Coverage at v4.17, the final code: 89% of branches, 86% of instructions.

---

## Documentation

| File | Content |
| --- | --- |
| [`docs/rules.md`](docs/rules.md) | The game rules: board, controls, plants, defenses, enemies, characters, balance numbers, shop, what the game does not do |
| [`docs/uml/`](docs/uml/) | PlantUML diagrams: the class diagram (`classes.puml`, split by package in `classes_*.puml`), the sequences of a purchase (`sequence_purchase.puml`) and of a night (`sequence_night.puml`), and an overview of the packages (`overview.puml`) |
| [`docs/sprites.md`](docs/sprites.md) | The image shown for each element of the game, in each state, and the tile sheets of the map |
| [`tools/Tiles.java`](tools/Tiles.java) | The program that draws the four tile sheets of the map, pixel by pixel; `java tools/Tiles.java assets/maps/assets` writes them again |

---

## Credits

All the images were made for the game, with AI tools:

- the sprites marked "Team" in [`docs/sprites.md`](docs/sprites.md), generated with Pixel Lab from the team's descriptions;
- the images of the opening and victory cutscenes ([`assets/cinematics/`](assets/cinematics/));
- the four tile sheets of the map (grass, soil, fences, decor), drawn pixel by pixel after the project, with Codex, to replace third-party sheets that could not be published ([`docs/sprites.md`](docs/sprites.md#map)).

---

## Team

| Track | Who | Content |
| --- | --- | --- |
| A — World and cycle | Antonin | Gradle project and CI, Tiled map, day and night (State pattern), board, plants, money, shop, Melda, tutorial, architecture document |
| B — Enemies and waves | Yohan | Sprites and licences, `Enemy` hierarchy, movements (Strategy pattern), mole, witch, bat, waves, old Garry and the cat, sequence diagrams, proof of playability |
| C — Defenses and HUD | Axel | Class diagram, defenses (`Defense`, catapatate, scarecrow, bramble, "Améliorer" (Upgrade)), libGDX game screen, HUD, shop, cutscenes, project management |
