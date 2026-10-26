-- Q1 nombre d'annonces par entreprise
SELECT companies.name AS company, COUNT(ads.id) AS ad_count --affiche le nom de l'entreprise, et renomme la colonne company dans le résultat + compte le nombre d'ads.id non NULL pour chaque groupe, résultat nommé ad_count
FROM companies
LEFT JOIN ads ON ads.company_id = companies.id --On rattache les annonces à leur entreprise. LEFT JOIN garde toutes les lignes de la table de gauche (companies), même sans annonce correspondante. Avec un JOIN simple, une entreprise sans annonce disparaîtrait, or le sujet veut qu'elles apparaissent toutes.
GROUP BY companies.id
ORDER BY ad_count DESC; --Trie par nombre d'annonces, du plus grand au plus petit (DESC = décroissant)

-- Q2 l'annonce avec le plus de candidatures
SELECT ads.title AS title, COUNT(applications.id) AS application_count
FROM ads
JOIN applications ON applications.ad_id = ads.id
GROUP BY ads.id
ORDER BY application_count DESC --Trie du plus grand nombre de candidatures au plus petit : l'annonce gagnante se retrouve en première ligne.
LIMIT 1; --Ne garde que la première ligne du résultat trié, donc la meilleure annonce. Si deux annonces étaient à égalité, LIMIT 1 en renverrait une seule, arbitrairement.

-- Q3 candidats de l'annonce 1, avec leur message
SELECT ads.title AS title,
       people.first_name AS first_name,
       people.last_name AS last_name,
       people.email AS email,
       applications.message AS message,
       applications.created_at AS created_at
FROM applications
JOIN ads ON ads.id = applications.ad_id --Pour chaque candidature, on va chercher l'annonce correspondante (pour récupérer title).
JOIN people ON people.id = applications.person_id -- Pour chaque candidature, on va chercher la personne qui a postulé (pour first_name, last_name, email)
WHERE ads.id = 1
ORDER BY applications.created_at ASC; --Trie par date de candidature, du plus ancien au plus récent (ASC = croissant, c'est aussi le défaut)