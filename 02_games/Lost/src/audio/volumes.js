/**
 * Output volume of every sound in the game, tuned together. Read by Meow.js, Purr.js, Music.js, SnowSteps.js,
 * CombatSfx.js and main.js. A change applies on the next page load; during a game, `__music.MUSIC.tracks` (the same
 * object as `VOLUMES.music.tracks`) applies to the next track.
 *
 * Every value is a linear gain applied at the output of its sound, grouped by family: meows, purrs, snow steps,
 * combat effects, music. All sounds mix at the audio destination, nothing lowers the music during a meow, and pitch
 * is never changed here.
 *
 * | Setting               | Gain  | Reason |
 * |-----------------------|-------|--------|
 * | meow.file             | 0.38  | Recorded meows (files peak at -1.5 dBFS): present over the music without being loud. |
 * | meow.synth.kitten     | 0.16  | Kitten fallback voice, played until its file is decoded: about -24 dBFS. |
 * | meow.synth.maman      | 0.18  | Maman fallback voice: about -25 dBFS. |
 * | meow.synth.chagicien  | 0.165 | Chagicien, the only voice that is always synthesized: about -22.5 dBFS. |
 * | meow.synth.chartiste  | 0.19  | Chartiste fallback voice: about -26 dBFS. |
 * | purr.pet              | 0.6   | Petting purr: 6 dB above the meadow and mountain music, overlapping peaks stay under 1. |
 * | purr.hugChaton        | 0.46  | Kitten purr in the hug: the quietest purr, at least 3.5 dB above the meadow music. |
 * | purr.hugMaman         | 0.68  | Maman's lower purr: the most present sound of the hug, 6 to 7 dB above the meadow music. |
 * | music.master          | 1     | Global music gain left neutral: tracks are tuned one by one. |
 * | music.tracks.meadow   | 0.16  | Meadow music stays present under the meows: output about -32 dBFS. |
 * | music.tracks.boss     | 0.21  | One gain for both boss parts (their difference is in the files): the fight is 3.7 dB above the meadow. |
 * | music.tracks.mountain | 0.19  | Mountain music, wind included: output about -33 dBFS, level with the meadow. |
 * | snow                  | 0.13  | Snow steps (SnowSteps.js): discreet, the loudest stays 4 dB under the mountain music. |
 * | combat.brushAir       | 0.30  | Brush swing: whooshes stay under the impacts. |
 * | combat.brushHit       | 0.42  | Brush hits the kitten: loudest of the fight; boss march + meow + effect peak at 0.93, under 1. |
 * | combat.brushGround    | 0.42  | Brush hits the ground after a dodge: same weight as a hit. |
 * | combat.paintThrow     | 0.30  | Paint throw (lava roar): under the impacts. |
 * | combat.paintLand      | 0.36  | Paint lands on the ground (lava splash, sizzling ground). |
 * | combat.paintHit       | 0.36  | Kitten caught in the paint: hissing burn. |
 * | combat.phase2         | 0.42  | Switch to phase 2: rise then big hit, once per duel. |
 * | combat.clawAir        | 0.22  | Kitten's claw swing: small, played on every attack. |
 * | combat.clawHit        | 0.30  | Claw hits the boss. |
 * | combat.swordAir       | 0.26  | Sword swing. |
 * | combat.swordHit       | 0.36  | Sword hits the boss: heavier than the claw. |
 *
 * Not in this table: internal mixes that shape a timbre rather than a volume (direct signal 0.35 and second formant
 * 0.6 of the synthesized voice, Meow.js; fundamental 0.12 of the purr, Purr.js), and the music fades and boss switch
 * (`MUSIC.fade`, `MUSIC.boss`, Music.js).
 */
export const VOLUMES = {
  meow: {
    file: 0.38,
    synth: { kitten: 0.16, maman: 0.18, chagicien: 0.165, chartiste: 0.19 },
  },
  purr: { pet: 0.6, hugKitten: 0.46, hugMaman: 0.68 },
  snow: 0.13,
  combat: {
    brushAir: 0.3, brushHit: 0.42, brushGround: 0.42,
    paintThrow: 0.3, paintLand: 0.36, paintHit: 0.36,
    phase2: 0.42,
    clawAir: 0.22, clawHit: 0.3, swordAir: 0.26, swordHit: 0.36,
  },
  music: {
    master: 1,
    tracks: { meadow: 0.16, boss: 0.21, mountain: 0.19 },
  },
};
