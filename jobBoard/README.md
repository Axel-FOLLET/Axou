# PROJECT JOB BOARD - Y.I.A Jobs

> À jour du 22/10/2026.

Y.I.A Jobs (initiales de Yohan, Ismail et Axel) est une plateforme d’annonces d’emploi développée avec React, Flask et SQLite.
Projet Epitech réalisé à trois : Axel FOLLET (chef de projet, front-end), Yohan AVRONSART (back-end : données et métier) et Ismail BASSIT (back-end : comptes et sécurité).

## Technologies

| Partie | Outils |
| --- | --- |
| Base de données | SQLite (fichier `backend/jobboard.db`) |
| Back-end / API | Python, Flask 3, sessions par cookie, python-dotenv |
| Front-end | React 19, React Router 8, Vite 8, ESLint |
| Déploiement | Render (gunicorn ; Flask sert le build React), décrit dans `render.yaml` |

## Structure du dépôt
```
JobBoard/
├── backend/                     API Flask et base de données
│   ├── app.py                   crée l'application, enregistre les blueprints et sert frontend/dist s'il existe (port 5000)
│   ├── db.py                    ouverture de la base (clés étrangères activées)
│   ├── auth_utils.py            clé secrète, cookie de session, personne connectée, @login_required, @admin_required
│   ├── routes/
│   │   ├── ads.py               annonces, candidatures, « Mes candidatures », CV du profil, clôture
│   │   ├── admin.py             CRUD d'administration des cinq tables
│   │   ├── auth.py              inscription, connexion, déconnexion, compte
│   │   ├── recruiter.py         catégories, espace recruteur (son entreprise et ses annonces)
│   │   └── verification.py      confirmation de l'adresse e-mail
│   ├── pending_registrations.py inscriptions en attente de confirmation de l'adresse
│   ├── pending_email_changes.py changements d'adresse e-mail en attente de confirmation
│   ├── application_cvs.py       CV en PDF : celui du profil et ceux joints aux candidatures
│   ├── mailer.py                envoi des e-mails (SMTP), désactivable
│   ├── login_limit.py           limite des essais de connexion (5 échecs en 15 minutes)
│   ├── create_admin.py          crée le compte administrateur à partir du .env
│   ├── demo.py                  mode démo (DEMO_MODE=1) : trois comptes et la route GET /api/demo/login
│   ├── schema.sql               création des tables
│   ├── seed.sql                 données de test
│   ├── init_db.py               crée jobboard.db à partir de schema.sql et seed.sql
│   ├── seed_data.py             remplit la base à partir de data/annonces.json (une seule fois)
│   ├── data/annonces.json       données des annonces pour le remplissage de la base
│   ├── queries.sql              requêtes d'exemple
│   ├── checks.sql               insertions qui doivent échouer (tests des contraintes)
│   ├── curl_tests.md            tests de l'API (commandes, codes, réponses)
│   ├── tests/curl_auth.md       tests de l'inscription et de la connexion
│   ├── tests/test_login_limit.py tests automatiques de la limite de connexion (unittest)
│   ├── .env.example             modèle du fichier de configuration
│   └── requirements.txt
├── docs/
│   ├── contrat_api.md           contrat de l'API : routes, champs, codes, messages d'erreur
│   ├── choix_techniques_front.md            choix techniques du front-end
│   ├── choix_techniques_back_donnees.md     choix techniques du back-end : données et API
│   ├── choix_techniques_comptes_securite.md choix techniques du back-end : comptes et sécurité
│   └── usage_ia.md              usage de l'IA par chaque membre de l'équipe
├── frontend/                    interface React (Vite)
│   ├── index.html
│   ├── vite.config.js           proxy des appels /api vers l'API Flask
│   └── src/
│       ├── App.jsx              routes de l'interface
│       ├── api.js               point d'accès unique à l'API (cookie, JSON, erreurs)
│       ├── AuthProvider.jsx     personne connectée, partagée par toutes les pages
│       ├── adminTables.js       description des cinq tables pour l'administration
│       ├── components/          habillage commun, pied de page, barre de recherche, carte d'annonce, formulaires
│       ├── pages/               une page par adresse
│       └── styles/              feuilles de style, une par usage
├── render.yaml                  déploiement sur Render (build, démarrage, variables)
└── .gitignore
```

## Prérequis

- Python 3 (testé avec 3.13 et 3.14)
- Node.js (testé avec v24) et npm

## Installation et lancement

### Back-end

Les commandes suivantes s’exécutent depuis la racine du dépôt, dans un terminal WSL ou Linux. `init_db.py` recrée les tables : les données existantes sont supprimées, compte administrateur compris. Il faut le relancer après toute modification de `schema.sql`, puis relancer `seed_data.py` et `create_admin.py`.

```bash
cd backend
python3 -m venv venv            # sous WSL ou Ubuntu, la commande « python » peut ne pas exister avant le venv
source venv/bin/activate        # dans le venv, « python » fonctionne
pip install -r requirements.txt
cp .env.example .env            # puis remplir .env comme décrit ci-dessous, avant la suite
python init_db.py               # crée jobboard.db et affiche le nombre de lignes par table
python seed_data.py             # ajoute une cinquantaine d'annonces (à relancer seulement après init_db.py)
python create_admin.py          # crée l'administrateur décrit dans .env
python app.py                   # API sur http://localhost:5000
```

Sous Windows avec PowerShell, le venv s’active avec `.\venv\Scripts\Activate.ps1`.

Dans `backend/.env`, avant `init_db.py` (le rôle de chaque clé est dans [Configuration](#configuration)) :

- `SECRET_KEY` : remplacer `change-me` par une chaîne aléatoire, par exemple celle que donne `python3 -c "import secrets; print(secrets.token_hex(32))"`.
- `ADMIN_EMAIL` et `ADMIN_PASSWORD` : les identifiants de l'administrateur, à choisir **avant** `create_admin.py`. Les modifier ensuite n'a aucun effet : le script répond `Admin déjà existant` et garde l'ancien mot de passe.
- E-mails : laisser `MAIL_ENABLED=0` pour tester. Rien n'est envoyé, et chaque e-mail (avec le lien de vérification d'une inscription ou d'un changement d'adresse) s'affiche dans le terminal de l'API, sur une ligne `[mail désactivé]`. Les clés `SMTP_*` et `MAIL_FROM` ne servent qu'avec `MAIL_ENABLED=1` : `SMTP_USER` est le compte Gmail d'envoi de l'équipe, et `SMTP_PASSWORD` son mot de passe d'application Gmail (16 lettres, pas le mot de passe du compte), communiqués par l'équipe et jamais écrits dans le dépôt.

### Front-end

Dans un second terminal, depuis la racine du dépôt :
```bash
cd frontend
npm install
npm run dev                     # interface sur http://localhost:5173, à ouvrir dans le navigateur
```

Vite transmet à Flask tous les appels dont l’adresse commence par `/api` (proxy de `vite.config.js`) : le navigateur ne parle qu'à une seule origine, ce qui évite les erreurs CORS.

### Site complet servi par Flask

Comme en production, Flask peut servir le site construit, sans `npm run dev` : `npm run build` dans `frontend/` produit `frontend/dist/`, que `app.py` sert dès qu'il existe (les adresses des pages React renvoient `index.html`). Le site est alors sur http://localhost:5000.

## Configuration

Le back-end utilise `jobboard.db`, dans son dossier de lancement, et le port 5000, que cible le proxy Vite.

La configuration est lue dans `backend/.env`, jamais dans le code. Ce fichier n'est pas suivi par Git : `.env.example` en donne le modèle.

| Clé | Rôle |
| --- | --- |
| `SECRET_KEY` | signe le cookie de session ; l'API refuse de démarrer sans elle |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | compte administrateur créé par `create_admin.py` |
| `COOKIE_SECURE` | `1` pour n'envoyer le cookie qu'en HTTPS (facultatif, absent de `.env.example` : à ajouter soi-même) |
| `APP_BASE_URL` | adresse du site, utilisée dans le lien de confirmation envoyé par e-mail |
| `MAIL_ENABLED` | `1` pour envoyer les e-mails ; `0` ou absent : rien n'est envoyé, le message s'affiche dans le terminal de l'API |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | serveur d'envoi des e-mails |
| `DEMO_MODE` | `1` active le mode démo (voir [Déploiement sur Render](#déploiement-sur-render)) ; absent ou autre valeur : rien n'est ajouté |

Le cookie de session est `HttpOnly` et `SameSite=Lax` ; sa signature expire au bout d'un jour. Les mots de passe sont enregistrés hachés (`scrypt`).

## Déploiement sur Render

`render.yaml`, à la racine, décrit un seul service web gratuit : le build installe les dépendances et construit le front (`npm ci && npm run build`, `pip install`), puis le démarrage recrée la base (`init_db.py`, `seed_data.py`, `create_admin.py`) et lance `gunicorn` sur le port fourni par Render (`$PORT`). Le système de fichiers de Render est éphémère : à chaque redémarrage ou nouveau déploiement, la base repart des données de démonstration, ce qui remet la démo à zéro.

Variables à saisir à la création du service : `ADMIN_EMAIL` et `ADMIN_PASSWORD`. `SECRET_KEY` est générée par Render ; `DEMO_MODE=1`, `MAIL_ENABLED=0` (Render bloque le SMTP sortant sur l'offre gratuite) et `COOKIE_SECURE=1` sont fixées dans le fichier.

Le mode démo (`DEMO_MODE=1`, `backend/demo.py`) crée au démarrage trois comptes aux mots de passe aléatoires et ajoute une route :

| Méthode | Route | Effet |
| --- | --- | --- |
| GET | `/api/demo/login?role=candidat` | ouvre la session du candidat de démo (deux candidatures déjà déposées) et redirige vers la page d'accueil `/` |
| GET | `/api/demo/login?role=recruteur` | ouvre la session du recruteur de démo, rattaché à l'entreprise qui a le plus d'annonces, et redirige vers `/recruteur` |
| GET | `/api/demo/login?role=admin` | ouvre la session de l'administrateur de démo et redirige vers `/admin` |

Un rôle inconnu renvoie 400 ; sans `DEMO_MODE=1`, la route n'existe pas (404).

## Base de données

| Table | Rôle | Colonnes principales |
| --- | --- | --- |
| `companies` | entreprises | id, name, description, location, website, siren (9 chiffres, unique) |
| `categories` | catégories d'annonces | id, name (unique) |
| `people` | candidats, comptes et responsables d'annonces | id, first_name, last_name, email (unique), phone, password_hash, role (`user` / `admin`), company_id |
| `ads` | annonces | id, title, short_description, description, salary, location, working_time, contract_type, status (`open` / `closed`), created_at, company_id, category_id, contact_id |
| `applications` | candidatures | id, ad_id, person_id, message, status (`pending` / `accepted` / `rejected`), created_at, receipt_email_sent_at, decision_email_sent_at (date d'envoi de l'accusé de réception et de la réponse ; `NULL` : pas envoyé) |
| `pending_registrations` | inscriptions en attente de confirmation de l'adresse | id, person_id (unique), token_hash (unique), first_name, last_name, phone, password_hash, created_at, expires_at |
| `pending_email_changes` | changements d'adresse e-mail en attente de confirmation | id, person_id (unique), new_email, token_hash (unique), created_at, expires_at |
| `person_cvs` | CV enregistré dans l'espace candidat (un par personne) | person_id (clé primaire), filename, content (le PDF), uploaded_at |
| `application_cvs` | CV joint à une candidature (une copie, un par candidature) | application_id (clé primaire), filename, content (le PDF), uploaded_at |

```text
companies 1 ───< N ads N >─── 1 categories
    1             N
    │             │ contact_id (responsable de l'annonce)
    │             1
    └─────────< N people          (company_id : recruteurs rattachés)

ads 1 ───< N applications N >─── 1 people   (person_id : candidat)

people 1 ─── 0..1 pending_registrations     (inscription en attente)
people 1 ─── 0..1 pending_email_changes     (changement d'adresse en attente)
people 1 ─── 0..1 person_cvs                (CV du profil)
applications 1 ─── 0..1 application_cvs    (CV joint à la candidature)
```

Relations :
- une entreprise publie plusieurs annonces (`ads.company_id`) ;
- une annonce appartient à une seule catégorie (`ads.category_id`) et a un responsable (`ads.contact_id`) ;
- un recruteur est rattaché à une entreprise (`people.company_id`), par l'administration uniquement ;
- une personne peut postuler à plusieurs annonces et une annonce recevoir plusieurs candidatures (table `applications`) ;
- une personne ne peut pas postuler deux fois à la même annonce (`UNIQUE (ad_id, person_id)`) ;
- une personne sans `password_hash` (candidat sans compte) existe en base mais ne peut pas se connecter.

Deux règles surprennent à la lecture :
- **Aucune suppression en cascade.** Les clés étrangères des cinq tables principales sont en `ON DELETE RESTRICT` : la base refuse de supprimer une entreprise, une catégorie ou une personne encore référencée, et une annonce qui a des candidatures. Il faut d'abord supprimer ou réaffecter ce qui y fait référence (l'API répond alors 409 `Record is still referenced`).
- **Les valeurs autorisées sont tenues par la base**, avec des contraintes `CHECK` : `ads.status`, `applications.status`, `people.role` et le format de `companies.siren`. Une valeur hors liste est refusée même si elle ne passe pas par l'API.

Une personne qui a candidaté sans compte est enregistrée dans `people` sans mot de passe. Si elle crée ensuite son compte avec la même adresse, l'inscription attend dans `pending_registrations` qu'elle ouvre le lien envoyé à cette adresse : connaître un e-mail ne donne jamais accès au compte ni aux candidatures de quelqu'un d'autre. Le jeton du lien n'est enregistré que haché ; il est valable 24 heures et ne sert qu'une fois. Cette table est créée automatiquement au premier usage si la base existe déjà.

Les CV sont des PDF de 2 Mo maximum, enregistrés directement dans la base. Le CV joint à une candidature est une copie : le recruteur garde celui qu'il a reçu, même si le candidat remplace ou supprime ensuite le CV de son profil. Comme les deux tables d'attente, ces tables sont en `ON DELETE CASCADE` : un CV disparaît avec sa personne ou sa candidature. Elles sont créées automatiquement au premier usage si la base existe déjà, sans relancer `init_db.py`.

## Routes de l'API

Toutes les routes sont sous `/api` et répondent en JSON, sauf les téléchargements de CV, qui renvoient le PDF. Un CV s'envoie en `multipart/form-data`, dans un champ `cv`. Le détail des champs, des codes et des messages est dans [`docs/contrat_api.md`](docs/contrat_api.md).

Accès : **public** (sans connexion), **connecté** (session ouverte), **recruteur** (connecté et rattaché à une entreprise), **admin** (compte de rôle `admin`).

| Méthode | Route | Accès | Fonction | Codes |
| --- | --- | --- | --- | --- |
| GET | `/api/ads` | public | Lister les annonces ouvertes, avec filtres et pagination facultatifs | 200, 400 |
| GET | `/api/ads/<id>` | public | Obtenir le détail d’une annonce (même fermée) | 200, 404 |
| GET | `/api/companies/<id>/ads` | public | Lister les annonces ouvertes d’une entreprise | 200, 404 |
| GET | `/api/categories` | public | Lister les catégories | 200 |
| POST | `/api/ads/<id>/applications` | public | Enregistrer une candidature, avec ou sans compte, avec un CV facultatif (fichier envoyé ou, connecté, CV du profil) | 201, 400, 401, 404, 409 |
| POST | `/api/auth/register` | public | Créer un compte (ouvre la session) | 201, 202, 400, 409 |
| POST | `/api/auth/verify` | public | Confirmer l'adresse d'une inscription en attente | 200, 400, 409 |
| POST | `/api/auth/login` | public | Se connecter (ouvre la session) | 200, 400, 401, 429 |
| POST | `/api/auth/logout` | public | Se déconnecter | 204 |
| GET, PATCH | `/api/auth/me` | connecté | Lire ou modifier son compte (sauf l'adresse e-mail) | 200, 400, 401, 409 |
| POST | `/api/auth/email-change` | connecté | Demander à changer son adresse e-mail (lien envoyé à la nouvelle adresse) | 202, 400, 401, 409 |
| POST | `/api/auth/email-change/confirm` | public | Confirmer la nouvelle adresse avec le jeton du lien | 200, 400, 409 |
| GET | `/api/me/applications` | connecté | Lister ses candidatures | 200, 401 |
| GET | `/api/me/cv` | connecté | Lire le nom et la date du CV de son profil | 200, 401, 404 |
| PUT | `/api/me/cv` | connecté | Enregistrer ou remplacer le CV de son profil | 200, 400, 401 |
| DELETE | `/api/me/cv` | connecté | Supprimer le CV de son profil (les CV déjà joints restent) | 204, 401, 404 |
| GET | `/api/me/cv/file` | connecté | Télécharger le CV de son profil | 200, 401, 404 |
| GET, PATCH | `/api/recruiter/company` | recruteur | Lire ou modifier son entreprise (sauf le SIREN) | 200, 400, 401, 403 |
| GET, POST | `/api/recruiter/ads` | recruteur | Lister les annonces de son entreprise ou en publier une | 200, 201, 400, 401, 403 |
| PATCH | `/api/recruiter/ads/<id>` | recruteur | Modifier une annonce ouverte de son entreprise | 200, 400, 401, 403, 404, 409 |
| DELETE | `/api/recruiter/ads/<id>` | recruteur | Supprimer une annonce de son entreprise qui n'a aucune candidature | 204, 401, 403, 404, 409 |
| GET | `/api/recruiter/ads/<id>/applications` | recruteur | Lister les candidatures d'une annonce de son entreprise | 200, 401, 403, 404 |
| GET | `/api/recruiter/ads/<id>/applications/<application_id>/cv` | recruteur | Télécharger le CV joint à une candidature | 200, 401, 403, 404 |
| POST | `/api/recruiter/ads/<id>/closure` | recruteur | Clôturer une annonce de son entreprise, avec ou sans candidature retenue | 200, 400, 401, 403, 404, 409 |
| POST | `/api/recruiter/ads/<id>/applications/<application_id>/rejection` | recruteur | Refuser une candidature sans clôturer l'annonce | 200, 401, 403, 404, 409 |
| POST | `/api/ads` | admin | Créer une annonce | 201, 400, 401, 403 |
| POST | `/api/ads/<id>/closure` | admin | Clôturer une annonce et désigner la candidature retenue | 200, 400, 401, 403, 404, 409 |
| GET | `/api/admin/<table>` | admin | Lister les lignes d'une table, avec pagination | 200, 400, 401, 403, 404 |
| GET | `/api/admin/<table>/<id>` | admin | Lire une ligne | 200, 401, 403, 404 |
| POST | `/api/admin/<table>` | admin | Créer une ligne | 201, 400, 401, 403, 404, 409 |
| PATCH | `/api/admin/<table>/<id>` | admin | Modifier une ligne | 200, 400, 401, 403, 404, 409 |
| DELETE | `/api/admin/<table>/<id>` | admin | Supprimer une ligne | 204, 401, 403, 404, 409 |

Un recruteur est une personne connectée dont la fiche est rattachée à une entreprise : le serveur lit cette entreprise dans la base, jamais dans la requête.

Filtres de `GET /api/ads`, tous facultatifs et combinables : `q` (texte dans le titre ou la description courte), `category`, `contract_type` et `location` (valeurs exactes). Les annonces fermées n’apparaissent jamais dans les listes. Pagination : `page` et `per_page` (1 à 50) ; le nombre total de lignes est renvoyé dans l'en-tête `X-Total-Count`.

Les routes renvoient 200 en lecture, 201 à la création, 202 pour une inscription en attente de confirmation, 204 après une suppression, 400 pour une requête invalide, 401 sans connexion ou pour un identifiant incorrect, 403 sans le rôle administrateur ou, pour l'espace recruteur, sans entreprise rattachée, 404 pour une ressource inexistante, 409 pour un doublon ou une ligne encore référencée, et 429 après 5 échecs de connexion en 15 minutes pour le même e-mail (l'en-tête `Retry-After` donne l'attente en secondes). Les erreurs ont toujours la forme `{"error": "..."}`. Aucune réponse ne contient de mot de passe ni d'empreinte.

Les commandes et résultats des vérifications sont dans `backend/curl_tests.md` et `backend/tests/curl_auth.md`. Les tests automatiques de la limite de connexion se lancent depuis `backend/` avec `python -m unittest tests.test_login_limit -v`.

## Pages

Navigation sans rechargement de la page (React Router), avec une barre commune : la page active est marquée et le logo ramène à l'accueil. Le menu dépend de la personne : « Offres d'emploi » pour tous, « Connexion » pour un visiteur, « Espace recruteur », « Espace candidat » et « Se déconnecter » une fois connecté, « Administration » pour un administrateur. Sur mobile, il se replie derrière un bouton « Menu ». Le pied de page reprend la navigation et les mentions légales.

| Adresse | Page |
| --- | --- |
| `/` | Accueil : barre de recherche et les deux offres les plus récentes |
| `/offres` | Offres d'emploi : liste des annonces ouvertes, filtrée par la recherche de l'accueil |
| `/login` | Connexion |
| `/account` | Création de compte : la session s'ouvre dès la création, puis l'accueil s'affiche |
| `/verification` | Confirmation de l'adresse, ouverte depuis le lien reçu par e-mail |
| `/confirmation-email` | Confirmation d'une nouvelle adresse e-mail, ouverte depuis le lien reçu à cette adresse |
| `/espace-candidat` | Espace candidat, onglet « Mes candidatures » |
| `/espace-candidat/informations` | Espace candidat, onglet « Mes informations » : modification du compte ; l'adresse e-mail change par « Changer d'adresse », confirmée par un lien ; section « Mon CV » pour enregistrer, remplacer, télécharger ou supprimer son CV |
| `/recruteur` | Espace recruteur, onglet « Vue d'ensemble » |
| `/recruteur/entreprise` | Espace recruteur, onglet « Mon entreprise » : fiche de l'entreprise, SIREN en lecture seule |
| `/recruteur/postes` | Espace recruteur, onglet « Mes postes » : annonces de l'entreprise |
| `/recruteur/postes/:id/candidatures` | Candidatures reçues pour une annonce : télécharger le CV, retenir ou refuser un candidat, clôturer l'annonce |
| `/recruteur/postes/:id/modifier` | Modification d'une annonce ouverte |
| `/recruteur/nouvelle-offre` | Espace recruteur, onglet « Publier une offre » |
| `/admin` | Administration : les cinq tables, avec création, modification, suppression et pagination |
| autre adresse | Page introuvable |

Toutes ces pages lisent et écrivent dans l'API. Les espaces candidat et recruteur demandent d'être connecté : un visiteur y trouve un lien vers la connexion. Sans entreprise rattachée, l'espace recruteur indique que l'administration doit rattacher le compte. L'administration est réservée aux administrateurs : sinon, la page affiche un message sans rien demander à l'API.

Sur chaque annonce, le bouton « En savoir plus » affiche dans la carte toutes les informations de l’annonce, sans fenêtre modale ; un message signale le chargement ou l’échec d’une requête. Le bouton « Postuler » ouvre sous l’annonce le formulaire de candidature, avec ou sans compte ; on peut y joindre un CV en PDF, et une personne connectée qui a enregistré un CV le voit proposé par défaut. Les textes de l’interface sont en français.

## Limites connues

- **Pas de protection CSRF.** Le cookie de session est `SameSite=Lax`, ce qui bloque l'envoi du cookie par la plupart des requêtes venues d'un autre site, mais aucun jeton CSRF n'est vérifié par l'API.
- **Le salaire n'est pas contrôlé par l'API.** `POST` et `PATCH` acceptent une valeur non numérique (par exemple `"abc"`) ; seul le formulaire du site impose un nombre.
- **Le mode démo ouvre toutes les sessions sans mot de passe.** Avec `DEMO_MODE=1`, n'importe qui peut devenir administrateur par `/api/demo/login?role=admin` et modifier les données ; c'est voulu pour la démonstration, et la base repart des données de démonstration à chaque redémarrage du service. Ce mode ne doit jamais être activé sur un site réel.
- **Pas de bouton de clôture dans la page d'administration.** L'administrateur peut clôturer une annonce par l'API (`POST /api/ads/<id>/closure`), mais la page admin ne le propose pas ; dans le site, seul le recruteur clôture ses annonces.
