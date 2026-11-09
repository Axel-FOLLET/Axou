import { LEVELS, LEVEL_ORDER } from './difficulty.js';

/**
 * Story text, shown to the player and read by Story and EndScreen. Everything is marked `draft: true` except the
 * cat credit (`END.cat`, kept word for word). One speech bubble is one page, and a click on it moves to the next.
 * `speaker`: name shown (displayName of the NPC), null for a help text.
 * `{name}` is replaced by the kitten's name (playerName.js) when displayed, by the Chagicien, the Chartiste and the
 * Chavalanche only: Maman never uses the name.
 */

/** Speech bubbles of the three NPCs, in the order of the journey. */
export const TEXTS = {
  // Draft: the Chagicien addresses the kitten and sends it to the forest (the Chartiste's clearing).
  chagicien: {
    draft: true, speaker: 'Chagicien',
    pages: [
      'Te voilà réveillé, {name}. Tu cherches ta mère, n’est-ce pas ?',
      'Mes sortilèges ne la retrouveront pas, mais le Chartiste peint tout ce qu’il voit.',
      'Va dans la forêt, de l’autre côté de la prairie. Il y tient son chevalet.',
    ],
  },
  // Draft: the Chagicien once he has given the way (next visit).
  chagicienAgain: {
    draft: true, speaker: 'Chagicien',
    pages: ['La forêt, {name}. Cherche les arbres ronds : une allée y mène, entre les murs des ruines.'],
  },
  // Draft: the Chagicien on his way to the drawbridge.
  chagicienRoute: {
    draft: true, speaker: 'Chagicien',
    pages: ['Je descends au pont-levis, {name}, je t’y attendrai. Toi, retourne voir le Chartiste et prouve-lui ta valeur.'],
  },
  // Draft: the Chagicien at the foot of the drawbridge, before the victory over the Chartiste.
  chagicienBridge: {
    draft: true, speaker: 'Chagicien',
    pages: [
      'Halte, {name}. Ce pont ne s’abaisse pas pour qui n’a encore rien prouvé.',
      'Retourne voir le Chartiste, dans la forêt, et prouve-lui ta valeur. La porte fera le reste.',
    ],
  },
  // Draft: the Chagicien at the foot of the drawbridge, after the victory.
  chagicienAfter: {
    draft: true, speaker: 'Chagicien',
    pages: ['Tu as prouvé ta valeur, {name}, et la porte l’a compris. Passe le pont : au pied de la montagne, le Chavalanche t’attend pour grimper.'],
  },
  // Draft: the Chagicien after the ending (Maman found, the stay-and-play choice).
  chagicienEnd: {
    draft: true, speaker: 'Chagicien',
    pages: ['Te voilà auprès de ta mère, {name}. Mes sortilèges n’y sont pour rien, mais je m’en réjouis.'],
  },

  // Draft: the Chartiste speaks in short rhymed poems and points to the mountain.
  chartiste: {
    draft: true, speaker: 'Chartiste',
    pages: [
      'Une ombre douce, au pelage de nuit,\nest passée ce matin sans faire de bruit.',
      'Je l’ai peinte en haut, sur la pierre dorée,\noù la montagne penche vers la vallée.',
      'Suis le chemin, {name}, que le vent a tracé :\nau pied du sommet, ta mère t’attend couchée.',
    ],
  },
  chartisteAgain: {
    draft: true, speaker: 'Chartiste',
    pages: ['Ne t’attarde pas, {name}, devant ma toile :\nla montagne t’attend, suis ton étoile.'],
  },
  // Draft: second visit, before Maman: the Chartiste starts the fight (Story._startCombat when the speech bubble
  // closes). Replaces chartisteAgain in that case. The third page, the poem of the choice, carries three buttons
  // (Bubble.js, `choices`); the clicked button sets `story.level` and closes the bubble, which starts the fight.
  // Labels are read from the difficulty table (difficulty.js): changing a `label` changes the button.
  chartisteChallenge: {
    draft: true, speaker: 'Chartiste',
    pages: [
      'Encore toi, {name} ? Tu reviens sans cesse,\net ma toile s’impatiente de ta paresse.',
      'Puisque tu restes, voyons ce que tu vaux :\nmon pinceau va peindre un tout autre tableau !',
      'Dis-moi, {name}, quel trait tu veux braver :\ndoux, juste ou fier, je saurai t’éprouver.',
    ],
    choices: LEVEL_ORDER.map((key) => ({ key, label: LEVELS[key].label })),
  },
  // Draft: after a defeat, the speech bubble reopens directly on the choice, before any new arena (Story._lose);
  // one page, the same three buttons.
  chartisteRematch: {
    draft: true, speaker: 'Chartiste',
    pages: ['Mon pinceau t’a couché sur la terre, {name} :\nveux-tu un trait plus tendre, ou la même colère ?'],
    choices: LEVEL_ORDER.map((key) => ({ key, label: LEVELS[key].label })),
  },
  // Draft: the Chartiste after the ending (Maman found, the stay-and-play choice).
  chartisteEnd: {
    draft: true, speaker: 'Chartiste',
    pages: ['Te voilà près de ta mère, {name}, enfin retrouvée :\nce jour, sur ma toile, restera gravé.'],
  },

  // Drafts: speech bubbles like the other NPCs, using the kitten's name. The Chavalanche is energetic: lively
  // sentences, exclamation marks, addresses the kitten familiarly.
  // First meeting, at the foot of the mountain: he gets up and follows, and the objective moves to Maman.
  chavalanche: {
    draft: true, speaker: 'Chavalanche',
    pages: [
      'Hé, {name} ! Enfin quelqu’un ! Je suis le Chavalanche, et cette montagne, je la connais par cœur.',
      'Ta mère t’attend tout là-haut. Allez, en route : je te suis pas à pas !',
      'Méfie-toi des Bonchats de neige : ils visent juste. Si l’un d’eux te renverse, touche-moi, je te protégerai.',
    ],
  },
  // Click on him before any fall: reminder of the climb.
  chavalancheWaiting: {
    draft: true, speaker: 'Chavalanche',
    pages: ['Grimpe, {name}, je suis juste derrière ! Si une boule de neige te renverse, touche-moi : je me mets devant toi.'],
  },
  // Opened by him, once, after the first fall: one click on him is enough to ask for his help.
  chavalancheOffer: {
    draft: true, speaker: 'Chavalanche',
    pages: ['Aïe, {name} ! Ces Bonchats ne manquent pas leur cible. Touche-moi quand tu veux : je prendrai leurs boules à ta place, jusqu’au sommet !'],
  },
  // Click on him after a fall: confirmation, he takes the snowballs.
  chavalancheHelp: {
    draft: true, speaker: 'Chavalanche',
    pages: ['C’est parti, {name} ! Reste derrière moi : leurs boules, c’est pour moi !'],
  },
  // Click on him while he protects.
  chavalancheGuard: {
    draft: true, speaker: 'Chavalanche',
    pages: ['Je suis devant toi, {name} ! Avance, je m’occupe des boules !'],
  },
  // Click on him at the summit ledge, before Maman.
  chavalancheSummit: {
    draft: true, speaker: 'Chavalanche',
    pages: ['Nous y sommes, {name} ! Ta mère est juste là, va vite la retrouver !'],
  },
  // Click on him after the ending (Maman found, the stay-and-play choice).
  chavalancheEnd: {
    draft: true, speaker: 'Chavalanche',
    pages: ['Quelle belle montée, {name} ! Je savais bien que tu la retrouverais.'],
  },

  // Draft: reunion, before the hug and the end screen.
  maman: {
    draft: true, speaker: 'Maman',
    pages: ['Te voilà, mon tout-petit. Viens contre moi, tu as fait un long chemin.'],
  },
  mamanAgain: {
    draft: true, speaker: 'Maman',
    pages: ['Va jouer, je reste ici. Reviens quand tu veux.'],
  },
};

/** End-screen and title-screen text. `draft: true` marks text still to be reviewed. */
export const END = {
  // Draft: title and sentence of the end screen.
  title: { draft: true, text: 'Retrouvés' },
  line: { draft: true, text: 'Le chaton a retrouvé sa maman.' },
  stay: { draft: true, text: 'Rester jouer' },
  quit: { draft: true, text: 'Quitter' },
  // Draft: title screen field hint and button. The default name (playerName.js) is used if the field stays empty.
  titleName: { draft: true, text: 'Le nom de ton chaton' },
  play: { draft: true, text: 'Jouer' },
  creditsTitle: { draft: true, text: 'Crédits' },
  // Draft: line about the game (author and tools still to be confirmed).
  game: { draft: true, text: 'Lost, prototype de jeu réalisé avec three.js, sous licence MIT : https://threejs.org' },
  // Credit of the cat model: kept word for word, not a draft.
  cat: {
    draft: false,
    lines: [
      'Chat 3D « Rigged and animated Cat » par JonasDichelle, publié sur BlendSwap (blend n° 18519) : https://blendswap.com/blend/18519',
      'Licence : Creative Commons Attribution 3.0 (CC BY 3.0) : https://creativecommons.org/licenses/by/3.0/',
      "Modifications : le modèle a été converti au format glTF/GLB pour le web, son rig et ses animations ont été retravaillés (cycles ajoutés, clips de marche, d'affût et de bond), la fourrure et les matériaux ont été recréés côté web.",
    ],
  },
};
