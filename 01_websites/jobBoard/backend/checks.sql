-- Check 1: application for an ad (999) that does not exist
INSERT INTO applications (ad_id, person_id, message)
VALUES (999, 1, 'Test annonce inexistante');
-- result: Runtime error near line 2: FOREIGN KEY constraint failed (19)

-- Check 2: Alice (person 1) has already applied to ad 1 in your seed, so UNIQUE (ad_id, person_id) is not respected.
INSERT INTO applications (ad_id, person_id, message)
VALUES (1, 1, 'Test doublon');
-- result: Runtime error near line 6: UNIQUE constraint failed: applications.ad_id, applications.person_id (19)

-- Check 3: invalid role, 'boss' is neither 'user' nor 'admin', so the CHECK fails
INSERT INTO people (first_name, last_name, email, role)
VALUES ('Test', 'Boss', 'boss@example.com', 'boss');
-- result: Runtime error near line 10: CHECK constraint failed: role IN ('user', 'admin') (19)


-- How to get the error messages:

-- Foreign keys must be enabled in the session, otherwise Check 1 will succeed. 
-- Open the SQLite console on the database: sqlite3 jobboard.db "PRAGMA foreign_keys = ON;" ".read checks.sql"
-- .read runs the file. For each statement that fails, SQLite prints an error, like Parse error near line 3: ... or Runtime error near line 3: ...