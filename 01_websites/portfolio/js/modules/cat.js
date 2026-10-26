/*
 * Chat de la carte Cat Game : un modèle 3D « low poly » vu de face, qui ne tourne pas tout seul.
 * On peut le faire tourner au doigt ou à la souris comme les cubes ; au lâcher, il revient doucement face à nous.
 * Chaque facette est un polygone SVG, plus clair quand elle est tournée vers la lumière.
 */
import { enableCubeDrag } from "./cubes/drag-cube.js";

const SVG = "http://www.w3.org/2000/svg";

/*
 * Lumière venant du haut à gauche, devant le chat (vecteur unitaire).
 */
const LIGHT = unit([-0.4, -0.55, 0.75]);

/*
 * Au lâcher, l'écart avec la vue de face est divisé par e toutes les 1 / RETURN_RATE secondes.
 */
const RETURN_RATE = 6;


/*
 * Petits calculs sur les vecteurs [x, y, z].
 */
function add(a, b) {
    return a.map((value, index) => value + b[index]);
}

function subtract(a, b) {
    return a.map((value, index) => value - b[index]);
}

function scale(a, factor) {
    return a.map(value => value * factor);
}

function dot(a, b) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit(a) {
    return scale(a, 1 / (Math.hypot(...a) || 1));
}

function average(points) {
    return scale(points.reduce(add), 1 / points.length);
}


/*
 * Normale d'un polygone (méthode de Newell, valable au-delà de 3 points), de longueur 1.
 */
function normalOf(corners) {
    const normal = [0, 0, 0];
    corners.forEach(([x1, y1, z1], index) => {
        const [x2, y2, z2] = corners[(index + 1) % corners.length];
        normal[0] += (y1 - y2) * (z1 + z2);
        normal[1] += (z1 - z2) * (x1 + x2);
        normal[2] += (x1 - x2) * (y1 + y2);
    });
    return unit(normal);
}


/*
 * Une facette et sa normale, tournée vers l'extérieur : à l'opposé du point inside, pris dans le volume.
 */
function facet(corners, inside) {
    const normal = normalOf(corners);
    return { corners, normal: dot(normal, subtract(average(corners), inside)) < 0 ? scale(normal, -1) : normal };
}


/*
 * Volume fermé fait d'anneaux de points empilés : chaque paire d'anneaux est reliée par des triangles.
 * Un anneau d'un seul point fait une pointe ; sinon les deux bouts sont fermés par un éventail.
 */
function ringMesh(rings) {
    const faces = [];
    const cap = (ring, next) => {
        if (ring.points.length < 2) return;
        const inside = average([ring.center, next.center]);
        ring.points.forEach((point, index) => {
            faces.push(facet([ring.center, point, ring.points[(index + 1) % ring.points.length]], inside));
        });
    };
    cap(rings[0], rings[1]);
    for (let r = 0; r + 1 < rings.length; r++) {
        const a = rings[r].points, b = rings[r + 1].points;
        const inside = average([rings[r].center, rings[r + 1].center]);
        if (a.length === 1) {
            b.forEach((point, index) => faces.push(facet([a[0], point, b[(index + 1) % b.length]], inside)));
        } else if (b.length === 1) {
            a.forEach((point, index) => faces.push(facet([point, a[(index + 1) % a.length], b[0]], inside)));
        } else {
            a.forEach((point, index) => {
                const next = (index + 1) % a.length;
                faces.push(facet([point, a[next], b[next]], inside), facet([point, b[next], b[index]], inside));
            });
        }
    }
    cap(rings.at(-1), rings.at(-2));
    return faces;
}


/*
 * Anneaux d'un volume tourné autour d'un axe vertical (x, z) : chaque ligne du profil vaut [y, rx, rz, dz].
 * rx et rz sont les demi-largeurs de l'anneau, dz l'avance de son centre ; rx = 0 fait une pointe.
 * Un anneau sur deux est décalé d'un demi-pas : les facettes deviennent des triangles en quinconce.
 */
function latheRings([axisX, axisZ], profile, segments) {
    return profile.map(([y, rx, rz, dz = 0], ringIndex) => {
        const center = [axisX, y, axisZ + dz];
        if (!rx) return { center, points: [center] };
        const points = Array.from({ length: segments }, (_, index) => {
            const angle = 2 * Math.PI * (index + (ringIndex % 2 ? 0.5 : 0)) / segments;
            return [axisX + rx * Math.sin(angle), y, axisZ + dz + rz * Math.cos(angle)];
        });
        return { center, points };
    });
}

function lathe(axis, profile, segments) {
    return ringMesh(latheRings(axis, profile, segments));
}


/*
 * Ellipsoïde en facettes : rings tranches de haut en bas, segments points par tranche.
 */
function ellipsoid([x, y, z], [rx, ry, rz], rings, segments) {
    const profile = Array.from({ length: rings + 1 }, (_, index) => {
        const angle = Math.PI * index / rings;
        return [y - ry * Math.cos(angle), rx * Math.sin(angle), rz * Math.sin(angle)];
    });
    return lathe([x, z], profile, segments);
}


/*
 * Tube qui suit un chemin de points [x, y, z, rayon] ; un rayon nul fait une pointe (bout de la queue).
 */
function tube(path, segments) {
    return ringMesh(path.map(([x, y, z, radius], ringIndex) => {
        const center = [x, y, z];
        if (!radius) return { center, points: [center] };
        const previous = path[Math.max(ringIndex - 1, 0)].slice(0, 3);
        const next = path[Math.min(ringIndex + 1, path.length - 1)].slice(0, 3);
        const along = unit(subtract(next, previous));
        const side = unit(cross(along, [0, 0, 1]));
        const up = cross(side, along);
        const points = Array.from({ length: segments }, (_, index) => {
            const angle = 2 * Math.PI * (index + (ringIndex % 2 ? 0.5 : 0)) / segments;
            return add(center, add(scale(side, radius * Math.cos(angle)), scale(up, radius * Math.sin(angle))));
        });
        return { center, points };
    }));
}


/*
 * Tête : large aux joues, étroite au sommet et au menton. Le museau n'est pas une forme ajoutée :
 * le sommet avant d'un anneau avance et plie les facettes en pointe.
 */
function head() {
    const rings = latheRings([0, 18], [
        [-222, 0, 0], [-208, 58, 46], [-178, 88, 70], [-138, 110, 82], [-106, 84, 74], [-80, 48, 52], [-64, 0, 0, -6]
    ], 8);
    rings[4].points[0][2] += 30;
    rings[5].points.forEach(point => {
        if (point[2] > 40) point[2] += 12;
    });
    return ringMesh(rings);
}


/*
 * Oreille pointue : une pyramide à base triangulaire, side = −1 à gauche, 1 à droite.
 */
function ear(side) {
    const tip = [92 * side, -268, 4];
    const base = [[28 * side, -205, 30], [98 * side, -168, 18], [55 * side, -192, -12]];
    return ringMesh([{ center: average(base), points: base }, { center: tip, points: [tip] }]);
}


/*
 * Toutes les facettes du chat, en unités d'un dessin de 400 × 534 centré sur l'origine :
 * x vers la droite, y vers le bas, z vers nous. Chat assis : tête, oreilles, corps en poire,
 * cuisses et pattes avant de chaque côté, queue dressée à droite.
 */
export function catFacets() {
    return [
        ...head(),
        ...ear(-1),
        ...ear(1),
        ...lathe([0, 0], [[-70, 55, 50, -10], [-10, 74, 68, -10], [70, 92, 90, -25], [150, 106, 110, -35], [215, 100, 110, -38], [240, 75, 85, -38]], 8),
        ...[-1, 1].flatMap(side => [
            ...ellipsoid([82 * side, 175, -35], [45, 60, 85], 4, 6),
            ...lathe([32 * side, 0], [[70, 30, 30, 30], [150, 24, 26, 58], [218, 26, 30, 72], [238, 22, 26, 78]], 6)
        ]),
        ...tube([[50, 220, -120, 17], [125, 205, -105, 16], [158, 140, -90, 15], [162, 70, -82, 13], [148, 15, -76, 11], [128, -15, -72, 0]], 5)
    ];
}


/*
 * Tourne un point comme rotateX(rx) rotateY(ry) en CSS (angles en degrés, y vers le bas, z vers nous).
 */
function rotate([x, y, z], rx, ry) {
    const a = ry * Math.PI / 180, b = rx * Math.PI / 180;
    const x1 = x * Math.cos(a) + z * Math.sin(a);
    const z1 = -x * Math.sin(a) + z * Math.cos(a);
    return [x1, y * Math.cos(b) - z1 * Math.sin(b), y * Math.sin(b) + z1 * Math.cos(b)];
}


/*
 * Place les facettes pour les angles donnés : coins projetés (vue orthogonale), éclairage et profondeur.
 * away signale une facette tournée à l'opposé de nous : cachée, car le volume est fermé.
 * Les facettes sont triées de l'arrière vers l'avant : les plus proches se dessinent en dernier.
 */
export function placeFacets(facets, rx, ry) {
    return facets.map(item => {
        const corners = item.corners.map(corner => rotate(corner, rx, ry));
        const normal = rotate(item.normal, rx, ry);
        const light = Math.max(0, dot(normal, LIGHT));
        const depth = corners.reduce((sum, corner) => sum + corner[2], 0) / corners.length;
        return { item, points: corners.map(([x, y]) => [x + 200, y + 267]), light, depth, away: normal[2] < -0.02 };
    }).sort((a, b) => a.depth - b.depth);
}


/*
 * Remplit chaque .cat-figure avec le dessin et le rend orientable.
 * Le chat est décoratif : son nom est porté par role="img" et aria-label dans le HTML.
 */
export function initCat() {
    const figures = document.querySelectorAll(".cat-figure");
    if (!figures.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const facets = catFacets();

    figures.forEach(figure => {
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("viewBox", "0 0 400 534");
        svg.setAttribute("aria-hidden", "true");
        const shapes = new Map(facets.map(item => [item, document.createElementNS(SVG, "polygon")]));
        figure.append(svg);

        /*
         * Même état que les cubes, pour réutiliser leur glisser (drag-cube.js) ; ici sans élan ni rotation propre.
         */
        const cat = { rotationX: 0, rotationY: 0, isDragging: false, wasDragged: false, velocityX: 0, velocityY: 0 };

        function render() {
            for (const { item, points, light, away } of placeFacets(facets, cat.rotationX, cat.rotationY)) {
                const shape = shapes.get(item);
                shape.classList.toggle("cat-figure__away", away);
                shape.setAttribute("points", points.map(point => point.map(value => value.toFixed(1)).join(",")).join(" "));
                /*
                 * --light (0 à 1) : la feuille de style en déduit la clarté des facettes.
                 */
                shape.style.setProperty("--light", light.toFixed(2));
                svg.append(shape);
            }
        }

        let frameId = null;
        let previousTime = 0;
        /*
         * Retour vers la vue de face : chaque image réduit les deux angles, jusqu'à les remettre à zéro.
         */
        function comeBack(currentTime) {
            const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
            previousTime = currentTime;
            const keep = Math.exp(-RETURN_RATE * deltaTime);
            cat.rotationX *= keep;
            cat.rotationY *= keep;
            const done = Math.abs(cat.rotationX) < 0.2 && Math.abs(cat.rotationY) < 0.2;
            if (done) cat.rotationX = cat.rotationY = 0;
            render();
            frameId = done ? null : requestAnimationFrame(comeBack);
        }

        function release() {
            if (cat.isDragging || frameId !== null) return;
            /*
             * Ramène l'angle entre −180 et 180 degrés : le chat revient par le chemin le plus court.
             */
            const nearest = angle => angle - 360 * Math.round(angle / 360);
            cat.rotationX = nearest(cat.rotationX);
            cat.rotationY = nearest(cat.rotationY);
            if (reducedMotion.matches) {
                cat.rotationX = cat.rotationY = 0;
                render();
                return;
            }
            previousTime = performance.now();
            frameId = requestAnimationFrame(comeBack);
        }

        figure.addEventListener("pointerdown", () => {
            if (frameId !== null) cancelAnimationFrame(frameId);
            frameId = null;
        });
        enableCubeDrag(figure, cat, render, () => false);
        figure.addEventListener("pointerup", release);
        figure.addEventListener("pointercancel", release);
        render();
    });
}
