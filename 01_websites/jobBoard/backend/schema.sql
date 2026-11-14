-- drop the tables if they already exist in the database. Otherwise move on.
DROP TABLE IF EXISTS application_cvs;
DROP TABLE IF EXISTS person_cvs;
DROP TABLE IF EXISTS pending_email_changes;
DROP TABLE IF EXISTS pending_registrations;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS ads;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS companies;

-- create the tables according to the different categories of the jobBoard. The columns we want are listed.
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  website TEXT,
  -- SIREN: 9-digit text (keeps the leading zeros); NULL for an old record still to be completed
  siren TEXT CHECK (siren IS NULL OR (length(siren) = 9 AND siren NOT GLOB '*[^0-9]*'))
);

-- A SIREN that is filled in appears only once (several NULLs remain possible).
-- Same index as the one created by migrate_siren.py on an existing database.
CREATE UNIQUE INDEX companies_siren_unique ON companies(siren);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  -- the recruiter's company; NULL by default: the person is not a recruiter
  company_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT
);

CREATE TABLE ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT,
  salary INTEGER,
  location TEXT,
  working_time TEXT,
  contract_type TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  company_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  contact_id INTEGER,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (contact_id) REFERENCES people(id) ON DELETE RESTRICT
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  receipt_email_sent_at TEXT,
  decision_email_sent_at TEXT,
  UNIQUE (ad_id, person_id),
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE RESTRICT,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT);
  

-- Pending registration: a person already in people without a password creates their account.
-- Nothing is applied to their record before the click on the link sent to their address.
-- Only the SHA-256 fingerprint of the token is kept; the link is valid for 24 hours and works once.
-- Same definition as pending_registrations.py, which creates the table on an existing database.
CREATE TABLE pending_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- PDF CVs (2 MB maximum), kept in the database. person_cvs: the profile CV (candidate area),
-- one per person. application_cvs: the copy attached to an application; it does not change
-- if the candidate later replaces the CV on their profile.
-- Same definition as application_cvs.py, which creates the tables on an existing database.
CREATE TABLE person_cvs (
  person_id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  content BLOB NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE application_cvs (
  application_id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  content BLOB NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- Pending email address change: the person asked for a new address (with their password),
-- but has not yet opened the link sent to this new address.
-- The people record is modified only at confirmation. Same rules as pending_registrations:
-- SHA-256 fingerprint of the token only, link valid for 24 hours, one request per person.
-- Same definition as pending_email_changes.py, which creates the table on an existing database.
CREATE TABLE pending_email_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL UNIQUE,
  new_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);