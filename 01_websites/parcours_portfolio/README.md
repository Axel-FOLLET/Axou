# Axel FOLLET — Resume & Portfolio

My resume website and my portfolio brought together in a single site, with no framework.

**Live site: <https://axel-follet.github.io/my_website/>**

The site is in French (default) and in English.

## Pages

| Page | French | English |
| --- | --- | --- |
| Home | `index.html` | `pages/en/index.html` |
| My background (resume) | `pages/fr/parcours.html` | `pages/en/parcours.html` |
| My portfolio (projects) | `pages/fr/portfolio.html` | `pages/en/portfolio.html` |
| Contact me | `pages/fr/contact.html` | `pages/en/contact.html` |

`404.html` is the page GitHub Pages shows for any missing address. `pages/games/snake.html` and `pages/games/pendu.html` are the two games on their own, the pages loaded by the portfolio cards.

## What is in the portfolio

Seven project cards on a wheel, each with a small animated scene. Some can be tried without leaving the page:

- **Snake** and **Hangman**: both games, playable in the browser (`js/games/`); the original projects are in Python, with Pygame.
- **Caesar and Vigenère ciphers** and **Language detector**: live demos of the algorithms (`js/tools/`).
- **Lost**: the cat of the game, in 3D, which can be turned with the mouse or a finger.
- **Job Board**: links to the candidate, recruiter and admin demos of the deployed project.

## Built with

- HTML, CSS and JavaScript (ES modules). No framework, no build step, no package to install.
- [three.js](https://threejs.org/) r186, as a reduced bundle in `js/vendor/`, only for the 3D cat of the Lost card.
- Manrope and Instrument Serif typefaces, hosted with the site.
- The contact form is sent through Formspree, after an "Are you human?" check.
- Animations stop or simplify when the visitor's system asks for reduced motion.

## Structure

```
index.html              French home page
404.html                page shown for a missing address
pages/
├── fr/                 My background, My portfolio, Contact me (French)
├── en/                 home page and the same three pages (English)
└── games/              Snake and Hangman on their own
css/
├── base/               colours, sizes and other shared values (tokens.css), base rules
├── layout/             header and menu, sections, footer, responsive rules
├── components/         buttons, cards, cubes, timeline, form, motion...
└── pages/              rules of one page each
js/
├── main.js             entry point: loads the modules a page needs
├── modules/            one module per behaviour (navigation, project wheel, timeline, contact form, 3D cat...)
│   ├── cubes/          the 3D cubes
│   └── scenes/         the animated scene of each project card
├── games/              Snake and Hangman
├── tools/              ciphers and language detector
└── vendor/             three.js (reduced bundle)
assets/
├── documents/          resume in PDF, French and English
├── fonts/              typefaces and their licences
├── images/             favicon, photo, LinkedIn logo, share image
└── models/             3D model of the cat
robots.txt, sitemap.xml
```

Code and comments are in English; the text shown to visitors is in French and in English.

## Run it locally

The site uses ES modules, so it must be opened through a web server, not as a file. From this folder:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>.

## How it was built

Missions given to my team of AI agents: for each one, an approved mission brief, then a review by the expert agent.

## Credits

- Photo, drawings and texts: original work by Axel FOLLET.
- 3D cubes, faceted cat, symbols and animated project scenes: built with HTML, CSS, SVG and JavaScript, except the LinkedIn logo.
- Lost's 3D cat: "Rigged and animated Cat" model by JonasDichelle (BlendSwap), under the [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) licence, reshaped and posed sitting; displayed with three.js, under the MIT licence.
- Manrope (The Manrope Project Authors) and Instrument Serif (The Instrument Serif Project Authors) typefaces, under the SIL Open Font License 1.1 (`assets/fonts/OFL-Manrope.txt`, `assets/fonts/OFL-InstrumentSerif.txt`).
- LinkedIn® and the [in]® logo are trademarks of LinkedIn Corporation and its affiliates; this site is neither affiliated with nor endorsed by LinkedIn.
