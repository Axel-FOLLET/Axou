# Tests de l'authentification (J3, Task04)

Tests rejoués le 07/10/2026 sur la branche `feature/auth` (inscription et connexion), après `python init_db.py` pour partir d'une base propre. Les réponses viennent du client de test de Flask, qui exécute le même code que le serveur ; la commande `curl` de chaque cas est celle à taper pour le refaire à la main.

| N° | Cas | Code attendu | Code obtenu |
|----|-----|--------------|-------------|
| 1 | register complet | 201 | 201 |
| 2 | même email une 2ᵉ fois | 409 | 409 |
| 3 | register sans password | 400 | 400 |
| 4 | login bon couple | 200 | 200 |
| 5 | login mauvais mot de passe | 401 | 401 |
| 6 | login email inconnu | 401 | 401 |
| 7 | login sans email | 400 | 400 |
| 8 | register avec un mot de passe de 5 caractères | 400 | 400 |
| 9 | register avec `Test@Example.com`, puis login avec `test@example.com` | 200 | 200 |

Aucune réponse de succès (cas 1, 4 et 9) ne contient `password` ni `password_hash`. Les cas 5 et 6 renvoient le même message (`Invalid credentials`), pour ne pas révéler si l'email existe.

Vérifications complémentaires : un `role` envoyé par le client à l'inscription est ignoré (le compte est créé avec le rôle `user`), et le mot de passe est stocké haché (jamais en clair).

À traiter au J4 (validation des types) : un mot de passe ou un email qui n'est pas du texte (un nombre par exemple) provoque encore une erreur 500 au lieu d'un 400.

## Cas 1 : register complet (attendu 201)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Alice", "last_name": "Test", "email": "alice.test@example.com", "password": "motdepasse1"}'
```

Code obtenu : 201

Réponse :

```json
{
  "email": "alice.test@example.com",
  "first_name": "Alice",
  "id": 4,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```


## Cas 2 : même email une 2ᵉ fois (attendu 409)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Alice", "last_name": "Test", "email": "alice.test@example.com", "password": "motdepasse1"}'
```

Code obtenu : 409

Réponse :

```json
{ "error": "Email already used" }
```


## Cas 3 : register sans password (attendu 400)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Alice", "last_name": "Test", "email": "alice.test@example.com"}'
```

Code obtenu : 400

Réponse :

```json
{ "error": "Missing field: password" }
```


## Cas 4 : login bon couple (attendu 200)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "alice.test@example.com", "password": "motdepasse1"}'
```

Code obtenu : 200

Réponse :

```json
{
  "email": "alice.test@example.com",
  "first_name": "Alice",
  "id": 4,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```


## Cas 5 : login mauvais mot de passe (attendu 401)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "alice.test@example.com", "password": "mauvais-mot-de-passe"}'
```

Code obtenu : 401

Réponse :

```json
{ "error": "Invalid credentials" }
```


## Cas 6 : login email inconnu (attendu 401)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "inconnu@example.com", "password": "motdepasse1"}'
```

Code obtenu : 401

Réponse :

```json
{ "error": "Invalid credentials" }
```


## Cas 7 : login sans email (attendu 400)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"password": "motdepasse1"}'
```

Code obtenu : 400

Réponse :

```json
{ "error": "Missing field: email" }
```


## Cas 8 : register avec un mot de passe de 5 caractères (attendu 400)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Bob", "last_name": "Test", "email": "bob.test@example.com", "password": "12345"}'
```

Code obtenu : 400

Réponse :

```json
{ "error": "Password must be at least 8 characters" }
```


## Cas 9 : register avec Test@Example.com, puis login avec test@example.com (attendu 200)

Étape 1 : inscription avec une majuscule dans l'email (attendu 201, email enregistré en minuscules).

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Chloé", "last_name": "Test", "email": "Test@Example.com", "password": "motdepasse1"}'
```

Code obtenu : 201

Réponse :

```json
{
  "email": "test@example.com",
  "first_name": "Chlo\u00e9",
  "id": 5,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```


# Changement d'adresse e-mail (J8-J9)

Tests rejou\u00e9s le 14/10/2026 avec le client de test de Flask, sur une copie de la base. Le compte de test (`Testeur Changement`, id 37, mot de passe `MotDePasse1`) a \u00e9t\u00e9 cr\u00e9\u00e9 dans cette copie ; avec une autre base, l'`id` et l'adresse \u00ab d\u00e9j\u00e0 utilis\u00e9e \u00bb du cas 16 changent. Contrat : `docs/contrat_api.md`, section \u00ab Changement d'adresse e-mail \u00bb.

La demande (`POST /api/auth/email-change`) exige la session **et** le mot de passe actuel ; elle ne modifie pas la fiche, elle envoie un lien \u00e0 la **nouvelle** adresse. La confirmation (`POST /api/auth/email-change/confirm`) se fait sans session, avec le jeton du lien. Avec `MAIL_ENABLED=0`, le lien s'affiche dans le terminal du serveur : `[changement d'adresse] lien pour <adresse> : http://localhost:5173/confirmation-email?token=<jeton>`.

| N\u00b0 | Cas | Code attendu | Code obtenu |
|----|-----|--------------|-------------|
| 10 | demande sans session | 401 | 401 |
| 11 | demande, corps qui n'est pas un objet JSON | 400 | 400 |
| 12 | demande sans `email` | 400 | 400 |
| 13 | demande avec un `email` sans `@` | 400 | 400 |
| 14 | demande avec un mauvais mot de passe | 401 | 401 |
| 15 | demande avec l'adresse actuelle (m\u00eame en majuscules) | 400 | 400 |
| 16 | demande avec une adresse d\u00e9j\u00e0 pr\u00e9sente dans `people` | 409 | 409 |
| 17 | demande valide | 202 | 202 |
| 18 | confirmation sans `token` | 400 | 400 |
| 19 | confirmation avec un jeton inconnu | 400 | 400 |
| 20 | confirmation avec le bon jeton | 200 | 200 |
| 21 | le m\u00eame jeton une deuxi\u00e8me fois | 400 | 400 |
| 22 | deux demandes de suite : premier lien, puis second | 400 puis 200 | 400 puis 200 |
| 23 | jeton expir\u00e9 | 400 | 400 |
| 24 | adresse prise par une autre fiche entre la demande et le clic | 409 | 409 |
| 25 | apr\u00e8s confirmation : login nouvelle adresse, puis ancienne | 200 puis 401 | 200 puis 401 |
| 26 | `PATCH /api/auth/me` avec `email` | 400 | 400 |

V\u00e9rifications compl\u00e9mentaires, dans la base (`sqlite3 jobboard.db`) : apr\u00e8s le cas 17, `SELECT person_id, new_email, token_hash FROM pending_email_changes;` montre une ligne dont `token_hash` (64 caract\u00e8res hexad\u00e9cimaux) **n'est pas** le jeton du lien, et `SELECT email FROM people WHERE id = 37;` affiche **toujours l'ancienne** adresse. Apr\u00e8s le cas 20, la table `pending_email_changes` est vide et la fiche porte la nouvelle adresse. La r\u00e9ponse 202 du cas 17 ne contient jamais le jeton. Le `GET /api/auth/me` fait avec la session d'origine apr\u00e8s le cas 20 r\u00e9pond 200 avec la nouvelle adresse : la session reste ouverte.

Le compte de test a \u00e9t\u00e9 cr\u00e9\u00e9 avec le cas 1 (`register`), adapt\u00e9 : `{"first_name": "Testeur", "last_name": "Changement", "email": "test.change@example.com", "password": "MotDePasse1"}`.

## Cas 10 : demande sans session (attendu 401)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 401

R\u00e9ponse :

```json
{ "error": "Login required" }
```


## Connexion du compte de test (attendu 200)

Les cas 11 \u00e0 17 utilisent le cookie de session enregistr\u00e9 ici.

Commande :

```bash
curl -i -c cookies.txt -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test.change@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 200


## Cas 11 : demande, corps qui n'est pas un objet JSON (attendu 400)

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '[]'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "JSON object expected" }
```


## Cas 12 : demande sans email (attendu 400)

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"password": "MotDePasse1"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid field: email" }
```


## Cas 13 : demande avec un email sans @ (attendu 400)

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle", "password": "MotDePasse1"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid field: email" }
```


## Cas 14 : demande avec un mauvais mot de passe (attendu 401)

Le mot de passe est v\u00e9rifi\u00e9 **avant** l'adresse : avec une session vol\u00e9e mais sans le mot de passe, on ne peut m\u00eame pas savoir si une adresse est d\u00e9j\u00e0 dans la base (le 409 n'est jamais atteint).

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle@example.com", "password": "faux"}'
```

Code obtenu : 401

R\u00e9ponse :

```json
{ "error": "Invalid credentials" }
```


## Cas 15 : demande avec l'adresse actuelle (attendu 400)

L'adresse est compar\u00e9e apr\u00e8s `.strip().lower()` : `Test.Change@example.com` est bien l'adresse actuelle.

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "Test.Change@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid value" }
```


## Cas 16 : demande avec une adresse d\u00e9j\u00e0 pr\u00e9sente dans people (attendu 409)

`claude.test@example.com` est une adresse d'une autre fiche de la base utilis\u00e9e pour le test ; prendre n'importe quelle adresse de `SELECT email FROM people;` qui n'est pas celle du compte de test.

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "claude.test@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 409

R\u00e9ponse :

```json
{ "error": "Email already used" }
```


## Cas 17 : demande valide (attendu 202)

Commande :

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 202

R\u00e9ponse :

```json
{ "message": "Verification required" }
```

Terminal du serveur (le jeton change \u00e0 chaque demande) :

```
[mail d\u00e9sactiv\u00e9] \u00c0 : nouvelle@example.com | Sujet : Confirmez votre nouvelle adresse \u2014 Y.I.A Jobs
[changement d'adresse] lien pour nouvelle@example.com : http://localhost:5173/confirmation-email?token=gjMpvMTs5rzYIxfuCEFC92c00MC91dqv-1vUobRb6Ro
```

Dans la base, juste apr\u00e8s : `pending_email_changes` contient `person_id = 37`, `new_email = nouvelle@example.com`, `token_hash = 6efab373\u2026e0be` (l'empreinte, pas le jeton) ; `people.email` de l'id 37 vaut toujours `test.change@example.com`.


## Cas 18 : confirmation sans token (attendu 400)

Les cas 18 \u00e0 24 sont jou\u00e9s **sans cookie** : la confirmation ne demande pas de session.

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid field: token" }
```


## Cas 19 : confirmation avec un jeton inconnu (attendu 400)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "pasunjeton"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid value" }
```


## Cas 20 : confirmation avec le bon jeton (attendu 200)

Le jeton est celui du lien affich\u00e9 au cas 17.

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "gjMpvMTs5rzYIxfuCEFC92c00MC91dqv-1vUobRb6Ro"}'
```

Code obtenu : 200

R\u00e9ponse :

```json
{
  "email": "nouvelle@example.com",
  "first_name": "Testeur",
  "id": 37,
  "last_name": "Changement",
  "phone": null,
  "role": "user"
}
```

Dans la base, juste apr\u00e8s : `pending_email_changes` est vide ; `people.email` de l'id 37 vaut `nouvelle@example.com`. `GET /api/auth/me` avec `-b cookies.txt` r\u00e9pond 200 avec la nouvelle adresse : la session d'origine est toujours ouverte.


## Cas 21 : le m\u00eame jeton une deuxi\u00e8me fois (attendu 400)

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "gjMpvMTs5rzYIxfuCEFC92c00MC91dqv-1vUobRb6Ro"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid value" }
```


## Cas 22 : deux demandes de suite, premier lien puis second (attendu 400 puis 200)

\u00c9tape 1 : deux demandes avec le cookie, pour `encore1@example.com` puis `encore2@example.com` (202 chacune, un lien par demande dans le terminal). `create` supprime la demande pr\u00e9c\u00e9dente de la m\u00eame personne : seul le second jeton existe encore en base.

\u00c9tape 2 : confirmation avec le **premier** jeton (attendu 400).

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<jeton du premier lien>"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid value" }
```

\u00c9tape 3 : confirmation avec le **second** jeton (attendu 200).

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<jeton du second lien>"}'
```

Code obtenu : 200

R\u00e9ponse :

```json
{
  "email": "encore2@example.com",
  "first_name": "Testeur",
  "id": 37,
  "last_name": "Changement",
  "phone": null,
  "role": "user"
}
```


## Cas 23 : jeton expir\u00e9 (attendu 400)

Une demande pour `encore3@example.com` (202), puis la ligne est vieillie \u00e0 la main dans la base pour ne pas attendre 24 heures :

```sql
UPDATE pending_email_changes SET expires_at = datetime('now', '-1 minute');
```

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<jeton du lien>"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Invalid value" }
```


## Cas 24 : adresse prise par une autre fiche entre la demande et le clic (attendu 409)

Une demande pour `prise.entre.temps@example.com` (202), puis une autre fiche prend cette adresse avant le clic (ici directement dans la base ; un `register` avec cette adresse ferait pareil) :

```sql
INSERT INTO people (first_name, last_name, email) VALUES ('Autre', 'Personne', 'prise.entre.temps@example.com');
```

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<jeton du lien>"}'
```

Code obtenu : 409

R\u00e9ponse :

```json
{ "error": "Email already used" }
```


## Cas 25 : apr\u00e8s confirmation, login nouvelle adresse puis ancienne (attendu 200 puis 401)

Apr\u00e8s le cas 22, l'adresse du compte est `encore2@example.com`.

\u00c9tape 1 : connexion avec la nouvelle adresse et le m\u00eame mot de passe (attendu 200).

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "encore2@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 200

R\u00e9ponse :

```json
{
  "email": "encore2@example.com",
  "first_name": "Testeur",
  "id": 37,
  "last_name": "Changement",
  "phone": null,
  "role": "user"
}
```

\u00c9tape 2 : connexion avec l'ancienne adresse (attendu 401).

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test.change@example.com", "password": "MotDePasse1"}'
```

Code obtenu : 401

R\u00e9ponse :

```json
{ "error": "Invalid credentials" }
```


## Cas 26 : PATCH /api/auth/me avec email (attendu 400)

Le changement d'adresse ne passe jamais par `PATCH /api/auth/me` : la seule voie reste la demande puis la confirmation.

Commande :

```bash
curl -i -b cookies.txt -X PATCH http://localhost:5000/api/auth/me -H "Content-Type: application/json" -d '{"email": "x@y.z"}'
```

Code obtenu : 400

R\u00e9ponse :

```json
{ "error": "Unknown field: email" }
```

Étape 2 : connexion avec l'email en minuscules (attendu 200).

Commande :

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test@example.com", "password": "motdepasse1"}'
```

Code obtenu : 200

Réponse :

```json
{
  "email": "test@example.com",
  "first_name": "Chlo\u00e9",
  "id": 5,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```

