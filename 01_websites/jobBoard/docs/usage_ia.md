# Usage de l'IA

Le groupe s'est appuyé de **l'intelligence artificielle** comme d'un **outil** de travail : encadré, contrôlé, et toujours au service de décisions humaines. Chaque membre de l'équipe décrit ci-dessous l'usage qu'il en fait dans sa partie.

---

## Front et gestion de projet — Axel

J'utilise principalement deux assistants : Claude Code, et Codex pour un second avis. Leur intérêt tient moins à ce qu'ils produisent qu'au cadre dans lequel ils travaillent.

### Des IA très cadrées

- **Des règles écrites.** Un dossier de règles, que mes assistants lisent obligatoirement au début de chaque session, fixe leur manière de travailler, avec l'accent sur la véracité et la fiabilité des données.
- **Des compétences dédiées.** Des procédures enregistrées (*skills*) encadrent les tâches comme la relecture (optimisation du code ou architecture des fichiers) ou la rédaction, afin de me guider vers des pratiques harmonisées et de m'apprendre des méthodes pérennes.
- **Un contrôle automatique des écritures.** Un *hook* refuse toute modification d'un fichier que ma demande ne nomme pas explicitement. Ainsi, l'assistant n'écrit jamais dans le projet de sa propre initiative.
- **Aucun secret.** L'assistant ne lit jamais les fichiers de configuration qui contiennent des mots de passe ou des clés, et n'en écrit aucun dans le code ni dans Git. Il ne crée ni commit ni envoi vers le dépôt.

### La gestion de projet

L'IA m'a beaucoup aidé à cadrer le travail de l'équipe.
Si le plan a été créé avec Yohan au J1, avec la **définition des attendus**, l'IA a complété le travail de recherche et corrigé les erreurs.

Aussi, je voulais récupérer le système de *tasks* des piscines : chaque journée découpée en tâches à faire pour mes camarades, estimer leur charge, rédiger les documents de tâches de chacun et tenir à jour le contrat d'API qui relie le front et le back. Avec les **skills rédactionnels**, reprendre le système de tasks a optimisé notre temps en explicitant un rendu précis à me donner.

Si au début l'usage ne montrait que peu d'apport, c'est l'intégration d'Ismail qui a **bousculé l'organisation** et, afin de valoriser cet ajout, l'IA m'a permis de mieux partager le travail et d'ajouter des objectifs. Ainsi notre rendu montre bien l'implication de **trois membres intégrés au projet**.

Les **arbitrages** restent en tout temps les **miens** : ce qui entre dans le produit, l'ordre des priorités, la répartition et l'adaptation de la charge de travail entre les membres, la définition du planning, le design, la gestion GitHub, les communications pour l'équipe.

### L'apprentissage

Je me sers de l'**IA pour apprendre** React. Je n'avais encore jamais utilisé de framework sur un projet, et j'étais curieux de commencer. Mes assistants m'accompagnaient déjà durant les piscines et suivaient ainsi la pédagogie qui me convient. L'IA commence ainsi par la théorie, m'expliquant notion par notion ce que j'ai besoin d'apprendre et ses raisons d'être, puis je l'applique moi-même dans les pages du site.

Ce que je ne sais pas expliquer, je ne le livre pas. Pour m'en assurer : des *quiz* tous les soirs afin de valider les acquis, l'IA connaît mes faiblesses et sait orienter les questions pour me mettre en difficulté.

### La relecture

L'IA relit mon travail avant chaque fusion, notamment le CSS : **règles en double, variables oubliées, cohérence entre les pages**. Elle s'appuie sur des règles et des outils dédiés, et complète les contrôles automatiques (`npm run lint`, `npm run build`) sans les remplacer. Pour les documents importants, deux assistants relisent séparément, puis je compare leurs remarques avant de trancher.

### Le code

Ma direction oriente mon code en deux temps. Un premier durant lequel je produis et un second où l'IA me corrige et questionne.


**L'IA n'écrit jamais dans le projet de sa propre initiative** : chaque modification exige une autorisation qui nomme le fichier, la ligne et un *hook* de contrôle automatique refuse toute écriture qui n'en a pas. Lorsqu'elle intervient dans le code, c'est sur une consigne précise ; rien n'est fusionné sans avoir été relu, testé dans le navigateur et compris.

Ainsi, la conception des écrans, l'identité visuelle et chaque décision technique restent les miennes, et je réponds de chaque ligne livrée.

### Les données de démonstration : l'avantage de la génération par IA

En revanche, les *données de démonstration* (les 50 annonces et les dix entreprises, avec leurs SIREN) ont été produites entièrement par l'IA, à partir d'un cahier des charges écrit par l'équipe. Elles sont chargées en base par un script, et la base elle-même vérifie le format et l'unicité de chaque SIREN.

À noter que je les ai relues et ai demandé des modifications légères, mais le **gain de temps** a été remarquable.

---

## Back-end, données et API — Yohan

Mon utilisation de l'IA pour la mise en place du back-end a été **assez importante** dans l'ensemble, notamment pour certaines tâches.

Je l'utilise surtout pour me montrer de **nouvelles notions** que j'essaie d'appliquer par la suite. **Je ne lui demande jamais de me donner la solution en entier.**

Cependant, j'essaie de m'en détacher le plus possible en retenant le maximum d'informations qu'elle m'apprend ou me montre.

### Utilisation des commandes Git

L'utilisation de **plusieurs branches** était une nouvelle notion : j'ai donc utilisé l'IA à chaque fois que je rencontrais des difficultés ou de nouveaux cas de figure, tout en retenant les formules pour **être indépendant** par la suite.

### Réalisation du code

J'essaie de faire **la base du code moi-même**, puis, une fois terminé, je demande l'avis de l'IA. Je prends généralement ses conseils d'amélioration.

Mon but principal est de **comprendre au minimum tous les scripts** fournis par l'IA et de les adapter. Par principe, **je ne fais pas de copier-coller** : je recopie les modifications ou les nouveaux codes à la main et je prends le temps de les relire.

J'ai également utilisé l'IA en complément de *cours en ligne*, pour acquérir la compréhension et les éléments de base du langage SQL (`SELECT`, `FROM`) et la mise en place des tables.

L'IA m'aide encore beaucoup dans la syntaxe quand j'ai besoin d'intégrer du *JSON* dans les scripts.

### Réalisation des tests

À chaque nouvelle étape d'amélioration des scripts Python ou des fichiers SQL, je réalise des tests avec **la commande `curl`** pour simuler des requêtes `GET` et `POST` avec différents paramètres.

J'ai utilisé l'IA pour les premiers tests, afin de vérifier mes commandes `curl` et d'être sûr de bien comprendre leur fonctionnement. **Maintenant, j'essaie de les taper entièrement à la main.**

### Axes d'amélioration pour les futurs projets

Je suis conscient d'être **très dépendant de l'IA**. Pour les futurs projets, j'aimerais progresser sur **l'utilisation de Git** et dans **la réutilisation des notions**.

---

## Back-end, comptes et sécurité — Ismail

Ma partie couvre **les comptes** : l'inscription, la connexion, les sessions, la page « Mon compte », le compte administrateur, la limite des tentatives de connexion et la vérification de l'adresse e-mail.

Une grande partie de ce qu'il fallait savoir sur le serveur et sur Flask était nouvelle pour moi : **l'IA m'a donc servi avant tout à apprendre**.

### Apprendre ce que je ne savais pas

Quand une notion me manquait, je demandais à l'IA de me l'expliquer : par exemple, comment Flask reçoit une *requête* et renvoie une *réponse*, à quoi sert une *session*, ou pourquoi un mot de passe est enregistré **haché et jamais en clair**.

Elle m'a guidé **étape par étape**, jusqu'à ce que je sache l'appliquer dans le code.

### Corriger mes erreurs

Quand le code ne marchait pas, je montrais l'erreur à l'IA. Elle m'aidait à **comprendre d'où elle venait** et comment la corriger, ce qui m'évitait de rester bloqué. Par exemple, les premiers tests ont montré qu'un e-mail envoyé sous forme de nombre provoquait **une erreur 500** au lieu d'un refus clair (400) ; la validation des données envoyées a ensuite corrigé ce cas.

### Tester

Pour l'ensemble des tests, l'IA m'a guidé sur les commandes à taper dans le terminal :

- **Les commandes `curl`**, pour appeler chaque route à la main et vérifier le code de réponse : 201 pour un compte créé, 409 pour un e-mail déjà utilisé, 401 pour un mauvais mot de passe.
- **Un test automatique** pour la limite de connexion : après cinq échecs, le serveur bloque la connexion, même avec le bon mot de passe, et un compte bloqué ne gêne pas les autres.

Les résultats sont notés dans **un document de tests**, avec la commande de chaque cas, pour pouvoir le refaire.
