# Choix techniques du front

Y.I.A Jobs sépare l'interface et les données : le site évolue sans toucher au serveur, et l'API reste ouverte à d'autres interfaces, une application mobile par exemple. 
**Chaque choix technique ci-dessous sert cette promesse : livrer un site internet concret et utilisable aujourd'hui, sans se bloquer demain.**

| Brique | Choix | Version |
| --- | --- | --- |
| Bibliothèque d'interface | React | 19.3 |
| Développement et construction | Vite | 8.3 |
| Navigation entre les pages | React Router | 8.4 |
| Personne connectée | Contexte React (`AuthContext`) | — |
| Session | Cookie signé, `credentials: 'include'` | — |
| Mise en forme | CSS écrit à la main, variables centralisées | — |
| Contrôle du code | ESLint, règles des hooks React | 10.12 |

---

## React

**Choix :** React 19, une bibliothèque d'interface fondée sur des **composants** : chaque morceau d'écran (barre de navigation, carte d'annonce, formulaire) est une fonction réutilisable, qui reçoit des données et rend l'affichage correspondant.

**Alternatives :** Vue, ou du JavaScript sans framework.

**Pourquoi :**
- **Réutilisation.** Le même formulaire de candidature sert sur toutes les annonces ; les mêmes onglets servent aux espaces candidat et recruteur. Ainsi, une correction faite une fois s'applique partout.
- **Un affichage qui suit l'état.** L'écran se décrit *selon l'état* : connecté ou non, chargement, erreur, liste vide. React met la page à jour dès que l'état change. Sans framework, chaque événement exigerait une modification de la page à la main, et chaque nouvel écran multiplierait les cas à ne pas oublier.
- **Un écosystème qui accompagne la croissance.** React est la bibliothèque d'interface la plus utilisée : 44,7 % des développeurs interrogés par Stack Overflow en 2025, contre 17,6 % pour Vue [1]. Faire grandir l'équipe ou le produit ne demandera donc pas de changer d'outil. Face à Vue, techniquement comparable pour un site de cette taille, c'est ce qui a fait pencher la balance.

## Vite

**Choix :** Vite 8, pour le développement et la construction du site.

**Alternative :** Create React App, l'ancien outil officiel, déprécié par l'équipe de React en février 2025 faute de mainteneurs actifs [2]. Démarrer dessus revenait à hériter d'une migration à venir.

**Pourquoi :**
- **Productivité.** En développement, Vite sert les fichiers directement au navigateur, sans tout reconstruire : une modification apparaît à l'écran presque immédiatement, en général sans recharger la page.
- **Un outil à jour.** Depuis la version 8, Vite construit le site avec Rolldown, écrit en Rust ; ses auteurs annoncent des constructions jusqu'à 10 à 30 fois plus rapides [3]. C'est par ailleurs l'un des outils que l'équipe de React recommande à la place de Create React App [2].
- **Un site léger en production.** `npm run build` produit des fichiers statiques minifiés : le front s'héberge indépendamment de l'API.
- **Front et API séparés, sans complication.** En développement, un proxy renvoie les appels `/api` vers le serveur Flask. Pour le navigateur, tout vient de la même adresse : le cookie de session fonctionne sans configuration supplémentaire.

## React Router

**Choix :** React Router 8 : **une seule page HTML**, et une adresse par écran (`/offres`, `/espace-candidat`, `/recruteur`, `/admin`…).

**Alternatives :** une page HTML par écran, ou un affichage conditionnel sans changement d'adresse.

**Pourquoi :**
- **Une navigation fluide.** Changer d'onglet ne recharge pas le site : seule la partie qui change est redessinée, l'en-tête et la session restent en place.
- **Des adresses qui ont un sens.** Chaque écran garde sa propre URL : on peut la partager, la mettre en favori ou revenir en arrière avec le navigateur. Un affichage conditionnel sans adresse perdrait tout cela.
- **Des habillages communs.** Les espaces candidat et recruteur ont chacun leur habillage, qui affiche les onglets et vérifie l'accès une seule fois, pour toutes leurs pages.

## Contexte d'authentification

**Choix :** un contexte React (`AuthContext`), qui donne à toutes les pages la personne connectée.

**Alternative :** une bibliothèque de gestion d'état (Redux, Zustand).

**Pourquoi :**
- **Un besoin simple.** Une seule information est partagée par tout le site : qui est connecté. Au chargement, le site la demande au serveur (`GET /api/auth/me`) ; chaque page la lit ensuite directement.
- **Un outil à la mesure du besoin.** Le contexte est inclus dans React : aucune bibliothèque de plus à maintenir ni à mettre à jour pour ce seul usage. Si le produit venait à partager davantage d'état, une bibliothèque dédiée resterait possible.
- **Le serveur reste l'autorité.** Le contexte sert uniquement à l'affichage (afficher « Se déconnecter », masquer un lien). C'est l'API qui vérifie les droits, à partir de la personne enregistrée en base : modifier le contexte dans le navigateur ne donne accès à rien.

## Cookie de session

**Choix :** la connexion repose sur un **cookie de session** signé par le serveur. Le front n'y touche jamais : il le joint automatiquement à chaque appel (`credentials: 'include'`).

**Alternative :** un jeton que le front conserve lui-même dans le navigateur (`localStorage`) et ajoute à chaque appel.

**Pourquoi :**
- **Un cookie hors de portée des scripts.** Le cookie est `HttpOnly` : aucun script de la page ne peut le lire, donc un script malveillant ne peut pas le dérober. Un jeton conservé dans `localStorage`, en revanche, lui est accessible ; c'est pourquoi l'OWASP déconseille d'y stocker un identifiant de session [4].
- **Des requêtes forgées limitées.** Le cookie est `SameSite=Lax` : le navigateur ne le joint pas aux requêtes de modification (POST, PUT, DELETE) venues d'un autre site [5]. Toutes les actions de l'API passent par ces méthodes. Par ailleurs, l'attribut `Secure` s'active par configuration en production : le cookie ne circule alors qu'en HTTPS.
- **Signé, donc toute modification est détectée.** Le serveur signe le cookie avec une clé secrète : un cookie altéré est rejeté, personne ne peut le modifier pour se faire passer pour un autre.
- **Moins de code côté front.** Aucun jeton à stocker, à renouveler ni à joindre à la main : le navigateur s'en charge.
- **Prêt pour un hébergement séparé.** En développement, le proxy de Vite donne au front et à l'API la même adresse. En production, s'ils sont servis sur deux sous-domaines (par exemple `app.` et `api.`), `credentials: 'include'` permet déjà à la session de suivre ; il restera à indiquer l'adresse de l'API au front et à autoriser celle du front côté API.

## Appels à l'API

**Choix :** un point d'entrée unique pour tous les échanges avec l'API.

**Alternative :** des appels écrits directement dans chaque page.

**Pourquoi :** le cookie, le format JSON et le traitement des erreurs sont gérés à un seul endroit. Ainsi, chaque page reçoit une réponse au même format, et une évolution de l'API se corrige en un point plutôt que dans chaque écran.

## Mise en forme : CSS écrit à la main

**Choix :** du CSS écrit à la main, rangé par rôle (formulaires, onglets, en-tête…) et par page. Chaque couleur, rayon et ombre est une variable définie une seule fois.

**Alternatives :** un framework CSS (Bootstrap, Tailwind).

**Pourquoi :**
- **Une identité visuelle maîtrisée.** Chaque règle est écrite pour le site, selon sa charte graphique : le design ne part d'aucun modèle préexistant.
- **Une charte modifiable en un point.** Changer une couleur de la marque revient à changer une variable ; tout le site suit.
- **Aucune dépendance.** Le style ne dépend d'aucune bibliothèque tierce, ni de ses mises à jour, ni de ses changements de version.

## Contrôle du code

**Choix :** ESLint, avec les règles officielles des hooks React, lancé par `npm run lint` avant chaque fusion.

**Pourquoi :** il détecte, avant même les tests, des erreurs que l'œil laisse passer : variable inutilisée, hook mal placé, mise à jour d'état qui provoquerait des rendus en boucle. Ainsi, le code fusionné respecte les mêmes règles, quel que soit son auteur.

---

## En résumé

| Engagement | Ce qui le garantit |
| --- | --- |
| **Livrer vite** | Composants réutilisables, rechargement immédiat en développement, constructions rapides. |
| **Protéger les comptes** | Session dans un cookie illisible par les scripts, droits vérifiés par le serveur. |
| **Évoluer sans blocage** | Front et API séparés, reliés par un contrat écrit : chaque partie avance sans bloquer l'autre. |
| **Durer** | Des outils standards, maintenus et largement adoptés. |

---

## Sources

1. Stack Overflow, *Developer Survey 2025*, « Web frameworks and technologies » : https://survey.stackoverflow.co/2025/technology
2. React, *Sunsetting Create React App*, 14 février 2025 : https://react.dev/blog/2025/02/14/sunsetting-create-react-app
3. Vite, annonce de Vite 8, 12 mars 2026 : https://vite.dev/blog/announcing-vite8
4. OWASP, *HTML5 Security Cheat Sheet*, « Local Storage » : https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
5. MDN, *Set-Cookie*, attribut `SameSite` : https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
