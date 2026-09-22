// Shells in flight (mortars and the siege mortar). Everything else hits at once.

import { positionAt } from './route.js';
import { enemiesAround } from './targeting.js';
import { damageEnemy } from './damage.js';
import { enemySpeed } from './effects.js';

/**
 * Where an enemy will be in `seconds`, assuming it keeps its current speed.
 * Mortars need the lead, otherwise their shells always land behind the target.
 */
export function predict(state, enemy, seconds) {
  const line = enemy.flying ? state.waveRoutes.flyer : state.waveRoutes.ground;
  const d = Math.min(line.length, enemy.d + enemySpeed(state, enemy) * seconds);
  return positionAt(line, d);
}

/**
 * Fires a shell at the point where the target will be when it lands.
 * @param {{x: number, y: number}} from  Muzzle, in world units.
 */
export function launchShell(state, tower, stats, target) {
  const from = { x: tower.x + 0.5, y: tower.y + 0.5 };
  const flight = stats.def.flightSeconds;
  const to = predict(state, target, flight);
  const shell = {
    id: state.nextProjectileId++,
    towerId: tower.id,
    doctrine: stats.doctrine,
    damage: stats.damage,
    radius: stats.splashRadius,
    from,
    to: { x: to.x, y: to.y },
    x: from.x,
    y: from.y,
    /** Seconds in the air so far, and the whole flight time. */
    t: 0,
    flight,
  };
  state.projectiles.push(shell);
  return shell;
}

/** Splash damage on impact. Mortars are ground weapons, so flyers are spared. */
function explode(state, shell) {
  const air = false;
  const towers = state.towers;
  let dealt = 0;
  for (const e of enemiesAround(state, shell.to, shell.radius, { air, ground: true })) {
    dealt += damageEnemy(e, shell.damage, shell.doctrine);
  }
  if (dealt > 0) {
    const tower = towers.find((t) => t.id === shell.towerId);
    if (tower) tower.damage += dealt;
  }
  state.events.push({ type: 'explosion', x: shell.to.x, y: shell.to.y, radius: shell.radius, doctrine: shell.doctrine });
}

/** Moves every shell along its arc and resolves the ones that land. */
export function updateProjectiles(state, dt) {
  let write = 0;
  for (let read = 0; read < state.projectiles.length; read++) {
    const shell = state.projectiles[read];
    shell.t += dt;
    const u = Math.min(1, shell.t / shell.flight);
    shell.x = shell.from.x + (shell.to.x - shell.from.x) * u;
    shell.y = shell.from.y + (shell.to.y - shell.from.y) * u;
    if (shell.t >= shell.flight) {
      explode(state, shell);
      continue;
    }
    state.projectiles[write++] = shell;
  }
  state.projectiles.length = write;
}
