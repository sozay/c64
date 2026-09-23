// Pure progression math for the River Raid layer (T-200).
//
// Kept separate from step() so the scoring table, the level speed/density
// scaling and the fuel bonus are unit-testable in isolation and free of DOM,
// wall-clock and Math.random. Every function is a pure function of its
// arguments, so the level a run reaches is fully determined by the seed plus
// the input sequence (bridges are seed-placed, see terrain.bridgeForSegment).

import {
  SCORE_VALUES,
  FUEL_BONUS_PER_UNIT,
  LEVEL_SPEED_STEP,
  LEVEL_DENSITY_STEP,
  MAX_SPEED_MULTIPLIER,
  MAX_ENEMY_CHANCE,
  ENEMY_CHANCE,
} from './constants.js';

export { SCORE_VALUES };

// Points awarded for destroying one target. Depots and bridges are identified
// by kind; enemies by type (ship or helicopter). Anything else scores zero.
export function scoreForTarget(target) {
  if (!target) return 0;
  if (target.kind === 'bridge') return SCORE_VALUES.bridge;
  if (target.kind === 'depot') return SCORE_VALUES.depot;
  if (target.kind === 'enemy') return SCORE_VALUES[target.type] ?? 0;
  return 0;
}

// Baseline speed multiplier for a level. Level 1 is the unscaled T-199 speed;
// each level adds LEVEL_SPEED_STEP, capped at MAX_SPEED_MULTIPLIER.
export function levelSpeedMultiplier(level) {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.min(MAX_SPEED_MULTIPLIER, 1 + (safeLevel - 1) * LEVEL_SPEED_STEP);
}

// Enemy spawn-chance multiplier for a level. Level 1 reproduces the T-199
// density exactly, so existing level-1 runs keep their spawn table.
export function levelDensityMultiplier(level) {
  const safeLevel = Math.max(1, Math.floor(level));
  return 1 + (safeLevel - 1) * LEVEL_DENSITY_STEP;
}

// Per-segment enemy chance for a level, clamped so the river never becomes
// impassable.
export function enemyChanceForLevel(level) {
  return Math.min(MAX_ENEMY_CHANCE, ENEMY_CHANCE * levelDensityMultiplier(level));
}

// Fuel bonus awarded on bridge destruction / level advance: the fuel left in
// the tank, rounded to whole units, times FUEL_BONUS_PER_UNIT.
export function fuelBonus(fuel) {
  return Math.max(0, Math.round(fuel)) * FUEL_BONUS_PER_UNIT;
}
