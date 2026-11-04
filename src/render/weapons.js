// One way to ask for the weapon of any emplacement (M9 D4): a standard emplacement carries the weapon
// of its doctrine (turrets.js), a recipe emplacement the one of its recipe (specials.js). The stage cache,
// the drawing of the emplacements and the fire at the barrel work on this and need not know which kind
// they have. Render-side only.

import { turnFrame } from './model.js';
import { buildTurret, restPose as turretRestPose, MOUNT_Z, TURRET_SCALE, MUZZLE, TURRET_DOCTRINES } from './turrets.js';
import { buildSpecial, specialRestPose, SPECIAL_MUZZLES, SPECIAL_IDS, SPECIAL_MOUNT_Z, specialScale, hasFloat, isLiveAlways } from './specials.js';
import { DOCTRINE_COLORS } from '../data/doctrines.js';
import { specialDef } from '../data/specials.js';
import { TURRET_TURN_SPEED, TURRET_RECOIL, TURRET_ROCKET, SPECIAL_TURN_SPEED, SPECIAL_MUZZLE, FX_TIP_AHEAD } from '../data/art.js';

/**
 * @typedef {object} WeaponModel
 * @property {string} kind  doctrine id, or recipe id for a recipe emplacement
 * @property {boolean} special
 * @property {number} mount  height of the roof plate the weapon stands on, world px
 * @property {number} scale  size of the weapon
 * @property {(pose: object) => {at: number[], dir: number[]}} muzzle
 * @property {(F: object, pose: object, layer: string) => {parts: object[], samples: number[][], muzzle: object}} build
 * @property {(accent: string, rank: number) => object} restPose
 * @property {string} accent  guide colour of the doctrine the weapon is built from
 * @property {string[]} staged  the layers a resting weapon takes from the cache
 * @property {string[]} live  the layers that are always drawn from the model, over the stage
 * @property {boolean} always  true when the weapon is never taken from a stage
 * @property {number} turnSpeed  radians per second of the drawing
 * @property {number} recoil  cells the whole stage is shoved back along the barrel by a shot
 * @property {number} ahead  cells the fire leaves in front of the muzzle point of the model
 * @property {number} tubes  barrels or tubes that fire in turn
 * @property {boolean} bobs  true when a part of the weapon hovers and bobs up and down
 * @property {boolean} recoilLive  true when the recoil is part of the model (a barrel slides back), so the
 *   weapon is drawn from the model while it recoils instead of shoving the stage
 */

const models = new Map();

/** The kinds a weapon model exists for: the six doctrines and the six recipes. */
export const WEAPON_KINDS = [...TURRET_DOCTRINES, ...SPECIAL_IDS];

/** The weapon model of a doctrine or recipe, or null. */
export function weaponModel(kind) {
  let m = models.get(kind);
  if (m !== undefined) return m;
  m = null;
  if (SPECIAL_IDS.includes(kind)) {
    m = {
      kind,
      special: true,
      mount: SPECIAL_MOUNT_Z,
      scale: specialScale(kind),
      muzzle: SPECIAL_MUZZLES[kind],
      build: (F, pose, layer) => buildSpecial(kind, F, pose, layer),
      restPose: (accent) => specialRestPose(accent),
      accent: DOCTRINE_COLORS[specialDef(kind).doctrine],
      staged: hasFloat(kind) ? ['base'] : ['all'],
      live: hasFloat(kind) ? ['float'] : [],
      always: isLiveAlways(kind),
      turnSpeed: SPECIAL_TURN_SPEED[kind],
      recoil: 0,
      ahead: 0,
      tubes: kind === 'stormBattery' ? SPECIAL_MUZZLE.stormBattery.barrels.length : 1,
      bobs: kind !== 'stormBattery' && kind !== 'emberCauldron' && kind !== 'siegeMortar',
      recoilLive: kind === 'stormBattery' || kind === 'siegeMortar',
    };
  } else if (TURRET_DOCTRINES.includes(kind)) {
    m = {
      kind,
      special: false,
      mount: MOUNT_Z,
      scale: TURRET_SCALE,
      muzzle: MUZZLE[kind],
      build: (F, pose, layer) => buildTurret(kind, F, { ...pose, layer }),
      restPose: (accent, rank) => turretRestPose(accent, rank),
      accent: DOCTRINE_COLORS[kind],
      staged: kind === 'psi' ? ['base', 'float'] : ['all'],
      live: [],
      always: false,
      turnSpeed: TURRET_TURN_SPEED[kind],
      recoil: TURRET_RECOIL[kind] ?? 0,
      ahead: FX_TIP_AHEAD[kind] ?? 0,
      tubes: kind === 'mortar' ? TURRET_ROCKET.mouths.length : 1,
      bobs: kind === 'psi',
      recoilLive: false,
    };
  }
  models.set(kind, m);
  return m;
}

/** The weapon kind of a tower record: its recipe, or else its doctrine. */
export const weaponKind = (tower) => tower.special ?? tower.doctrine;

/** The weapon model of a tower record, or null. */
export const weaponOf = (tower) => weaponModel(weaponKind(tower));

/** Screen position of a local point of a weapon facing `theta`, relative to the ground point of its field. */
export function weaponPoint(model, theta, [lx, ly, z]) {
  return turnFrame(theta, model.mount, model.scale).W(lx, ly, z);
}

/**
 * The muzzle on screen, in world px relative to the ground point of the emplacement, for a weapon facing
 * `theta` in the pose `pose`.
 */
export function weaponMuzzle(kind, theta, pose) {
  const model = weaponModel(kind);
  const [lx, ly, z] = model.muzzle(pose).at;
  return weaponPoint(model, theta, [lx, ly, z]);
}

const boxes = new Map();

/**
 * The area a weapon can cover on screen whichever way it faces, `[x0, y0, x1, y1]` in world px relative to
 * the ground point of its field: the points of its model at eight directions, both layers.
 */
export function weaponBox(kind) {
  let box = boxes.get(kind);
  if (box) return box;
  const model = weaponModel(kind);
  box = [0, 0, 0, 0];
  const pose = model.restPose(model.accent, 3);
  for (let i = 0; i < 8; i++) {
    const F = turnFrame((i * Math.PI) / 4, model.mount, model.scale);
    for (const [lx, ly, z] of model.build(F, pose, 'all').samples) {
      const [x, y] = F.W(lx, ly, z);
      box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
    }
  }
  boxes.set(kind, box);
  return box;
}
