// What enemies do besides walking (GDD section 9): healers mend the swarm,
// the brood mother drops swarmers as she goes, the warp herald jumps ahead and
// the daemon prince keeps changing what his hide is made of.
//
// Bursters are not here: they only matter when they die, which the death pass
// in enemies.js handles.

import { enemyDef } from '../data/enemies.js';
import { healEnemy } from './damage.js';
import { positionAt, waveLineOf } from './route.js';
import { spawnEnemy } from './enemies.js';

/** Heals every other enemy inside the radius. */
function healAround(state, healer, heal, dt) {
  const r2 = heal.radius * heal.radius;
  const amount = heal.perSecond * dt;
  for (const other of state.enemies) {
    if (other === healer || other.dead) continue;
    const dx = other.x - healer.x;
    const dy = other.y - healer.y;
    if (dx * dx + dy * dy <= r2) healEnemy(other, amount);
  }
}

/**
 * One step of every enemy ability. New enemies are collected first and added
 * afterwards, so the list does not grow while it is being walked.
 */
export function updateAbilities(state, dt) {
  const hatch = [];
  for (const e of state.enemies) {
    if (e.dead || !e.hasAbility) continue;
    const def = enemyDef(e.type);
    e.abilityTimer += dt;

    if (def.heal) healAround(state, e, def.heal, dt);

    if (def.spawnTrail && e.abilityTimer >= def.spawnTrail.intervalSeconds) {
      e.abilityTimer = 0;
      const trail = def.spawnTrail;
      // Only so many in all (balancing round 5). Without a cap the trail grew
      // with how long she lived and dropped its last swarmers just short of the
      // bastion, so a long maze fed her instead of beating her.
      const dropped = e.dropped ?? 0;
      const count = Math.min(trail.count, (trail.maxCount ?? Infinity) - dropped);
      e.dropped = dropped + Math.max(0, count);
      for (let i = 0; i < count; i++) {
        hatch.push({ type: trail.type, d: Math.max(0, e.d - 0.2 - i * 0.15) });
      }
    }

    if (def.warpJump && e.abilityTimer >= def.warpJump.intervalSeconds) {
      e.abilityTimer = 0;
      const line = waveLineOf(state, e);
      e.d = Math.min(line.length - 0.001, e.d + def.warpJump.cells);
      positionAt(line, e.d, e);
      state.events.push({ type: 'warpJump', enemyId: e.id, x: e.x, y: e.y });
    }

    if (def.armorCycle && e.abilityTimer >= def.armorCycle.seconds) {
      e.abilityTimer = 0;
      const types = def.armorCycle.types;
      const next = types[(types.indexOf(e.armor) + 1) % types.length];
      // He has no shield, so both layers change together.
      e.armor = next;
      e.armorBelow = next;
      state.events.push({ type: 'armorChange', enemyId: e.id, armor: next, x: e.x, y: e.y });
    }
  }

  for (const { type, d } of hatch) {
    spawnEnemy(state, type, { d });
    state.waveStats.spawned += 1;
  }
}
