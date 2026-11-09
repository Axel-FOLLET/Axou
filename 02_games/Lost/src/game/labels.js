/**
 * Short labels shown to the player, in the language of the game. The story text is in texts.js, which depends on the
 * difficulty table: these labels stay apart so the table can read them without an import cycle.
 */

export const LEVEL_LABELS = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' };

export const NPC_NAMES = {
  chagicien: 'Chagicien',
  chartiste: 'Chartiste',
  maman: 'Maman',
  chavalanche: 'Chavalanche',
  snowCat: 'Chat de neige',
};

/** Name above the health bar during the fight. */
export const BOSS_NAME = 'Chartiste écarlate';

export const UI_LABELS = { bubbleNext: 'Suite ▸', bubbleClose: 'Fermer', map: 'Carte' };
