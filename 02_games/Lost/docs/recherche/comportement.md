# Comportement du chat domestique : état des connaissances

Rapport A1 de la mission chat_recherche, rédigé le 2026-10-22. Il sert à la mission B (correction du modèle 3D et des animations de `tools/anim_cat.py`). Le chat à modéliser a environ 2 ans, ce qui en fait un jeune adulte.

## Méthode et statut des sources

- Les références ont été trouvées avec l'API REST Europe PMC, sans compte. Quelques résumés viennent de l'API Semantic Scholar, qui a renvoyé l'erreur 429 (trop de requêtes) lors d'une seconde série.
- Le statut de lecture de chaque source est indiqué dans la section « Sources » :
  - TI : texte intégral lu, récupéré en XML JATS par Europe PMC ;
  - WF : page lue par WebFetch, dont l'outil ne restitue qu'un extrait reformulé ;
  - R : résumé seulement ;
  - C : connue seulement parce qu'une autre source la cite.
- Wikipedia n'a servi qu'à s'orienter. Un chiffre qui ne vient que de Wikipedia est marqué « non vérifié ».
- Plusieurs éditeurs ont bloqué la lecture : ScienceDirect, Taylor & Francis, SAGE et figshare ont renvoyé l'erreur 403, et pmc.ncbi.nlm.nih.gov a renvoyé un reCAPTCHA. Les sources concernées sont classées R ou C.
- Les « implications pour l'animation » de la section 7 sont des déductions de l'auteur du rapport, pas des résultats publiés.

## 1. Développement, du chaton au jeune adulte

### 1.1 Stades de vie

- Les lignes directrices AAHA/AAFP 2021 (Quimby et al. 2021, WF) définissent quatre stades : chaton de la naissance à 1 an, jeune adulte de 1 à 6 ans, adulte mûr de 7 à 10 ans, senior au-delà de 10 ans.
- Le chat de 2 ans à modéliser est donc un jeune adulte au sens de ces lignes directrices.
- Les mêmes lignes directrices signalent deux points pour ce stade : le marquage urinaire peut coïncider avec la maturité sexuelle, et la baisse du jeu social peut favoriser l'agression entre chats (Quimby et al. 2021, WF).

### 1.2 Étapes physiques du chaton

Ces repères ne viennent que de Wikipedia (article « Kitten »). Ils sont non vérifiés par une source primaire :

| Étape | Âge |
|---|---|
| Ouverture des yeux | 7 à 10 jours |
| Nourriture solide | 5 à 6 semaines |
| Sevrage | commence à 3-4 semaines, se termine vers 6-8 semaines |
| Perte des dents de lait | vers 3 mois |
| Dentition adulte complète | vers 9 mois |
| Maturité sexuelle | vers 7 mois |
| Taille adulte | vers 1 an |

Vernick et al. 2025 (TI) citent une étude sur la nutrition : une restriction alimentaire de 50 % chez la mère pendant la gestation retarde les corrections posturales, la marche, la course, l'escalade et le jeu du chaton. L'article ne donne aucun âge normal pour ces étapes motrices.

### 1.3 Période sensible de socialisation à l'humain

- **Expériences de Karsh, résumées par Turner 2021 (TI)** : des chatons manipulés de la 2e à la mi-7e semaine deviennent plus amicaux envers l'humain. L'effet a été testé jusqu'à 3 ans (Lowe & Bradshaw 2002, C).
- **Les mêmes expériences, détaillées dans le tableau 1 de Vernick et al. 2025 (TI)** :
  - Des chatons manipulés de la 3e à la 14e semaine, comparés à des chatons manipulés de la 7e à la 14e, s'approchent plus vite d'une personne inconnue (11 s contre 41 s) et se laissent tenir plus longtemps (41 s contre 24 s), à 14 semaines.
  - Quand la manipulation passe à 40 min par jour, les deux groupes ne diffèrent plus.
  - Parmi les fenêtres de manipulation qui se chevauchent, celles de 2-6 et de 3-7 semaines donnent les durées de maintien les plus longues.
- **Lowe & Bradshaw 2002, d'après le tableau de Vernick 2025 (TI)** : 29 chats testés à 2, 4, 12, 24 et 33 mois. Le nombre de tentatives de fuite à 4 mois est corrélé à celui mesuré à 24 et 33 mois. La réaction à la manipulation reste donc stable chez le jeune adulte.
- **Vernick et al. 2025 (TI), 50 chatons de refuge testés à 8, 10 et 12 semaines** :
  - le délai d'approche d'une personne inconnue diminue avec l'âge : 20,3 s, puis 14,9 s, puis 14,8 s (N = 39) ;
  - le temps de jeu avec une plume pendant un test de 60 s augmente : 35,0 s, puis 49,5 s, puis 53,0 s (N = 27).
- **Quimby et al. 2021 (WF)** : la socialisation commence vers 2-3 semaines, et sa fenêtre peut se fermer vers 9-10 semaines. Les lignes directrices recommandent 30 à 60 min par jour d'interactions agréables.
- **Turner 2021 (TI)** : la socialisation aux autres chats se fait vers 10 semaines (Schaer, C). Le placement d'un chaton est recommandé pas avant 10-12 semaines.

**Divergence sur la fenêtre de socialisation.** Karsh l'étend de 2 à 7 semaines (Turner 2021, TI). Vernick 2025 (TI) écrit « entre 2 et 9 semaines ». Quimby 2021 (WF) parle de 2-3 semaines à 9-10 semaines. Wikipedia indique 3 à 9 semaines (non vérifié). Il s'agit d'une période sensible graduelle, pas d'une limite nette : une manipulation prolongée jusqu'à 14 semaines peut compenser en partie (Vernick 2025, TI).

## 2. Jeu et interactions entre jeunes chats

### 2.1 Âges du jeu (Gajdoš Kmecová et al. 2021, TI, sauf mention contraire)

- Le jeu social est le plus fréquent de 4 semaines à 4 mois (West, C).
- Son pic se situe entre la 9e et la 14e semaine (Mendoza & Ramirez, C).
- Les données de Barrett & Bateson (C) montrent trois évolutions : le dos rond (« arch ») diminue de la 7e à la 12e semaine, le pas de côté diminue dès 12 semaines, et le contact avec les objets augmente dès 7-8 semaines.
- Le jeu social mutuel devient plus rare avec l'âge.

Quimby 2021 (WF) place le pic du jeu entre chats vers 12 semaines ; le jeu avec les objets domine ensuite.

**Divergence sur le pic du jeu.** Les sources le placent entre 9 et 14 semaines (Mendoza & Ramirez), vers 12 semaines (Quimby) ou aux 3e-4e mois (Crowell-Davis 2005, cité par Wikipedia, non vérifié). Ces fourchettes se recouvrent en gros sur 9-16 semaines.

### 2.2 Structure d'une séquence de jeu (Gajdoš Kmecová et al. 2021, TI)

1. Un chat lance le jeu par un bond (« pounce »).
2. L'autre répond en se mettant ventre en l'air, ou en se dressant face à lui (posture de face-à-face).
3. Suivent la lutte, la poursuite et des pauses.
4. La séquence se termine souvent par une poursuite ou par un dos rond.

Autres observations des mêmes auteurs :
- Il y a peu de vocalisations pendant le jeu.
- La queue dressée a une fonction affiliative.
- La « play face » (visage de jeu) n'est pas validée chez le chat.
- La roulade sur le dos apparaît dans trois contextes : le jeu, l'affiliation et l'agonisme (apaisement). Son sens dépend donc du contexte.

### 2.3 Distinguer le jeu du combat (Rodan et al. 2024, TI)

- Des chats qui luttent sans vocaliser jouent très probablement.
- Une poursuite non réciproque, avec vocalisations, pauses d'inactivité répétées et peu de contact direct, n'est probablement pas du jeu. Un chat traite alors l'autre comme une proie ou un objet.
- Une « lutte » qui paraît brutale peut rester du jeu.
- Un épisode court de mésentente est normal.
- Des chats liés dorment serrés ou entrelacés. Toilette mutuelle (allogrooming), frottements mutuels et contacts nez à nez signalent une relation affiliative.

## 3. Attitudes et signaux

### 3.1 Synthèse par état émotionnel

Le tableau suit l'éthogramme de Nicholson & O'Carroll 2021 (TI, tableau de l'éthogramme), complété par Ellis 2018 (WF) et Rodan et al. 2024 (TI) quand ils sont cités dans la case.

| État | Pupilles et yeux | Oreilles | Queue | Posture du corps | Moustaches |
|---|---|---|---|---|---|
| Contentement / détente | pupilles fines et verticales, yeux mi-clos (Nicholson) ; petites pupilles ou yeux fermés, clignement lent (Rodan 2024) | droites, tournées vers l'avant (Nicholson ; Rodan 2024) | détendue, ou dressée et un peu courbée (Nicholson) | assis, couché en boule ; tonus musculaire mou, pattes étendues (Rodan 2024) ; étirement, bâillement, pétrissage, roulade sur le dos (Nicholson) | non décrites dans les sources lues |
| Intérêt | pupilles dilatées (Nicholson) | en avant, petits mouvements (Nicholson) | horizontale ou dressée (Nicholson) | orienté vers le stimulus | non décrites |
| Jeu | pupilles dilatées (Nicholson) | droites, en avant (Nicholson) | verticale ou en U inversé (Nicholson) | bond, ventre en l'air, face-à-face (Gajdoš Kmecová 2021) | non décrites |
| Peur | yeux grands ouverts, pupilles rondes et dilatées (Nicholson ; Ellis 2018) | aplaties sur le côté ou vers l'arrière (Nicholson) ; aplaties vers le bas (Ellis 2018) | rentrée ou enroulée (Nicholson) ; serrée contre le corps (Ellis 2018) | accroupi, tête basse (Nicholson) ; corps près du sol, tête rentrée plus bas que le corps, piloérection (Ellis 2018) ; pattes repliées sous le corps (Rodan 2024) | non décrites |
| Colère / agression défensive | pupilles ovales et dilatées (Nicholson) ; pupilles « oblongues » dans l'état tendu (Rodan 2024) | tournées sur le côté (Nicholson) ; aplaties et tournées vers l'extérieur (Rodan 2024) | basse et rigide en L inversé, qui fouette (Nicholson) | piloérection (Nicholson) ; corps tendu, regard fixe, sifflement (Rodan 2024) | non décrites |
| Frustration | — | rotation des oreilles (Ellis 2018) | queue qui fouette (Ellis 2018) | peau du dos qui ondule (Ellis 2018) ; léchage du nez, sifflement (Bennett et al. 2017, R) | non décrites |
| Douleur (échelle de grimace) | hauteur entre les paupières inférieure à 50 % de la largeur de l'œil (Evangelista 2019) | pointes écartées et tournées vers l'extérieur (Evangelista 2019) | — | tête sous la ligne des épaules (Evangelista 2019) | tendues et dirigées vers l'avant (Evangelista 2019) |

Nicholson & O'Carroll 2021 (TI) font deux remarques sur ce tableau :
- la taille de la pupille dépend aussi de la lumière ;
- sur 109 images codées, les émotions mêlées sont les plus fréquentes (35 %), devant l'intérêt (26 %), le contentement (21 %), la peur (15 %), la colère (2 %) et la joie (1 %).

Ellis 2018 (WF) ajoute qu'un chat immobile n'est pas forcément détendu, et qu'une toilette rythmique indique un état positif.

### 3.2 Queue dressée

- La queue dressée est un signal d'intention amicale. Elle est plus fréquente chez les chats de rang bas et se dirige vers ceux de rang plus élevé. Les chatons l'utilisent pour saluer leur mère (Cafazzo & Natoli 2009, R).
- Elle accompagne l'accueil d'un congénère familier ou du propriétaire, avec des frottements du flanc et de la tête (Turner 2021, TI).

### 3.3 Clignement lent

- Humphrey et al. 2020 (TI) décrivent la séquence : une série de demi-clignements, puis un rétrécissement prolongé de l'œil ou une fermeture complète.
  - Le stimulus humain fermait les yeux plus de 0,5 s.
  - Un rétrécissement était codé s'il durait au moins 2 images vidéo, soit 0,08 s.
- Expérience 1 (18 chats analysés, essais de 62,75 s en moyenne) : le taux de rétrécissement de l'œil est de 0,06 par seconde après un clignement lent du propriétaire, contre 0,03 sans interaction.
- Expérience 2 (18 chats analysés, essais d'1 min, avec une personne inconnue) :
  - 5,33 demi-clignements contre 1,94 ;
  - 2,78 rétrécissements contre 0,33 ;
  - les chats s'approchent plus souvent de la main tendue après un clignement lent.

**Divergence sur le demi-clignement.** Bennett et al. 2017 (R) associent le clignement et le demi-clignement à la peur, chez 29 chats de refuge filmés en extraits de 4 s. Humphrey 2020 (TI) en fait au contraire un élément d'une séquence de communication positive. Le contexte (refuge contre domicile, stimulus menaçant ou non) explique probablement l'écart ; cette explication n'est pas vérifiée.

### 3.4 Moustaches : une lacune

Aucune source scientifique lue ne décrit la position des moustaches dans les états de détente, d'intérêt ou de peur. La seule description mesurée est celle de l'échelle de grimace féline : moustaches tendues et dirigées vers l'avant en cas de douleur (Evangelista et al. 2019, TI).

**Divergence.** La lecture courante, « moustaches en avant = intérêt », ne s'appuie sur aucune source lue. Elle s'oppose à la lecture « moustaches en avant et tendues = douleur » de l'échelle de grimace. Martvel et al. 2024 (R) étudient les signaux faciaux codés en CatFACS, mais leur résumé ne parle que des oreilles et du mimétisme facial rapide.

## 4. Réactions au contact humain

### 4.1 Approche

- Les chats préfèrent les humains qui ne les approchent pas pendant qu'ils se reposent, qui ne les suivent pas, qui se mettent à leur hauteur et qui leur parlent (Mertens & Turner 1988, C, cités par Haywood 2021, TI).
- Pendant les 5 premières minutes, les chats n'ont aucune préférence d'approche selon le genre ou l'âge de la personne. Les enfants qui s'approchent, surtout les garçons, font fuir les chats (Mertens & Turner 1988, C, cités par Turner 2021, TI).
- C'est le chat qui détermine la durée de l'interaction. Plus la part de ses initiatives acceptées est grande, plus le temps total d'interaction est long (Turner 1991, 158 foyers, C, cité par Turner 2021, TI).
- Les épisodes de proximité lancés par le chat durent plus longtemps (Mertens, C, cité par Turner 2021, TI).
- Les chats âgés produisent des chaînes d'interaction plus courtes (Wedl 2011, C, cité par Turner 2021, TI).

### 4.2 Zones de caresse

| Zone | Réaction | Source |
|---|---|---|
| Région temporale (entre les yeux et les oreilles), base des oreilles, joues | réponses positives ; zones recommandées | Soennichsen & Chamove 2002 (C, cités par Haywood 2021) ; consignes « CAT » de Haywood 2021 (TI) |
| Menton | « parfois » acceptable | Haywood 2021 (TI) |
| Tête en général | zone préférée ; le chat ajuste sa posture et ferme les yeux | Bernstein & Friedmann 2014 (C), cités par Turner 2021 (TI) |
| Région périorale, flancs, dos, ventre | réaction variable selon l'individu | Soennichsen & Chamove 2002 (C, cités par Haywood 2021) |
| Dos, flancs, pattes, queue | prudence | Haywood 2021 (TI) |
| Région caudale (base de la queue) | réponses négatives ; à éviter | Soennichsen & Chamove 2002 (C) ; Haywood 2021 (TI) ; Ellis et al. 2015 (R) |
| Ventre | à éviter | Haywood 2021 (TI) |

Ellis et al. 2015 (R), sur des chats manipulés par leur propriétaire ou par une personne inconnue :
- La manipulation par une personne familière donne un score négatif plus élevé (8,5 contre 5,0, p = 0,001).
- La région caudale donne un score négatif de 2,0, contre 0,0 à 1,0 pour les autres régions avec une personne inconnue (p = 0,046). Avec une personne familière, le score est de 2,0 contre 1,0 (p = 0,002).
- L'ordre de passage des régions n'a pas d'effet.

### 4.3 Durée avant irritation : aucune mesure disponible

- Aucune source lue ne mesure une durée moyenne de caresse avant irritation.
- La consigne la plus précise est un avis d'experts et non une mesure : faire une pause toutes les 3 à 5 secondes pour « vérifier » le chat (Haywood et al. 2021, TI, consignes « CAT »).
- L'étude de Haywood 2021 (TI) ne mesure pas de seuil de durée. Elle porte sur 100 chats de refuge (âge moyen 6,1 ans, écart-type 4,3), 120 participants et 535 observations de 5 minutes.
- En condition témoin, le contact physique est plus long, et 27 % des chats montrent des comportements agonistiques. En condition « CAT », ils ne sont plus que 16 %. Les auteurs en concluent que « moins, c'est mieux ».
- En condition « CAT », les chats montrent davantage de queue qui ondule, d'oreilles neutres ou en avant, de pétrissage et de frottements (Haywood 2021, TI).
- Le « petting and biting syndrome », où le chat mord pendant les caresses, est décrit par Bradshaw 1992 (C, via Wikipedia, non vérifié).
- Près de 50 % des propriétaires brésiliens interrogés rapportent de l'agression de leur chat, surtout pendant les caresses ou le jeu (Ramos & Mills 2009, C, cités par Haywood 2021, TI).
- Les chats qui « tolèrent » les caresses ont un cortisol fécal plus élevé (Ramos 2013, C, cité par Haywood 2021, TI).

### 4.4 Signaux à surveiller pendant une caresse (Haywood et al. 2021, TI)

**Signaux de confort :**
- le chat se frotte contre la main ;
- il ronronne ;
- il pétrit ;
- sa queue ondule doucement ;
- ses oreilles sont neutres ou en avant ;
- ses yeux se ferment (aussi chez Turner 2021, TI).

**Signaux qui demandent une pause ou l'arrêt :**
- tête tournée ou éloignement ;
- oreilles aplaties ou tournées vers l'arrière ;
- secouement de tête ;
- peau du dos qui ondule ;
- léchage du nez ;
- immobilité soudaine, avec arrêt du ronronnement ou des frottements ;
- tête tournée brusquement vers la main ;
- toilette brève, de quelques secondes ;
- queue qui fouette, souvent tenue horizontale ou basse.

## 5. Séquences typiques et fréquences

| Comportement | Ce que disent les sources | Statut |
|---|---|---|
| Sommeil et repos | 50 % du budget-temps chez 11 chats confinés (Eckstein & Hart 2000, R). Plus de la moitié des chats dormiraient 12 à 18 h par jour (Izawa 1983, via Wikipedia). Le temps de repos et de sommeil augmente avec l'âge, r = 0,45, sur 61 chats (Yamazaki 2020, TI), sans heures absolues dans le texte. | les 12-18 h sont non vérifiées |
| Toilette (« groom ») | 4 % du temps total, soit 8 % du temps hors sommeil et repos. 91 % des épisodes touchent plusieurs régions du corps. Ordre plutôt de la tête vers la queue (céphalo-caudal). La toilette suit souvent le sommeil. La toilette par grattage avec une patte arrière représente environ 1/50 de la toilette orale. (Eckstein & Hart 2000, R) | résumé seulement |
| Toilette brève pendant un contact | signal de conflit ou de pause, quelques secondes (Haywood 2021, TI) ; une toilette rythmique indique au contraire un état positif (Ellis 2018, WF) | lu |
| Étirement et bâillement | rangés dans les comportements de contentement (Nicholson 2021, TI) ; l'étirement est une posture de détente selon l'éthogramme du UK Cat Behaviour Working Group 1995 (via Wikipedia) | aucune fréquence ni durée trouvée |
| Réveil | la toilette suit souvent le sommeil (Eckstein & Hart 2000, R) | aucune séquence « réveil, étirement, toilette » chiffrée n'a été trouvée |
| Roulade sur le dos | contexte de jeu, d'affiliation ou d'apaisement (Gajdoš Kmecová 2021, TI) ; rangée dans le contentement (Nicholson 2021, TI) ; réponse « ventre en l'air » au bond d'un partenaire de jeu (Gajdoš Kmecová 2021, TI) | aucune fréquence trouvée |
| S'asseoir, se coucher | « assis » et « couché en boule » rangés dans le contentement (Nicholson 2021, TI) ; « pattes étendues » chez le chat détendu (Rodan 2024, TI) | aucune fréquence ni transition chiffrée |
| Pétrissage | signal positif pendant une caresse (Haywood 2021, TI ; Nicholson 2021, TI) | aucune fréquence |
| Salut queue dressée et frottement | à l'arrivée du propriétaire ou d'un congénère familier (Turner 2021, TI ; Cafazzo & Natoli 2009, R) | aucune fréquence |

Delgado & Hecht 2019 (R) ont fait une revue sur le jeu du chat. Leur résumé chiffre 46 publications, 138 comportements et 84 libellés uniques, ce qui montre que les définitions ne sont pas homogènes d'une étude à l'autre. Les fréquences ci-dessus ne sont donc pas directement comparables entre elles. L'extension de ce constat aux comportements autres que le jeu est une déduction non vérifiée.

## 6. Divergences entre sources (récapitulatif)

1. **Fenêtre de socialisation à l'humain** :
   - 2 à 7 semaines (Karsh, via Turner 2021) ;
   - 2 à 9 semaines (Vernick 2025) ;
   - 2-3 à 9-10 semaines (Quimby 2021) ;
   - 3 à 9 semaines (Wikipedia, non vérifié).
2. **Pic du jeu social** : 9 à 14 semaines (Mendoza & Ramirez) ; environ 12 semaines (Quimby) ; 3e-4e mois (Crowell-Davis, via Wikipedia).
3. **Demi-clignement** : signe de peur pour Bennett 2017, élément d'une communication positive pour Humphrey 2020.
4. **Moustaches en avant** : intérêt selon la lecture courante, qui n'a aucune source lue ; douleur selon l'échelle de grimace (Evangelista 2019).
5. **Part de la toilette** : Eckstein & Hart 2000 donnent 8 % du temps hors sommeil et repos. Wikipedia (« Cat behavior ») écrit « 8 % du temps de repos », ce qui est une mauvaise lecture du résumé.
6. **Effet de la familiarité de la personne** : Ellis 2015 trouve plus de réactions négatives avec une personne familière. Les consignes générales (Haywood 2021, Turner 2021) ne distinguent pas la personne familière de l'inconnue. Ellis 2015 n'a été lu qu'en résumé.

## 7. Implications pour l'animation (déductions, non vérifiées)

Ces propositions découlent des sections 1 à 5. Elles ne sont pas des résultats publiés, et le rapport ne vérifie pas ce que font aujourd'hui les fonctions de `tools/anim_cat.py`.

- **Pétrissage (`paddle`, si c'est bien sa fonction)** : à placer dans un contexte détendu, c'est-à-dire chat couché ou assis, yeux mi-clos, oreilles en avant (Haywood 2021 ; Nicholson 2021).
- **Toilette (`groom`)** :
  - commencer par la tête, puis descendre vers l'arrière du corps, en touchant plusieurs régions ;
  - un enchaînement « réveil puis toilette » est plausible (Eckstein & Hart 2000) ;
  - un épisode de toilette de quelques secondes au milieu d'une caresse se lirait comme un signal de gêne (Haywood 2021).
- **Marche (`walk_pose`)** : un jeune adulte qui vient saluer porte la queue dressée, éventuellement un peu courbée au bout (Cafazzo & Natoli 2009 ; Nicholson 2021).
- **Roulade (`rolled`)** :
  - à placer en contexte de jeu ou de détente, avec des oreilles en avant ou neutres et des pupilles non dilatées ;
  - une roulade ne doit pas inviter à caresser le ventre, zone à éviter (Haywood 2021).
- **Inclinaison de la tête (`_tilt`)** : aucune source lue ne décrit l'inclinaison latérale de la tête du chat. Elle n'est ni confirmée ni infirmée.
- **Réaction aux caresses** :
  - zones positives : tête, joues, base des oreilles ;
  - zone négative : la base de la queue ;
  - pour un signal de gêne crédible : oreilles qui tournent vers l'arrière, peau du dos qui ondule, queue qui fouette, tête tournée vers la main (Haywood 2021).
- **Durée des caresses** : aucune valeur n'est sourcée. Si une durée est nécessaire, la consigne de pause toutes les 3 à 5 s (Haywood 2021) peut servir de rythme, mais ce n'est pas une mesure de seuil d'irritation.
- **Moustaches** : aucune référence ne fixe leur position au repos. Il vaut mieux éviter des moustaches très tendues vers l'avant, que l'échelle de grimace associe à la douleur.

## Non observé / non vérifié

- **Étapes physiques du chaton** (ouverture des yeux, sevrage, dentition, maturité sexuelle, taille adulte) : seulement Wikipedia, non vérifié par une source primaire.
- **12 à 18 h de sommeil par jour** (Izawa 1983) : connu par Wikipedia seulement, non lu.
- **Moustaches hors douleur** : aucune description sourcée.
- **Durée avant irritation pendant les caresses** : aucune mesure trouvée. Seule existe la consigne de pause toutes les 3-5 s, issue d'avis d'experts.
- **Fréquences et durées** de l'étirement, du bâillement, de la roulade, des transitions assis-couché et de la séquence de réveil : non trouvées.
- **Inclinaison latérale de la tête** : aucune source lue.
- **Sources lues en résumé seulement (R)** : Ellis et al. 2015, Eckstein & Hart 2000, Cafazzo & Natoli 2009, Bennett et al. 2017, Delgado & Hecht 2019, Martvel et al. 2024, Rodan et al. 2011 et Rodan et al. 2022. Le détail de leurs méthodes n'est pas vérifié.
- **Sources connues seulement par citation (C)** : Soennichsen & Chamove 2002, Mertens & Turner 1988, Turner 1991, Bernstein & Friedmann 2014, Lowe & Bradshaw 2002, Karsh, West, Mendoza & Ramirez, Barrett & Bateson, Ramos & Mills 2009, Ramos 2013, Wedl 2011, Schaer, Bradshaw 1992, Crowell-Davis 2005 et Izawa 1983.
- **Sources lues par WebFetch (WF)** : Quimby 2021 et Ellis 2018. L'outil restitue un extrait reformulé, pas le texte brut.
- **Recherche Semantic Scholar** de la seconde série : interrompue par l'erreur 429. Elle portait sur CatFACS, les moustaches, la roulade sociale, le sommeil, l'agression liée aux caresses et l'étirement, et n'a apporté aucune source.
- **Les fonctions de `tools/anim_cat.py`** n'ont été repérées que par leur nom. Leur comportement actuel n'a pas été lu, et les déductions de la section 7 ne sont pas confrontées au code.

## Sources

Statut de lecture : TI = texte intégral lu ; WF = lu par WebFetch, extrait reformulé ; R = résumé seulement ; C = cité par une autre source.

- **Bennett V, Gourkow N, Mills DS (2017).** Facial correlates of emotional behaviour in the domestic cat (Felis catus). Behavioural Processes 141:342-350. doi:10.1016/j.beproc.2017.03.011. Statut : R.
- **Cafazzo S, Natoli E (2009).** The social function of tail up in the domestic cat (Felis silvestris catus). Behavioural Processes 80:60-66. doi:10.1016/j.beproc.2008.09.008. Statut : R.
- **Delgado M, Hecht J (2019).** A review of the development and functions of cat play, with future research considerations. Applied Animal Behaviour Science 214:1-17. doi:10.1016/j.applanim.2019.03.004. Statut : R, via Semantic Scholar. Le titre a été vérifié dans les bibliographies de Vernick 2025, de Nicholson 2021 et de Gajdoš Kmecová 2021 ; le chiffrage « 46 publications, 138 comportements, 84 libellés » vient du résumé lu.
- **Eckstein RA, Hart BL (2000).** The organization and control of grooming in cats. Applied Animal Behaviour Science 68:131-140. doi:10.1016/S0168-1591(00)00094-0. Statut : R.
- **Ellis SLH (2018).** Recognising and assessing feline emotions during the consultation: history, body language and behaviour. Journal of Feline Medicine and Surgery 20(5):445-456. doi:10.1177/1098612X18771206 (PMC11395287). Statut : WF.
- **Ellis SLH, Thompson H, Guijarro C, Zulch HE (2015).** The influence of body region, handler familiarity and order of region handled on the domestic cat's response to being stroked. Applied Animal Behaviour Science 173:60-67. doi:10.1016/j.applanim.2014.11.002. Statut : R, via Semantic Scholar ; texte intégral sous embargo ou refusé (403).
- **Ellis SLH, Rodan I, Carney HC et al. (2013).** AAFP and ISFM feline environmental needs guidelines. Journal of Feline Medicine and Surgery 15:219-230. doi:10.1177/1098612X13477537. Statut : R ; le texte intégral a renvoyé l'erreur 500.
- **Evangelista MC, Watanabe R, Leung VSY et al. (2019).** Facial expressions of pain in cats: the development and validation of a Feline Grimace Scale. Scientific Reports 9:19128. doi:10.1038/s41598-019-55693-8 (PMC6911058). Statut : TI. L'étude porte sur 35 chats douloureux et 20 témoins, avec un seuil d'analgésie supérieur à 0,39 sur 1.
- **Gajdoš Kmecová N, Peťková B, Kottferová J, Skurková L, Mills DS (2021).** Are these cats playing? A closer look at social play in cats and proposal for a psychobiological approach and standard terminology. Frontiers in Veterinary Science 8:712310. doi:10.3389/fvets.2021.712310 (PMC8343019). Statut : TI.
- **Haywood C, Ripari L, Puzzo J, Foreman-Worsley R, Finka LR (2021).** Providing humans with practical, best practice handling guidelines during human-cat interactions increases cats' affiliative behaviour and reduces aggression and signs of conflict. Frontiers in Veterinary Science 8:714143. doi:10.3389/fvets.2021.714143 (PMC8381768). Statut : TI.
- **Humphrey T, Proops L, Forman J, Spooner R, McComb K (2020).** The role of cat eye narrowing movements in cat-human communication. Scientific Reports 10:16503. doi:10.1038/s41598-020-73426-0 (PMC7536207). Statut : TI.
- **Martvel G, Scott L, Florkiewicz B, Zamansky A, Shimshoni I, Lazebnik T (2024).** Computational investigation of the social function of domestic cat facial signals. Scientific Reports 14:27533. doi:10.1038/s41598-024-79216-2. Statut : R.
- **Nicholson SL, O'Carroll RÁ (2021).** Development of an ethogram/guide for identifying feline emotions: a new approach to feline interactions and welfare assessment in practice. Irish Veterinary Journal 74:8. doi:10.1186/s13620-021-00189-z (PMC7995744). Statut : TI.
- **Quimby J, Gowland S, Carney HC, DePorter T, Plummer P, Westropp J (2021).** 2021 AAHA/AAFP Feline Life Stage Guidelines. Journal of Feline Medicine and Surgery 23:211-233. doi:10.1177/1098612X21993657 (PMC10812130). Statut : WF ; le XML Europe PMC n'était pas disponible.
- **Rodan I, Sundahl E, Carney H et al. (2011).** AAFP and ISFM feline-friendly handling guidelines. Journal of Feline Medicine and Surgery 13:364-375. doi:10.1016/j.jfms.2011.03.012. Statut : R ; le texte intégral a renvoyé l'erreur 500.
- **Rodan I, Dowgray N, Carney HC et al. (2022).** 2022 AAFP/ISFM Cat Friendly Veterinary Interaction Guidelines: Approach and Handling Techniques. Journal of Feline Medicine and Surgery 24:1093-1132. doi:10.1177/1098612X221128760. Statut : R ; SAGE a renvoyé 403 et PMC un reCAPTCHA.
- **Rodan I, Ramos D, Carney H, DePorter T, Horwitz DF, Mills D, Vitale K (2024).** 2024 AAFP intercat tension guidelines: recognition, prevention and management. Journal of Feline Medicine and Surgery 26:1098612X241263465. doi:10.1177/1098612X241263465 (PMC11292941). Statut : TI, lu par recherche ciblée (jeu ou combat, affiliation, légendes des figures).
- **Turner DC (2021).** The mechanics of social interactions between cats and their owners. Frontiers in Veterinary Science 8:650143. doi:10.3389/fvets.2021.650143 (PMC8044293). Statut : TI.
- **Vernick J, Martin C, Montelpare W, Dunham AE, Overall KL (2025).** Understanding the influence of early-life stressors on social interaction, telomere length, and hair cortisol concentration in homeless kittens. Animals 15:446. doi:10.3390/ani15030446 (PMC11815723). Statut : TI, lu par recherche ciblée (introduction, tableau 1, tableau des résultats selon l'âge).
- **Yamazaki A, Edamura K, Tanegashima K et al. (2020).** Utility of a novel activity monitor assessing physical activities and sleep quality in cats. PLoS One 15:e0236795. doi:10.1371/journal.pone.0236795 (PMC7394395). Statut : TI. Seul l'élément cité a été relevé : r = 0,45 entre l'âge et le temps de repos, sur 61 chats.
- **Sources citées par les précédentes (C)**, non lues :
  - Soennichsen S, Chamove AS (2002). Anthrozoös 15:258-265. doi:10.2752/089279302786992577.
  - Lowe SE, Bradshaw JWS (2002). Anthrozoös 15:69-79. doi:10.2752/089279302786992702.
  - Mertens & Turner 1988 ; Turner 1991 ; Bernstein & Friedmann 2014 ; Karsh 1983-1988 ; Ramos & Mills 2009 ; Ramos 2013 ; Wedl 2011.
- **Wikipedia, orientation seulement** : articles « Kitten » et « Cat behavior », en.wikipedia.org, consultés le 2026-10-22. Les chiffres qui n'en viennent que sont marqués « non vérifié ».
