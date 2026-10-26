--Insertion des données dans les tableaux correspondants avec INSERT INTO

-- SIREN fictifs : données de test uniquement, ce ne sont pas les SIREN d'entreprises réelles
INSERT INTO companies (name, description, location, website, siren) VALUES
  ('TechNova', 'Studio de développement web', 'Paris', 'https://technova.example.com', '000000991'),
  ('GreenWorks', 'Agence de design durable', 'Lyon', 'https://greenworks.example.com', '000000993');

INSERT INTO categories (name) VALUES
  ('Développement'),
  ('Design'),
  ('Data');

INSERT INTO people (first_name, last_name, email, phone) VALUES
  ('Alice', 'Martin', 'alice.martin@example.com', '0600000001'),
  ('Bruno', 'Durand', 'bruno.durand@example.com', '0600000002'),
  ('Chloé', 'Petit', 'chloe.petit@example.com', NULL);

INSERT INTO ads (title, short_description, description, salary, location, working_time, contract_type, status, company_id, category_id, contact_id) VALUES
  ('Développeur Python', 'Back-end Flask', 'Vous développerez des sites web et leurs API en Flask.', 42000, 'Paris', 'Temps plein', 'CDI', 'open', 1, 1, 1),
  ('Data analyst', 'Analyse de données, SQL', 'Vous analyserez des jeux de données et rédigerez des requêtes SQL.', 52000, 'Mulhouse', '35h', 'Stage', 'closed', 2, 3, 2),
  ('Cybersécurité', 'Blue team', 'Vous protégerez nos sites web contre les attaques et les logiciels malveillants.', 100000, 'Londres', 'Temps plein', 'CDI', 'open', 1, 1, 3);

INSERT INTO applications (ad_id, person_id, message, status, created_at) VALUES
  (1, 1, 'Bonjour, votre offre correspond à mon profil.', 'pending', '2025-01-10 09:00:00'),
  (1, 3, 'Bonjour, je souhaite rejoindre votre équipe.', 'pending', '2025-01-11 14:30:00'),
  (2, 2, 'Bonjour, je candidate à cette annonce.', 'accepted', '2025-01-12 18:45:00'),
  (2, 3, 'Bonjour, ce poste m''intéresse beaucoup.', 'rejected', '2025-01-13 10:15:00');