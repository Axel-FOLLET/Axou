# PROJECT JOB BOARD - Y.I.A Jobs

> Last updated: 14/11/2026.

Y.I.A Jobs (the initials of Yohan, Ismail and Axel) is a job board built with React, Flask and SQLite.
Epitech project carried out by a team of three: Axel FOLLET (project manager, front-end), Yohan AVRONSART (back-end: data and business logic) and Ismail BASSIT (back-end: accounts and security).

## Technologies

| Part | Tools |
| --- | --- |
| Database | SQLite (file `backend/jobboard.db`) |
| Back-end / API | Python, Flask 3, cookie sessions, python-dotenv |
| Front-end | React 19, React Router 8, Vite 8, ESLint |
| Deployment | Render (gunicorn; Flask serves the React build), described in `render.yaml` |

## Repository structure
```
JobBoard/
├── backend/                     Flask API and database
│   ├── app.py                   creates the application, registers the blueprints and serves frontend/dist if it exists (port 5000)
│   ├── db.py                    opens the database (foreign keys enabled)
│   ├── auth_utils.py            secret key, session cookie, logged-in person, @login_required, @admin_required
│   ├── routes/
│   │   ├── ads.py               job ads, applications, "My applications", profile CV, closure
│   │   ├── admin.py             admin CRUD of the five tables
│   │   ├── auth.py              registration, login, logout, account
│   │   ├── recruiter.py         categories, recruiter area (their company and its job ads)
│   │   └── verification.py      email address confirmation
│   ├── pending_registrations.py registrations waiting for the address to be confirmed
│   ├── pending_email_changes.py email address changes waiting to be confirmed
│   ├── application_cvs.py       PDF CVs: the profile CV and those attached to applications
│   ├── mailer.py                sends the emails (SMTP), can be disabled
│   ├── login_limit.py           limit on login attempts (5 failures in 15 minutes)
│   ├── create_admin.py          creates the administrator account from .env
│   ├── demo.py                  demo mode (DEMO_MODE=1): three accounts and the route GET /api/demo/login
│   ├── schema.sql               creates the tables
│   ├── seed.sql                 test data
│   ├── init_db.py               creates jobboard.db from schema.sql and seed.sql
│   ├── seed_data.py             fills the database from data/ads.json (once only)
│   ├── data/ads.json            job ad data used to fill the database
│   ├── queries.sql              example queries
│   ├── checks.sql               inserts that must fail (constraint tests)
│   ├── curl_tests.md            API tests (commands, codes, responses)
│   ├── tests/curl_auth.md       registration and login tests
│   ├── tests/test_login_limit.py automated tests of the login limit (unittest)
│   ├── .env.example             template of the configuration file
│   └── requirements.txt
├── docs/                        project documents, written in French
│   ├── contrat_api.md           API contract: routes, fields, codes, error messages
│   ├── choix_techniques_front.md            technical choices of the front-end
│   ├── choix_techniques_back_donnees.md     technical choices of the back-end: data and API
│   ├── choix_techniques_comptes_securite.md technical choices of the back-end: accounts and security
│   └── usage_ia.md              use of AI by each member of the team
├── frontend/                    React interface (Vite)
│   ├── index.html
│   ├── vite.config.js           proxy of the /api calls to the Flask API
│   └── src/
│       ├── App.jsx              routes of the interface
│       ├── api.js               single access point to the API (cookie, JSON, errors)
│       ├── AuthProvider.jsx     logged-in person, shared by all the pages
│       ├── LangProvider.jsx     language of the interface (French or English), shared by all the pages
│       ├── lang.js              useLang(): current language and t(fr, en), the text in the chosen language
│       ├── adminTables.js       description of the five tables for the admin page
│       ├── components/          common layout, footer, search bar, job ad card, forms
│       ├── pages/               one page per address
│       └── styles/              style sheets, one per use
├── render.yaml                  deployment on Render (build, start, variables)
└── .gitignore
```

## Requirements

- Python 3 (tested with 3.13 and 3.14)
- Node.js (tested with v24) and npm

## Installation and launch

### Back-end

The following commands are run from the root of the repository, in a WSL or Linux terminal. `init_db.py` recreates the tables: the existing data is deleted, administrator account included. It must be run again after any change to `schema.sql`, followed by `seed_data.py` and `create_admin.py`.

```bash
cd backend
python3 -m venv venv            # on WSL or Ubuntu, the "python" command may not exist before the venv
source venv/bin/activate        # inside the venv, "python" works
pip install -r requirements.txt
cp .env.example .env            # then fill in .env as described below, before going on
python init_db.py               # creates jobboard.db and prints the number of rows per table
python seed_data.py             # adds about fifty job ads (run it again only after init_db.py)
python create_admin.py          # creates the administrator described in .env
python app.py                   # API on http://localhost:5000
```

On Windows with PowerShell, the venv is activated with `.\venv\Scripts\Activate.ps1`.

In `backend/.env`, before `init_db.py` (the role of each key is in [Configuration](#configuration)):

- `SECRET_KEY`: replace `change-me` with a random string, for example the one given by `python3 -c "import secrets; print(secrets.token_hex(32))"`.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the administrator's credentials, to be chosen **before** `create_admin.py`. Changing them afterwards has no effect: the script answers `Admin already exists` and keeps the old password.
- Emails: leave `MAIL_ENABLED=0` for testing. Nothing is sent, and each email (with the verification link of a registration or of an address change) is printed in the API terminal, on a line starting with `[mail disabled]`. The `SMTP_*` and `MAIL_FROM` keys are only used with `MAIL_ENABLED=1`: `SMTP_USER` is the team's sending Gmail account, and `SMTP_PASSWORD` its Gmail app password (16 letters, not the account password), shared by the team and never written in the repository.

### Front-end

In a second terminal, from the root of the repository:
```bash
cd frontend
npm install
npm run dev                     # interface on http://localhost:5173, to open in the browser
```

Vite forwards to Flask every call whose address starts with `/api` (proxy of `vite.config.js`): the browser talks to a single origin, which avoids CORS errors.

### Whole site served by Flask

As in production, Flask can serve the built site, without `npm run dev`: `npm run build` in `frontend/` produces `frontend/dist/`, which `app.py` serves as soon as it exists (the addresses of the React pages return `index.html`). The site is then on http://localhost:5000.

## Configuration

The back-end uses `jobboard.db`, in the folder it is started from, and port 5000, which the Vite proxy targets.

The configuration is read from `backend/.env`, never from the code. This file is not tracked by Git: `.env.example` gives its template.

| Key | Role |
| --- | --- |
| `SECRET_KEY` | signs the session cookie; the API refuses to start without it |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | administrator account created by `create_admin.py` |
| `COOKIE_SECURE` | `1` to send the cookie over HTTPS only (optional, absent from `.env.example`: to be added by hand) |
| `APP_BASE_URL` | address of the site, used in the confirmation link sent by email |
| `MAIL_ENABLED` | `1` to send the emails; `0` or absent: nothing is sent, the message is printed in the API terminal |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | server that sends the emails |
| `DEMO_MODE` | `1` turns the demo mode on (see [Deployment on Render](#deployment-on-render)); absent or any other value: nothing is added |

The session cookie is `HttpOnly` and `SameSite=Lax`; its signature expires after one day. Passwords are stored hashed (`scrypt`).

## Deployment on Render

`render.yaml`, at the root, describes a single free web service: the build installs the dependencies and builds the front-end (`npm ci && npm run build`, `pip install`), then the start command recreates the database (`init_db.py`, `seed_data.py`, `create_admin.py`) and starts `gunicorn` on the port given by Render (`$PORT`). Render's file system is ephemeral: at each restart or new deployment, the database starts again from the demo data, which resets the demo.

Variables to enter when the service is created: `ADMIN_EMAIL` and `ADMIN_PASSWORD`. `SECRET_KEY` is generated by Render; `DEMO_MODE=1`, `MAIL_ENABLED=0` (Render blocks outgoing SMTP on the free plan) and `COOKIE_SECURE=1` are set in the file.

The demo mode (`DEMO_MODE=1`, `backend/demo.py`) creates three accounts with random passwords at start-up and adds one route:

| Method | Route | Effect |
| --- | --- | --- |
| GET | `/api/demo/login?role=candidat` | opens the session of the demo candidate (two applications already submitted) and redirects to the home page `/` |
| GET | `/api/demo/login?role=recruteur` | opens the session of the demo recruiter, attached to the company with the most job ads, and redirects to `/recruteur` |
| GET | `/api/demo/login?role=admin` | opens the session of the demo administrator and redirects to `/admin` |

An unknown role returns 400; without `DEMO_MODE=1`, the route does not exist (404).

## Database

| Table | Role | Main columns |
| --- | --- | --- |
| `companies` | companies | id, name, description, location, website, siren (9 digits, unique) |
| `categories` | job ad categories | id, name (unique) |
| `people` | candidates, accounts and job ad contacts | id, first_name, last_name, email (unique), phone, password_hash, role (`user` / `admin`), company_id |
| `ads` | job ads | id, title, short_description, description, salary, location, working_time, contract_type, status (`open` / `closed`), created_at, company_id, category_id, contact_id |
| `applications` | applications | id, ad_id, person_id, message, status (`pending` / `accepted` / `rejected`), created_at, receipt_email_sent_at, decision_email_sent_at (date the acknowledgement and the answer were sent; `NULL`: not sent) |
| `pending_registrations` | registrations waiting for the address to be confirmed | id, person_id (unique), token_hash (unique), first_name, last_name, phone, password_hash, created_at, expires_at |
| `pending_email_changes` | email address changes waiting to be confirmed | id, person_id (unique), new_email, token_hash (unique), created_at, expires_at |
| `person_cvs` | CV saved in the candidate area (one per person) | person_id (primary key), filename, content (the PDF), uploaded_at |
| `application_cvs` | CV attached to an application (a copy, one per application) | application_id (primary key), filename, content (the PDF), uploaded_at |

```text
companies 1 ───< N ads N >─── 1 categories
    1             N
    │             │ contact_id (contact of the job ad)
    │             1
    └─────────< N people          (company_id: attached recruiters)

ads 1 ───< N applications N >─── 1 people   (person_id: candidate)

people 1 ─── 0..1 pending_registrations     (pending registration)
people 1 ─── 0..1 pending_email_changes     (pending address change)
people 1 ─── 0..1 person_cvs                (profile CV)
applications 1 ─── 0..1 application_cvs    (CV attached to the application)
```

Relationships:
- a company publishes several job ads (`ads.company_id`);
- a job ad belongs to a single category (`ads.category_id`) and has a contact (`ads.contact_id`);
- a recruiter is attached to a company (`people.company_id`), by the administration only;
- a person can apply to several job ads and a job ad can receive several applications (table `applications`);
- a person cannot apply twice to the same job ad (`UNIQUE (ad_id, person_id)`);
- a person without `password_hash` (candidate without an account) exists in the database but cannot log in.

Two rules are surprising at first reading:
- **No cascading deletion.** The foreign keys of the five main tables are `ON DELETE RESTRICT`: the database refuses to delete a company, a category or a person that is still referenced, and a job ad that has applications. What refers to it must first be deleted or reassigned (the API then answers 409 `Record is still referenced`).
- **The allowed values are enforced by the database**, with `CHECK` constraints: `ads.status`, `applications.status`, `people.role` and the format of `companies.siren`. A value outside the list is refused even if it does not go through the API.

A person who applied without an account is stored in `people` without a password. If they later create their account with the same address, the registration waits in `pending_registrations` until they open the link sent to that address: knowing an email never gives access to someone else's account or applications. The token of the link is only stored hashed; it is valid for 24 hours and can be used once. This table is created automatically at first use if the database already exists.

CVs are PDF files of 2 MB at most, stored directly in the database. The CV attached to an application is a copy: the recruiter keeps the one they received, even if the candidate later replaces or deletes the CV of their profile. Like the two waiting tables, these tables are `ON DELETE CASCADE`: a CV disappears with its person or its application. They are created automatically at first use if the database already exists, without running `init_db.py` again.

## API routes

All the routes are under `/api` and answer in JSON, except the CV downloads, which return the PDF. A CV is sent as `multipart/form-data`, in a `cv` field. The details of the fields, codes and messages are in [`docs/contrat_api.md`](docs/contrat_api.md) (in French).

Access: **public** (no login), **logged in** (open session), **recruiter** (logged in and attached to a company), **admin** (account with the `admin` role).

| Method | Route | Access | Purpose | Codes |
| --- | --- | --- | --- | --- |
| GET | `/api/ads` | public | List the open job ads, with optional filters and pagination | 200, 400 |
| GET | `/api/ads/<id>` | public | Get the details of a job ad (even a closed one) | 200, 404 |
| GET | `/api/companies/<id>/ads` | public | List the open job ads of a company | 200, 404 |
| GET | `/api/categories` | public | List the categories | 200 |
| POST | `/api/ads/<id>/applications` | public | Record an application, with or without an account, with an optional CV (uploaded file or, when logged in, profile CV) | 201, 400, 401, 404, 409 |
| POST | `/api/auth/register` | public | Create an account (opens the session) | 201, 202, 400, 409 |
| POST | `/api/auth/verify` | public | Confirm the address of a pending registration | 200, 400, 409 |
| POST | `/api/auth/login` | public | Log in (opens the session) | 200, 400, 401, 429 |
| POST | `/api/auth/logout` | public | Log out | 204 |
| GET, PATCH | `/api/auth/me` | logged in | Read or edit one's account (except the email address) | 200, 400, 401, 409 |
| POST | `/api/auth/email-change` | logged in | Ask to change one's email address (link sent to the new address) | 202, 400, 401, 409 |
| POST | `/api/auth/email-change/confirm` | public | Confirm the new address with the token of the link | 200, 400, 409 |
| GET | `/api/me/applications` | logged in | List one's applications | 200, 401 |
| GET | `/api/me/cv` | logged in | Read the name and date of one's profile CV | 200, 401, 404 |
| PUT | `/api/me/cv` | logged in | Save or replace one's profile CV | 200, 400, 401 |
| DELETE | `/api/me/cv` | logged in | Delete one's profile CV (the CVs already attached remain) | 204, 401, 404 |
| GET | `/api/me/cv/file` | logged in | Download one's profile CV | 200, 401, 404 |
| GET, PATCH | `/api/recruiter/company` | recruiter | Read or edit one's company (except the SIREN) | 200, 400, 401, 403 |
| GET, POST | `/api/recruiter/ads` | recruiter | List the job ads of one's company or publish one | 200, 201, 400, 401, 403 |
| PATCH | `/api/recruiter/ads/<id>` | recruiter | Edit an open job ad of one's company | 200, 400, 401, 403, 404, 409 |
| DELETE | `/api/recruiter/ads/<id>` | recruiter | Delete a job ad of one's company that has no application | 204, 401, 403, 404, 409 |
| GET | `/api/recruiter/ads/<id>/applications` | recruiter | List the applications to a job ad of one's company | 200, 401, 403, 404 |
| GET | `/api/recruiter/ads/<id>/applications/<application_id>/cv` | recruiter | Download the CV attached to an application | 200, 401, 403, 404 |
| POST | `/api/recruiter/ads/<id>/closure` | recruiter | Close a job ad of one's company, with or without a selected application | 200, 400, 401, 403, 404, 409 |
| POST | `/api/recruiter/ads/<id>/applications/<application_id>/rejection` | recruiter | Reject an application without closing the job ad | 200, 401, 403, 404, 409 |
| POST | `/api/ads` | admin | Create a job ad | 201, 400, 401, 403 |
| POST | `/api/ads/<id>/closure` | admin | Close a job ad and name the selected application | 200, 400, 401, 403, 404, 409 |
| GET | `/api/admin/<table>` | admin | List the rows of a table, with pagination | 200, 400, 401, 403, 404 |
| GET | `/api/admin/<table>/<id>` | admin | Read a row | 200, 401, 403, 404 |
| POST | `/api/admin/<table>` | admin | Create a row | 201, 400, 401, 403, 404, 409 |
| PATCH | `/api/admin/<table>/<id>` | admin | Edit a row | 200, 400, 401, 403, 404, 409 |
| DELETE | `/api/admin/<table>/<id>` | admin | Delete a row | 204, 401, 403, 404, 409 |

A recruiter is a logged-in person whose record is attached to a company: the server reads that company from the database, never from the request.

Filters of `GET /api/ads`, all optional and combinable: `q` (text in the title or the short description), `category`, `contract_type` and `location` (exact values). Closed job ads never appear in the lists. Pagination: `page` and `per_page` (1 to 50); the total number of rows is returned in the `X-Total-Count` header.

The routes return 200 for a read, 201 for a creation, 202 for a registration waiting for confirmation, 204 after a deletion, 400 for an invalid request, 401 without a login or for wrong credentials, 403 without the administrator role or, for the recruiter area, without an attached company, 404 for a resource that does not exist, 409 for a duplicate or a row that is still referenced, and 429 after 5 login failures in 15 minutes for the same email (the `Retry-After` header gives the wait in seconds). Errors always have the form `{"error": "..."}`. No response contains a password or a hash.

The commands and results of the checks are in `backend/curl_tests.md` and `backend/tests/curl_auth.md`. The automated tests of the login limit are run from `backend/` with `python -m unittest tests.test_login_limit -v`.

## Pages

Navigation without reloading the page (React Router), with a common bar: the active page is marked and the logo leads back to the home page. The menu depends on the person: "Job offers" for everyone, "Log in" for a visitor, "Recruiter area", "Candidate area" and "Log out" once logged in, "Admin" for an administrator. On mobile, it folds behind a "Menu" button. The footer repeats the navigation and holds the legal notice.

The interface is in French and in English: an "English" / "Français" button in the bar switches the language, and a `?lang=en` link opens the site in English. The labels quoted in this file are the English ones. The addresses of the pages are in French in both languages.

| Address | Page |
| --- | --- |
| `/` | Home: search bar and the two most recent job offers |
| `/offres` | Job offers: list of the open job ads, filtered by the search of the home page |
| `/login` | Log in |
| `/account` | Account creation: the session opens as soon as the account is created, then the home page is shown |
| `/verification` | Address confirmation, opened from the link received by email |
| `/confirmation-email` | Confirmation of a new email address, opened from the link received at that address |
| `/espace-candidat` | Candidate area, "My applications" tab |
| `/espace-candidat/informations` | Candidate area, "My details" tab: account editing; the email address is changed with "Change email address", confirmed by a link; "My CV" section to save, replace, download or delete one's CV |
| `/recruteur` | Recruiter area, "Overview" tab |
| `/recruteur/entreprise` | Recruiter area, "My company" tab: company record, SIREN read-only |
| `/recruteur/postes` | Recruiter area, "My positions" tab: job ads of the company |
| `/recruteur/postes/:id/candidatures` | Applications received for a job ad: download the CV, select or reject a candidate, close the job ad |
| `/recruteur/postes/:id/modifier` | Editing of an open job ad |
| `/recruteur/nouvelle-offre` | Recruiter area, "Post a job offer" tab |
| `/admin` | Admin: the five tables, with creation, editing, deletion and pagination |
| any other address | Page not found |

All these pages read and write through the API. The candidate and recruiter areas require a login: a visitor finds a link to the login page there. Without an attached company, the recruiter area says that the administration must attach the account. The admin page is reserved for administrators: otherwise, the page shows a message without asking the API for anything.

On each job ad, a click on its title shows all the information of the ad in the card, without a modal window; a message reports the loading or the failure of a request. The "Apply" button opens the application form under the job ad, with or without an account; a PDF CV can be attached, and a logged-in person who has saved a CV sees it offered by default.

## Known limits

- **No CSRF protection.** The session cookie is `SameSite=Lax`, which blocks the cookie from being sent by most requests coming from another site, but no CSRF token is checked by the API.
- **The salary is not checked by the API.** `POST` and `PATCH` accept a non-numeric value (for example `"abc"`); only the form of the site requires a number.
- **The demo mode opens every session without a password.** With `DEMO_MODE=1`, anyone can become administrator through `/api/demo/login?role=admin` and change the data; this is intended for the demonstration, and the database starts again from the demo data at each restart of the service. This mode must never be turned on for a real site.
- **No closure button in the admin page.** The administrator can close a job ad through the API (`POST /api/ads/<id>/closure`), but the admin page does not offer it; in the site, only the recruiter closes their job ads.
