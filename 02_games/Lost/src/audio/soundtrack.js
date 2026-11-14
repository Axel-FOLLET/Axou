import { MUSIC } from './Music.js';

/**
 * Decides which music plays. One rule, replayed on every story step, combat cue and zone change: silence on
 * the title and end screens, during the arrival cutscene and while the challenge is being read, otherwise the boss
 * music if the fight has started, otherwise the music of the kitten's zone. The sword and hug cutscenes change no
 * step, so the music in progress goes on.
 * @param {object} o `music` (Music), `story` (Story), `world` (World)
 * @returns {(options?: object) => void} applies the rule; `options` are passed to `Music.play`
 */
export function connectSoundtrack({ music, story, world }) {
  let bossMusic = false; // from the end of the challenge to the victory, the defeat or an interruption

  function apply(options) {
    if (story.step === 'title' || story.step === 'arrival' || story.step === 'end' || story.musicSilent) { music.stop(); return; }
    music.play(bossMusic ? 'boss' : world.inMountain ? 'mountain' : 'meadow', options);
  }

  story.onMusicCue = (cue) => {
    if (cue === 'boss-start') { bossMusic = true; music.setBossPhase2(false); }
    else if (cue === 'victory' || cue === 'explore' || cue === 'defeat') { bossMusic = false; music.setBossPhase2(false); }
    else if (cue === 'boss-phase2') music.setBossPhase2(true);
    apply(cue === 'victory' ? { fade: MUSIC.fade.victory } : undefined);
  };
  world.onZoneChange = () => apply();
  return apply;
}
