# Choix techniques — Comptes et sécurité

Y.I.A Jobs garantit à chaque personne que son mot de passe reste illisible, même pour le service, que sa session ne se falsifie pas sans être détectée et que ses candidatures ne s'ouvrent qu'à elle et à l'administration du service.
**Chaque choix ci-dessous sert cette promesse : protéger les comptes avec des mécanismes éprouvés, proportionnés à la taille actuelle du service et prêts à évoluer avec lui.**

| Brique | Choix | Version |
| --- | --- | --- |
| Mots de passe | Werkzeug, `scrypt` salé | 3.1.9 |
| Session | Cookie signé de Flask | 3.1.3 |
| Limite de connexion | Compteur par adresse e-mail | — |
| Secrets et réglages | `python-dotenv`, fichier `.env` hors de Git | 1.2.4 |
| Confirmation de l'adresse | Jeton `secrets`, conservé en empreinte SHA-256 | Python 3.13 et 3.14 |

---

## Mots de passe

**Choix :** le serveur ne conserve jamais un mot de passe, seulement son empreinte, calculée par `generate_password_hash` ; à la connexion, `check_password_hash` compare l'essai à cette empreinte.

**Alternatives :** un stockage lisible, ou un hachage rapide (MD5, SHA-256 seul).

**Pourquoi :**
- **Une empreinte à sens unique.** Une base copiée ne livre aucun mot de passe : il faudrait les deviner un par un. Par ailleurs, les réponses de l'API ne contiennent ni le mot de passe ni son empreinte.
- **Un calcul volontairement lent.** `scrypt` est coûteux en calcul et en mémoire [1]. En revanche, l'OWASP juge les hachages rapides comme SHA-256 inadaptés au stockage des mots de passe, car ils permettent d'enchaîner les essais [2].
- **Un sel propre à chaque compte.** Werkzeug ajoute à chaque mot de passe 16 caractères aléatoires [1] : deux comptes au même mot de passe ont deux empreintes différentes, et les tables précalculées deviennent inutiles [2].
- **Des réglages au niveau de l'OWASP.** Le réglage par défaut de Werkzeug (`scrypt:32768:8:1`) reste en deçà du minimum fixé par l'OWASP [1][2]. Le service emploie donc N = 2^15, r = 8 et p = 3, l'une des configurations minimales recommandées par l'OWASP [2]. Chaque empreinte commence par ses paramètres : une empreinte plus ancienne reste vérifiable, puis elle est recalculée à la connexion suivante, comme le préconise l'OWASP [2].

## Session

**Choix :** après la connexion, le serveur place l'identifiant de la personne dans le cookie de session de Flask, signé par une clé secrète. Le cookie est `HttpOnly`, `SameSite=Lax`, `Secure` dès que `COOKIE_SECURE=1`, et sa signature expire au bout d'un jour.

**Alternative :** un jeton JWT que le front conserve dans `localStorage`.

**Pourquoi :**
- **Une modification détectée.** Flask signe le cookie [3] : un cookie altéré est rejeté, et la requête est traitée comme celle d'un visiteur non connecté. La signature ne chiffre pas le contenu, qui reste lisible [3] ; c'est pourquoi le cookie ne porte que l'identifiant. Le serveur retrouve ensuite la personne et son rôle en base à chaque requête : un changement de rôle s'applique dès l'appel suivant.
- **Un cookie hors de portée des scripts.** `HttpOnly` interdit à JavaScript de le lire, et `Secure` le réserve au HTTPS [5]. Un jeton dans `localStorage`, à l'inverse, reste accessible à tout script de la page ; l'OWASP déconseille d'y placer un identifiant de session [6].
- **Des requêtes forgées limitées.** Avec `SameSite=Lax`, le navigateur ne joint le cookie aux requêtes venues d'un autre site que pour une navigation de premier niveau par une méthode sûre, comme GET : POST, PUT, PATCH et DELETE en sont exclus [5].
- **Une durée de vie bornée.** Flask refuse un cookie dont la signature dépasse une durée fixée, 31 jours par défaut [4] ; le service la ramène à un jour. Ainsi, une copie dérobée, que la déconnexion n'efface pas, cesse de servir un jour après la connexion. Un registre des sessions côté serveur permettra, à terme, de la révoquer immédiatement.

## Limite de connexion

**Choix :** après cinq échecs en quinze minutes pour une même adresse, le serveur refuse toute tentative avec le code 429, accompagné de l'en-tête `Retry-After` qui indique l'attente en secondes [7].

**Alternatives :** des essais illimités, ou un compteur par adresse IP.

**Pourquoi :**
- **Des essais en série sans issue.** Pendant le blocage, le bon mot de passe est lui aussi refusé : un robot ne peut pas savoir si l'un de ses essais était juste.
- **Un compteur attaché au compte.** Le décompte se fait sur l'adresse normalisée (espaces retirés, minuscules), comme le recommande l'OWASP plutôt qu'un compteur par adresse IP [8]. Les échecs de plus de quinze minutes sont oubliés, et une connexion réussie remet le compteur à zéro.
- **Une réponse identique à chaque échec.** Adresse inconnue, mot de passe faux ou fiche sans compte : le code et le message sont les mêmes, conformément à l'OWASP [8]. Ainsi, le message ne révèle pas quelles adresses possèdent un compte. Le temps de réponse, en revanche, le trahit encore : l'empreinte n'est calculée que pour un compte existant, alors que l'OWASP recommande de la calculer dans tous les cas [8].
- **Des limites proportionnées.** Le compteur vit en mémoire : il repart de zéro au redémarrage, et un stockage partagé le remplacera si le service passe sur plusieurs serveurs. Par ailleurs, une personne peut bloquer volontairement le compte d'une autre, risque que signale l'OWASP [8] ; la durée de quinze minutes borne cette gêne.

## Secrets et réglages

**Choix :** la clé secrète et les réglages d'envoi des e-mails sont lus au démarrage dans un fichier `.env`, grâce à `python-dotenv`, et jamais écrits dans le code.

**Alternative :** des valeurs inscrites dans le code source.

**Pourquoi :**
- **Aucun secret dans l'historique.** Le fichier `.env` est exclu de Git ; seul le modèle `.env.example`, aux valeurs d'exemple, est partagé.
- **Un démarrage refusé sans clé.** Si la clé secrète manque, l'API s'arrête plutôt que de signer les sessions avec une valeur par défaut.
- **Une clé par installation.** Chaque installation a son propre fichier `.env` : changer la clé ne demande aucune modification du code. Flask recommande une clé longue et aléatoire, tirée par le module `secrets` [3][4].

## Confirmation de l'adresse e-mail

**Choix :** lorsqu'une adresse figure déjà dans la base sans compte (une personne qui a candidaté sans compte, ou qu'une entreprise a saisie), l'inscription attend que la personne ouvre un lien envoyé à cette adresse.

**Alternative :** une inscription directe, qui rattacherait aussitôt le compte à la fiche existante.

**Pourquoi :**
- **Connaître une adresse ne suffit pas.** Tant que le lien n'est pas ouvert, la fiche reste inchangée et ses candidatures inaccessibles ; le mot de passe choisi attend, lui aussi sous forme d'empreinte.
- **Un jeton imprévisible, conservé en empreinte.** Le jeton compte 32 octets tirés par le module `secrets`, conçu pour les jetons de sécurité [9] ; la base n'en garde que l'empreinte SHA-256. Ainsi, une base copiée ne permet pas de reconstituer un lien valide.
- **Un lien bref et à usage unique.** Valable 24 heures, il est supprimé dès sa première utilisation, comme le préconise l'OWASP pour ce type de lien [10] ; une nouvelle demande remplace en outre la précédente. Un lien inconnu, périmé ou déjà utilisé reçoit le même refus.
- **Un lien qui confirme sans connecter.** Aucune session n'est ouverte : la personne se connecte ensuite avec son mot de passe. Cependant, ouvrir le lien valide l'inscription telle qu'elle a été demandée, mot de passe compris ; le message invite donc à l'ignorer si l'on n'est pas à l'origine de la demande. Choisir le mot de passe au moment de la confirmation supprimera cette dépendance.
- **Une adresse qui ne change pas sans preuve.** L'adresse d'un compte n'est pas modifiable depuis l'espace personnel : sans vérification, on pourrait s'approprier celle d'une autre personne. Un changement confirmé par lien est prévu.

---

## En résumé

| Engagement | Ce qui le garantit |
| --- | --- |
| **Des mots de passe illisibles** | Empreintes `scrypt` salées, aux réglages minimaux de l'OWASP, absentes de toutes les réponses. |
| **Une session sous l'autorité du serveur** | Cookie signé par une clé hors du code, inaccessible aux scripts et valable un jour ; rôle relu en base à chaque requête. |
| **Des essais en série freinés** | Attente imposée après cinq échecs, même avec le bon mot de passe. |
| **Une fiche réservée à son titulaire** | Confirmation par lien à usage unique, jetons conservés en empreinte, adresse non modifiable sans preuve. |

---

## Sources

1. Werkzeug 3.1.x, *Utilities*, `generate_password_hash` : https://werkzeug.palletsprojects.com/en/stable/utils/
2. OWASP, *Password Storage Cheat Sheet* : https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
3. Flask 3.1.x, *Quickstart*, « Sessions » : https://flask.palletsprojects.com/en/stable/quickstart/
4. Flask 3.1.x, *Configuration Handling*, `SECRET_KEY` et `PERMANENT_SESSION_LIFETIME` : https://flask.palletsprojects.com/en/stable/config/
5. MDN, *Set-Cookie*, attributs `HttpOnly`, `Secure` et `SameSite`, et cookie sans `Expires` : https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
6. OWASP, *HTML5 Security Cheat Sheet*, « Local Storage » : https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
7. MDN, *429 Too Many Requests* : https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429
8. OWASP, *Authentication Cheat Sheet*, « Account Lockout » et « Authentication Responses » : https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
9. Python, *secrets — Generate secure random numbers for managing secrets* : https://docs.python.org/3/library/secrets.html
10. OWASP, *Forgot Password Cheat Sheet* : https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
