# API tests

## Case 1: GET /api/ads (expected 200)

Command:

```bash
curl -i http://localhost:5000/api/ads
```

Status code: 200

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 19:40:59",
    "id": 3,
    "location": "Londres",
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  },
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 19:40:59",
    "id": 1,
    "location": "Paris",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python"
  }
]
```

## Case 2: GET /api/ads/1 (expected 200)

Command:

```bash
curl -i http://localhost:5000/api/ads/1
```

Status code: 200

Response:

```json
{
  "category": "D\u00e9veloppement",
  "company": "TechNova",
  "contact_id": 1,
  "contract_type": "CDI",
  "created_at": "2026-10-07 19:40:59",
  "description": "you will dev many website",
  "id": 1,
  "location": "Paris",
  "salary": 42000,
  "short_description": "Back-end Flask",
  "status": "open",
  "title": "D\u00e9veloppeur Python",
  "working_time": "Temps plein"
}
```

## Case 3: GET /api/ads/999 (expected 404)

Command:

```bash
curl -i http://localhost:5000/api/ads/999
```

Status code: 404

Response:

```json
{ "error": "Ad not found" }
```

## Case 4: GET /api/companies/1/ads (expected 200)

Command:

```bash
curl -i http://localhost:5000/api/companies/1/ads
```

Status code: 200

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 19:40:59",
    "id": 3,
    "location": "Londres",
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  },
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 19:40:59",
    "id": 1,
    "location": "Paris",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python"
  }
]
```

## Case 5: GET /api/companies/999/ads (expected 404)

Command:

```bash
curl -i http://localhost:5000/api/companies/999/ads
```

Status code: 404

Response:

```json
{ "error": "Company not found" }
```

## Case 6: POST /api/ads complete (expected 201)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads -H "Content-Type: application/json" -d '{"title": "Test", "short_description": "Court", "company_id": 1, "category_id": 1}'
```

Status code: 201

Response:

```json
{
  "category": "D\u00e9veloppement",
  "company": "TechNova",
  "contact_id": null,
  "contract_type": null,
  "created_at": "2026-10-07 19:41:00",
  "description": null,
  "id": 4,
  "location": null,
  "salary": null,
  "short_description": "Court",
  "status": "open",
  "title": "Test",
  "working_time": null
}
```

## Case 7: POST /api/ads without title (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads -H "Content-Type: application/json" -d '{"short_description": "Court", "company_id": 1, "category_id": 1}'
```

Status code: 400

Response:

```json
{ "error": "Missing field: title" }
```

## Case 8: POST /api/ads with company_id = 999 (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads -H "Content-Type: application/json" -d '{"title": "Test", "short_description": "Court", "company_id": 999, "category_id": 1}'
```

Status code: 400

Response:

```json
{ "error": "Unknown company_id or category_id" }
```

## Case 9: POST /api/ads/3/applications, person 3 (expected 201)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{"person_id": 3, "message": "Bonjour !"}'
```

Status code: 201

Response:

```json
{
  "ad_id": 3,
  "created_at": "2026-10-07 19:41:00",
  "id": 5,
  "message": "Bonjour !",
  "person_id": 3,
  "status": "pending"
}
```

## Case 10: POST /api/ads/3/applications, same request (expected 409)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{"person_id": 3, "message": "Bonjour !"}'
```

Status code: 409

Response:

```json
{ "error": "Already applied" }
```

## Case 11: POST /api/ads/1/applications without message (expected 400)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads/1/applications -H "Content-Type: application/json" -d '{"person_id": 3}'
```

Status code: 400

Response:

```json
{ "error": "Missing field: message" }
```

## Case 12: POST /api/ads/999/applications (expected 404)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads/999/applications -H "Content-Type: application/json" -d '{"person_id": 3, "message": "Salut"}'
```

Status code: 404

Response:

```json
{ "error": "Ad not found" }
```

# J3 - API test

## Part 1: SQL test after typing --> PRAGMA foreign_keys = ON;

## Test 1

Command: UPDATE ads SET status = 'invalide' WHERE id = 1;
Result: Runtime error: CHECK constraint failed: status IN ('open', 'closed') (19)

## Test 2

Command: DELETE FROM companies WHERE id = 1;
Result: Runtime error: FOREIGN KEY constraint failed (19)

## Test 3

Command: DELETE FROM ads WHERE id = 1;
Result: Runtime error: FOREIGN KEY constraint failed (19)

## Part 2: http test (continuation of J2)

## Test 13 (expected: 200, "Cybersécurité")

Command:

```bash
curl -i "http://localhost:5000/api/ads?contract_type=CDI&location=Londres"
```

Status code: 200

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 13:29:32",
    "id": 3,
    "location": "Londres",
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
```

## Test 14 (expected: 200, [])

Command:

```bash
curl -i http://localhost:5000/api/ads?q=zzzz
```

Status code: 200

Response:

```json
[]
```

## Test 15 (expected: 200, "status": "closed")

Command:

```bash
curl -i http://localhost:5000/api/ads/2
```

Status code: 200

Response:

```json
{
  "category": "Data",
  "company": "GreenWorks",
  "contact_id": 2,
  "contract_type": "Stage",
  "created_at": "2026-10-07 13:29:32",
  "description": "you will analize many arrays",
  "id": 2,
  "location": "Mulhouse",
  "salary": 52000,
  "short_description": "Analyse de donn\u00e9es, SQL",
  "status": "closed",
  "title": "Data analyst",
  "working_time": "35h"
}
```

## Test 16 (expected: 200, ids 3 and 1 only)

Command:

```bash
curl -i http://localhost:5000/api/ads
```

Status code: 200

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 13:29:32",
    "id": 3,
    "location": "Londres",
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  },
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-07 13:29:32",
    "id": 1,
    "location": "Paris",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python"
  }
]
```

## Test 17 (expected: 200, [])

Command:

```bash
curl -i http://localhost:5000/api/companies/2/ads
```

Status code: 200

Response:

```json
[]
```

## Test 19 (expected: 201)

Command:

```bash
curl -i -X POST http://localhost:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{"person_id": 1, "message": "Bonjour, je suis intéressé."}'
```

Status code: 201

Response:

```json
{
  "ad_id": 3,
  "created_at": "2026-10-07 13:57:02",
  "id": 5,
  "message": "Bonjour, je suis int\u00e9ress\u00e9.",
  "person_id": 1,
  "status": "pending"
}
```

## J4 test

## Part 1: SQL test

# Test 1: registration of a new user (expected: 201 CREATED)

Command:

```bash
curl -i -X POST http://127.0.0.1:5000/api/auth/register -H "Content-Type: application/json" -d '{"first_name":"Bob","last_name":"Test","email":"bob@example.com","password":"password123"}'
```

Status code: 201

Response:

```json
{
  "email": "bob@example.com",
  "first_name": "Bob",
  "id": 4,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```

# Test 2: Login of this new person (expected: 200 OK)

Command:

```bash
curl -i -c cookies.txt -X POST http://127.0.0.1:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"bob@example.com","password":"password123"}'
```

Status code: 200

Response:

```json
{
  "email": "bob@example.com",
  "first_name": "Bob",
  "id": 4,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```

# Test 3: Admin route without login (expected: 401 UNAUTHORIZED)

Command:

```bash
curl -i http://127.0.0.1:5000/api/admin/people
```

Status code: 401

Response:

```json
{
  "error": "Login required"
}
```

# Test 4: Admin route with a non-admin user (expected: 403 FORBIDDEN)

Command:

```bash
curl -i -b cookies.txt http://127.0.0.1:5000/api/admin/people
```

Status code: 403

Response:

```json
{
  "error": "Admin only"
}
```

# Test 5: make the user an admin (expected: bob@example.com | admin)

Command:

```bash
sqlite3 jobboard.db
UPDATE people SET role = 'admin' WHERE email = 'bob@example.com';
```

```check
SELECT id, email, role FROM people WHERE email = 'bob@example.com';
```

Obtained: bob@example.com|admin

Response:

```json
4|bob@example.com|admin
```

# Test 6: log the user in again as an admin (expected: 200 OK)

Command:

```bash
curl -i -c cookies.txt -X POST http://127.0.0.1:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"bob@example.com","password":"password123"}'
```

Status code: 200

Response:

```json
{
  "email": "bob@example.com",
  "first_name": "Bob",
  "id": 4,
  "last_name": "Test",
  "phone": null,
  "role": "admin"
}
```

# Test 7: GET /api/admin/people (expected 200 OK)

Command:

```bash
curl -i -b cookies.txt http://127.0.0.1:5000/api/admin/people
```

Status code: 200

Response:

```json
[
  {
    "email": "alice.martin@example.com",
    "first_name": "Alice",
    "id": 1,
    "last_name": "Martin",
    "phone": "0600000001",
    "role": "user"
  },
  {
    "email": "bruno.durand@example.com",
    "first_name": "Bruno",
    "id": 2,
    "last_name": "Durand",
    "phone": "0600000002",
    "role": "user"
  },
  {
    "email": "chloe.petit@example.com",
    "first_name": "Chlo\u00e9",
    "id": 3,
    "last_name": "Petit",
    "phone": null,
    "role": "user"
  },
  {
    "email": "bob@example.com",
    "first_name": "Bob",
    "id": 4,
    "last_name": "Test",
    "phone": null,
    "role": "admin"
  }
]
```

# Test 8: GET /api/admin/companies (expected 200 OK)

Command:

```bash
curl -i -b cookies.txt http://127.0.0.1:5000/api/admin/companies
```

Status code: 200

Response:

```json
[
  {
    "description": "Studio de d\u00e9veloppement web",
    "id": 1,
    "location": "Paris",
    "name": "TechNova",
    "website": "https://technova.example.com"
  },
  {
    "description": "Agence de design durable",
    "id": 2,
    "location": "Lyon",
    "name": "GreenWorks",
    "website": "https://greenworks.example.com"
  }
]
```

# Test 9: GET /api/admin/categories (expected 200 OK)

Command:

```bash
curl -i -b cookies.txt http://127.0.0.1:5000/api/admin/categories
```

Status code: 200

Response:

```json
[
  {
    "id": 1,
    "name": "D\u00e9veloppement"
  },
  {
    "id": 2,
    "name": "Design"
  },
  {
    "id": 3,
    "name": "Data"
  }
]
```

# Test 10: GET /api/admin/ads (expected 200 OK)

Command:

```bash
curl -i -b cookies.txt http://127.0.0.1:5000/api/admin/ads
```

Status code: 200

Response:

```json
[
  {
    "category_id": 1,
    "company_id": 1,
    "contact_id": 1,
    "contract_type": "CDI",
    "created_at": "2026-10-08 18:23:28",
    "description": "you will dev many website",
    "id": 1,
    "location": "Paris",
    "salary": 42000,
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python",
    "working_time": "Temps plein"
  },
  {
    "category_id": 3,
    "company_id": 2,
    "contact_id": 2,
    "contract_type": "Stage",
    "created_at": "2026-10-08 18:23:28",
    "description": "you will analize many arrays",
    "id": 2,
    "location": "Mulhouse",
    "salary": 52000,
    "short_description": "Analyse de donn\u00e9es, SQL",
    "status": "closed",
    "title": "Data analyst",
    "working_time": "35h"
  },
  {
    "category_id": 1,
    "company_id": 1,
    "contact_id": 3,
    "contract_type": "CDI",
    "created_at": "2026-10-08 18:23:28",
    "description": "you will defend our website against virus",
    "id": 3,
    "location": "Londres",
    "salary": 100000,
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9",
    "working_time": "Temps plein"
  }
]
```

# Test 11: GET /api/admin/applications (expected 200 OK)

Command:

```bash
curl -i -b cookies.txt http://127.0.0.1:5000/api/admin/applications
```

Status code: 200

Response:

```json
[
  {
    "ad_id": 1,
    "created_at": "2025-01-10 09:00:00",
    "id": 1,
    "message": "Bonjour, votre offre correspond \u00e0 mon profil.",
    "person_id": 1,
    "status": "pending"
  },
  {
    "ad_id": 1,
    "created_at": "2025-01-11 14:30:00",
    "id": 2,
    "message": "Bonjour, je souhaite rejoindre votre \u00e9quipe.",
    "person_id": 3,
    "status": "pending"
  },
  {
    "ad_id": 2,
    "created_at": "2025-01-12 18:45:00",
    "id": 3,
    "message": "Bonjour, je candidate \u00e0 cette annonce.",
    "person_id": 2,
    "status": "accepted"
  },
  {
    "ad_id": 2,
    "created_at": "2025-01-13 10:15:00",
    "id": 4,
    "message": "Bonjour, ce poste m'int\u00e9resse beaucoup.",
    "person_id": 3,
    "status": "rejected"
  }
]
```

# Test 12: POST application of the user (expected 201 CREATED)

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{"message":"Bonjour"}'
```

Status code: 201

Response:

```json
{
  "ad_id": 3,
  "created_at": "2026-10-08 18:54:29",
  "id": 5,
  "message": "Bonjour",
  "person_id": 4,
  "status": "pending"
}
```

# Test 13: POST application of a visitor / no cookie in this case (expected 201 CREATED)

```bash
curl -i -X POST http://127.0.0.1:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{
    "first_name":"Alice",
    "last_name":"Test",
    "email":"alice@example.com",
    "message":"Je suis intéressée."
  }'
```

Status code: 201

Response:

```json
{
  "ad_id": 3,
  "created_at": "2026-10-08 18:58:18",
  "id": 6,
  "message": "Je suis int\u00e9ress\u00e9e.",
  "person_id": 5,
  "status": "pending"
}
```

# Test 14: POST application without message / no cookie in this case (expected 400 BAD REQUEST)

```bash
curl -i -X POST http://127.0.0.1:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{}'
```

Status code: 400

Response:

```json
{
  "error": "Missing field: message"
}
```

# Test 15: POST application with the email of a protected account (expected 401 UNAUTHORIZED)

```bash
curl -i -X POST http://127.0.0.1:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{
    "first_name":"Bob",
    "last_name":"Test",
    "email":"bob@example.com",
    "message":"Bonjour"
  }'
```

Status code: 401

Response:

```json
{
  "error": "Login required for this email"
}
```

# Test 16: close ad 3 (expected: 200 OK)

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:5000/api/ads/3/closure -H "Content-Type: application/json" -d '{"accepted_application_id":5}'
```

Status code: 200

Response:

```json
{
  "category": "D\u00e9veloppement",
  "company": "TechNova",
  "contact_id": 3,
  "contract_type": "CDI",
  "created_at": "2026-10-08 18:23:28",
  "description": "you will defend our website against virus",
  "id": 3,
  "location": "Londres",
  "salary": 100000,
  "short_description": "Blue team",
  "status": "closed",
  "title": "Cybers\u00e9curit\u00e9",
  "working_time": "Temps plein"
}
```

# Test 17: apply to the closed ad (expected: 409 CONFLICT)

```bash
curl -i -X POST http://127.0.0.1:5000/api/ads/3/applications -H "Content-Type: application/json" -d '{"first_name":"Charlie","last_name":"Test","email":"charlie@example.com","message":"Bonjour"}'
```

Status code: 409

Response:

```json
{
  "error": "Ad is closed"
}
```

# Test 18: try to close the already closed ad (expected: 409 CONFLICT)

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:5000/api/ads/3/closure -H "Content-Type: application/json" -d '{"accepted_application_id":1}'
```

Status code: 409

Response:

```json
{
  "error": "Ad already closed"
}
```

# Test 19: Close an ad that has applications without saying which one to accept (expected: 200 OK)

Rule changed on 14/10: `accepted_application_id` is optional. Without it, all the applications of the ad become `rejected` and the ad becomes `closed` (the former 400 `Missing field: accepted_application_id` no longer exists). This test closes ad 2: replay it **after** test 20, which uses the same ad.

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:5000/api/ads/2/closure -H "Content-Type: application/json" -d '{}'
```

Status code: not replayed with curl since the change (checked on 14/10 by a direct call to `close_ad_in_db` on a copy of the database: 200, ad `closed`, applications `rejected`).

# Test 20: Test a wrong application at closure (expected: 400 BAD REQUEST)

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:5000/api/ads/2/closure -H "Content-Type: application/json" -d '{"accepted_application_id":9999}'
```

Status code: 400

Response:

```json
{
  "error": "Application does not belong to this ad"
}
```

## J5 Tests

# Partie 1 : droits admin

# Test 1: Creation of an ad by an admin (expected: 201 CREATED)

```bash : registration of the test user in the database and login as admin
curl -i -X POST "http://127.0.0.1:5000/api/auth/register" -H "Content-Type: application/json" -d '{"first_name":"Admin","last_name":"Test","email":"admin@example.com","password":"motdepasse8"}'
sqlite3 jobboard.db "UPDATE people SET role = 'admin' WHERE email = 'admin@example.com';"
sqlite3 jobboard.db "SELECT email, role FROM people;"
curl -i -X POST "http://127.0.0.1:5000/api/auth/login" -H "Content-Type: application/json" -c cookies_admin.txt -d '{"email":"admin@example.com","password":"motdepasse8"}'
```

```bash : creation of an ad
curl -i -X POST "http://127.0.0.1:5000/api/ads" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"title":"Test","short_description":"Desc","company_id":1,"category_id":1}'
```

Status code: 201 CREATED

Response:

```json
{
  "category": "D\u00e9veloppement",
  "company": "TechNova",
  "contact_id": null,
  "contract_type": null,
  "created_at": "2026-10-09 09:16:38",
  "description": null,
  "id": 4,
  "location": null,
  "salary": null,
  "short_description": "Desc",
  "status": "open",
  "title": "Test",
  "working_time": null
}
```

# Test 2: Creation of an ad by a user (expected: 403 FORBIDDEN)

```bash : registration of the test user in the database and login as user
curl -i -X POST "http://127.0.0.1:5000/api/auth/register" -H "Content-Type: application/json" -d '{"first_name":"Bobby","last_name":"Test","email":"bob2@example.com","password":"motdepasse2"}'
curl -i -X POST "http://127.0.0.1:5000/api/auth/login" -H "Content-Type: application/json" -c cookies_bobby.txt -d '{"email":"bob2@example.com","password":"motdepasse2"}'
```

```bash : creation of an ad
curl -i -X POST "http://127.0.0.1:5000/api/ads" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"title":"Test","short_description":"Desc","company_id":1,"category_id":1}'
```

Status code: 403 FORBIDDEN

Response:

```json
{
  "error": "Admin only"
}
```

# Partie 2 : pagination

# Test 1: pagination test with 1 ad per page: page 1 (expected: 200 OK, 1 ad, X-Total-Count: 2) ---> X-Total-Count = total number of ads

```bash
curl -i "http://127.0.0.1:5000/api/ads?page=1&per_page=1"
```

Status code: 200
X-Total-Count : 2

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-09 13:48:43",
    "id": 3,
    "location": "Londres",
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
```

# Test 2: pagination test with 1 ad per page: page 2 (expected: 200 OK, 1 ad, X-Total-Count: 2) ---> X-Total-Count = total number of ads

```bash
curl -i "http://127.0.0.1:5000/api/ads?page=2&per_page=1"
```

Status code: 200
X-Total-Count : 2

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-09 13:48:43",
    "id": 1,
    "location": "Paris",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python"
  }
]
```

# Test 3: impossible case, showing page 3 when there are only 2 ads (expected: 200 OK, [], X-Total-Count: 2)

```bash
curl -i "http://127.0.0.1:5000/api/ads?page=3&per_page=1"
```

Status code: 200
X-Total-Count : 2

Response:

```json
[]
```

# Test 4: impossible case, showing 0 ads per page (expected: 400, Invalid pagination)

```bash
curl -i "http://127.0.0.1:5000/api/ads?per_page=0"
```

Status code: 400

Response:

```json
{
  "error": "Invalid pagination"
}
```

# Test 5: impossible case, showing page "abc" (expected: 400, Invalid pagination)

```bash
curl -i "http://127.0.0.1:5000/api/ads?page=abc"
```

Status code: 400

Response:

```json
{
  "error": "Invalid pagination"
}
```

# Test 5: display of all the open ads: job seeker's point of view (expected: 200 OK, 2 ads, X-Total-Count: 2)

```bash
curl -i "http://127.0.0.1:5000/api/ads"
```

Status code: 200
X-Total-Count : 2

Response:

```json
[
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-09 13:48:43",
    "id": 3,
    "location": "Londres",
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  },
  {
    "company": "TechNova",
    "contract_type": "CDI",
    "created_at": "2026-10-09 13:48:43",
    "id": 1,
    "location": "Paris",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python"
  }
]
```

# Test 6: display of all the open and closed ads: admin's point of view (expected: 200 OK, 2 ads, X-Total-Count: 3)

```bash
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads?page=1&per_page=2"
```

Status code: 200
X-Total-Count : 3

Response:

```json
[
  {
    "category_id": 1,
    "company_id": 1,
    "contact_id": 1,
    "contract_type": "CDI",
    "created_at": "2026-10-09 13:48:43",
    "description": "you will dev many website",
    "id": 1,
    "location": "Paris",
    "salary": 42000,
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python",
    "working_time": "Temps plein"
  },
  {
    "category_id": 3,
    "company_id": 2,
    "contact_id": 2,
    "contract_type": "Stage",
    "created_at": "2026-10-09 13:48:43",
    "description": "you will analize many arrays",
    "id": 2,
    "location": "Mulhouse",
    "salary": 52000,
    "short_description": "Analyse de donn\u00e9es, SQL",
    "status": "closed",
    "title": "Data analyst",
    "working_time": "35h"
  }
]
```

## J6 tests

# Partie 1 : python

# Test 1: test of the automatic filling of the database (expected: companies: 12, categories: 6, people: 13, ads: 53, applications: 4)

```bash
python3 init_db.py
python3 seed_data.py
```

Response:

```bash
companies: 12
categories: 6
people: 13
ads: 53
applications: 4
```

# Test 2: test of the automatic filling of the database with the database already full (expected: "Database already filled: 10 company(ies) of the file already exist. Run python init_db.py again before python seed_data.py.")

```bash
python3 seed_data.py
```

Response:

```bash
Database already filled: 10 company(ies) of the file already exist. Run python init_db.py again before python seed_data.py.
```

# Partie 2 : curl

# Test 1: display of the ads (expected: X-Total-Count: 52, 200 OK, 52 ads)

```bash
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads"
```

Status code: 200
X-Total-Count : 52

Response:

```json
[
  {
    "company": "Caldrivane",
    "contract_type": "Freelance",
    "created_at": "2026-10-12 10:10:16",
    "id": 53,
    "location": "34000 Montpellier",
    "short_description": "Concevez des d\u00e9marches de proximit\u00e9 \u00e0 partir des situations v\u00e9cues par les habitants.",
    "status": "open",
    "title": "Designer UX ind\u00e9pendant"
  },
  {
    "company": "Caldrivane",
    "contract_type": "Alternance",
    "created_at": "2026-10-12 10:10:16",
    "id": 52,
    "location": "34000 Montpellier",
    "short_description": "Apprenez \u00e0 d\u00e9velopper des modules utiles aux structures qui organisent la vie locale.",
    "status": "open",
    "title": "D\u00e9veloppeur logiciel en alternance"
  },
  {
    "company": "Caldrivane",
    "contract_type": "CDD",
    "created_at": "2026-10-12 10:10:16",
    "id": 51,
    "location": "34000 Montpellier",
    "short_description": "Guidez les utilisateurs \u00e0 distance jusqu'\u00e0 la r\u00e9solution de leur demande.",
    "status": "open",
    "title": "Technicien assistance \u00e0 distance"
  }
]
```

etc. up to the 52nd...

# Test 2: display of 4 ads per page (expected: X-Total-Count: 52, 200 OK, 4 ads)

```bash
curl -i "http://127.0.0.1:5000/api/ads?per_page=4"
```

Status code: 200
X-Total-Count : 52

Response:

```json
[
  {
    "company": "Caldrivane",
    "contract_type": "Freelance",
    "created_at": "2026-10-12 10:10:16",
    "id": 53,
    "location": "34000 Montpellier",
    "short_description": "Concevez des d\u00e9marches de proximit\u00e9 \u00e0 partir des situations v\u00e9cues par les habitants.",
    "status": "open",
    "title": "Designer UX ind\u00e9pendant"
  },
  {
    "company": "Caldrivane",
    "contract_type": "Alternance",
    "created_at": "2026-10-12 10:10:16",
    "id": 52,
    "location": "34000 Montpellier",
    "short_description": "Apprenez \u00e0 d\u00e9velopper des modules utiles aux structures qui organisent la vie locale.",
    "status": "open",
    "title": "D\u00e9veloppeur logiciel en alternance"
  },
  {
    "company": "Caldrivane",
    "contract_type": "CDD",
    "created_at": "2026-10-12 10:10:16",
    "id": 51,
    "location": "34000 Montpellier",
    "short_description": "Guidez les utilisateurs \u00e0 distance jusqu'\u00e0 la r\u00e9solution de leur demande.",
    "status": "open",
    "title": "Technicien assistance \u00e0 distance"
  },
  {
    "company": "Caldrivane",
    "contract_type": "CDI",
    "created_at": "2026-10-12 10:10:16",
    "id": 50,
    "location": "34000 Montpellier",
    "short_description": "Organisez des changements num\u00e9riques que les petites structures peuvent absorber.",
    "status": "open",
    "title": "Chef de projet transformation num\u00e9rique"
  }
]
```

# Test 3: try to see one's applications in one's account without logging in (expected: Login required, 401)

```bash
curl -i "http://127.0.0.1:5000/api/me/applications"
```

Status code: 401

Response:

```json
{
  "error": "Login required"
}
```

# Test 4: logged-in account without applications (expected: [], 200)

```bash
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/me/applications"
```

Status code: 200

Response:

```json
[]
```

# Test 5: apply to an offer and see it in one's area (expected: one offer with 7 fields, 200)

```bash
## apply to an ad
curl -s -X POST "http://127.0.0.1:5000/api/ads/3/applications" -H "Content-Type: application/json" -b cookies_bob.txt -d '{"message":"Candidature de Bob"}'

## bob's profile, "my applications" area
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/me/applications"
```

Response of the POST:
Status code: 201

````json
{
  "ad_id": 3,
  "created_at": "2026-10-12 12:11:24",
  "id": 5,
  "message": "Candidature de Bob",
  "person_id": 4,
  "status": "pending"
}

Response of the GET:
Status code: 201

```json
[
  {
    "ad_id": 3,
    "company": "TechNova",
    "created_at": "2026-10-12 12:11:24",
    "id": 5,
    "message": "Candidature de Bob",
    "status": "pending",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
````

# Test 6: try to apply again to an ad (expected: already applied, 409 conflict)

```bash
## apply to an ad
curl -s -X POST "http://127.0.0.1:5000/api/ads/3/applications" -H "Content-Type: application/json" -b cookies_bob.txt -d '{"message":"Candidature de Bob"}'
```

Status code: 409

Response:

```json
{
  "error": "Already applied"
}
```

# Test 7: view of the "my applications" area when several people applied to the same ad (expected: one offer with 7 fields for each, 200)

```bash
## apply to an ad
curl -s -X POST "http://127.0.0.1:5000/api/ads/3/applications" -H "Content-Type: application/json" -b cookies_carla.txt -d '{"message":"Candidature de Carla"}'


## bob's and carla's profiles, "my applications" area
curl -i -b cookies_carla.txt "http://127.0.0.1:5000/api/me/applications"
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/me/applications"
```

Status code: 200

Response:

```json
HTTP/1.1 200 OK
Server: Werkzeug/3.1.9 Python/3.14.4
Date: Mon, 12 Oct 2026 12:16:05 GMT
Content-Type: application/json
Content-Length: 212
Vary: Cookie
Connection: close

[
  {
    "ad_id": 3,
    "company": "TechNova",
    "created_at": "2026-10-12 12:16:04",
    "id": 6,
    "message": "Candidature de Carla",
    "status": "pending",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
HTTP/1.1 200 OK
Server: Werkzeug/3.1.9 Python/3.14.4
Date: Mon, 12 Oct 2026 12:16:05 GMT
Content-Type: application/json
Content-Length: 210
Vary: Cookie
Connection: close

[
  {
    "ad_id": 3,
    "company": "TechNova",
    "created_at": "2026-10-12 12:11:24",
    "id": 5,
    "message": "Candidature de Bob",
    "status": "pending",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
```

# Test 8: view of bob's and carla's "my applications" area when bob is accepted (expected: bob = accepted, carla = rejected, one offer with 7 fields for each, 200)

```bash
## accepter bob
curl -s -X POST "http://127.0.0.1:5000/api/ads/3/closure" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"accepted_application_id": 5}'

## bob's and carla's profiles, "my applications" area
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/me/applications"
curl -i -b cookies_carla.txt "http://127.0.0.1:5000/api/me/applications"
```

Status code: 200

Response:

```json
{
  "category": "D\u00e9veloppement",
  "company": "TechNova",
  "contact_id": 3,
  "contract_type": "CDI",
  "created_at": "2026-10-12 12:05:35",
  "description": "you will defend our website against virus",
  "id": 3,
  "location": "Londres",
  "salary": 100000,
  "short_description": "Blue team",
  "status": "closed",
  "title": "Cybers\u00e9curit\u00e9",
  "working_time": "Temps plein"
}
HTTP/1.1 200 OK
Server: Werkzeug/3.1.9 Python/3.14.4
Date: Mon, 12 Oct 2026 12:28:02 GMT
Content-Type: application/json
Content-Length: 211
Vary: Cookie
Connection: close

[
  {
    "ad_id": 3,
    "company": "TechNova",
    "created_at": "2026-10-12 12:11:24",
    "id": 5,
    "message": "Candidature de Bob",
    "status": "accepted",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
HTTP/1.1 200 OK
Server: Werkzeug/3.1.9 Python/3.14.4
Date: Mon, 12 Oct 2026 12:28:02 GMT
Content-Type: application/json
Content-Length: 213
Vary: Cookie
Connection: close

[
  {
    "ad_id": 3,
    "company": "TechNova",
    "created_at": "2026-10-12 12:16:04",
    "id": 6,
    "message": "Candidature de Carla",
    "status": "rejected",
    "title": "Cybers\u00e9curit\u00e9"
  }
]
```

# Part 3: SIREN of the companies

# Test 1: reading a record with its SIREN (expected: 200, siren present)

```bash
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/companies/1"
```

Status code: 200

```json
{
  "description": "Studio de développement web",
  "id": 1,
  "location": "Paris",
  "name": "TechNova",
  "siren": "000000991",
  "website": "https://technova.example.com"
}
```

# Test 2: valid creation, spaces removed (expected: 201, siren "123456789")

```bash
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"Test SA","siren":" 123456789 "}'
```

Status code: 201

```json
{
  "description": null,
  "id": 13,
  "location": null,
  "name": "Test SA",
  "siren": "123456789",
  "website": null
}
```

# Test 3: SIREN missing, empty, spaces or null (expected: 400, Missing field: siren)

```bash
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X"}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":""}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":"   "}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":null}'
```

Status code: 400 (the 4 cases)

```json
{ "error": "Missing field: siren" }
```

# Test 4: format refused (expected: 400, Invalid value)

```bash
## JSON number (not a string)
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":123456780}'
## lettres
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":"12345678A"}'
## 8 chiffres
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":"12345678"}'
## 10 chiffres
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"X","siren":"1234567890"}'
```

Status code: 400 (the 4 cases)

```json
{ "error": "Invalid value" }
```

# Test 5: SIREN starting with zero (expected: 201, the zero is kept)

```bash
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"Zero SA","siren":"012345678"}'
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/companies/14"
sqlite3 jobboard.db "SELECT quote(siren), typeof(siren) FROM companies WHERE id = 14;"
```

Status code: 201 puis 200

```json
{
  "description": null,
  "id": 14,
  "location": null,
  "name": "Zero SA",
  "siren": "012345678",
  "website": null
}
```

In the database: `'012345678'|text`

# Test 6: two creations with the same SIREN (expected: 409, Already exists, no new record)

```bash
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"Zero SA","siren":"012345678"}'
sqlite3 jobboard.db "SELECT quote(siren), typeof(siren) FROM companies WHERE name = 'Zero SA';"
```

Status code: 409

```json
{ "error": "Already exists" }
```

Number of records before / after: 14 / 14.

# Test 7: change to the SIREN of another company (expected: 409, record unchanged)

```bash
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/companies/13" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"Renommé","siren":"012345678"}'
sqlite3 jobboard.db "SELECT name, siren FROM companies WHERE id = 13;"
```

Status code: 409

```json
{ "error": "Already exists" }
```

Record unchanged: `Test SA|123456789` (the name was not modified either).

# Test 10: change that keeps its own SIREN (expected: 200)

```bash
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/companies/13" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"siren":"123456789","location":"Paris"}'
```

Status code: 200

```json
{
  "description": null,
  "id": 13,
  "location": "Paris",
  "name": "Test SA",
  "siren": "123456789",
  "website": null
}
```

# Test 11: change without siren, then attempt to clear it (expected: 200 SIREN kept, then 400)

```bash
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/companies/13" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"website":"https://test.example.com"}'
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/companies/13" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"siren":null}'
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/companies/13" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"siren":""}'
```

Status code: 200, then 400 and 400

```json
{"description":null,"id":13,"location":"Paris","name":"Test SA","siren":"123456789","website":"https://test.example.com"}
{"error":"Missing field: siren"}
{"error":"Missing field: siren"}
```

# Test 12: old record without SIREN, readable then completed (expected: 200 with null, then 200 with the SIREN)

```bash
sqlite3 jobboard.db "INSERT INTO companies (name) VALUES ('Ancienne');"
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/companies/15"
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/companies/15" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"siren":"555555555"}'
```

Status code: 200 puis 200

```json
{"description":null,"id":15,"location":null,"name":"Ancienne","siren":null,"website":null}
{"description":null,"id":15,"location":null,"name":"Ancienne","siren":"555555555","website":null}
```

# Test 13: protections and other tables unchanged (expected: 401, 403, 201, 400)

```bash
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -d '{"name":"X","siren":"111111111"}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/companies" -H "Content-Type: application/json" -b cookies_bob.txt -d '{"name":"X","siren":"111111111"}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/categories" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"Nouvelle"}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/categories" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"name":"N2","siren":"111111111"}'
```

Status code: 401, 403, 201, 400

```json
{"error":"Login required"}
{"error":"Admin only"}
{"id":7,"name":"Nouvelle"}
{"error":"Unknown field: siren"}
```

## Test J7

# Test 1: The column exists (expected: company_id|INTEGER|0|NULL)

```bash
sqlite3 jobboard.db "SELECT name, type, \"notnull\", quote(dflt_value) FROM pragma_table_info('people') WHERE name = 'company_id';"
```

Status code: 401, 403, 201, 400

```json
company_id|INTEGER|0|NULL
```

# Test 2: The admin sees the field (expected: 200, "company_id": null)

```bash
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/people/15"
```

Status code: 200

```json
{
  "company_id": null,
  "email": "bob@example.com",
  "first_name": "Bob",
  "id": 15,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```

# Test 3: Unknown company (expected: 400 Unknown reference, for both)

```bash
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/people/15" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"company_id":999}'
curl -i -X POST "http://127.0.0.1:5000/api/admin/people" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"first_name":"Rec","last_name":"Test","email":"rec@example.com","company_id":999}'
```

Status code: 400 (for both)

```json (for both)
{
  "error": "Unknown reference"
}
```

# Test 4: The admin attaches Bob to a company (expected: 200, "company_id": 1)

```bash
curl -i -X PATCH "http://127.0.0.1:5000/api/admin/people/15" -H "Content-Type: application/json" -b cookies_admin.txt -d '{"company_id":1}'
```

Status code: 200

```json
{
  "company_id": 1,
  "email": "bob@example.com",
  "first_name": "Bob",
  "id": 15,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```

# Test 5: Bob cannot assign it to himself (expected: 400 Unknown field: company_id)

```bash
curl -i -X PATCH "http://127.0.0.1:5000/api/auth/me" -H "Content-Type: application/json" -b cookies_bob.txt -d '{"company_id":2}'
```

Status code: 400

```json
{
  "error": "Unknown field: company_id"
}
```

# Test 6: Registration of a user who tries to pass as a recruiter (expected: 201, then NULL in the database, the person registers but is not a recruiter, the recruiter code is ignored)

```bash
curl -i -X POST "http://127.0.0.1:5000/api/auth/register" -H "Content-Type: application/json" -d '{"first_name":"Eve","last_name":"Test","email":"eve@example.com","password":"motdepasse8","company_id":1}'
sqlite3 jobboard.db "SELECT email, quote(company_id) FROM people WHERE email = 'eve@example.com';"
```

Status code: 201 puis NULL

```json register
{
  "email": "eve@example.com",
  "first_name": "Eve",
  "id": 16,
  "last_name": "Test",
  "phone": null,
  "role": "user"
}
```

```json the code
eve@example.com|NULL
```

# Test 6: GET /api/categories, public (expected: 200, 6 categories in alphabetical order)

```bash
curl -i "http://127.0.0.1:5000/api/categories"

```

Status code: 200

```json
[
  {
    "id": 4,
    "name": "Cybers\u00e9curit\u00e9"
  },
  {
    "id": 3,
    "name": "Data"
  },
  {
    "id": 2,
    "name": "Design"
  },
  {
    "id": 1,
    "name": "D\u00e9veloppement"
  },
  {
    "id": 5,
    "name": "Gestion de projet"
  },
  {
    "id": 6,
    "name": "Support informatique"
  }
]
```

# Test 7: The refusals (the recruiter_required decorator)

```bash
# no session -> expected: 401 Login required
curl -i "http://127.0.0.1:5000/api/recruiter/company"
curl -i "http://127.0.0.1:5000/api/recruiter/ads"

# ordinary user -> expected: 403 Recruiter only
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/company"
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads"

# admin without a company -> expected: 403 Recruiter only
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/recruiter/company"
```

Status code: 401 (for both)

```json no session (for both)
{
  "error": "Login required"
}
```

Status code: 403 (for both)

```json ordinary user (for both)
{
  "error": "Recruiter only"
}
```

Status code: 403

```json admin without a company
{
  "error": "Recruiter only"
}
```

# Test 8: GET /api/recruiter/company (expected: 200, TechNova for Rec1, with its siren)

```bash
curl -i -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/company"

```

Status code: 200

```json
{
  "description": "Studio de d\u00e9veloppement web",
  "id": 1,
  "location": "Paris",
  "name": "TechNova",
  "siren": "000000991",
  "website": "https://technova.example.com"
}
```

# Test 9: PATCH /api/recruiter/company

```bash
# corps vide -> expected: 400 No fields to update
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/company" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{}'

# siren -> expected: 400 Unknown field: siren
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/company" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"siren":"111111111"}'

# id -> expected: 400 Unknown field: id
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/company" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"id":5}'

# name vide -> expected: 400 Missing field: name
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/company" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"name":"   "}'

# valid -> expected: 200, name "TechNova SA" (spaces removed) and location changed
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/company" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"name":" TechNova SA ","location":"Paris 9e"}'

# the other company did not change -> expected: GreenWorks|Lyon
sqlite3 jobboard.db "SELECT name, location FROM companies WHERE id = 2;"
```

Status code, empty body: 400

```json
{
  "error": "No fields to update"
}
```

Status code, empty siren: 400

```json
{
  "error": "Unknown field: siren"
}
```

Status code, empty id: 400

```json
{
  "error": "Unknown field: id"
}
```

Status code, empty name: 400

```json
{
  "error": "Missing field: name"
}
```

Status code, valid case: 200

```json
{
  "description": "Studio de d\u00e9veloppement web",
  "id": 1,
  "location": "Paris 9e",
  "name": "TechNova SA",
  "siren": "000000991",
  "website": "https://technova.example.com"
}
```

Obtained: the company did not change

```json
GreenWorks|Lyon
```

# Test 10: GET /api/recruiter/ads: each one sees only their own

```bash
# Rec1 (TechNova): ads 3 (applications_count: 0, oldest_unanswered_at: null) and 1 (applications_count: 2, oldest_unanswered_at: "2025-01-10 09:00:00").
curl -i -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads"

# Rec2 (GreenWorks): ad 2, closed (applications_count: 2, oldest_unanswered_at: null, because its applications are accepted and rejected, none pending).
curl -i -b cookies_rec2.txt "http://127.0.0.1:5000/api/recruiter/ads"

```

Status code, valid case: 200 for both

```json Rec1
[
  {
    "applications_count": 0,
    "contract_type": "CDI",
    "created_at": "2026-10-13 13:27:46",
    "id": 3,
    "location": "Londres",
    "oldest_unanswered_at": null,
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybers\u00e9curit\u00e9"
  },
  {
    "applications_count": 2,
    "contract_type": "CDI",
    "created_at": "2026-10-13 13:27:46",
    "id": 1,
    "location": "Paris",
    "oldest_unanswered_at": "2025-01-10 09:00:00",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "D\u00e9veloppeur Python"
  }
]
```

```json Rec2
[
  {
    "applications_count": 2,
    "contract_type": "Stage",
    "created_at": "2026-10-13 13:27:46",
    "id": 2,
    "location": "Mulhouse",
    "oldest_unanswered_at": null,
    "short_description": "Analyse de donn\u00e9es, SQL",
    "status": "closed",
    "title": "Data analyst"
  }
]
```

# Test 11: POST /api/recruiter/ads (expected: 400 for company_id, contact_id, missing title and unknown category; 201 for a valid ad, which carries the recruiter's company)

```bash
# company_id sent -> expected: 400 Unknown field: company_id
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"T","short_description":"S","category_id":1,"company_id":2}'

# contact_id sent -> expected: 400 Unknown field: contact_id
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"T","short_description":"S","category_id":1,"contact_id":2}'

# title absent -> expected: 400 Missing field: title
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"short_description":"S","category_id":1}'

# unknown category -> expected: 400 Unknown category_id
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"T","short_description":"S","category_id":999}'

# valid -> expected: 201, "company": "GreenWorks", "category": "Design", contact_id = id of Rec2
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -b cookies_rec2.txt -d '{"title":"Designer","short_description":"UX","category_id":2,"salary":40000,"contract_type":"CDI"}'

# check in the database: company 2, contact = Rec2, status open
sqlite3 jobboard.db "SELECT company_id, contact_id, status FROM ads ORDER BY id DESC LIMIT 1;"
sqlite3 jobboard.db "SELECT id FROM people WHERE email = 'rec2@example.com';"

# the ad appears in Rec2's list, not in Rec1's
curl -s -b cookies_rec2.txt "http://127.0.0.1:5000/api/recruiter/ads"
curl -s -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads"
```

Status code, company_id sent: 400

```json
{
  "error": "Unknown field: company_id"
}
```

Status code, contact_id sent: 400

```json
{
  "error": "Unknown field: contact_id"
}
```

Status code, title missing: 400

```json
{
  "error": "Missing field: title"
}
```

Status code, unknown category: 400

```json
{
  "error": "Unknown category_id"
}
```

Status code, valid case: 201

```json
{
  "category": "Design",
  "company": "GreenWorks",
  "contact_id": 17,
  "contract_type": "CDI",
  "created_at": "2026-10-13 13:52:58",
  "description": null,
  "id": 54,
  "location": null,
  "salary": 40000,
  "short_description": "UX",
  "status": "open",
  "title": "Designer",
  "working_time": null
}
```

Obtained in the database: the ad carries Rec2's company (2), Rec2 as contact (17) and the status open

```json
2|17|open
17
```

Status code, Rec2's list: 200, the new ad appears first

```json Rec2
[
  {
    "applications_count": 0,
    "contract_type": "CDI",
    "created_at": "2026-10-13 13:52:58",
    "id": 54,
    "location": null,
    "oldest_unanswered_at": null,
    "short_description": "UX",
    "status": "open",
    "title": "Designer"
  },
  {
    "applications_count": 2,
    "contract_type": "Stage",
    "created_at": "2026-10-13 13:27:46",
    "id": 2,
    "location": "Mulhouse",
    "oldest_unanswered_at": null,
    "short_description": "Analyse de données, SQL",
    "status": "closed",
    "title": "Data analyst"
  }
]
```

Status code, Rec1's list: 200, the new ad is not there (identical to test 10)

```json Rec1
[
  {
    "applications_count": 0,
    "contract_type": "CDI",
    "created_at": "2026-10-13 13:27:46",
    "id": 3,
    "location": "Londres",
    "oldest_unanswered_at": null,
    "short_description": "Blue team",
    "status": "open",
    "title": "Cybersécurité"
  },
  {
    "applications_count": 2,
    "contract_type": "CDI",
    "created_at": "2026-10-13 13:27:46",
    "id": 1,
    "location": "Paris",
    "oldest_unanswered_at": "2025-01-10 09:00:00",
    "short_description": "Back-end Flask",
    "status": "open",
    "title": "Développeur Python"
  }
]
```

# Test 12: seed_data.py attaches the 10 contacts of the file to the company of their ads (expected: 10, then each contact with their company)

```bash
# fresh database and seeding
python3 init_db.py
python3 seed_data.py

# number of recruiters -> expected: 10
sqlite3 jobboard.db "SELECT COUNT(*) FROM people WHERE company_id IS NOT NULL;"

# who is attached to which company -> expected: the 10 contacts, each with the company of their ads
sqlite3 -header -column jobboard.db "SELECT people.email, companies.name AS entreprise FROM people JOIN companies ON companies.id = people.company_id;"
```

Obtained, number of recruiters: 10

```bash
10
```

Obtained, attachment: each contact is attached to the company of their ads (Alice, Bruno and Chloé from seed.sql stay without a company)

```bash
email                          entreprise
-----------------------------  ----------
elodie.varenot@example.com     Orvelune
mathis.clervaux@example.com    Talvoria
ines.delrival@example.com      Nerquilio
hugo.montelac@example.com      Velsorine
anais.brivel@example.com       Praxeline
leo.savenot@example.com        Dorlavie
manon.rivorel@example.com      Mirelquaz
noemie.valcen@example.com      Solvenyre
jules.dorlier@example.com      Brumelix
camille.lesterval@example.com  Caldrivane
```

## Test J9

# Test 1: POST /api/recruiter/ads/<id>/applications/<application_id>/rejection, rejection of a single application

Fresh database (`init_db.py` then `seed_data.py`), `MAIL_ENABLED=0`. Rec1 (TechNova, company 1), Rec2 (GreenWorks, company 2) and Bob (ordinary account): same accounts and same cookies as the J7 tests. Ad 1: TechNova, open, applications 1 and 2 from `seed.sql` (`pending`). Ad 2: GreenWorks, closed, applications 3 and 4.

```bash
# rejection of application 1 -> expected: 200, the application with "status": "rejected"; ad 1 stays open
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications/1/rejection"

# same rejection a 2nd time -> expected: 409 Application already processed
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications/1/rejection"

# application of another ad, or nonexistent -> expected: 404 Application not found (for both)
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications/3/rejection"
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications/999/rejection"

# ad of another company -> expected: 404 Ad not found
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/2/applications/3/rejection"

# closed ad -> expected: 409 Ad already closed
curl -i -X POST -b cookies_rec2.txt "http://127.0.0.1:5000/api/recruiter/ads/2/applications/3/rejection"

# no session -> expected: 401 Login required; ordinary account -> expected: 403 Recruiter only
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads/1/applications/2/rejection"
curl -i -X POST -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications/2/rejection"

# check in the database -> expected: ad 1 open, application 1 rejected, application 2 still pending
sqlite3 jobboard.db "SELECT id, status FROM ads WHERE id = 1; SELECT id, status FROM applications WHERE id IN (1, 2);"
```

Status code: not replayed with curl. Checked on 14/10 with the Flask test client on a fresh database in `/tmp` (accounts created by `register`, `company_id` set in the database, emails simulated): 200 (`"status": "rejected"`, same keys as the list of applications), 409 `Application already processed`, 404 `Application not found` (for both), 404 `Ad not found`, 409 `Ad already closed`, 401 `Login required`, 403 `Recruiter only`. In the database: ad 1 `open`, application 1 `rejected`, application 2 `pending`.

# Test 2: the closure does not write a 2nd time to the candidate already rejected

After test 1, with a successful sending of emails: application 1 has its `decision_email_sent_at` filled in.

```bash
# closure without an accepted candidate -> expected: 200 "status": "closed", one email for each application except the 1st
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/closure" -H "Content-Type: application/json" -d '{}'
```

Status code: not replayed with curl. Checked on 14/10 with the Flask test client (simulated sending, which succeeds): the rejection of application 1 sends 1 "not selected" email (the French text contains "n'a pas donné suite"); the closure of ad 1 (40 applications) returns 200 `closed` and sends 39 emails, none to application 1.

# Test 3: GET /api/admin/<table>?order=asc|desc, sorting of the admin tables

Fresh database (`init_db.py` then `seed_data.py`), administrator logged in with `cookies_admin.txt` (same account as the J5 tests), Bob logged in with `cookies_bob.txt`.

```bash
# most recent first -> expected: 200, created_at descending, X-Total-Count unchanged
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/applications?order=desc&page=1&per_page=5"
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads?order=desc&page=1&per_page=5"

# oldest first -> expected: 200, created_at ascending
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/applications?order=asc&page=1&per_page=5"

# table without created_at -> expected: 200, id descending
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/people?order=desc&page=1&per_page=5"

# without order -> expected: 200, id ascending as before (ids 1 to 5)
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads?page=1&per_page=5"

# unknown value, in capitals or empty -> expected: 400 Invalid order (for the 3)
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads?order=up"
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads?order=DESC"
curl -i -b cookies_admin.txt "http://127.0.0.1:5000/api/admin/ads?order="

# no session -> expected: 401 Login required; ordinary account -> expected: 403 Admin only
curl -i "http://127.0.0.1:5000/api/admin/ads?order=desc"
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/admin/ads?order=desc"
```

Status code: not replayed with curl. Checked on 14/10 with the Flask test client on a fresh database in `/tmp` (admin created by `register` then `role` set in the database): 15 checks out of 15. `applications?order=desc`: ids 1360 to 1356; `asc`: ids 1, 2, 3, 4, 513 (created_at ascending, not the id); `ads?order=desc`: 53, 52, 39, 45, 41; `people?order=desc`: 115 to 111; without `order`: 1 to 5; page 2 in `desc` follows page 1; 400 `Invalid order` for `up`, `DESC`, empty and `id;DROP`; 401 `Login required`; 403 `Admin only`.

## Tests J8 and J9

Tests replayed with curl on 15/10, in the order below, on a fresh database. The tests follow one another: ad 1 is closed in test 3, then serves for the 409 of tests 4 and 7; the ad `$AD` is deleted at the end of test 7.

# Setup: fresh database, two recruiters, one ordinary account, two ads without applications

```bash
# fresh database, then server with emails disabled (the [mail disabled] lines are printed in this terminal)
python3 init_db.py
python3 seed_data.py
MAIL_ENABLED=0 python3 app.py

# in a 2nd terminal: registration (expected: 201, the session opens)
curl -s -c cookies_rec1.txt -X POST "http://127.0.0.1:5000/api/auth/register" -H "Content-Type: application/json" -d '{"first_name":"Rec","last_name":"Un","email":"rec1.test@example.com","password":"password123"}'
curl -s -c cookies_rec2.txt -X POST "http://127.0.0.1:5000/api/auth/register" -H "Content-Type: application/json" -d '{"first_name":"Rec","last_name":"Deux","email":"rec2.test@example.com","password":"password123"}'
curl -s -c cookies_bob.txt -X POST "http://127.0.0.1:5000/api/auth/register" -H "Content-Type: application/json" -d '{"first_name":"Bob","last_name":"Test","email":"bob.test@example.com","password":"password123"}'

# Rec1 -> TechNova (1), Rec2 -> GreenWorks (2), Bob stays an ordinary account
sqlite3 jobboard.db "UPDATE people SET company_id = 1 WHERE email = 'rec1.test@example.com'; UPDATE people SET company_id = 2 WHERE email = 'rec2.test@example.com';"
sqlite3 jobboard.db "SELECT id, email, company_id FROM people WHERE email LIKE '%.test@example.com';"

# two ads of Rec1 without applications: $AD (edit, deletion) and $AD2 (emails)
AD=$(curl -s -b cookies_rec1.txt -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -d '{"title":"Dev Python","short_description":"Back Flask","category_id":1,"location":"Paris"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
AD2=$(curl -s -b cookies_rec1.txt -X POST "http://127.0.0.1:5000/api/recruiter/ads" -H "Content-Type: application/json" -d '{"title":"Stage data","short_description":"SQL et Python","category_id":1}' | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "AD=$AD AD2=$AD2"
```

Obtained: 201 for the 3 registrations, then in the database

```bash
114|rec1.test@example.com|1
115|rec2.test@example.com|2
116|bob.test@example.com|
AD=54 AD2=55
```

Seed ads used: 1 (TechNova, open, 40 applications including 1 and 2 from `seed.sql`), 2 (GreenWorks, closed), 3 (TechNova, open, 16 applications).

# Test 1: Emails, an application then a closure (expected: 201 then 200, and a [mail disabled] line in the server terminal each time)

```bash
# Bob applies to $AD2 -> expected: 201; terminal: [mail disabled] ... Subject: Candidature reçue : Stage data
curl -i -X POST -b cookies_bob.txt "http://127.0.0.1:5000/api/ads/$AD2/applications" -H "Content-Type: application/json" -d '{"message":"Bonjour, je suis intéressé."}'

# Rec1 closes $AD2 without an accepted candidate -> expected: 200 "status": "closed"; terminal: [mail disabled] ... Subject: Information concernant votre candidature : Stage data
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/$AD2/closure" -H "Content-Type: application/json" -d '{}'

# check in the database -> expected: Bob's application is rejected
sqlite3 jobboard.db "SELECT applications.id, people.email, applications.status FROM applications JOIN people ON people.id = applications.person_id WHERE ad_id = $AD2;"
```

Status code, application: 201

```json
{
  "ad_id": 55,
  "created_at": "2026-10-15 12:47:41",
  "id": 1361,
  "message": "Bonjour, je suis intéressé.",
  "person_id": 116,
  "status": "pending"
}
```

Status code, closure: 200

```json
{
  "category": "Développement",
  "company": "TechNova",
  "contact_id": 114,
  "contract_type": null,
  "created_at": "2026-10-15 12:47:41",
  "description": null,
  "id": 55,
  "location": null,
  "salary": null,
  "short_description": "SQL et Python",
  "status": "closed",
  "title": "Stage data",
  "working_time": null
}
```

Obtained in the server terminal: one line after the application, one line after the closure

```bash
[mail disabled] To: bob.test@example.com | Subject: Candidature reçue : Stage data
[mail disabled] To: bob.test@example.com | Subject: Information concernant votre candidature : Stage data
```

Obtained in the database

```bash
1361|bob.test@example.com|rejected
```

# Test 2: GET /api/recruiter/ads/<id>/applications, applications of an ad (expected: 200 with the keys of the contract, [] for an ad without applications, 404 for the ad of another company)

```bash
# ad 1 (TechNova) -> expected: 200, 40 applications, from the oldest to the most recent
curl -i -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications"

# ad without applications -> expected: 200, []
curl -i -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/$AD/applications"

# ad 2 (GreenWorks) read by Rec1 -> expected: 404 Ad not found
curl -i -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/2/applications"
```

Status code, ad 1: 200, 40 applications, each with the 8 keys of the contract (the first one below)

```json
[
  {
    "created_at": "2025-01-10 09:00:00",
    "email": "alice.martin@example.com",
    "first_name": "Alice",
    "id": 1,
    "last_name": "Martin",
    "message": "Bonjour, votre offre correspond à mon profil.",
    "phone": "0600000001",
    "status": "pending"
  },
  ...
]
```

Status code, ad without applications: 200

```json
[]
```

Status code, ad of another company: 404

```json
{
  "error": "Ad not found"
}
```

# Test 3: POST /api/recruiter/ads/<id>/closure, recruiter closure (expected: 200 with accepted_application_id, 200 with {}, 409 if already closed)

```bash
# ad 1, application 1 accepted -> expected: 200 "status": "closed"; in the database 1 accepted, 39 rejected; terminal: 40 [mail disabled] lines
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/closure" -H "Content-Type: application/json" -d '{"accepted_application_id": 1}'
sqlite3 jobboard.db "SELECT status, COUNT(*) FROM applications WHERE ad_id = 1 GROUP BY status; SELECT id, status FROM applications WHERE id = 1;"

# ad 3, no accepted candidate -> expected: 200 "status": "closed"; in the database the 16 applications rejected
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/3/closure" -H "Content-Type: application/json" -d '{}'
sqlite3 jobboard.db "SELECT status, COUNT(*) FROM applications WHERE ad_id = 3 GROUP BY status;"

# ad 1 a 2nd time -> expected: 409 Ad already closed
curl -i -X POST -b cookies_rec1.txt "http://127.0.0.1:5000/api/recruiter/ads/1/closure" -H "Content-Type: application/json" -d '{}'
```

Status code, with accepted_application_id: 200

```json
{
  "category": "Développement",
  "company": "TechNova",
  "contact_id": 1,
  "contract_type": "CDI",
  "created_at": "2026-10-01 12:46:39",
  "description": "you will dev many website",
  "id": 1,
  "location": "Paris",
  "salary": 42000,
  "short_description": "Back-end Flask",
  "status": "closed",
  "title": "Développeur Python",
  "working_time": "Temps plein"
}
```

Obtained in the database: 1 accepted application (the 1st), the 39 others rejected; 40 `[mail disabled]` lines in the terminal (subject "Information concernant votre candidature : Développeur Python")

```bash
accepted|1
rejected|39
1|accepted
```

Status code, with {}: 200

```json
{
  "category": "Développement",
  "company": "TechNova",
  "contact_id": 3,
  "contract_type": "CDI",
  "created_at": "2026-08-24 12:46:39",
  "description": "you will defend our website against virus",
  "id": 3,
  "location": "Londres",
  "salary": 100000,
  "short_description": "Blue team",
  "status": "closed",
  "title": "Cybersécurité",
  "working_time": "Temps plein"
}
```

Obtained in the database: the 16 applications are rejected; 16 `[mail disabled]` lines in the terminal

```bash
rejected|16
```

Status code, already closed: 409

```json
{
  "error": "Ad already closed"
}
```

# Test 4: PATCH /api/recruiter/ads/<id>, edit (expected: 200; 400 No fields to update, Unknown field, Missing field, Unknown category_id; 404; 409 on a closed ad)

```bash
# 2 fields -> expected: 200, title and salary changed, location still "Paris"
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"Dev Python senior","salary":45000}'

# category -> expected: 200, "category": "Design", the title changed just before is kept
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"category_id":2}'

# empty body, or no body -> expected: 400 No fields to update (for both)
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{}'
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -b cookies_rec1.txt

# champs interdits -> expected: 400 Unknown field: company_id / status / contact_id
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"company_id":2}'
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"status":"closed"}'
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"contact_id":1}'

# required field sent empty or null -> expected: 400 Missing field: title / short_description
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":""}'
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"short_description":null}'

# unknown category or wrong type -> expected: 400 Unknown category_id (for both)
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"category_id":999}'
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"category_id":true}'

# nonexistent ad -> expected: 404 Ad not found
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/999" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"X"}'

# order of the contract: the body is checked before the ad -> expected: 400 Missing field: title (not 404)
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/999" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":""}'

# ad 1, closed in test 3 -> expected: 409 Ad is closed
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/1" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"Nouveau titre"}'

# check in the database -> expected: $AD changed, company and contact unchanged; ad 1 unchanged
sqlite3 jobboard.db "SELECT id, title, salary, category_id, company_id, contact_id, status FROM ads WHERE id IN (1, $AD);"
```

Status code, 2 fields: 200

```json
{
  "category": "Développement",
  "company": "TechNova",
  "contact_id": 114,
  "contract_type": null,
  "created_at": "2026-10-15 12:47:41",
  "description": null,
  "id": 54,
  "location": "Paris",
  "salary": 45000,
  "short_description": "Back Flask",
  "status": "open",
  "title": "Dev Python senior",
  "working_time": null
}
```

Status code, category: 200

```json
{
  "category": "Design",
  "company": "TechNova",
  "contact_id": 114,
  "contract_type": null,
  "created_at": "2026-10-15 12:47:41",
  "description": null,
  "id": 54,
  "location": "Paris",
  "salary": 45000,
  "short_description": "Back Flask",
  "status": "open",
  "title": "Dev Python senior",
  "working_time": null
}
```

Status code, empty body, no body: 400 (for both)

```json
{
  "error": "No fields to update"
}
```

Status code, forbidden fields: 400 (for the 3)

```json
{
  "error": "Unknown field: company_id"
}
{
  "error": "Unknown field: status"
}
{
  "error": "Unknown field: contact_id"
}
```

Status code, required field empty or null: 400 (for both)

```json
{
  "error": "Missing field: title"
}
{
  "error": "Missing field: short_description"
}
```

Status code, category 999, category true: 400 (for both)

```json
{
  "error": "Unknown category_id"
}
```

Status code, nonexistent ad: 404

```json
{
  "error": "Ad not found"
}
```

Status code, nonexistent ad with an empty title: 400

```json
{
  "error": "Missing field: title"
}
```

Status code, closed ad: 409

```json
{
  "error": "Ad is closed"
}
```

Obtained in the database

```bash
1|Développeur Python|42000|1|1|1|closed
54|Dev Python senior|45000|2|1|114|open
```

# Test 5: two recruiters of two companies (expected: 404 Ad not found on PATCH and DELETE applied to the other's ad, database unchanged)

The three other routes (applications, closure, rejection) are already checked: test 2 above and Test J9.

```bash
# before -> the two ads
sqlite3 jobboard.db "SELECT id, title, salary, company_id, status FROM ads WHERE id IN (2, $AD);"

# Rec2 (GreenWorks) on the ad $AD of TechNova -> expected: 404 Ad not found (for both)
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -b cookies_rec2.txt -d '{"title":"Piraté"}'
curl -i -X DELETE "http://127.0.0.1:5000/api/recruiter/ads/$AD" -b cookies_rec2.txt

# Rec1 (TechNova) on ad 2 of GreenWorks -> expected: 404 Ad not found (for both)
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/2" -H "Content-Type: application/json" -b cookies_rec1.txt -d '{"title":"Piraté"}'
curl -i -X DELETE "http://127.0.0.1:5000/api/recruiter/ads/2" -b cookies_rec1.txt

# after -> expected: identical to before
sqlite3 jobboard.db "SELECT id, title, salary, company_id, status FROM ads WHERE id IN (2, $AD);"
```

Status code: 404 (for the 4)

```json
{
  "error": "Ad not found"
}
```

Obtained in the database, before and after: identical

```bash
2|Data analyst|52000|2|closed
54|Dev Python senior|45000|1|open
```

# Test 6: Access to the five recruiter routes (expected: 401 without session, 403 with an ordinary account)

```bash
# no session -> expected: 401 Login required (for the 5)
curl -i "http://127.0.0.1:5000/api/recruiter/ads/1/applications"
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads/$AD/closure" -H "Content-Type: application/json" -d '{}'
curl -i -X POST "http://127.0.0.1:5000/api/recruiter/ads/1/applications/2/rejection"
curl -i -X PATCH "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -d '{"title":"X"}'
curl -i -X DELETE "http://127.0.0.1:5000/api/recruiter/ads/$AD"

# ordinary account (Bob) -> expected: 403 Recruiter only (for the 5)
curl -i -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications"
curl -i -X POST -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads/$AD/closure" -H "Content-Type: application/json" -d '{}'
curl -i -X POST -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads/1/applications/2/rejection"
curl -i -X PATCH -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads/$AD" -H "Content-Type: application/json" -d '{"title":"X"}'
curl -i -X DELETE -b cookies_bob.txt "http://127.0.0.1:5000/api/recruiter/ads/$AD"

# the ad $AD was not touched -> expected: still open, same title
sqlite3 jobboard.db "SELECT id, title, status FROM ads WHERE id = $AD;"
```

Status code, no session: 401 (for the 5)

```json
{
  "error": "Login required"
}
```

Status code, ordinary account: 403 (for the 5)

```json
{
  "error": "Recruiter only"
}
```

Obtained in the database

```bash
54|Dev Python senior|open
```

# Test 7: DELETE /api/recruiter/ads/<id>, deletion (expected: 409 with applications, 404, then 204 without body)

```bash
# ad 1, which has applications -> expected: 409 Ad has applications
curl -i -X DELETE "http://127.0.0.1:5000/api/recruiter/ads/1" -b cookies_rec1.txt

# nonexistent ad -> expected: 404 Ad not found
curl -i -X DELETE "http://127.0.0.1:5000/api/recruiter/ads/999" -b cookies_rec1.txt

# $AD, without applications -> expected: 204, without body
curl -i -X DELETE "http://127.0.0.1:5000/api/recruiter/ads/$AD" -b cookies_rec1.txt

# it is gone -> expected: 404 Ad not found, then no row in the database; ad 1 still exists
curl -i "http://127.0.0.1:5000/api/ads/$AD"
sqlite3 jobboard.db "SELECT id FROM ads WHERE id = $AD;"
sqlite3 jobboard.db "SELECT COUNT(*) FROM ads WHERE id = 1;"
```

Status code, ad with applications: 409

```json
{
  "error": "Ad has applications"
}
```

Status code, nonexistent ad: 404

```json
{
  "error": "Ad not found"
}
```

Status code, deletion: 204, no body

```bash
HTTP/1.1 204 NO CONTENT
Server: Werkzeug/3.1.9 Python/3.14.4
Content-Type: text/html; charset=utf-8
Vary: Cookie
Connection: close
```

Status code, read after deletion: 404

```json
{
  "error": "Ad not found"
}
```

Obtained in the database: no row for `$AD`, ad 1 is still there

```bash
1
```
