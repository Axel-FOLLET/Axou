# Authentication tests (J3, Task04)

Tests replayed on 07/10/2026 on the `feature/auth` branch (registration and login), after `python init_db.py` to start from a clean database. The responses come from the Flask test client, which runs the same code as the server; the `curl` command of each case is the one to type to redo it by hand.

| No. | Case | Expected code | Obtained code |
|----|-----|--------------|-------------|
| 1 | complete register | 201 | 201 |
| 2 | same email a 2nd time | 409 | 409 |
| 3 | register without password | 400 | 400 |
| 4 | login with the right pair | 200 | 200 |
| 5 | login with a wrong password | 401 | 401 |
| 6 | login with an unknown email | 401 | 401 |
| 7 | login without email | 400 | 400 |
| 8 | register with a 5-character password | 400 | 400 |
| 9 | register with `Test@Example.com`, then login with `test@example.com` | 200 | 200 |

No success response (cases 1, 4 and 9) contains `password` or `password_hash`. Cases 5 and 6 return the same message (`Invalid credentials`), so as not to reveal whether the email exists.

Additional checks: a `role` sent by the client at registration is ignored (the account is created with the role `user`), and the password is stored hashed (never in plain text).

To handle on J4 (type validation): a password or an email that is not text (a number for example) still causes a 500 error instead of a 400.

## Case 1: complete register (expected 201)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Alice", "last_name": "Test", "email": "alice.test@example.com", "password": "motdepasse1"}'
```

Status code: 201

Response:

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


## Case 2: same email a 2nd time (expected 409)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Alice", "last_name": "Test", "email": "alice.test@example.com", "password": "motdepasse1"}'
```

Status code: 409

Response:

```json
{ "error": "Email already used" }
```


## Case 3: register without password (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Alice", "last_name": "Test", "email": "alice.test@example.com"}'
```

Status code: 400

Response:

```json
{ "error": "Missing field: password" }
```


## Case 4: login with the right pair (expected 200)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "alice.test@example.com", "password": "motdepasse1"}'
```

Status code: 200

Response:

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


## Case 5: login with a wrong password (expected 401)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "alice.test@example.com", "password": "mauvais-mot-de-passe"}'
```

Status code: 401

Response:

```json
{ "error": "Invalid credentials" }
```


## Case 6: login with an unknown email (expected 401)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "inconnu@example.com", "password": "motdepasse1"}'
```

Status code: 401

Response:

```json
{ "error": "Invalid credentials" }
```


## Case 7: login without email (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"password": "motdepasse1"}'
```

Status code: 400

Response:

```json
{ "error": "Missing field: email" }
```


## Case 8: register with a 5-character password (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Bob", "last_name": "Test", "email": "bob.test@example.com", "password": "12345"}'
```

Status code: 400

Response:

```json
{ "error": "Password must be at least 8 characters" }
```


## Case 9: register with Test@Example.com, then login with test@example.com (expected 200)

Step 1: registration with a capital letter in the email (expected 201, email saved in lowercase).

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name": "Chloé", "last_name": "Test", "email": "Test@Example.com", "password": "motdepasse1"}'
```

Status code: 201

Response:

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


# Email address change (J8-J9)

Tests replayed on 14/10/2026 with the Flask test client, on a copy of the database. The test account (`Testeur Changement`, id 37, password `MotDePasse1`) was created in this copy; with another database, the `id` and the "already used" address of case 16 change. Contract: `docs/contrat_api.md`, section "Changement d'adresse e-mail" (the section title is in French in that file).

The request (`POST /api/auth/email-change`) requires the session **and** the current password; it does not modify the record, it sends a link to the **new** address. The confirmation (`POST /api/auth/email-change/confirm`) is done without a session, with the token of the link. With `MAIL_ENABLED=0`, the link is printed in the server terminal: `[email change] link for <address>: http://localhost:5173/confirmation-email?token=<token>`.

| No. | Case | Expected code | Obtained code |
|----|-----|--------------|-------------|
| 10 | request without session | 401 | 401 |
| 11 | request, body that is not a JSON object | 400 | 400 |
| 12 | request without `email` | 400 | 400 |
| 13 | request with an `email` without `@` | 400 | 400 |
| 14 | request with a wrong password | 401 | 401 |
| 15 | request with the current address (even in capitals) | 400 | 400 |
| 16 | request with an address already present in `people` | 409 | 409 |
| 17 | valid request | 202 | 202 |
| 18 | confirmation without `token` | 400 | 400 |
| 19 | confirmation with an unknown token | 400 | 400 |
| 20 | confirmation with the right token | 200 | 200 |
| 21 | the same token a second time | 400 | 400 |
| 22 | two requests in a row: first link, then second | 400 then 200 | 400 then 200 |
| 23 | expired token | 400 | 400 |
| 24 | address taken by another record between the request and the click | 409 | 409 |
| 25 | after confirmation: login with the new address, then the old one | 200 then 401 | 200 then 401 |
| 26 | `PATCH /api/auth/me` with `email` | 400 | 400 |

Additional checks, in the database (`sqlite3 jobboard.db`): after case 17, `SELECT person_id, new_email, token_hash FROM pending_email_changes;` shows a row whose `token_hash` (64 hexadecimal characters) is **not** the token of the link, and `SELECT email FROM people WHERE id = 37;` **still** shows the old address. After case 20, the table `pending_email_changes` is empty and the record carries the new address. The 202 response of case 17 never contains the token. The `GET /api/auth/me` made with the original session after case 20 answers 200 with the new address: the session stays open.

The test account was created with case 1 (`register`), adapted: `{"first_name": "Testeur", "last_name": "Changement", "email": "test.change@example.com", "password": "MotDePasse1"}`.

## Case 10: request without session (expected 401)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle@example.com", "password": "MotDePasse1"}'
```

Status code: 401

Response:

```json
{ "error": "Login required" }
```


## Login of the test account (expected 200)

Cases 11 to 17 use the session cookie saved here.

Command:

```bash
curl -i -c cookies.txt -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test.change@example.com", "password": "MotDePasse1"}'
```

Status code: 200


## Case 11: request, body that is not a JSON object (expected 400)

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '[]'
```

Status code: 400

Response:

```json
{ "error": "JSON object expected" }
```


## Case 12: request without email (expected 400)

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"password": "MotDePasse1"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid field: email" }
```


## Case 13: request with an email without @ (expected 400)

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle", "password": "MotDePasse1"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid field: email" }
```


## Case 14: request with a wrong password (expected 401)

The password is checked **before** the address: with a stolen session but without the password, one cannot even know whether an address is already in the database (the 409 is never reached).

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle@example.com", "password": "faux"}'
```

Status code: 401

Response:

```json
{ "error": "Invalid credentials" }
```


## Case 15: request with the current address (expected 400)

The address is compared after `.strip().lower()`: `Test.Change@example.com` is indeed the current address.

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "Test.Change@example.com", "password": "MotDePasse1"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid value" }
```


## Case 16: request with an address already present in people (expected 409)

`claude.test@example.com` is an address of another record in the database used for the test; take any address from `SELECT email FROM people;` that is not the one of the test account.

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "claude.test@example.com", "password": "MotDePasse1"}'
```

Status code: 409

Response:

```json
{ "error": "Email already used" }
```


## Case 17: valid request (expected 202)

Command:

```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/auth/email-change -H "Content-Type: application/json" -d '{"email": "nouvelle@example.com", "password": "MotDePasse1"}'
```

Status code: 202

Response:

```json
{ "message": "Verification required" }
```

Server terminal (the token changes at every request):

```
[mail disabled] To: nouvelle@example.com | Subject: Confirmez votre nouvelle adresse — Y.I.A Jobs
[email change] link for nouvelle@example.com: http://localhost:5173/confirmation-email?token=gjMpvMTs5rzYIxfuCEFC92c00MC91dqv-1vUobRb6Ro
```

In the database, just after: `pending_email_changes` contains `person_id = 37`, `new_email = nouvelle@example.com`, `token_hash = 6efab373…e0be` (the fingerprint, not the token); `people.email` of id 37 is still `test.change@example.com`.


## Case 18: confirmation without token (expected 400)

Cases 18 to 24 are played **without a cookie**: the confirmation does not require a session.

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{}'
```

Status code: 400

Response:

```json
{ "error": "Invalid field: token" }
```


## Case 19: confirmation with an unknown token (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "pasunjeton"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid value" }
```


## Case 20: confirmation with the right token (expected 200)

The token is the one of the link shown in case 17.

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "gjMpvMTs5rzYIxfuCEFC92c00MC91dqv-1vUobRb6Ro"}'
```

Status code: 200

Response:

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

In the database, just after: `pending_email_changes` is empty; `people.email` of id 37 is `nouvelle@example.com`. `GET /api/auth/me` with `-b cookies.txt` answers 200 with the new address: the original session is still open.


## Case 21: the same token a second time (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "gjMpvMTs5rzYIxfuCEFC92c00MC91dqv-1vUobRb6Ro"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid value" }
```


## Case 22: two requests in a row, first link then second (expected 400 then 200)

Step 1: two requests with the cookie, for `encore1@example.com` then `encore2@example.com` (202 each, one link per request in the terminal). `create` deletes the previous request of the same person: only the second token still exists in the database.

Step 2: confirmation with the **first** token (expected 400).

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<token of the first link>"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid value" }
```

Step 3: confirmation with the **second** token (expected 200).

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<token of the second link>"}'
```

Status code: 200

Response:

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


## Case 23: expired token (expected 400)

A request for `encore3@example.com` (202), then the row is aged by hand in the database so as not to wait 24 hours:

```sql
UPDATE pending_email_changes SET expires_at = datetime('now', '-1 minute');
```

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<token of the link>"}'
```

Status code: 400

Response:

```json
{ "error": "Invalid value" }
```


## Case 24: address taken by another record between the request and the click (expected 409)

A request for `prise.entre.temps@example.com` (202), then another record takes this address before the click (here directly in the database; a `register` with this address would do the same):

```sql
INSERT INTO people (first_name, last_name, email) VALUES ('Autre', 'Personne', 'prise.entre.temps@example.com');
```

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/email-change/confirm -H "Content-Type: application/json" -d '{"token": "<token of the link>"}'
```

Status code: 409

Response:

```json
{ "error": "Email already used" }
```


## Case 25: after confirmation, login with the new address then the old one (expected 200 then 401)

After case 22, the address of the account is `encore2@example.com`.

Step 1: login with the new address and the same password (expected 200).

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "encore2@example.com", "password": "MotDePasse1"}'
```

Status code: 200

Response:

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

Step 2: login with the old address (expected 401).

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test.change@example.com", "password": "MotDePasse1"}'
```

Status code: 401

Response:

```json
{ "error": "Invalid credentials" }
```


## Case 26: PATCH /api/auth/me with email (expected 400)

The address change never goes through `PATCH /api/auth/me`: the only way remains the request then the confirmation.

Command:

```bash
curl -i -b cookies.txt -X PATCH http://localhost:5000/api/auth/me -H "Content-Type: application/json" -d '{"email": "x@y.z"}'
```

Status code: 400

Response:

```json
{ "error": "Unknown field: email" }
```

Step 2: login with the email in lowercase (expected 200).

Command:

```bash
curl -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test@example.com", "password": "motdepasse1"}'
```

Status code: 200

Response:

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

