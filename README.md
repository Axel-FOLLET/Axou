# Axou

The projects of Axel FOLLET, gathered in one repository: websites, games and algorithms.

They are presented, with demos, on my site: **<https://axel-follet.github.io/my_website/>**

Code and comments are in English. Folder names and the text shown to users are mostly in French.

## Websites — `01_websites/`

| Folder | Project |
| --- | --- |
| [`jobBoard/`](01_websites/jobBoard/) | **Y.I.A Jobs**, a job board built with React, Flask and SQLite. Epitech project by a team of three, which I led. Its [README](01_websites/jobBoard/README.md) explains how to install and run it. |
| [`my_website/`](01_websites/my_website/) | **Resume & Portfolio**, my resume website and my portfolio brought together in a single site, with no framework. This is the site published at the address above, from its own repository, [my_website](https://github.com/Axel-FOLLET/my_website). See its [README](01_websites/my_website/README.md). |

## Games — `02_games/`

| Folder | Project |
| --- | --- |
| [`Lost/`](02_games/Lost/) | **Lost**, a 3D game in the browser: a kitten looks for its mother. In development, with Three.js and Blender. Its [README](02_games/Lost/README.md) describes the game and how to run it. |
| [`jeu_du_pendu/`](02_games/jeu_du_pendu/) | **Hangman**, in Python with Pygame. My first personal project and my first complete program. |
| [`jeu_du_snake/`](02_games/jeu_du_snake/) | **Snake**, in Python with Pygame. A complete Snake, a personal project built after Hangman. |

## Algorithms — `03_algorithms/`

| Folder | Project |
| --- | --- |
| [`chiffrement/`](03_algorithms/chiffrement/) | **Caesar and Vigenère ciphers**, in Python: encrypting and decrypting, and finding a Caesar key in a French text. Python piscine exercise. |
| [`detecteur_de_langue/`](03_algorithms/detecteur_de_langue/) | **Language detector**, in Python: recognising the language of a text among ten by comparing the frequency of its letters with that of each language. |

## Running the Python projects

Python 3 is required, and Pygame for the two games (`pip install pygame`). Each program is started from its own folder:

```bash
cd 02_games/jeu_du_pendu && python3 hangman_pygame
cd 02_games/jeu_du_snake && python3 snake_pygame
cd 03_algorithms/chiffrement && python3 cipher.py
cd 03_algorithms/detecteur_de_langue && python3 language_detector.py
```

The menus and messages of these programs are in French.
