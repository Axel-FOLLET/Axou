// -------------------- HTML ELEMENTS --------------------

// We retrieve the skills panel using its id="skills-bubble".
const bubble = document.getElementById("skills-bubble");

// We retrieve each experience using its id.
const sfr = document.getElementById("experience-sfr");
const bpce = document.getElementById("experience-bpce");
const ocp = document.getElementById("experience-ocp");
const natixis = document.getElementById("experience-natixis");
const enedis = document.getElementById("experience-enedis");


// -------------------- SFR SKILLS PANEL --------------------

sfr.addEventListener("click", function() {

    /*
        Adds the "flipped" class if it does not exist.
        If it already exists, toggle removes it.
    */
    sfr.classList.toggle("flipped");

    // We clear the panel before displaying the new skills.
    bubble.textContent = "";

    // We create a <ul> element.
    const liste = document.createElement("ul");

    // Array containing the skills and tools related to this experience.
    const competences = [
        "Project management",
        "Change management",
        "Communication and diplomacy",
        "Training design",
        "CapCut",
        "Caption",
        "edit2Emotions",
        "Performance indicator monitoring",
        "Reporting",
        "Social data analysis"
    ];

    // forEach goes through all the skills.
    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    // We add the complete list to the skills panel.
    bubble.appendChild(liste);

});


// -------------------- BPCE IT SKILLS PANEL --------------------

bpce.addEventListener("click", function() {

    bpce.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "Apprenticeship recruitment campaign management",
        "IT recruitment",
        "Independent working",
        "LinkedIn communication",
        "Dashboards",
        "Reporting",
        "Coordination with educational institutions",
        "Administrative management",
        "Recruitment fairs"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- OCP SKILLS PANEL --------------------

ocp.addEventListener("click", function() {

    ocp.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "Candidate sourcing",
        "SmartRecruiters",
        "APEC",
        "Pôle Emploi",
        "Telephone interviews",
        "Microsoft Teams interviews",
        "Recruitment follow-up",
        "Administrative management",
        "Manager training"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- NATIXIS SKILLS PANEL --------------------

natixis.addEventListener("click", function() {

    natixis.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "First independently managed project",
        "Understanding the testing phase involved in developing a tool",
        "Coordination between the HR and HRIS teams"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- ENEDIS SKILLS PANEL --------------------

enedis.addEventListener("click", function() {

    enedis.classList.toggle("flipped");

    bubble.textContent = "";

    const liste = document.createElement("ul");

    const competences = [
        "First professional experience",
        "Introduction to the Human Resources field"
    ];

    competences.forEach(function(competence) {

        const element = document.createElement("li");

        element.textContent = competence;

        liste.appendChild(element);

    });

    bubble.appendChild(liste);

});


// -------------------- IT CAREER CHANGE SKILLS --------------------

// We retrieve all buttons with the "skill" class.
const skills = document.querySelectorAll(".skill");

/*
    We retrieve the panel that will display
    the explanation of the selected skill.
*/
const skillDescription = document.getElementById("skill-description");


// -------------------- CLICK ON A SKILL --------------------

skills.forEach(function(skill) {

    // For each button, we listen for a click.
    skill.addEventListener("click", function() {

        // We retrieve the data-skill value from the HTML.
        const selectedSkill = skill.dataset.skill;

        /*
            Depending on the selected skill,
            we display a different explanation.

            if - else if works like
            if - elif in Python.
        */
        if (selectedSkill === "python") {

            skillDescription.textContent =
                "Python is an interpreted, versatile and cross-platform programming language. It can be used to develop applications, automate tasks and work on many different types of software projects.";

        } else if (selectedSkill === "html") {

            skillDescription.textContent =
                "HTML is the standard markup language used to structure the content of a web page. It defines elements such as headings, paragraphs, links, images, forms and the different sections of a page.";

        } else if (selectedSkill === "css") {

            skillDescription.textContent =
                "CSS is a style sheet language used to define the appearance of an HTML document. It can be used to manage layouts, colors, sizes, animations and responsive design for different screen sizes.";

        } else if (selectedSkill === "javascript") {

            skillDescription.textContent =
                "JavaScript is a programming language mainly used to make web pages interactive. It can react to user actions, dynamically modify a page and create more advanced behaviors.";

        } else if (selectedSkill === "git") {

            skillDescription.textContent =
                "Git is a distributed version control system. It allows developers to track changes to a project, manage different versions of the code and make collaborative work easier.";

        }

    });

});


// -------------------- 3D CUBES --------------------

// We retrieve all the cubes present in the HTML.
const cubeTriggers = document.querySelectorAll(".cube-trigger");


/*
    Array containing the names of the six faces.
    JavaScript will automatically create each face.
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
    This array will contain the information
    required to animate each cube.
*/
const cubeStates = [];


/*
    Duration of the effect after a click.

    4 seconds allow the cube to spin more
    without making the movement too fast.
*/
const clickDuration = 4;


/*
    Additional speed triggered by a click.

    It is strong enough for the interaction
    to remain clearly visible.
*/
const clickExtraSpeed = 70;


cubeTriggers.forEach(function(cubeTrigger, index) {

    // We create the main 3D object.
    const cubeObject = document.createElement("span");

    cubeObject.classList.add("cube-object");


    /*
        We create the six faces of the cube.
        Each face receives a different class.
    */
    cubeFaceNames.forEach(function(faceName) {

        const face = document.createElement("span");

        face.classList.add(
            "cube-face",
            "cube-" + faceName
        );

        cubeObject.appendChild(face);

    });


    // We add the completed cube inside its button.
    cubeTrigger.appendChild(cubeObject);


    /*
        data-speed defines the normal speed of the cube.

        data-phase allows the different cubes
        to start from different positions.
    */
    const baseSpeed =
        Number(cubeTrigger.dataset.speed) || 16;

    const phase =
        Number(cubeTrigger.dataset.phase) || index * 30;


    /*
        Each cube has its own state:
        its angles, normal speed
        and remaining click animation time.
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


    // -------------------- CLICK ON A CUBE --------------------

    cubeTrigger.addEventListener("click", function() {

        /*
            A click triggers 4 seconds
            of additional rotation.

            If the cube is clicked again during the effect,
            the 4 seconds restart.
        */
        cubeState.clickTimeRemaining = clickDuration;

    });

});


// -------------------- CONTINUOUS CUBE ANIMATION --------------------

let previousTime = performance.now();


function animateCubes(currentTime) {

    /*
        deltaTime represents the time elapsed
        since the previous frame.

        We limit its value to avoid a large jump
        if the browser tab has been left in the background.
    */
    const deltaTime = Math.min(
        (currentTime - previousTime) / 1000,
        0.05
    );

    previousTime = currentTime;


    cubeStates.forEach(function(cubeState) {

        let clickIntensity = 0;


        /*
            If the cube has just been clicked,
            the intensity starts at 1 and then
            gradually decreases to 0.

            The acceleration therefore fades smoothly.
        */
        if (cubeState.clickTimeRemaining > 0) {

            cubeState.clickTimeRemaining -= deltaTime;

            const remainingRatio =
                Math.max(
                    cubeState.clickTimeRemaining / clickDuration,
                    0
                );


            /*
                Math.sin provides a smoother decrease
                than an abrupt change in speed.
            */
            clickIntensity =
                Math.sin(
                    remainingRatio * Math.PI / 2
                );

        }


        /*
            At rest:
            extraSpeed is equal to 0.

            After a click:
            extraSpeed can rise up to 70,
            then gradually decreases.
        */
        const extraSpeed =
            clickExtraSpeed * clickIntensity;


        /*
            The click accelerates all three axes.

            The Y axis provides the main rotation,
            while X and Z create the spinning
            effect in three-dimensional space.
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
            Only one transformation is applied.

            This prevents two different animations
            from visually separating from each other.
        */
        cubeState.cubeObject.style.transform =
            "rotateX(" + cubeState.rotationX + "deg) "
            + "rotateY(" + cubeState.rotationY + "deg) "
            + "rotateZ(" + cubeState.rotationZ + "deg)";

    });


    // The browser prepares the next frame.
    requestAnimationFrame(animateCubes);

}


// We start the animation only once.
requestAnimationFrame(animateCubes);