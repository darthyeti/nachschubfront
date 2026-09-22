import { createGrid, setBlocked } from '../../src/sim/grid.js';

/**
 * Builds a square grid from rows of text. '#' is blocked, anything else free.
 * Letters mark named cells, returned in `marks` (e.g. S and G for start and goal).
 */
export function gridFromAscii(rows) {
  const size = rows.length;
  const grid = createGrid(size);
  const marks = {};
  rows.forEach((row, y) => {
    if (row.length !== size) throw new Error(`row ${y} has length ${row.length}, expected ${size}`);
    [...row].forEach((ch, x) => {
      if (ch === '#') setBlocked(grid, x, y, true);
      else if (/[A-Za-z0-9]/.test(ch)) marks[ch] = { x, y };
    });
  });
  return { grid, marks };
}

/** A map-shaped object for route tests: waypoints R, 1-4, B from the ASCII art. */
export function mapFromAscii(rows) {
  const { grid, marks } = gridFromAscii(rows);
  return {
    size: grid.size,
    grid,
    protected: new Uint8Array(grid.size * grid.size),
    rift: marks.R,
    beacons: [marks['1'], marks['2'], marks['3'], marks['4']],
    bastion: marks.B,
    obstacles: [],
  };
}

/** A minimal planning-phase state around a map, enough for zone and pod tests. */
export function planningState(map, extra = {}) {
  return {
    seed: 'TEST',
    map,
    route: null,
    mapVersion: 0,
    phase: 'planning',
    phaseTime: 0,
    wave: 0,
    lives: 20,
    speed: 1,
    supplyLevel: 1,
    zones: [],
    pods: [],
    towers: [],
    nextTowerId: 1,
    enemies: [],
    stress: false,
    events: [],
    ...extra,
  };
}
