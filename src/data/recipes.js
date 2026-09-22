// Recipes (GDD section 8): three different doctrines at a minimum rank produce a
// special tower. Their combat behaviour follows in M3, their own artwork in M4.

/**
 * `ingredients` are doctrine ids, `minRank` the rank every ingredient must reach.
 * The first ingredient is the leading doctrine: it gives the special tower its
 * guide colour and, until the concept art exists, its placeholder sprite.
 */
export const RECIPES = [
  { id: 'purgeShrine', ingredients: ['flame', 'psi', 'mortar'], minRank: 2 },
  { id: 'stormBattery', ingredients: ['autocannon', 'laser', 'tesla'], minRank: 2 },
  { id: 'emberCauldron', ingredients: ['flame', 'tesla', 'autocannon'], minRank: 2 },
  { id: 'siegeMortar', ingredients: ['mortar', 'laser', 'autocannon'], minRank: 3 },
  { id: 'thunderTower', ingredients: ['tesla', 'psi', 'laser'], minRank: 3 },
  { id: 'soulfireObelisk', ingredients: ['psi', 'flame', 'tesla'], minRank: 4 },
];

export const RECIPE_IDS = RECIPES.map((r) => r.id);

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id) ?? null;
}
