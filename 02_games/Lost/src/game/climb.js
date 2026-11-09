/**
 * Zone 2 climb settings: the table to adjust by playing, like the combat difficulty (difficulty.js). Covers the
 * Chavalanche, snow cats, snowballs and falls. Read by Chavalanche.js, world/SnowCats.js and world/snowCatLook.js.
 * Units: m, s, rad.
 *
 * - `chavalanche`: following the kitten.
 *   - `follow` (m): follow distance along the kitten's trail of steps.
 *   - `start` (m): he sets off when the kitten is further than this, after the first interaction.
 *   - `walk`, `trot` (m/s): gaits, each matching its clip.
 *   - `trail` (m): sampling step of the trail.
 *   - `shield` (m): guard position when protecting, in front of the kitten towards the nearest snow cat.
 *   - Scale, coat and accessories are in NPC_KINDS (Npc.js).
 * - `snowCats`: snow cats (world/SnowCats.js), small white cats using the NPC model (scale and fur:
 *   NPC_KINDS.snowCat, npcTuning.js), fixed and indestructible.
 *   - `count`: 6 to 10. It changes how many snowballs there are to read, not the falls of a player who never
 *     dodges, whose pace is set by the 5 s cycle, `gap` and the grace time. 8 gives one cat every 8 to 28 m.
 *   - `cycle` (s): life of one snowball, from spawn to throw.
 *   - `grow` (s): growth time, from nothing to the size of the cat.
 *   - `contact` (s): time in the `Swipe` clip when the paw lands (FIGHT.claw.contact, combat.js). The clip starts
 *     `contact` s before the end of the cycle and the ball leaves on contact.
 *   - `ahead` (m): distance between the cat's muzzle and the edge of the ball spawning in front of it.
 *   - `melt` (s): melt time of a cancelled ball, which melts where it is.
 *   - `charge` (m): kitten distance at which a snow cat starts a ball, large enough that after the 5 s cycle a
 *     climbing kitten is still within range and really targeted.
 *   - `reach` (m): beyond this distance a ready ball is undone instead of thrown (the kitten has passed).
 *   - `release` (factor): the cat cancels its ball if the kitten moves beyond `charge` × `release`.
 *   - `gap` (s): minimum time between throws of different cats, so the kitten sees each ball, ground shadow and
 *     paw instead of a salvo.
 *   - `turn` (rad/s): speed at which the cat turns towards the kitten.
 *   - `from`, `to` (0 to 1): stretch of the climb where the cats stand, foot to summit, evenly spaced.
 *   - `radius` (m): space reserved for one cat.
 *   - `offset` (m): gap between the corridor edge and the cat's edge.
 *   - `lateral` (m): maximum extra gap if pines and rocks occupy the edge strip.
 *   - `search` (m): how far a cat may slide along the path to find a free spot (no pine or rock under it).
 *   - `room` (m): free gap between its edge and a pine or rock.
 *   - `safeFoot` (m): radius around the foot where no ball is thrown at the kitten (the Chavalanche waits there).
 *   - `safeSummit` (m): same margin around the summit ledge (Maman).
 *   - Cost (one cat is an animated model plus its fur):
 *     - `show` (m): beyond this camera distance the cat is neither drawn nor animated.
 *     - `anim` (m): beyond this it is drawn, its animation frozen and its fur reduced to `farFur` shells
 *       (close up, fur follows FUR_LOD, npcTuning.js).
 *     - `perFrame`: cats built per frame on entering zone 2 (one, so crossing the bridge does not stall).
 *   - `coat`: colours (sRGB hex, `setCoat` in Npc.js: base, tips, sunlit flat, sheen). `gain`: factor on the fur
 *     base, above white, so the coat reads white (not grey) in warm sunlight and shadow despite widely spaced fur
 *     shells (`furStep` of the kind, Npc.js).
 *   - `beanies`: a hat of a different colour for each cat, drawn at random from `list` without replacement, so
 *     `list` holds at least `count` colours, distinct from the white coat and the snow. Cuff: the colour lightened
 *     by `cuff` towards white. Ribs: the colour darkened by `rib` towards black. `pompom`: shared cream.
 * - `snowball`: snowball.
 *   - `size`: diameter relative to the cat height measured on the model (1 = its height).
 *   - `speed` (m/s): horizontal speed.
 *   - `minFlight` (s): shortest flight, so a ball thrown from close by stays visible.
 *   - `arc` (m): height above the straight line from throw to impact.
 *   - `warn` (s): ground shadow shown before the impact.
 *   - `hit` (m): radius around the impact where the kitten falls (the ground mark has this radius).
 *   - `lead` (0 to 1): part of the kitten's movement during the flight that the shot anticipates (1 aims where it
 *     will be if it keeps going). Below 1 the shot lands slightly short, so stopping or turning is enough to avoid it.
 *   - `spin` (rad/s): rotation.
 *   - `snow`: ball look (snowCatLook.js). `top` upper side, `shade` lower side, `lift` factor on both. `glowColor`
 *     and `glow`: self-lighting that keeps the ball white in the shade (the warm sun turns pure snow sandy).
 * - `fall`: falls.
 *   - `slide` (m): slide down the path, staying in the corridor. `time` (s): duration of the slide.
 *   - `free` (s): time in the Knockback clip where the player regains control.
 *   - `grace` (s): time without a new fall. On a fall, balls in preparation are undone and the cycle restarts
 *     after the grace time.
 * - `help`: the Chavalanche's help. Available from `falls` falls. `until`: 'summit', protection up to the summit
 *   ledge.
 */
export const CLIMB = {
  chavalanche: { follow: 2.2, start: 1.0, walk: 1.05, trot: 2.4, trail: 0.4, shield: 1.1 },
  snowCats: {
    count: 8, cycle: 5, grow: 4, contact: 0.33, ahead: 0.32, melt: 0.3,
    charge: 18, reach: 14, release: 1.15, gap: 0.5, turn: 6,
    from: 0.14, to: 0.9, radius: 0.35, offset: 0.9, lateral: 3, search: 10, room: 0.4,
    safeFoot: 9, safeSummit: 2,
    show: 45, anim: 30, farFur: 6, perFrame: 1,
    coat: { coat: 0xffffff, tip: 0xffffff, coatLit: 0xffffff, sheen: 0xffffff, gain: 1.5 },
    beanies: {
      cuff: 0.35, rib: 0.75, pompom: 0xfff3e0,
      list: [
        ['red', 0xd9363e], ['orange', 0xf08a24], ['yellow', 0xf2c230], ['green', 0x3fa65a], ['turquoise', 0x1fb5b0],
        ['blue', 0x2f5fd0], ['purple', 0x8a4fc9], ['magenta', 0xd6479c], ['brown', 0x8a5a3a], ['charcoal', 0x3d3f52],
        ['lemon', 0xa6d13a], ['sky', 0x5bb5f0],
      ],
    },
  },
  snowball: {
    size: 1, speed: 7, minFlight: 0.7, arc: 1.2, warn: 1.0, hit: 0.55, lead: 0.85, spin: 5,
    snow: { top: 0xdde8ff, shade: 0xbcc8ee, lift: 1.3, glowColor: 0xb4c0dc, glow: 0.45 },
  },
  fall: { slide: 3.5, time: 0.45, free: 0.95, grace: 1.5 },
  help: { falls: 1, until: 'summit' },
};
