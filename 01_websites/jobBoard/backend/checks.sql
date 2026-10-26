-- Check 1 : candidature pour une annonce (999) qui n'existe pas
INSERT INTO applications (ad_id, person_id, message)
VALUES (999, 1, 'Test annonce inexistante');
-- resultat : Runtime error near line 2: FOREIGN KEY constraint failed (19)

-- Check 2 : Alice (personne 1) a déjà postulé à l'annonce 1 dans ton seed, donc UNIQUE (ad_id, person_id) n'est pas respectée.
INSERT INTO applications (ad_id, person_id, message)
VALUES (1, 1, 'Test doublon');
-- resultat : Runtime error near line 6: UNIQUE constraint failed: applications.ad_id, applications.person_id (19)

-- Check 3 : rôle invalide, 'boss' n'est ni 'user' ni 'admin', donc le CHECK échoue
INSERT INTO people (first_name, last_name, email, role)
VALUES ('Test', 'Boss', 'boss@example.com', 'boss');
-- resultat : Runtime error near line 10: CHECK constraint failed: role IN ('user', 'admin') (19)


--Comment obtenir les messages d'erreur :

--Il faut activer les clés étrangères dans la session, sinon le Check 1 réussira. 
-- Ouvrir la console SQLite sur la base : sqlite3 jobboard.db "PRAGMA foreign_keys = ON;" ".read checks.sql"
--.read exécute le fichier. Pour chaque instruction qui échoue, SQLite affiche une erreur, du genre Parse error near line 3: ... ou Runtime error near line 3: ...