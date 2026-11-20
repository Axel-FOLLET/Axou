# Axou

The projects of Axel FOLLET, gathered in one repository: websites, games and algorithms.

They are presented, with demos, on my site: **<https://axel-follet.github.io/my_website/>**

Code, comments and folder names are in English. The text shown to users is mostly in French.

## Websites — `01_websites/`

| Folder | Project |
| --- | --- |
| [`jobBoard/`](01_websites/jobBoard/) | **Y.I.A Jobs**, a job board built with React, Flask and SQLite. Epitech project by a team of three, which I led. Its [README](01_websites/jobBoard/README.md) explains how to install and run it. |
| [`my_website/`](01_websites/my_website/) | **Resume & Portfolio**, my resume website and my portfolio brought together in a single site, with no framework. This is the site published at the address above, from its own repository, [my_website](https://github.com/Axel-FOLLET/my_website). See its [README](01_websites/my_website/README.md). |

## Games — `02_games/`

| Folder | Project |
| --- | --- |
| [`2D_game/`](02_games/2D_game/) | **Cropa**, a 2D farm and defense game in Java with libGDX: by day, you plant and sell; by night, you defend the farm. Epitech project by a team of three. Its [README](02_games/2D_game/README.md) explains how to build and run it. |
| [`Lost/`](02_games/Lost/) | **Lost**, a 3D game in the browser: a kitten looks for its mother. In development, with Three.js and Blender. Its [README](02_games/Lost/README.md) describes the game and how to run it. |
| [`hangman/`](02_games/hangman/) | **Hangman**, in Python with Pygame. My first personal project and my first complete program. |
| [`snake/`](02_games/snake/) | **Snake**, in Python with Pygame. A complete Snake, a personal project built after Hangman. |

## Algorithms — `03_algorithms/`

| Folder | Project |
| --- | --- |
| [`ciphers/`](03_algorithms/ciphers/) | **Caesar and Vigenère ciphers**, in Python: encrypting and decrypting, and finding a Caesar key in a French text. Python piscine exercise. |
| [`language_detector/`](03_algorithms/language_detector/) | **Language detector**, in Python: recognising the language of a text among ten by comparing the frequency of its letters with that of each language. |

## Running the Python projects

Python 3 is required, and Pygame for the two games (`pip install pygame`). Each program is started from its own folder:

```bash
cd 02_games/hangman && python3 hangman_pygame
cd 02_games/snake && python3 snake_pygame
cd 03_algorithms/ciphers && python3 cipher.py
cd 03_algorithms/language_detector && python3 language_detector.py
```

The menus and messages of these programs are in French.
