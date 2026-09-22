// Enemy types (GDD section 9). Health is the wave-1 value; speed in cells per second.
// M1 uses speed and flying only; armour, rewards and specials follow in M3.

export const ENEMIES = {
  swarmer: { armor: 'flesh', health: 30, speed: 1.6, reward: 1, flying: false },
  warrior: { armor: 'flesh', health: 70, speed: 1.1, reward: 2, flying: false },
  breaker: { armor: 'plate', health: 220, speed: 0.6, reward: 5, flying: false },
  warpseer: { armor: 'warpshield', health: 60, shield: 60, speed: 1.0, reward: 4, flying: false },
  carrionflyer: { armor: 'flyer', health: 50, speed: 1.4, reward: 3, flying: true },
  burster: { armor: 'flesh', health: 90, speed: 0.9, reward: 3, flying: false },
  healer: { armor: 'flesh', health: 80, speed: 0.9, reward: 4, flying: false },
};
