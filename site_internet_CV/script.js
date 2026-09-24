// -------------------- RÉCUPÉRATION DES ÉLÉMENTS HTML --------------------

// On récupère la bulle grâce à son id="skills-bubble".
const bubble = document.getElementById("skills-bubble");

// On récupère chaque expérience grâce à son id.
const sfr = document.getElementById("experience-sfr");
const bpce = document.getElementById("experience-bpce");
const ocp = document.getElementById("experience-ocp");
const natixis = document.getElementById("experience-natixis");
const enedis = document.getElementById("experience-enedis");


// -------------------- BULLE SFR --------------------

sfr.addEventListener("click", function() {

    /*
        Ajoute la classe "flipped" si elle n'existe pas.
        Si elle existe déjà, toggle l'enlève.
    */
    sfr.classList.toggle("flipped");

    // On vide la bulle avant d'afficher les nouvelles compétences.
    bubble.textContent = "";

    // On crée une balise <ul>.
    const liste = document.createElement("ul");

    // Tableau contenant les compétences et outils de l'expérience.
    const competences = [
        "Gestion de projets",
        "Conduite du changement",
        "Communication et diplomatie",
        "Conception de formations",
        "CapCut",
        "Caption",
        "edit2Emotions",
        "Suivi d'indicateurs",
        "Reporting",
        "Analyse de données sociales"
    ];

    // forEach parcourt toutes les compétences.
    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    // On ajoute la liste complète dans la bulle.
    bubble.appendChild(liste);

});


// -------------------- BULLE BPCE IT --------------------

bpce.addEventListener("click", function() {

    bpce.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "Gestion de campagne d’alternance",
        "Recrutement IT",
        "Travail en autonomie",
        "Communication LinkedIn",
        "Tableaux de bord",
        "Reporting",
        "Coordination avec les écoles",
        "Gestion administrative",
        "Forums recrutement"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- BULLE OCP --------------------

ocp.addEventListener("click", function() {

    ocp.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "Sourcing",
        "SmartRecruiters",
        "APEC",
        "Pôle Emploi",
        "Entretiens téléphoniques",
        "Entretiens Microsoft Teams",
        "Suivi des recrutements",
        "Gestion administrative",
        "Formation des managers"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- BULLE NATIXIS --------------------

natixis.addEventListener("click", function() {

    natixis.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "Premier projet géré en autonomie",
        "Compréhension d'une phase test dans la création d'un outil",
        "Lien entre l'équipe RH et SIRH"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- BULLE ENEDIS --------------------

enedis.addEventListener("click", function() {

    enedis.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "Première expérience professionnelle",
        "Insertion au domaine RH"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- COMPÉTENCES RECONVERSION --------------------

// On récupère tous les boutons qui possèdent la classe "skill".
const skills = document.querySelectorAll(".skill");

/*
    On récupère la bulle qui affichera
    l'explication de la compétence sélectionnée.
*/
const skillDescription = document.getElementById("skill-description");


// -------------------- CLIC SUR UNE COMPÉTENCE --------------------

skills.forEach(function(skill) {

    // Pour chaque bouton, on écoute le clic.
    skill.addEventListener("click", function() {

        // On récupère la valeur de data-skill présente dans le HTML.
        const selectedSkill = skill.dataset.skill;

        /*
            Selon la compétence sélectionnée,
            on affiche une explication différente.

            if - else if fonctionne comme
            if - elif sur Python.
        */
        if (selectedSkill === "python") {

            skillDescription.textContent =
                "Python est un langage de programmation interprété, polyvalent et multiplateforme. Il permet de développer des applications, d'automatiser des tâches et de travailler sur différents types de projets logiciels.";

        } else if (selectedSkill === "html") {

            skillDescription.textContent =
                "HTML est le langage de balisage standard utilisé pour structurer le contenu d'une page web. Il définit notamment les titres, paragraphes, liens, images, formulaires et différentes sections d'une page.";

        } else if (selectedSkill === "css") {

            skillDescription.textContent =
                "CSS est un langage de feuille de style utilisé pour définir l'apparence d'un document HTML. Il permet de gérer la mise en page, les couleurs, les tailles, les animations et l'adaptation aux différents écrans.";

        } else if (selectedSkill === "javascript") {

            skillDescription.textContent =
                "JavaScript est un langage de programmation principalement utilisé pour rendre les pages web interactives. Il permet de réagir aux actions de l'utilisateur, de modifier la page dynamiquement et de créer des comportements avancés.";

        } else if (selectedSkill === "git") {

            skillDescription.textContent =
                "Git est un logiciel de gestion de versions décentralisé. Il permet de suivre les modifications d'un projet, de gérer plusieurs versions du code et de faciliter le travail collaboratif.";

        }

    });

});


// -------------------- CUBES 3D --------------------

// On récupère tous les cubes présents dans le HTML.
const cubeTriggers = document.querySelectorAll(".cube-trigger");


/*
    Tableau contenant le nom des six faces.
    JavaScript va créer automatiquement chaque face.
*/
const cubeFaceNames = [
    "front",
    "back",
    "right",
    "left",
    "top",
    "bottom"
];


/*
    Ce tableau contiendra les informations
    nécessaires pour animer chaque cube.
*/
const cubeStates = [];


/*
    Durée de l'effet après un clic.

    7 secondes permettent au cube de tourner davantage
    sans avoir une rotation trop rapide.
*/
const clickDuration = 4;


/*
    Vitesse supplémentaire provoquée par le clic.

    Elle est suffisamment importante pour que
    l'interaction soit clairement visible.
*/
const clickExtraSpeed = 70;


cubeTriggers.forEach(function(cubeTrigger, index) {

    // On crée l'objet 3D principal.
    const cubeObject = document.createElement("span");

    cubeObject.classList.add("cube-object");


    /*
        On crée les six faces du cube.
        Chaque face reçoit une classe différente.
    */
    cubeFaceNames.forEach(function(faceName) {

        const face = document.createElement("span");

        face.classList.add(
            "cube-face",
            "cube-" + faceName
        );

        cubeObject.appendChild(face);

    });


    // On ajoute le cube terminé dans son bouton.
    cubeTrigger.appendChild(cubeObject);


    /*
        data-speed définit la vitesse normale du cube.

        data-phase permet aux différents cubes
        de commencer dans des positions différentes.
    */
    const baseSpeed =
        Number(cubeTrigger.dataset.speed) || 16;

    const phase =
        Number(cubeTrigger.dataset.phase) || index * 30;


    /*
        Chaque cube possède son propre état :
        ses angles, sa vitesse normale
        et le temps restant après un clic.
    */
    const cubeState = {

        cubeObject: cubeObject,

        rotationX: -18 + phase * 0.05,
        rotationY: phase,
        rotationZ: phase * 0.12,

        baseSpeed: baseSpeed,

        clickTimeRemaining: 0

    };


    cubeStates.push(cubeState);


    // -------------------- CLIC SUR LE CUBE --------------------

    cubeTrigger.addEventListener("click", function() {

        /*
            Au clic, on déclenche 7 secondes
            de rotation supplémentaire.

            Si on reclique pendant l'effet,
            les 7 secondes recommencent.
        */
        cubeState.clickTimeRemaining = clickDuration;

    });

});


// -------------------- ANIMATION CONTINUE DES CUBES --------------------

let previousTime = performance.now();


function animateCubes(currentTime) {

    /*
        deltaTime représente le temps écoulé
        depuis l'image précédente.

        On limite sa valeur pour éviter un grand saut
        si l'onglet est laissé en arrière-plan.
    */
    const deltaTime = Math.min(
        (currentTime - previousTime) / 1000,
        0.05
    );

    previousTime = currentTime;


    cubeStates.forEach(function(cubeState) {

        let clickIntensity = 0;


        /*
            Si le cube vient d'être cliqué,
            l'intensité commence à 1 puis diminue
            progressivement jusqu'à 0.

            L'accélération disparaît donc doucement.
        */
        if (cubeState.clickTimeRemaining > 0) {

            cubeState.clickTimeRemaining -= deltaTime;

            const remainingRatio =
                Math.max(
                    cubeState.clickTimeRemaining / clickDuration,
                    0
                );


            /*
                Math.sin permet d'obtenir une diminution
                plus douce qu'une baisse brutale.
            */
            clickIntensity =
                Math.sin(
                    remainingRatio * Math.PI / 2
                );

        }


        /*
            Au repos :
            extraSpeed vaut 0.

            Après un clic :
            extraSpeed peut monter jusqu'à 70,
            puis redescend progressivement.
        */
        const extraSpeed =
            clickExtraSpeed * clickIntensity;


        /*
            Le clic accélère les trois axes.

            L'axe Y tourne davantage,
            tandis que X et Z ajoutent l'effet
            de tournoiement en profondeur.
        */
        cubeState.rotationX +=
            (
                cubeState.baseSpeed * 0.28
                + extraSpeed * 1.85
            )
            * deltaTime;


        cubeState.rotationY +=
            (
                cubeState.baseSpeed
                + extraSpeed
            )
            * deltaTime;


        cubeState.rotationZ +=
            (
                cubeState.baseSpeed * 0.08
                + extraSpeed * 1.55
            )
            * deltaTime;


        /*
            Une seule transformation est appliquée.

            Il n'y a donc pas deux animations
            qui tournent l'une sur l'autre.
        */
        cubeState.cubeObject.style.transform =
            "rotateX(" + cubeState.rotationX + "deg) "
            + "rotateY(" + cubeState.rotationY + "deg) "
            + "rotateZ(" + cubeState.rotationZ + "deg)";

    });


    // Le navigateur prépare l'image suivante.
    requestAnimationFrame(animateCubes);

}


// On lance l'animation une seule fois.
requestAnimationFrame(animateCubes);