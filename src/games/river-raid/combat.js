// Pure collision rules for the River Raid combat layer (T-199).
//
// Everything here is a plain function over boxes ({x, worldY, halfWidth,
// halfHeight}) or over the entity list carried in the simulation state. No DOM,
// no canvas, no Math.random: the rules are deterministic and unit-testable
// without running a full step().

import {
  PLAYER_SCREEN_Y,
  PLAYER_HALF_WIDTH,
  PLAYER_HALF_HEIGHT,
} from './constants.js';

export function boxesOverlap(a, b) {
  return (
    Math.abs(a.x - b.x) <= a.halfWidth + b.halfWidth &&
    Math.abs(a.worldY - b.worldY) <= a.halfHeight + b.halfHeight
  );
}

// The jet's collision box in world coordinates. `scrollY` is the simulation
// camera offset; the jet always sits at PLAYER_SCREEN_Y on screen.
export function jetBox(player, scrollY) {
  return {
    x: player.x,
    worldY: scrollY + PLAYER_SCREEN_Y,
    halfWidth: PLAYER_HALF_WIDTH,
    halfHeight: PLAYER_HALF_HEIGHT,
  };
}

// A bullet is stopped by the first entity it overlaps: it destroys that enemy
// or depot and is consumed. Depots therefore block bullets rather than letting
// them pass through to targets behind.
export function findBulletTarget(entities, bullet) {
  return entities.find((entity) => boxesOverlap(bullet, entity)) ?? null;
}

// Depots do not collide with the jet; only enemies do.
export function findJetEnemy(entities, jet) {
  return (
    entities.find(
      (entity) => entity.kind === 'enemy' && boxesOverlap(jet, entity),
    ) ?? null
  );
}

// Flying over a depot refuels it once; a used depot no longer refuels.
export function findRefuelDepot(entities, jet) {
  return (
    entities.find(
      (entity) =>
        entity.kind === 'depot' && !entity.used && boxesOverlap(jet, entity),
    ) ?? null
  );
}
