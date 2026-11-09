# Copie figée de CCapture.js 2.0.0

Demande de l'utilisateur (2026-11-08) : une copie gardée dans le projet, jamais mise à jour automatiquement.

- Source : https://registry.npmjs.org/ccapture.js/-/ccapture.js-2.0.0.tgz, téléchargée le 2026-11-08 sans exécuter de script.
- Licence : MIT (`LICENSE`).
- Empreinte npm de l'archive `ccapture.js-2.0.0.tgz` (sha512) : 6cKIIcK8TIX6uKffk6ItOwsmOnvp5Wx6YXKK6QYWUJFts2OTcLm66feEP6tOclosUE3MicjHz/cG4GbuUWgK2w==

Règles : ne pas l'ajouter à `package.json`, ne pas lancer `npm install ccapture.js` ni `npm update` dessus ; l'importer par son chemin depuis les outils de capture, jamais depuis `src/` du jeu.

Accès réseau relevés à la lecture : `AudioTimeline.js` (`fetch` de l'adresse audio qu'on lui donne) et `GifskiEncoder.js` (GIF haute qualité, code chargé depuis un CDN, en option). Ne pas utiliser `GifskiEncoder`.
