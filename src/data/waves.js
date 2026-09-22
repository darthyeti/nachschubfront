// Test waves for M1. The full 50-wave table follows in M3.
// Each group spawns `count` enemies of `type`, `interval` seconds apart,
// starting `delay` seconds after the wave begins.

export const WAVES = [
  { groups: [{ type: 'warrior', count: 12, interval: 0.9, delay: 0 }] },
  { groups: [{ type: 'swarmer', count: 24, interval: 0.45, delay: 0 }] },
  { groups: [{ type: 'breaker', count: 8, interval: 1.6, delay: 0 }] },
  { groups: [{ type: 'carrionflyer', count: 12, interval: 0.9, delay: 0 }] },
  {
    groups: [
      { type: 'warrior', count: 8, interval: 1.0, delay: 0 },
      { type: 'swarmer', count: 12, interval: 0.5, delay: 2 },
      { type: 'carrionflyer', count: 6, interval: 1.2, delay: 4 },
      { type: 'breaker', count: 3, interval: 2.5, delay: 6 },
    ],
  },
];
