import { describe, expect, it } from 'vitest';
import { mapFeatures } from '../src/ui/MiniMap.js';

const obstacle = (name) => ({ name, x: 0, z: 0, hx: 1, hz: 1, rotY: 0 });

describe('mapFeatures', () => {
  it('draws ruins as stones, but not cats, launchers or hidden rampart pieces', () => {
    const kept = ['church_facade', 'low_wall_east', 'rampart_wall_a', 'rampart_tower_a'];
    const hidden = ['npc_maman_0', 'launcher_east', 'rampart_moat_a', 'rampart_closed', 'rampart_back'];
    const world = { ruins: { obstacles: [...kept, ...hidden].map(obstacle) } };
    expect(mapFeatures(world).stones.map((o) => o.name)).toEqual(kept);
  });
});
