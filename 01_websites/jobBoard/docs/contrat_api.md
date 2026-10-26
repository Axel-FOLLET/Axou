# Contrat de l'API Y.I.A Jobs

Version : J5 (schéma définitif, Blueprints, préfixe `/api`, filtres, inscription, connexion, sessions, candidatures, clôture et CRUD admin, création d'annonce réservée à l'admin, « Mes candidatures », pagination)

- Toutes les routes sont sous le préfixe **`/api`**. Les anciennes URL sans préfixe (`/ads`...) renvoient 404.
- Toutes les réponses sont en **JSON**, sauf les réponses `204 No Content`.
- Les corps de requête `POST` et `PATCH` sont en JSON (`Content-Type: application/json`). Seul l'envoi d'un CV utilise un formulaire `multipart/form-data` (voir [CV](#cv)).
- Serveur de développement : `http://localhost:5000`.
- Les routes d'administration nécessitent une connexion avec un compte ayant le rôle `admin`.

---

## Routes publiques

| Route                         | Succès                                                                       | Erreurs                                                          |
| ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/ads`                | 200 : tableau d'annonces **ouvertes**, de la plus récente à la plus ancienne | 400 `Invalid pagination` (200 et `[]` si aucun résultat)         |
| `GET /api/ads/<id>`           | 200 : annonce complète (**même fermée**)                                     | 404 `Ad not found`                                               |
| `GET /api/companies/<id>/ads` | 200 : tableau d'annonces **ouvertes** de l'entreprise (`[]` possible)        | 404 `Company not found`                                          |

## Routes protégées

| Route                         | Accès                | Succès                                              | Erreurs                                                                                             |
| ----------------------------- | -------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/ads`               | **admin uniquement** | 201 : l'annonce créée                               | 401 `Login required` ; 403 `Admin only` ; 400 champ manquant, ou `company_id` / `category_id` inconnu |
| `GET /api/me/applications`    | connecté             | 200 : candidatures de la personne connectée         | 401 `Login required`                                                                                |
| `GET/PUT/DELETE /api/me/cv`, `GET /api/me/cv/file` | connecté | CV du profil (voir [CV](#cv)) | 401 `Login required` ; 400 `Invalid field: cv` ; 404 `CV not found` |

---

# Filtres de `GET /api/ads`

Tous **facultatifs** et **combinables** (assemblés avec AND).

| Paramètre       | Rôle                                              | Exemple              |
| --------------- | ------------------------------------------------- | -------------------- |
| `q`             | texte contenu dans `title` ou `short_description` | `?q=python`          |
| `category`      | nom de catégorie exact                            | `?category=Data`     |
| `contract_type` | type de contrat exact                             | `?contract_type=CDI` |
| `location`      | lieu exact                                        | `?location=Londres`  |

Exemple combiné :

`GET /api/ads?contract_type=CDI&location=Londres`

Règles :

- Sans filtre, la route renvoie toutes les annonces ouvertes, triées par `created_at` puis `id` décroissants.
- Un filtre sans résultat renvoie **200** et `[]`.
- Les annonces `closed` sont **toujours exclues** de cette liste, même si elles correspondent aux filtres.
- Les valeurs de filtre doivent être **encodées en URL** (`encodeURIComponent` ou `URLSearchParams` côté front).

---

# Pagination

Disponible sur `GET /api/ads` et `GET /api/admin/<table>`.

| Paramètre  | Rôle                          | Valeurs acceptées      | Défaut si l'autre est fourni |
| ---------- | ----------------------------- | ---------------------- | ---------------------------- |
| `page`     | numéro de page, à partir de 1 | entier ≥ 1             | `1`                          |
| `per_page` | nombre de lignes par page     | entier entre 1 et 50   | `10`                         |

Exemple :

`GET /api/ads?page=2&per_page=10`

Règles :

- Les deux paramètres sont **facultatifs**. Sans aucun des deux, la réponse est la **liste complète**, comme avant.
- Avec la pagination, seules les lignes de la page demandée sont renvoyées (`OFFSET = (page - 1) * per_page`). La réponse **reste un tableau**.
- Une page au-delà de la dernière renvoie **200** et `[]`.
- La pagination se combine avec les filtres de `GET /api/ads`.
- L'ordre est celui de la route : `created_at` puis `id` décroissants pour `GET /api/ads`, `id` croissant pour `GET /api/admin/<table>`, sauf si son paramètre `order` dit le contraire (voir [Liste](#liste)).

## En-tête `X-Total-Count`

Chaque réponse de ces deux routes contient l'en-tête :

```text
X-Total-Count: 47
```

Il donne le **nombre total de lignes** correspondant à la requête (**filtres compris**, pagination non comprise), pour que le front calcule le nombre de pages : `Math.ceil(total / per_page)`.

Côté front : `Number(response.headers.get("X-Total-Count"))`.

## Erreur

| Code | Message              | Cas                                                                                     |
| ---- | -------------------- | --------------------------------------------------------------------------------------- |
| 400  | `Invalid pagination` | `page` ou `per_page` n'est pas un entier, vaut moins de 1, ou `per_page` dépasse 50     |

Exemples : `?per_page=0`, `?page=abc`, `?per_page=51`.

---

# Mes candidatures

Route :

`GET /api/me/applications`

Réservée aux utilisateurs **connectés** (`@login_required`).

Renvoie les candidatures de la personne connectée, **de la plus récente à la plus ancienne** (`created_at` puis `id` décroissants).

## Contrôle du propriétaire

La personne est **toujours** celle de la session (`current_user()["id"]`). Aucun identifiant n'est lu dans l'URL ni dans le corps de la requête : une personne ne peut lire que **ses propres** candidatures.

## Format de réponse

```json
[
  {
    "id": 1,
    "ad_id": 3,
    "title": "Cybersécurité",
    "company": "TechNova",
    "status": "accepted",
    "message": "Bonjour, je suis intéressé.",
    "created_at": "2026-10-09 14:12:00"
  }
]
```

Clés : `id`, `ad_id`, `title`, `company`, `status`, `message`, `created_at`.

- `id` est l'identifiant de la **candidature** ; `ad_id` celui de l'**annonce**.
- `title` est le titre de l'annonce, `company` le **nom** de l'entreprise.
- `status` vaut `pending`, `accepted` ou `rejected` (voir [Statuts](#statuts)).
- Sans candidature : **200** et `[]`.

## Erreur

| Code | Message          | Cas                      |
| ---- | ---------------- | ------------------------ |
| 401  | `Login required` | utilisateur non connecté |

---

# Candidatures

La route :

`POST /api/ads/<id>/applications`

permet de candidater de **deux façons**.

## 1. Candidature en tant que visiteur

Un utilisateur non connecté doit fournir ses informations personnelles.

### Corps de la requête

| Champ        | Obligatoire | Remarque                                         |
| ------------ | ----------- | ------------------------------------------------ |
| `first_name` | oui         |                                                  |
| `last_name`  | oui         |                                                  |
| `email`      | oui         | espaces retirés et lettres passées en minuscules |
| `message`    | oui         |                                                  |
| `phone`      | non         |                                                  |

Exemple :

```json
{
  "first_name": "Alice",
  "last_name": "Test",
  "email": "Alice@Example.com",
  "message": "Bonjour, je suis intéressée.",
  "phone": "0600000000"
}
```

L'email est normalisé avant la recherche ou la création de la personne.

Si aucune personne n'existe avec cet email, une nouvelle personne est créée.

Si une personne existe déjà et possède un compte protégé par un mot de passe, la candidature est refusée :

```json
{
  "error": "Login required for this email"
}
```

avec le code **401**.

Si la personne existe mais ne possède pas de mot de passe, elle peut être réutilisée.

---

## 2. Candidature en tant qu'utilisateur connecté

Un utilisateur connecté n'a pas besoin de fournir son nom ni son email.

Seul le message est obligatoire :

```json
{
  "message": "Bonjour, je suis intéressé."
}
```

Le `person_id` est automatiquement récupéré depuis le compte connecté.

Il n'est donc pas nécessaire d'envoyer :

- `first_name`
- `last_name`
- `email`
- `person_id`

Le `person_id` utilisé pour la candidature correspond à l'utilisateur actuellement connecté.

---

## Vérifications de `POST /api/ads/<id>/applications`

Ordre général des vérifications :

1. vérification du CV joint, s'il y en a un (voir [CV](#cv)) ;
2. vérification des champs obligatoires, puis du CV du profil si `use_profile_cv` est demandé ;
3. vérification de l'existence de l'annonce ;
4. vérification que l'annonce n'est pas fermée ;
5. identification ou création de la personne ;
6. vérification d'une éventuelle candidature déjà existante ;
7. insertion de la candidature et de son CV, dans la même transaction.

### Erreurs

| Code | Message                         | Cas                                              |
| ---- | ------------------------------- | ------------------------------------------------ |
| 400  | `Missing field: <nom du champ>` | champ obligatoire absent ou vide                 |
| 401  | `Login required for this email` | une personne existante possède un compte protégé |
| 404  | `Ad not found`                  | annonce inexistante                              |
| 409  | `Ad is closed`                  | l'annonce est fermée                             |
| 409  | `Already applied`               | la personne a déjà postulé à cette annonce       |

Une candidature créée retourne **201**.

---

# CV

Le CV est **facultatif**. C'est un **PDF de 2 Mo maximum** : le serveur vérifie que le fichier commence par la signature `%PDF-`, sans se fier au nom du fichier ni au type annoncé par le navigateur. Un fichier vide, trop lourd ou qui n'est pas un PDF reçoit 400 `Invalid field: cv`.

Les CV sont gardés dans la base, dans deux tables créées automatiquement sur une base existante (`application_cvs.py`) :

- `person_cvs` : le CV du profil, un seul par personne connectée, remplaçable ;
- `application_cvs` : le CV joint à une candidature. C'est une **copie** : si le candidat change ensuite le CV de son profil, le recruteur garde celui qu'il a reçu.

Une suppression de la personne ou de la candidature (CRUD admin) supprime son CV (`ON DELETE CASCADE`). Ces tables ne sont pas dans le CRUD d'administration.

## Joindre un CV à une candidature

`POST /api/ads/<id>/applications` accepte deux formats :

- **JSON**, comme avant ; une personne connectée peut ajouter `"use_profile_cv": true` pour joindre une copie du CV de son profil ;
- **`multipart/form-data`** : les mêmes champs en texte, plus le fichier dans le champ `cv`. Un fichier envoyé passe avant `use_profile_cv`.

Le CV est vérifié **avant** toute écriture, puis enregistré dans la même transaction que la candidature.

| Code | Message | Cas |
| --- | --- | --- |
| 400 | `Invalid field: cv` | fichier refusé, ou `use_profile_cv` alors que le profil n'a pas de CV |

`use_profile_cv` est ignoré pour un visiteur.

## CV du profil (espace candidat)

Réservé aux personnes **connectées** (`@login_required`). La personne est toujours celle de la session : chacun ne voit et ne change que son propre CV.

| Route | Succès | Erreurs |
| --- | --- | --- |
| `GET /api/me/cv` | 200 : `{"filename": "cv.pdf", "uploaded_at": "2026-10-16 09:30:00"}` | 401, 404 `CV not found` |
| `GET /api/me/cv/file` | 200 : le PDF (`application/pdf`, en téléchargement, sous son nom d'origine) | 401, 404 `CV not found` |
| `PUT /api/me/cv` | 200 : même réponse que `GET /api/me/cv`. Corps `multipart/form-data`, fichier dans le champ `cv` ; remplace le CV précédent | 401, 400 `Invalid field: cv` |
| `DELETE /api/me/cv` | 204 ; les CV déjà joints à des candidatures restent | 401, 404 `CV not found` |

## Téléchargement par le recruteur

`GET /api/recruiter/ads/<id>/applications/<application_id>/cv` : voir [Espace recruteur](#espace-recruteur).

---

# Formats de réponse

## Liste d'annonces

Pour `GET /api/ads` et `GET /api/companies/<id>/ads` :

```json
[
  {
    "id": 3,
    "title": "Cybersécurité",
    "short_description": "Blue team",
    "company": "TechNova",
    "location": "Londres",
    "contract_type": "CDI",
    "salary": 100000,
    "status": "open",
    "created_at": "2026-10-07 10:04:10"
  }
]
```

Clés : `id`, `title`, `short_description`, `company`, `location`, `contract_type`, `salary`, `status`, `created_at`. `salary` est un entier (salaire annuel brut) ou `null` s'il n'est pas indiqué ; il sert au filtre « Salaire minimum » de la page des offres (ajouté au J8).

---

## Détail d'une annonce

Pour `GET /api/ads/<id>` et la réponse de `POST /api/ads` :

```json
{
  "id": 1,
  "title": "Développeur Python",
  "short_description": "Back-end Flask",
  "description": "you will dev many website",
  "salary": 42000,
  "location": "Paris",
  "working_time": "Temps plein",
  "contract_type": "CDI",
  "status": "open",
  "created_at": "2026-10-07 10:04:10",
  "company": "TechNova",
  "category": "Développement",
  "contact_id": 1
}
```

Clés : `id`, `title`, `short_description`, `description`, `salary`, `location`, `working_time`, `contract_type`, `status`, `created_at`, `company`, `category`, `contact_id`.

- `company` et `category` sont des **noms**, pas des identifiants.
- Les champs facultatifs non renseignés valent `null`.

---

## Candidature

Pour la réponse de `POST /api/ads/<id>/applications` :

```json
{
  "id": 5,
  "ad_id": 3,
  "person_id": 1,
  "message": "Bonjour, je suis intéressé.",
  "status": "pending",
  "created_at": "2026-10-07 10:30:00"
}
```

Clés : `id`, `ad_id`, `person_id`, `message`, `status`, `created_at`, `has_cv` (`true` si un CV est joint).

---

# Corps des requêtes `POST`

## `POST /api/ads`

Réservée aux administrateurs : 401 `Login required` sans connexion, 403 `Admin only` pour un compte non admin.

| Champ               | Obligatoire | Remarque                     |
| ------------------- | ----------- | ---------------------------- |
| `title`             | oui         |                              |
| `short_description` | oui         |                              |
| `company_id`        | oui         | doit exister                 |
| `category_id`       | oui         | doit exister                 |
| `description`       | non         |                              |
| `salary`            | non         | entier                       |
| `location`          | non         |                              |
| `working_time`      | non         |                              |
| `contract_type`     | non         |                              |
| `contact_id`        | non         | doit exister s'il est fourni |

Le `status` d'une nouvelle annonce est `open`.

---

# Clôture d'une annonce

Route :

`POST /api/ads/<id>/closure`

Cette route est réservée aux utilisateurs ayant le rôle `admin`.

Elle permet de fermer une annonce et de définir la candidature acceptée.

## Sans candidature

Si aucune candidature n'existe pour l'annonce, aucun `accepted_application_id` n'est nécessaire.

```json
{}
```

L'annonce passe alors à :

```text
status = closed
```

## Avec des candidatures

Si l'annonce possède des candidatures, le champ suivant est **facultatif** :

```json
{
  "accepted_application_id": 5
}
```

**Sans candidat retenu** (`{}`, ou `accepted_application_id` à `null`) : toutes les candidatures de l'annonce passent à `rejected`, puis l'annonce passe à `closed`.

**Avec un candidat retenu**, la candidature sélectionnée passe à :

```text
accepted
```

Toutes les autres candidatures de cette annonce passent à :

```text
rejected
```

L'annonce passe ensuite à :

```text
closed
```

Toutes ces modifications sont effectuées dans **une seule transaction**.

Après la validation, chaque candidat reçoit un e-mail : retenu ou non retenu (voir [E-mails des candidatures](#e-mails-des-candidatures)). Le recruteur clôture ses propres annonces avec [`POST /api/recruiter/ads/<id>/closure`](#post-apirecruiteradsidclosure), selon les mêmes règles.

## Erreurs

| Code | Message                                  | Cas                                                        |
| ---- | ---------------------------------------- | ---------------------------------------------------------- |
| 401  | `Login required`                         | utilisateur non connecté                                   |
| 403  | `Admin only`                             | utilisateur connecté mais non administrateur               |
| 400  | `Application does not belong to this ad` | la candidature sélectionnée appartient à une autre annonce |
| 404  | `Ad not found`                           | annonce inexistante                                        |
| 409  | `Ad already closed`                      | annonce déjà fermée                                        |

---

# CRUD d'administration

Toutes les routes CRUD suivantes sont réservées aux administrateurs.

Sans connexion :

```json
{
  "error": "Login required"
}
```

→ **401**

Avec un compte connecté mais sans rôle `admin` :

```json
{
  "error": "Admin only"
}
```

→ **403**

---

## Tables accessibles

Le CRUD admin autorise uniquement les tables suivantes :

- `companies`
- `categories`
- `people`
- `ads`
- `applications`

Toute autre table retourne :

```json
{
  "error": "Unknown table"
}
```

→ **404**

---

## Routes CRUD

### Liste

`GET /api/admin/<table>`

Retourne tous les enregistrements de la table, triés par `id` croissant.

Accepte la [pagination](#pagination) (`page`, `per_page`, en-tête `X-Total-Count`, 400 `Invalid pagination`).

Paramètre facultatif `order` (ajouté au J9), pour la flèche de tri de la page admin :

| Valeur | Tri |
| ------ | --- |
| absent | `id` croissant, comme avant |
| `asc` | plus anciens d'abord |
| `desc` | plus récents d'abord |

- Avec `order`, `ads` et `applications` sont triées par `created_at`, puis par `id` en cas d'égalité ; les autres tables par `id`.
- Le tri porte sur toute la table, avant la pagination : `GET /api/admin/applications?order=desc&page=1&per_page=10` renvoie les 10 candidatures les plus récentes.
- Toute autre valeur renvoie **400** `Invalid order`.

### Détail

`GET /api/admin/<table>/<id>`

Retourne un enregistrement.

Si l'enregistrement n'existe pas :

```json
{
  "error": "Record not found"
}
```

→ **404**

### Création

`POST /api/admin/<table>`

Crée un nouvel enregistrement.

### Modification

`PATCH /api/admin/<table>/<id>`

Modifie uniquement les champs autorisés.

### Suppression

`DELETE /api/admin/<table>/<id>`

Supprime un enregistrement.

Succès :

**204 No Content**

---

# Champs modifiables du CRUD

## `companies`

Champs disponibles :

```text
id
name
description
location
website
siren
```

Champs modifiables :

```text
name
description
location
website
siren
```

Champs obligatoires à la création :

```text
name
siren
```

### SIREN

Le `siren` identifie une entreprise : **une entreprise n'a qu'une fiche**. Seul le format et l'unicité dans notre base sont contrôlés, pas la correspondance réelle auprès de l'INSEE.

- **Chaîne de 9 chiffres** (`"012345678"`), jamais un nombre JSON : les zéros du début sont conservés.
- Les espaces au début et à la fin sont retirés avant la validation.
- Une ancienne fiche non renseignée a `"siren": null` (provisoire) ; elle reste lisible et peut recevoir un SIREN valide par `PATCH`.
- `PATCH` sans `siren` : la valeur actuelle est conservée. `PATCH` avec le SIREN de la fiche elle-même : accepté (ce n'est pas un doublon).
- Un SIREN déjà renseigné **ne peut pas être effacé** (`null`, `""` ou espaces → 400).
- L'unicité est garantie par la base (index unique `companies_siren_unique`), y compris pour deux créations simultanées.

Exemple de création :

```json
{
  "name": "Orvelune",
  "siren": "936442573"
}
```

| Code | Message                 | Cas                                                                                   |
| ---- | ----------------------- | ------------------------------------------------------------------------------------- |
| 400  | `Missing field: siren`  | `siren` absent à la création, ou `null`, vide ou composé d'espaces (création ou `PATCH`) |
| 400  | `Invalid value`         | `siren` qui n'est pas une chaîne (nombre JSON...), contient autre chose que des chiffres, ou n'a pas 9 chiffres |
| 409  | `Already exists`        | SIREN déjà attribué à une autre fiche (la fiche n'est ni créée ni modifiée)            |

Migration d'une base existante : `python migrate_siren.py [fichier.db]` ajoute la colonne (`NULL` pour les fiches existantes) et l'index unique, sans réinitialiser la base. Un deuxième lancement ne change rien.

---

## `categories`

Champs disponibles :

```text
id
name
```

Champ modifiable :

```text
name
```

Champ obligatoire à la création :

```text
name
```

---

## `people`

Champs disponibles :

```text
id
first_name
last_name
email
phone
role
```

Champs modifiables :

```text
first_name
last_name
email
phone
role
```

Champs obligatoires à la création :

```text
first_name
last_name
email
```

Le champ `password_hash` n'est jamais retourné et ne peut pas être modifié par ce CRUD.

L'email est normalisé en minuscules et sans espaces avant l'enregistrement.

---

## `ads`

Champs disponibles :

```text
id
title
short_description
description
salary
location
working_time
contract_type
status
created_at
company_id
category_id
contact_id
```

Champs modifiables :

```text
title
short_description
description
salary
location
working_time
contract_type
company_id
category_id
contact_id
```

Champs obligatoires à la création :

```text
title
short_description
company_id
category_id
```

Les champs `status` et `created_at` ne sont pas modifiables par le CRUD.

---

## `applications`

Champs disponibles :

```text
id
ad_id
person_id
message
status
created_at
receipt_email_sent_at
decision_email_sent_at
```

Champs modifiables :

```text
ad_id
person_id
message
```

Champs obligatoires à la création :

```text
ad_id
person_id
message
```

Les champs `status` et `created_at` ne sont pas modifiables par le CRUD. Les champs `receipt_email_sent_at` et `decision_email_sent_at` non plus : seul l'envoi des e-mails les remplit (voir [E-mails des candidatures](#e-mails-des-candidatures)).

---

# Erreurs du CRUD

| Code | Message                      | Cas                                                     |
| ---- | ---------------------------- | ------------------------------------------------------- |
| 400  | `Missing field: <nom>`       | champ obligatoire absent ou vide                        |
| 400  | `Unknown field: <nom>`       | champ non autorisé                                      |
| 400  | `Invalid pagination`         | `page` / `per_page` invalide sur la liste               |
| 400  | `Invalid order`              | `order` différent de `asc` ou `desc` sur la liste       |
| 400  | `No fields to update`        | `PATCH` sans champ à modifier                           |
| 400  | `Unknown reference`          | clé étrangère inconnue                                  |
| 400  | `Invalid value`              | valeur refusée par une contrainte `CHECK`               |
| 400  | `Database error`             | autre erreur de base de données                         |
| 404  | `Unknown table`              | table non autorisée                                     |
| 404  | `Record not found`           | enregistrement inexistant                               |
| 409  | `Already exists`             | violation d'une contrainte `UNIQUE`                     |
| 409  | `Record is still referenced` | suppression impossible car l'enregistrement est utilisé |
| 401  | `Login required`             | utilisateur non connecté                                |
| 403  | `Admin only`                 | utilisateur non administrateur                          |

---

# Règles importantes du CRUD

- Les tables accessibles sont limitées à celles définies dans le contrat.
- Les champs accessibles en écriture sont limités aux champs modifiables définis ci-dessus.
- `password_hash` n'est jamais retourné par les réponses du CRUD.
- `status` et `created_at` des annonces et candidatures ne sont pas modifiables par le CRUD.
- Les clés étrangères sont vérifiées par la base de données.
- Les erreurs de contrainte sont transformées en réponses JSON correspondant au contrat.
- Une suppression réussie retourne **204 No Content**.

---

# Statuts

| Champ                 | Valeurs                           | Défaut    |
| --------------------- | --------------------------------- | --------- |
| `ads.status`          | `open`, `closed`                  | `open`    |
| `applications.status` | `pending`, `accepted`, `rejected` | `pending` |

- Une annonce `closed` n'apparaît pas dans les listes publiques (`GET /api/ads`, `GET /api/companies/<id>/ads`), mais son détail reste consultable et indique son statut.
- Une candidature ne peut pas être créée sur une annonce `closed`.
- Lors de la clôture d'une annonce avec des candidatures, une candidature est `accepted` et toutes les autres sont `rejected`.
- Ces statuts sont appliqués par des contraintes `CHECK` dans la base.

---

# Format des erreurs

Toute erreur est un objet JSON avec une seule clé `error` :

```json
{
  "error": "Ad not found"
}
```

---

# Comptes : inscription et connexion

Routes sous `/api/auth`.

La connexion crée une **session Flask** permettant d'identifier l'utilisateur connecté.

| Route                     | Succès                                             | Erreurs                                                                              |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `POST /api/auth/register` | 201 : compte créé et création de la session ; 202 : vérification de l’email en attente (pas de session) | 400 : champ invalide ou mot de passe trop court ; 409 : email déjà associé à un compte actif |
| `POST /api/auth/login`    | 200 : le compte connecté et création de la session | 400 champ invalide ; 401 `Invalid credentials` ; 429 `Too many attempts` (en-tête `Retry-After`) |
| `POST /api/auth/verify`   | 200 : la fiche, compte activé (pas de session ouverte) | 400 `Invalid field: token` ou `Invalid value` ; 409 `Email already used`             |

## Corps des requêtes

### `POST /api/auth/register`

| Champ        | Obligatoire | Remarque                                         |
| ------------ | ----------- | ------------------------------------------------ |
| `first_name` | oui         |                                                  |
| `last_name`  | oui         |                                                  |
| `email`      | oui         | espaces retirés et lettres passées en minuscules |
| `password`   | oui         | 8 caractères minimum                             |
| `phone`      | non         |                                                  |

Le champ `role` n'est pas lu : un compte créé par l'inscription a toujours le rôle `user`.

Une inscription réussie (201) crée la session, comme une connexion : la personne n'a pas à se reconnecter. Une inscription en attente (202) n'en crée aucune.

### `POST /api/auth/login`

`email` et `password` sont obligatoires.

L'email est normalisé comme à l'inscription.

Une connexion réussie crée une session contenant l'identifiant de l'utilisateur.

## Validation des champs

À l'inscription et à la connexion, chaque champ texte obligatoire (`first_name`, `last_name`, `email`, `password` ; `email` et `password` pour la connexion) est validé. Un champ **manquant**, qui n'est pas du texte, vide (après retrait des espaces) ou de plus de 100 caractères renvoie :

```json
{
  "error": "Invalid field: email"
}
```

→ **400**. Le nom du champ est celui du **premier** champ invalide.

Un `email` sans `@` renvoie aussi `Invalid field: email`.

Si le corps n'est pas un objet JSON : **400** `JSON object expected`.

---

# Format de réponse

Pour `POST /api/auth/register` et `POST /api/auth/login` :

```json
{
  "id": 4,
  "first_name": "Alice",
  "last_name": "Test",
  "email": "alice.test@example.com",
  "phone": null,
  "role": "user"
}
```

Clés :

`id`, `first_name`, `last_name`, `email`, `phone`, `role`.

Aucune réponse ne contient le mot de passe ni son empreinte (`password_hash`).

---

# Erreurs des comptes

| Code | Message                                  | Cas                                                          |
| ---- | ---------------------------------------- | ------------------------------------------------------------ |
| 400  | `Invalid field: <nom du champ>`          | champ absent, vide, non textuel, trop long, ou email sans `@` |
| 400  | `JSON object expected`                   | corps de requête qui n'est pas un objet JSON                 |
| 400  | `Password must be at least 8 characters` | mot de passe trop court                                      |
| 409  | `Email already used`                     | email déjà associé à un compte actif                                        |
| 401  | `Invalid credentials`                    | email inconnu, mot de passe faux ou compte sans mot de passe |
| 429  | `Too many attempts`                      | 5 échecs de connexion en 15 minutes pour cet email ; même le bon mot de passe est refusé pendant le blocage. L'en-tête `Retry-After` donne le nombre de secondes à attendre |

---
## Inscription d'un candidat déjà enregistré sans compte

Lorsqu'un email existe déjà dans `people` et que son `password_hash` est vide, le système doit distinguer ce candidat d'un utilisateur possédant déjà un compte.

1. **Création en attente :** le système initialise une procédure d'inscription et envoie un lien de vérification à l'adresse email concernée. Le compte reste en attente tant que l'adresse n'est pas vérifiée.
2. **Avant vérification :** l'utilisateur peut consulter l'état de sa procédure, mais ne peut pas accéder aux candidatures déjà rattachées à cette personne.
3. **Après vérification :** le système confirme que l'utilisateur contrôle l'adresse email, lui permet de définir ou de finaliser son mot de passe et rattache le compte à la ligne `people` existante. Les candidatures déjà enregistrées restent associées à cette personne et deviennent accessibles après authentification.
4. **Si l'utilisateur quitte la page :** la vérification reste obligatoire. La procédure peut être reprise ultérieurement avec le lien reçu par email ou une nouvelle demande de vérification.
5. **Sécurité :** connaître une adresse email ou rester sur la page d'inscription ne suffit jamais à prendre le contrôle d'un compte ni à accéder aux candidatures d'une autre personne.

### Codes de réponse

| Code | Message | Cas |
| --- | --- | --- |
| 202 | `Verification required` | Demande de vérification prise en compte |
| 409 | `Email already used` | L'adresse correspond déjà à un compte actif |
| 401 | `Login required` | Accès aux candidatures sans session valide |

Le 202 n'est pas une erreur : son corps est `{"message": "Verification required"}`. Le jeton n'apparaît jamais dans une réponse : il part uniquement dans le lien envoyé par email (`<APP_BASE_URL>/verification?token=…`), ou dans le terminal de l'API si `MAIL_ENABLED` vaut `0`. La fiche `people` n'est pas modifiée tant que le lien n'a pas été ouvert. Une nouvelle demande remplace la précédente.

### Confirmation : `POST /api/auth/verify`

Corps : `{"token": "<jeton reçu dans le lien>"}`. Le lien est valable **24 heures** et ne sert qu'**une fois**.

| Code | Réponse | Cas |
| --- | --- | --- |
| 200 | la fiche (`id`, `first_name`, `last_name`, `email`, `phone`, `role`) | adresse confirmée : le nom, le prénom, le téléphone et le mot de passe choisis à l'inscription sont posés. Aucune session n'est ouverte : la personne se connecte ensuite avec `POST /api/auth/login` |
| 400 | `Invalid field: token` | jeton absent, vide ou non textuel |
| 400 | `Invalid value` | jeton inconnu, déjà utilisé ou expiré (même réponse dans les trois cas) |
| 409 | `Email already used` | la fiche a reçu un compte entre-temps : le lien ne remplace jamais un mot de passe existant |

---

## Changement d'adresse e-mail

Ajouté au J8. `PATCH /api/auth/me` refuse toujours `email` (400 `Unknown field: email`) : l'adresse ne change qu'en deux temps, et seulement quand la **nouvelle** adresse a été confirmée. Connaître une adresse ou utiliser une session laissée ouverte ne suffit donc jamais à détourner un compte.

### Base de données

```sql
CREATE TABLE pending_email_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL UNIQUE,
  new_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);
```

Mêmes règles que `pending_registrations` : seule l'empreinte SHA-256 du jeton est gardée, le lien vaut **24 heures** et ne sert qu'**une fois**, une nouvelle demande remplace la précédente.

### Demande : `POST /api/auth/email-change`

Réservée aux personnes **connectées**. Corps :

```json
{
  "email": "nouvelle.adresse@example.com",
  "password": "mot de passe actuel"
}
```

- `email` est normalisé comme à l'inscription (espaces retirés, minuscules).
- `password` est le mot de passe **actuel** : il prouve que la personne devant l'écran est bien la titulaire du compte.
- L'adresse de la fiche ne change pas à cette étape. Un lien `<APP_BASE_URL>/confirmation-email?token=…` part à la **nouvelle** adresse ; si `MAIL_ENABLED` vaut `0`, il est écrit dans le terminal de l'API. Le jeton n'apparaît jamais dans une réponse.

| Code | Réponse | Cas |
| --- | --- | --- |
| 202 | `{"message": "Verification required"}` | demande enregistrée, lien envoyé |
| 400 | `JSON object expected` | corps qui n'est pas un objet JSON |
| 400 | `Invalid field: email` ou `Invalid field: password` | champ absent, vide, non textuel, trop long, ou e-mail sans `@` |
| 400 | `Invalid value` | nouvelle adresse identique à l'adresse actuelle |
| 401 | `Login required` | pas de session |
| 401 | `Invalid credentials` | mot de passe actuel faux |
| 409 | `Email already used` | adresse déjà présente dans `people`, avec ou sans compte |

### Confirmation : `POST /api/auth/email-change/confirm`

Corps : `{"token": "<jeton reçu dans le lien>"}`. Aucune session n'est exigée : le lien peut être ouvert sur un autre appareil, le jeton suffit à prouver que la nouvelle adresse est contrôlée.

| Code | Réponse | Cas |
| --- | --- | --- |
| 200 | la fiche (`id`, `first_name`, `last_name`, `email`, `phone`, `role`), avec la nouvelle adresse | adresse confirmée et enregistrée |
| 400 | `Invalid field: token` | jeton absent, vide ou non textuel |
| 400 | `Invalid value` | jeton inconnu, déjà utilisé ou expiré (même réponse dans les trois cas) |
| 409 | `Email already used` | la nouvelle adresse a été prise entre-temps par une autre fiche |

La session en cours reste ouverte. Le mot de passe ne change pas.

# Authentification et autorisations

La fonction `current_user()` permet d'identifier l'utilisateur connecté grâce à la session.

Les routes protégées utilisent :

```text
@login_required
```

ou :

```text
@admin_required
```

### Utilisateur non connecté

```json
{
  "error": "Login required"
}
```

→ **401**

### Utilisateur connecté mais non administrateur

```json
{
  "error": "Admin only"
}
```

→ **403**

### Administrateur

L'accès aux routes d'administration, à la création d'annonces (`POST /api/ads`) et à la clôture des annonces est autorisé.

### Récapitulatif des routes protégées

| Route                               | Décorateur        |
| ----------------------------------- | ----------------- |
| `POST /api/ads`                     | `@admin_required` |
| `POST /api/ads/<id>/closure`        | `@admin_required` |
| `GET/POST/PATCH/DELETE /api/admin/…`| `@admin_required` |
| `GET /api/me/applications`          | `@login_required` |
| `POST /api/auth/email-change`       | `@login_required` |
| `GET/PUT/DELETE /api/me/cv`, `GET /api/me/cv/file` | `@login_required` |
| `GET/PATCH /api/recruiter/company`, `GET/POST /api/recruiter/ads`, `PATCH/DELETE /api/recruiter/ads/<id>`, `GET /api/recruiter/ads/<id>/applications`, `GET /api/recruiter/ads/<id>/applications/<application_id>/cv`, `POST /api/recruiter/ads/<id>/closure` | vérification du recruteur (voir [Espace recruteur](#espace-recruteur)) |

---

# Suppressions protégées

Les clés étrangères sont en `ON DELETE RESTRICT`.

Une entreprise, une catégorie ou une personne référencée ne peut pas être supprimée.

Une annonce qui possède des candidatures ne peut pas être supprimée.

Dans ce cas, le CRUD retourne :

```json
{
  "error": "Record is still referenced"
}
```

avec le code **409**.

---

# Espace recruteur

Ajouté au J7. Un **recruteur** est une personne connectée dont la fiche `people` a un `company_id` : elle gère cette entreprise et ses annonces, et rien d'autre.

## Base de données

`people` reçoit une colonne facultative :

```sql
company_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT
```

- `NULL` (cas par défaut) : la personne n'est pas recruteur.
- Elle est renseignée par l'administrateur, avec le CRUD de `people` : `company_id` s'ajoute aux champs disponibles et modifiables de `people`. Une entreprise inconnue renvoie 400 `Unknown reference`.
- L'inscription (`POST /api/auth/register`) et `PATCH /api/auth/me` ne la lisent jamais : personne ne peut se déclarer recruteur soi-même.
- Le remplissage (`seed_data.py`) rattache chaque contact des annonces à l'entreprise de ces annonces.

## Vérification du recruteur

Appliquée à toutes les routes `/api/recruiter/…`, dans `routes/recruiter.py` :

| Code | Message | Cas |
| --- | --- | --- |
| 401 | `Login required` | pas de session |
| 403 | `Recruiter only` | personne connectée sans `company_id` (un administrateur sans entreprise reçoit aussi 403) |

L'entreprise utilisée est **toujours** celle de la fiche de la personne connectée : aucune route ne lit un `company_id` envoyé par le client.

## Routes

| Route | Succès | Erreurs |
| --- | --- | --- |
| `GET /api/categories` (publique) | 200 : `[{"id": 1, "name": "Développement"}]`, par ordre alphabétique | — |
| `GET /api/recruiter/company` | 200 : l'entreprise | 401, 403 |
| `PATCH /api/recruiter/company` | 200 : l'entreprise modifiée | 401, 403, 400 (voir ci-dessous) |
| `GET /api/recruiter/ads` | 200 : toutes les annonces de l'entreprise, ouvertes et fermées, de la plus récente à la plus ancienne (`[]` possible) | 401, 403 |
| `POST /api/recruiter/ads` | 201 : l'annonce créée, au format [Détail d'une annonce](#détail-dune-annonce) | 401, 403, 400 (voir ci-dessous) |
| `PATCH /api/recruiter/ads/<id>` (J8) | 200 : l'annonce modifiée, au format [Détail d'une annonce](#détail-dune-annonce) | 401, 403, 404, 400, 409 (voir ci-dessous) |
| `DELETE /api/recruiter/ads/<id>` (J8) | 204 | 401, 403, 404, 409 (voir ci-dessous) |
| `GET /api/recruiter/ads/<id>/applications` (J8) | 200 : les candidatures de l'annonce (`[]` possible) | 401, 403, 404 |
| `GET /api/recruiter/ads/<id>/applications/<application_id>/cv` | 200 : le CV joint, en PDF | 401, 403, 404 (voir ci-dessous) |
| `POST /api/recruiter/ads/<id>/closure` (J8) | 200 : l'annonce fermée, au format [Détail d'une annonce](#détail-dune-annonce) | 401, 403, 404, 400, 409 (voir ci-dessous) |
| `POST /api/recruiter/ads/<id>/applications/<application_id>/rejection` (J9) | 200 : la candidature refusée | 401, 403, 404, 409 (voir ci-dessous) |

**Annonce d'une autre entreprise.** Sur les routes `/api/recruiter/ads/<id>…`, une annonce inexistante **et** une annonce d'une autre entreprise reçoivent la même réponse : 404 `Ad not found`. Un recruteur ne peut ni lire, ni modifier, ni clôturer, ni supprimer l'annonce d'une autre entreprise, et la réponse ne lui apprend même pas qu'elle existe.

### `GET /api/recruiter/company`

```json
{
  "id": 2,
  "name": "Orvelune",
  "description": "…",
  "location": "Lyon",
  "website": "https://orvelune.example",
  "siren": "936442573"
}
```

### `PATCH /api/recruiter/company`

Champs modifiables : `name`, `description`, `location`, `website`. Le `siren` n'est **pas** modifiable par le recruteur : il identifie l'entreprise, seul l'administrateur le change.

| Code | Message | Cas |
| --- | --- | --- |
| 400 | `No fields to update` | corps vide |
| 400 | `Unknown field: <nom>` | champ hors de la liste, `siren` et `id` compris |
| 400 | `Missing field: name` | `name` vide ou composé d'espaces |

### `GET /api/recruiter/ads`

```json
[
  {
    "id": 12,
    "title": "Développeur Python",
    "short_description": "Back-end Flask",
    "location": "Lyon",
    "contract_type": "CDI",
    "status": "open",
    "created_at": "2026-10-09 14:12:00",
    "applications_count": 3,
    "oldest_unanswered_at": "2026-09-20 09:00:00"
  }
]
```

- `applications_count` : nombre total de candidatures reçues par l'annonce (0 possible).
- `oldest_unanswered_at` : `created_at` de la plus ancienne candidature encore `pending` de l'annonce, `null` s'il n'y en a aucune.
- Pas de pagination.

### `POST /api/recruiter/ads`

Mêmes champs que [`POST /api/ads`](#post-apiads), **sans** `company_id` ni `contact_id` : le serveur met l'entreprise du recruteur et le recruteur lui-même comme contact. Le `status` d'une nouvelle annonce est `open`.

| Champ | Obligatoire | Remarque |
| --- | --- | --- |
| `title` | oui | |
| `short_description` | oui | |
| `category_id` | oui | doit exister (liste : `GET /api/categories`) |
| `description`, `salary` (entier), `location`, `working_time`, `contract_type` | non | |

| Code | Message | Cas |
| --- | --- | --- |
| 400 | `Missing field: <nom>` | `title`, `short_description` ou `category_id` absent ou vide |
| 400 | `Unknown field: <nom>` | `company_id`, `contact_id` ou tout champ hors de la liste |
| 400 | `Unknown category_id` | catégorie inexistante |

### `PATCH /api/recruiter/ads/<id>`

Mêmes champs que `POST /api/recruiter/ads`, tous facultatifs : seuls les champs envoyés changent. `company_id`, `contact_id`, `status` et `created_at` ne sont jamais modifiables.

| Code | Message | Cas |
| --- | --- | --- |
| 400 | `No fields to update` | corps vide |
| 400 | `Unknown field: <nom>` | champ hors de la liste |
| 400 | `Missing field: <nom>` | `title`, `short_description` ou `category_id` envoyé vide |
| 400 | `Unknown category_id` | catégorie inexistante |
| 404 | `Ad not found` | annonce inexistante ou d'une autre entreprise |
| 409 | `Ad is closed` | une annonce fermée ne se modifie plus |

### `DELETE /api/recruiter/ads/<id>`

Supprime une annonce **sans candidature**. Une annonce qui a reçu des candidatures se clôture, elle ne se supprime pas : les candidats gardent ainsi la trace de leur candidature dans « Mes candidatures ».

| Code | Message | Cas |
| --- | --- | --- |
| 204 | — | annonce supprimée |
| 404 | `Ad not found` | annonce inexistante ou d'une autre entreprise |
| 409 | `Ad has applications` | l'annonce a au moins une candidature |

### `GET /api/recruiter/ads/<id>/applications`

Les candidatures d'une annonce de l'entreprise, ouverte ou fermée, de la plus **ancienne** à la plus récente (`created_at` puis `id` croissants) : le recruteur répond d'abord à ceux qui attendent depuis le plus longtemps.

```json
[
  {
    "id": 5,
    "first_name": "Alice",
    "last_name": "Test",
    "email": "alice.test@example.com",
    "phone": null,
    "message": "Bonjour, je suis intéressée.",
    "status": "pending",
    "created_at": "2026-10-09 14:12:00"
  }
]
```

Clés : `id`, `first_name`, `last_name`, `email`, `phone`, `message`, `status`, `created_at`, `has_cv` (`true` si un CV est joint). `id` est l'identifiant de la **candidature** : c'est lui qu'on envoie comme `accepted_application_id` à la clôture. Pas de pagination.

### `GET /api/recruiter/ads/<id>/applications/<application_id>/cv`

Le CV joint à la candidature : 200 et le PDF (`application/pdf`, en téléchargement, sous son nom d'origine).

| Code | Message | Cas |
| --- | --- | --- |
| 404 | `Ad not found` | annonce inexistante ou d'une autre entreprise |
| 404 | `Application not found` | candidature inexistante ou d'une autre annonce |
| 404 | `CV not found` | la candidature n'a pas de CV |

### `POST /api/recruiter/ads/<id>/closure`

Mêmes corps, mêmes règles et même transaction que la [clôture par l'administrateur](#clôture-dune-annonce) : `accepted_application_id` est facultatif. Sans lui (`{}`), toutes les candidatures passent à `rejected` ; avec lui, cette candidature passe à `accepted` et toutes les autres à `rejected`. Les e-mails partent après la validation.

| Code | Message | Cas |
| --- | --- | --- |
| 400 | `Application does not belong to this ad` | la candidature sélectionnée appartient à une autre annonce |
| 404 | `Ad not found` | annonce inexistante ou d'une autre entreprise |
| 409 | `Ad already closed` | annonce déjà fermée |

### `POST /api/recruiter/ads/<id>/applications/<application_id>/rejection`

Ajouté au J9. Refuse **une seule** candidature, sans clôturer l'annonce : le recruteur répond au candidat sans attendre la fin du recrutement. Pas de corps.

- La candidature passe de `pending` à `rejected` ; l'annonce reste `open`, les autres candidatures ne changent pas.
- Après le `commit()`, le candidat reçoit l'e-mail « non retenu » (même texte qu'à la clôture), et `decision_email_sent_at` est rempli si l'envoi réussit.
- À la clôture suivante, cette candidature ne reçoit pas un second e-mail : `notify_closure` saute les candidatures dont `decision_email_sent_at` est déjà rempli.

```json
{
  "id": 5,
  "first_name": "Alice",
  "last_name": "Test",
  "email": "alice.test@example.com",
  "phone": null,
  "message": "Bonjour, je suis intéressée.",
  "status": "rejected",
  "created_at": "2026-10-09 14:12:00"
}
```

Réponse 200 : la candidature, avec les mêmes clés que [`GET /api/recruiter/ads/<id>/applications`](#get-apirecruiteradsidapplications).

| Code | Message | Cas |
| --- | --- | --- |
| 404 | `Ad not found` | annonce inexistante ou d'une autre entreprise |
| 404 | `Application not found` | candidature inexistante ou d'une autre annonce |
| 409 | `Ad already closed` | annonce déjà fermée |
| 409 | `Application already processed` | la candidature n'est plus `pending` |

---

# E-mails des candidatures

Ajouté au J8. Les fonctions de `backend/mailer.py` sont appelées par les routes, **après** le `commit()` : un e-mail ne part que si la base a bien enregistré, et un e-mail qui échoue ne fait jamais échouer la route (la réponse HTTP reste la même).

| Événement | Destinataire | Fonction | Suivi dans `applications` |
| --- | --- | --- | --- |
| Candidature créée (`POST /api/ads/<id>/applications`) | le candidat | `notify_application_received` | `receipt_email_sent_at` |
| Annonce clôturée (`POST /api/ads/<id>/closure` ou `POST /api/recruiter/ads/<id>/closure`) | chaque candidat : retenu ou non retenu | `notify_closure` | `decision_email_sent_at` |
| Candidature refusée seule (`POST /api/recruiter/ads/<id>/applications/<application_id>/rejection`, J9) | ce candidat | `notify_rejection` (même texte que le « non retenu » de `notify_closure`) | `decision_email_sent_at` |

```sql
receipt_email_sent_at TEXT,   -- date d'envoi de l'accusé de réception ; NULL : pas envoyé
decision_email_sent_at TEXT   -- date d'envoi de la réponse (retenu ou non) ; NULL : pas envoyé
```

- La colonne reçoit `datetime('now')` **seulement si** l'envoi a réussi (`send_email` a renvoyé `True`).
- Avec `MAIL_ENABLED=0`, rien n'est envoyé : les colonnes restent `NULL`, et une ligne s'affiche dans le terminal de l'API.
- Un `NULL` permet de retrouver les e-mails à renvoyer : `SELECT id FROM applications WHERE status != 'pending' AND decision_email_sent_at IS NULL`.
- Base existante, sans la réinitialiser :

  ```sql
  ALTER TABLE applications ADD COLUMN receipt_email_sent_at TEXT;
  ALTER TABLE applications ADD COLUMN decision_email_sent_at TEXT;
  ```

---

# Changements : dépôt de CV

- CV en PDF (2 Mo maximum), facultatif, joint à une candidature en `multipart/form-data` ou copié depuis le profil (`use_profile_cv`) : voir [CV](#cv).
- Nouvelles routes `GET/PUT/DELETE /api/me/cv`, `GET /api/me/cv/file` et `GET /api/recruiter/ads/<id>/applications/<application_id>/cv`.
- Clé `has_cv` dans la réponse de `POST /api/ads/<id>/applications` et dans les candidatures de l'espace recruteur.
- Tables `person_cvs` et `application_cvs`, créées automatiquement sur une base existante.

---

# Changements J9

- Espace recruteur : `POST /api/recruiter/ads/<id>/applications/<application_id>/rejection` refuse une candidature sans clôturer l'annonce (404 `Application not found`, 409 `Application already processed`) ; `notify_closure` n'écrit plus aux candidats déjà prévenus.
- Administration : paramètre facultatif `order` (`asc` ou `desc`) sur `GET /api/admin/<table>`, par `created_at` pour `ads` et `applications`, sinon par `id` ; 400 `Invalid order`.

---

# Changements J8

- Espace recruteur : `PATCH` et `DELETE /api/recruiter/ads/<id>`, `GET /api/recruiter/ads/<id>/applications`, `POST /api/recruiter/ads/<id>/closure` ; une annonce d'une autre entreprise répond 404 `Ad not found`.
- E-mails des candidatures branchés (accusé de réception, retenu, non retenu) ; colonnes `receipt_email_sent_at` et `decision_email_sent_at` dans `applications`, lisibles par le CRUD admin, non modifiables.
- Changement d'adresse e-mail confirmé par un lien envoyé à la nouvelle adresse : `POST /api/auth/email-change`, `POST /api/auth/email-change/confirm`, table `pending_email_changes`.

---

# Changements J7

- Espace recruteur : colonne `people.company_id`, routes `GET /api/categories`, `GET/PATCH /api/recruiter/company`, `GET/POST /api/recruiter/ads`, erreur 403 `Recruiter only`.
- `PATCH /api/auth/me` : `email` n'est plus modifiable (400 `Unknown field: email`) ; un `phone` vide est enregistré `null`.
- Inscription en attente : le lien de vérification n'est écrit dans le journal du serveur que si l'envoi d'e-mails est désactivé.
- `POST /api/auth/register` : une réponse 201 crée aussi la session ; rien ne change pour 202.

---

# Changements J6

- `companies` reçoit `siren` (chaîne de 9 chiffres, unique, obligatoire à la création) : voir [SIREN](#siren).
- Script `migrate_siren.py` pour ajouter le SIREN à une base existante sans la réinitialiser.
- `POST /api/auth/login` : 429 `Too many attempts` avec `Retry-After` après 5 échecs en 15 minutes.
- `POST /api/auth/register` répond 202 pour un email déjà dans `people` sans mot de passe ; nouvelle route `POST /api/auth/verify` et table `pending_registrations`.

---

# Changements J5

- `POST /api/ads` est réservée à l'admin (401 / 403).
- Nouvelle route `GET /api/me/applications` (candidatures de la personne connectée).
- Pagination facultative (`page`, `per_page`, en-tête `X-Total-Count`) sur `GET /api/ads` et `GET /api/admin/<table>`.
- Inscription et connexion : un champ manquant ou invalide renvoie `Invalid field: <nom>` (au lieu de `Missing field: <nom>`).
