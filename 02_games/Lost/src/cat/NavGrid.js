/** Path-finding grid of the cat, used by brainNavigation.js. */

/**
 * A* navigation grid (8 neighbours) around the non-walkable obstacles of `ruins` (high walls, rocks), grown by the
 * cat radius + 5 cm; blocked outside the `limit` disc. Low walls stay free: the cat jumps onto them. Built once, on
 * the first blocked path; a rotating obstacle (boss footprint, combat.js) is refreshed with `refresh`.
 */
export class NavGrid {
  constructor(ruins, { limit, cell, radius }) {
    this.ruins = ruins;
    this.cell = cell;
    this.limit = limit;
    // Mountain zone: `navBounds` rectangle and `blockedCell` test instead of the centred disc.
    const b = ruins.navBounds ?? { x0: -limit, x1: limit, z0: -limit, z1: limit };
    this.x0 = b.x0;
    this.z0 = b.z0;
    this.nx = Math.ceil((b.x1 - b.x0) / cell);
    this.nz = Math.ceil((b.z1 - b.z0) / cell);
    this.blocked = new Uint8Array(this.nx * this.nz);
    this.pad = radius + 0.05;
    this._fill(0, this.nx - 1, 0, this.nz - 1);
  }

  /** Recomputes cells [i0, i1] × [j0, j1] with the obstacles' current heading. */
  _fill(i0, i1, j0, j1) {
    const nx = this.nx, limit = this.limit, pad = this.pad, zone = this.ruins;
    const obs = (zone.navObstacles ?? zone.obstacles).filter((o) => !o.climbable)
      .map((o) => ({ o, c: Math.cos(o.rotY), s: Math.sin(o.rotY) }));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = this.cx(i), z = this.cz(j);
        let b = zone.blockedCell ? zone.blockedCell(x, z, pad) : Math.hypot(x, z) > limit;
        for (let k = 0; !b && k < obs.length; k++) {
          const { o, c, s } = obs[k];
          const dx = x - o.x, dz = z - o.z;
          b = Math.abs(dx * c - dz * s) <= o.hx + pad && Math.abs(dx * s + dz * c) <= o.hz + pad;
        }
        this.blocked[j * nx + i] = b ? 1 : 0;
      }
    }
  }

  /** Recomputes the square of half-side `r` (m) around (x, z) (obstacle rotated or moved). */
  refresh(x, z, r) {
    this._fill(this.ix(x - r), this.ix(x + r), this.iz(z - r), this.iz(z + r));
  }

  /** Centre (m) of cell i in x and j in z; cell index of a coordinate. */
  cx(i) { return this.x0 + (i + 0.5) * this.cell; }
  cz(j) { return this.z0 + (j + 0.5) * this.cell; }
  ix(x) { return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / this.cell))); }
  iz(z) { return Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.z0) / this.cell))); }

  /** Free cell nearest to (i, j) (square rings up to 12 cells), or -1. */
  nearestFree(i, j) {
    const nx = this.nx, nz = this.nz;
    if (!this.blocked[j * nx + i]) return j * nx + i;
    for (let r = 1; r <= 12; r++) {
      let best = -1, bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz || this.blocked[b * nx + a]) continue;
          const d = di * di + dj * dj;
          if (d < bestD) { bestD = d; best = b * nx + a; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Cell path from a to b ({x, z} centres, without the start cell), or null. */
  find(ax, az, bx, bz) {
    const nx = this.nx, nz = this.nz, N = nx * nz;
    const s = this.nearestFree(this.ix(ax), this.iz(az));
    const t = this.nearestFree(this.ix(bx), this.iz(bz));
    if (s < 0 || t < 0) return null;
    const g = new Float32Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const ti = t % nx, tj = (t / nx) | 0;
    const h = (k) => {
      const dx = Math.abs((k % nx) - ti), dz = Math.abs(((k / nx) | 0) - tj);
      return Math.max(dx, dz) + 0.41421356 * Math.min(dx, dz);
    };
    // Binary heap on f = g + h.
    const heap = [], f = new Float32Array(N);
    const push = (k) => {
      heap.push(k);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (f[heap[p]] <= f[heap[c]]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]]; c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
          if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return top;
    };
    g[s] = 0; f[s] = h(s); push(s);
    while (heap.length) {
      const k = pop();
      if (closed[k]) continue;
      if (k === t) break;
      closed[k] = 1;
      const i = k % nx, j = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
          const m = b * nx + a;
          if (this.blocked[m] || closed[m]) continue;
          // No diagonal cut between two blocked cells.
          if (di && dj && (this.blocked[j * nx + a] || this.blocked[b * nx + i])) continue;
          const cost = g[k] + (di && dj ? 1.41421356 : 1);
          if (cost < g[m]) { g[m] = cost; parent[m] = k; f[m] = cost + h(m); push(m); }
        }
      }
    }
    if (parent[t] < 0 && t !== s) return null;
    const out = [];
    for (let k = t; k !== s && k >= 0; k = parent[k]) out.push({ x: this.cx(k % nx), z: this.cz((k / nx) | 0) });
    return out.reverse();
  }
}
