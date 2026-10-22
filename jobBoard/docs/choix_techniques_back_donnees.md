# Choix techniques — Données et API

Y.I.A Jobs garde ses données cohérentes et protégées : la base refuse ce qui la rendrait incohérente, et chaque personne n'atteint que les données auxquelles elle a droit.
**Chaque choix ci-dessous sert cette promesse : une API simple à installer aujourd'hui, prête à évoluer avec le service.**

| Brique                                   | Choix                                           | Version |
| ---------------------------------------- | ----------------------------------------------- | ------- |
| Langage                                  | Python                                          | 3.13 et 3.14 |
| Framework web                            | Flask, routes organisées en Blueprints          | 3.1.3   |
| Requêtes HTTP, hachage des mots de passe | Werkzeug (installé avec Flask)                  | 3.1.9   |
| Base de données                          | SQLite, par le module `sqlite3` de Python       | 3.46.1  |
| Configuration                            | `python-dotenv` (fichier `.env`, hors du dépôt) | 1.2.4   |
| Accès aux données                        | SQL écrit à la main, requêtes paramétrées       | —       |

---

## Flask

**Choix :** Flask 3, un micro-framework Python. Les routes sont regroupées par domaine (annonces, comptes, administration, espace recruteur), chacun dans son Blueprint, monté sous `/api` pour éviter les collisions avec les pages du front.

**Alternatives :** Django, FastAPI, ou Express (Node.js).

**Pourquoi :**

- **Un cœur minimal.** Flask garde un noyau simple et extensible ; il ne décide pas, par exemple, de la base de données à utiliser [1]. L'API n'emploie ainsi que ce dont elle a besoin : huit paquets au total, dont Flask et `python-dotenv`, les autres étant installés avec Flask.
- **Un découpage par domaine.** Les Blueprints servent précisément à découper une application en ensembles de routes et à les monter sous un préfixe d'URL [2]. Chaque domaine vit dans son fichier ; le préfixe `/api` est déclaré une seule fois, à l'enregistrement.
- **Face à Django.** Django fournit un ORM, une interface d'administration et des gabarits HTML. Pour une API qui ne renvoie que du JSON à un front séparé, ces briques seraient restées pour l'essentiel inutilisées ; par ailleurs, son ORM aurait remplacé un schéma SQL que l'équipe voulait maîtriser ligne à ligne.
- **Face à FastAPI et Express.** FastAPI et Flask ont une adoption comparable : 14,8 % et 14,4 % des développeurs interrogés par Stack Overflow en 2025 [3]. Express aurait aligné le langage sur celui du front ; en revanche, Python inclut `sqlite3` dans sa bibliothèque standard, sans pilote à ajouter.

## SQLite

**Choix :** SQLite, une base contenue dans un seul fichier, que l'API lit et écrit directement, sans serveur de base de données à installer ni à administrer.

**Alternatives :** MySQL ou PostgreSQL, des moteurs client/serveur.

**Pourquoi :**

- **Aucune administration.** SQLite ne demande ni configuration ni maintenance [4] : ni serveur, ni compte, ni port réseau. Ainsi, une base neuve se recrée en une commande, et une copie de la base tient dans un fichier.
- **Un moteur à la mesure du trafic.** La documentation officielle estime qu'un site de moins de 100 000 visites par jour fonctionne sans difficulté avec SQLite [4].
- **Une limite connue.** SQLite accepte un nombre illimité de lectures simultanées, mais un seul écrivain à la fois par fichier [4] : les écritures passent l'une après l'autre. Si elles devenaient trop nombreuses, un moteur client/serveur comme PostgreSQL prendrait le relais.

## Le schéma

**Choix :** cinq tables métier (entreprises, catégories, personnes, annonces, candidatures) reliées par des clés étrangères, avec des règles inscrites dans la base elle-même.

**Pourquoi :**

- **Des liens explicites.** Une annonce appartient à une entreprise et à une catégorie, et désigne un contact ; une candidature relie une personne à une annonce, une seule fois par couple (`UNIQUE (ad_id, person_id)`) ; un recruteur est rattaché à son entreprise.
- **Aucune suppression en cascade.** Toutes les clés étrangères des tables métier sont en `ON DELETE RESTRICT` : la base refuse de supprimer une ligne encore référencée [5]. Ainsi, une entreprise qui publie des annonces, ou une annonce qui a reçu des candidatures, ne peut pas disparaître par erreur ; l'API répond alors 409. Seule la table des inscriptions en attente, temporaire, s'efface avec la personne concernée.
- **Des valeurs contrôlées par la base.** Des contraintes `CHECK` limitent les statuts des annonces et des candidatures, le rôle des personnes et le format du SIREN (neuf chiffres, stockés en texte pour conserver les zéros initiaux). Un index unique interdit deux fiches avec le même SIREN, y compris lors de deux créations simultanées.
- **Utilisation des clés étrangères.** SQLite les désactive par défaut et demande de les activer pour chaque connexion [5] ; c'est pourquoi la connexion ouverte par l'API exécute `PRAGMA foreign_keys = ON` avant toute requête.

## Requêtes paramétrées

**Choix :** toutes les valeurs reçues sont transmises à la base séparément de la requête, à la place des `?`.

**Alternative :** construire la requête en concaténant les valeurs dans le texte SQL.

**Pourquoi :**

- **Le code et les données restent séparés.** C'est la première défense recommandée par l'OWASP contre l'injection SQL : la base distingue alors le code des données, et une valeur malveillante ne peut pas changer le sens de la requête [6].
- **Des noms de tables pris dans une liste fixe.** Un nom de table ou de colonne ne peut pas être paramétré ; l'OWASP recommande alors une validation par liste autorisée [6]. L'administration n'accepte donc que cinq tables et, pour chacune, une liste de champs : toute autre valeur est refusée.
- **Une règle appliquée partout.** Les filtres de recherche, la pagination (`LIMIT ? OFFSET ?`) et le script de remplissage suivent le même principe.

## Le remplissage par le back-end

**Choix :** un script Python lit le fichier de données (entreprises, catégories, recruteurs, annonces) et l'insère avec les mêmes requêtes paramétrées que l'API.

**Pourquoi :**

- **Tout ou rien.** L'ensemble est validé par un seul `commit()` : si une erreur survient en cours de route, rien n'est enregistré et la base reste dans son état précédent.
- **Une seconde exécution refusée.** Le script cherche d'abord les entreprises du fichier (par SIREN, sinon par nom) ; s'il en trouve, il s'arrête avec un message clair, avant toute insertion.
- **Des données vérifiées avant l'écriture.** Le format et l'unicité des SIREN sont contrôlés avant l'ouverture de la base ; chaque contact est ensuite rattaché à l'entreprise de ses annonces, et le script s'arrête si un contact en désigne deux.

## L'espace recruteur

**Choix :** l'entreprise d'un recruteur est lue côté serveur, dans sa fiche, à chaque requête ; le front ne la transmet jamais.

**Alternative :** laisser le front envoyer l'identifiant de l'entreprise.

**Pourquoi :**

- **L'identité vient de la session.** Une vérification commune à toutes les routes du recruteur lit la personne connectée, puis son entreprise en base, et la transmet à la route. Sans session, la réponse est 401 ; sans entreprise, 403, y compris pour un administrateur.
- **Un champ inattendu est refusé.** Un `company_id`, un `contact_id` ou un `siren` envoyé par le client reçoit une erreur 400 : le client ne peut pas désigner une autre entreprise que la sienne.
- **Des requêtes bornées à l'entreprise.** La lecture et la modification de l'entreprise, comme la liste et la création des annonces, portent toutes sur l'entreprise du recruteur. Par ailleurs, seul l'administrateur rattache une personne à une entreprise : l'inscription ignore ce champ, et la modification du compte le refuse.

---

## En résumé

| Engagement                           | Ce qui le garantit                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Des données cohérentes**           | Clés étrangères activées, suppressions bloquées tant qu'une ligne est utilisée, valeurs contrôlées par la base. |
| **Des accès maîtrisés**              | Identité et entreprise lues côté serveur, champs hors liste refusés.                                            |
| **Une base protégée des injections** | Valeurs toujours paramétrées, noms de tables tirés d'une liste fixe.                                            |
| **Évoluer sans tout reprendre**      | Routes découpées par domaine, limite d'écriture de SQLite connue et relais identifié.                           |

---

## Sources

1. Flask, _Design Decisions in Flask_, « What does “micro” mean? » : https://flask.palletsprojects.com/en/stable/design/
2. Flask, _Modular Applications with Blueprints_, « Why Blueprints? » : https://flask.palletsprojects.com/en/stable/blueprints/
3. Stack Overflow, _Developer Survey 2025_, « Web frameworks and technologies » et « Databases » (tous répondants) : https://survey.stackoverflow.co/2025/technology
4. SQLite, _Appropriate Uses For SQLite_ : https://www.sqlite.org/whentouse.html
5. SQLite, _SQLite Foreign Key Support_, sections 2 et 4.3 : https://www.sqlite.org/foreignkeys.html
6. OWASP, _SQL Injection Prevention Cheat Sheet_ : https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
