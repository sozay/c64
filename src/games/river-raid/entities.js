// Deterministic entity placement for the River Raid combat layer (T-199).
//
// The spawn table is a pure function of (seed, segment index): the same seed
// always yields the same enemies at the same world rows and lateral offsets, so
// the whole combat layer stays reproducible from the seed. Nothing here reads
// the DOM or calls Math.random.

import {
  ENEMY_CHANCE,
  ENEMY_COUNTER_BASE,
  HELICOPTER_COUNTER_BASE,
  HELICOPTER_HALF_WIDTH,
  HELICOPTER_HALF_HEIGHT,
  HELICOPTER_MIN_CHANGE_FRAMES,
  HELICOPTER_MAX_CHANGE_FRAMES,
  SHIP_SHARE,
  SHIP_HALF_WIDTH,
  SHIP_HALF_HEIGHT,
  DEPOT_HALF_WIDTH,
  DEPOT_HALF_HEIGHT,
} from './constants.js';
import { random01, randomBetween } from './prng.js';

// Maps a 0..1 lateral fraction to a world x that keeps the entity fully inside
// the navigable river at the given cross-section. Rivers narrower than the
// entity fall back to the centre line.
export function lateralX(banks, halfWidth, lateral) {
  const min = banks.left + halfWidth;
  const max = banks.right - halfWidth;
  if (min >= max) return banks.center;
  return min + lateral * (max - min);
}

// Returns null or { type: 'ship' | 'helicopter', lateral } for one segment.
export function enemyForSegment(seed, index) {
  const roll = random01(seed, ENEMY_COUNTER_BASE + index * 4);
  if (roll >= ENEMY_CHANCE) return null;
  const typeRoll = random01(seed, ENEMY_COUNTER_BASE + index * 4 + 1);
  const lateral = random01(seed, ENEMY_COUNTER_BASE + index * 4 + 2);
  return {
    type: typeRoll < SHIP_SHARE ? 'ship' : 'helicopter',
    lateral,
  };
}

export function createDepotEntity(index, worldY, banks, spawn) {
  return {
    uid: index,
    kind: 'depot',
    type: 'depot',
    worldY,
    x: lateralX(banks, DEPOT_HALF_WIDTH, spawn.lateral),
    halfWidth: DEPOT_HALF_WIDTH,
    halfHeight: DEPOT_HALF_HEIGHT,
    dir: 0,
    used: false,
  };
}

export function createEnemyEntity(seed, index, worldY, banks, spawn) {
  const isHelicopter = spawn.type === 'helicopter';
  const halfWidth = isHelicopter ? HELICOPTER_HALF_WIDTH : SHIP_HALF_WIDTH;
  const halfHeight = isHelicopter ? HELICOPTER_HALF_HEIGHT : SHIP_HALF_HEIGHT;
  const counter = HELICOPTER_COUNTER_BASE + index * 8;

  return {
    uid: index,
    kind: 'enemy',
    type: spawn.type,
    worldY,
    x: lateralX(banks, halfWidth, spawn.lateral),
    halfWidth,
    halfHeight,
    dir: random01(seed, counter) < 0.5 ? -1 : 1,
    changeCount: 0,
    changeCountdown: Math.round(
      randomBetween(
        seed,
        counter + 4,
        HELICOPTER_MIN_CHANGE_FRAMES,
        HELICOPTER_MAX_CHANGE_FRAMES,
      ),
    ),
  };
}
