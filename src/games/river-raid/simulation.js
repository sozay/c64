// Pure, fixed-timestep River Raid simulation core.
//
// step(state, input) advances exactly one fixed tick. It mutates and returns
// the provided state object and nothing else: it never touches `input`, never
// reads the DOM, and never calls Math.random. Identical seeds plus identical
// input sequences therefore always produce identical states.
//
// Coordinate convention: the world scrolls toward increasing worldY, so the
// jet's forward direction is +worldY. Terrain, enemies and depots are placed
// ahead of the jet (higher worldY) and despawn once they scroll behind it.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  FIXED_DT,
  SEGMENT_HEIGHT,
  PLAYER_SCREEN_Y,
  PLAYER_HALF_WIDTH,
  PLAYER_HALF_HEIGHT,
  CRUISE_SPEED,
  MAX_SPEED,
  THROTTLE_ACCEL,
  COAST_DECEL,
  LATERAL_SPEED,
  FUEL_MAX,
  INITIAL_LIVES,
  RESPAWN_INVULNERABLE_FRAMES,
  BULLET_SPEED,
  BULLET_HALF_WIDTH,
  BULLET_HALF_HEIGHT,
  SHIP_LATERAL_SPEED,
  HELICOPTER_LATERAL_SPEED,
  HELICOPTER_MIN_CHANGE_FRAMES,
  HELICOPTER_MAX_CHANGE_FRAMES,
  HELICOPTER_COUNTER_BASE,
  SPAWN_AHEAD_SEGMENTS,
  DESPAWN_MARGIN,
} from './constants.js';
import { clamp, random01, randomBetween } from './prng.js';
import {
  createTerrain,
  ensureSegments,
  segmentIndexFor,
  bankAt,
  depotForSegment,
} from './terrain.js';
import { enemyForSegment, createDepotEntity, createEnemyEntity } from './entities.js';
import { drainFuel, refuel, isFuelEmpty } from './fuel.js';
import {
  boxesOverlap,
  jetBox,
  findBulletTarget,
  findJetEnemy,
  findRefuelDepot,
} from './combat.js';

export function playerWorldY(state) {
  return state.scrollY + PLAYER_SCREEN_Y;
}

export function detectBankCollision(terrain, x, worldY) {
  const banks = bankAt(terrain, worldY);
  return x - PLAYER_HALF_WIDTH < banks.left || x + PLAYER_HALF_WIDTH > banks.right;
}

export function createInitialState(seed) {
  const normalizedSeed = seed >>> 0;
  const state = {
    seed: normalizedSeed,
    frame: 0,
    time: 0,
    scrollY: 0,
    speed: CRUISE_SPEED,
    fuel: FUEL_MAX,
    lives: INITIAL_LIVES,
    respawnGrace: 0,
    gameOver: false,
    gameOverReason: null,
    bullet: null,
    entities: [],
    nextSpawnIndex: 0,
    player: { x: WORLD_WIDTH / 2, collided: false },
    terrain: createTerrain(normalizedSeed),
  };
  state.player.collided = detectBankCollision(
    state.terrain,
    state.player.x,
    playerWorldY(state),
  );
  return state;
}

// Grows the spawn table up to (and including) the segment index at the leading
// edge. Each segment contributes at most one depot and one enemy, both placed
// by pure seed-derived rules.
function ensureSpawns(state, upToIndex) {
  const { terrain } = state;
  while (state.nextSpawnIndex <= upToIndex) {
    const index = state.nextSpawnIndex;
    state.nextSpawnIndex += 1;

    const worldY = index * SEGMENT_HEIGHT + SEGMENT_HEIGHT / 2;
    ensureSegments(terrain, index + 2);
    const banks = bankAt(terrain, worldY);

    const depotSpawn = depotForSegment(state.seed, index);
    if (depotSpawn) {
      state.entities.push(
        createDepotEntity(index, worldY, banks, depotSpawn),
      );
    }

    const enemySpawn = enemyForSegment(state.seed, index);
    if (enemySpawn) {
      state.entities.push(
        createEnemyEntity(state.seed, index, worldY, banks, enemySpawn),
      );
    }
  }
}

function updateHelicopter(state, entity) {
  entity.changeCountdown -= 1;
  if (entity.changeCountdown > 0) return;

  entity.changeCount += 1;
  const counter = HELICOPTER_COUNTER_BASE + entity.uid * 8 + entity.changeCount;
  entity.dir = random01(state.seed, counter) < 0.5 ? -1 : 1;
  entity.changeCountdown = Math.round(
    randomBetween(
      state.seed,
      counter + 4,
      HELICOPTER_MIN_CHANGE_FRAMES,
      HELICOPTER_MAX_CHANGE_FRAMES,
    ),
  );
}

// Ships and helicopters move laterally inside the river and reverse when they
// reach a bank. Ships are the slow movers; helicopters are faster and flip
// direction on a seed-determined schedule.
function moveEntityLateral(state, entity, speed) {
  const banks = bankAt(state.terrain, entity.worldY);
  const min = banks.left + entity.halfWidth;
  const max = banks.right - entity.halfWidth;
  if (min >= max) {
    entity.x = banks.center;
    entity.dir = 1;
    return;
  }

  entity.x += entity.dir * speed * FIXED_DT;
  if (entity.x <= min) {
    entity.x = min;
    entity.dir = 1;
  } else if (entity.x >= max) {
    entity.x = max;
    entity.dir = -1;
  }
}

function updateEnemies(state) {
  for (const entity of state.entities) {
    if (entity.kind !== 'enemy') continue;
    if (entity.type === 'helicopter') updateHelicopter(state, entity);
    const speed =
      entity.type === 'helicopter' ? HELICOPTER_LATERAL_SPEED : SHIP_LATERAL_SPEED;
    moveEntityLateral(state, entity, speed);
  }
}

function updateBullet(state, fire) {
  if (state.bullet) {
    state.bullet.worldY += BULLET_SPEED * FIXED_DT;
    if (state.bullet.worldY > state.scrollY + WORLD_HEIGHT + DESPAWN_MARGIN) {
      state.bullet = null;
    }
    return;
  }

  if (fire) {
    state.bullet = {
      x: state.player.x,
      worldY: playerWorldY(state) + PLAYER_HALF_HEIGHT,
      halfWidth: BULLET_HALF_WIDTH,
      halfHeight: BULLET_HALF_HEIGHT,
    };
  }
}

// A single bullet destroys the first enemy or depot it overlaps and is then
// consumed. Depots therefore block bullets instead of letting them pass.
function resolveBulletHits(state) {
  if (!state.bullet) return;
  const target = findBulletTarget(state.entities, state.bullet);
  if (!target) return;
  state.entities.splice(state.entities.indexOf(target), 1);
  state.bullet = null;
}

function despawnBehind(state) {
  const cutoff = state.scrollY - DESPAWN_MARGIN;
  if (!state.entities.some((entity) => entity.worldY < cutoff)) return;
  state.entities = state.entities.filter((entity) => entity.worldY >= cutoff);
}

// Respawn placeholder: return the jet to the centre of the river at the start
// of the current segment. Checkpoint respawn arrives with the progression
// ticket. Enemies overlapping the respawn point are cleared so a crash cannot
// immediately repeat.
function respawn(state) {
  const worldY = playerWorldY(state);
  const segmentStart = segmentIndexFor(worldY) * SEGMENT_HEIGHT;
  state.scrollY = Math.max(0, segmentStart - PLAYER_SCREEN_Y);
  state.player.x = bankAt(state.terrain, playerWorldY(state)).center;
  state.player.collided = false;
  state.fuel = refuel();
  state.bullet = null;
  state.respawnGrace = RESPAWN_INVULNERABLE_FRAMES;

  const jet = jetBox(state.player, state.scrollY);
  state.entities = state.entities.filter(
    (entity) => !(entity.kind === 'enemy' && boxesOverlap(jet, entity)),
  );
}

function crash(state, reason) {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.lives = 0;
    state.gameOver = true;
    state.gameOverReason = reason;
    state.player.collided = false;
    state.bullet = null;
    return;
  }
  respawn(state);
}

export function step(state, input = {}) {
  // Game over freezes the simulation: no further frame advances or mutations.
  if (state.gameOver) return state;

  const left = Boolean(input.left);
  const right = Boolean(input.right);
  const throttle = Boolean(input.throttle);
  const fire = Boolean(input.fire);

  state.frame += 1;
  state.time += FIXED_DT;
  if (state.respawnGrace > 0) state.respawnGrace -= 1;

  if (throttle) {
    state.speed = Math.min(MAX_SPEED, state.speed + THROTTLE_ACCEL * FIXED_DT);
  } else {
    state.speed = Math.max(CRUISE_SPEED, state.speed - COAST_DECEL * FIXED_DT);
  }

  const direction = (right ? 1 : 0) - (left ? 1 : 0);
  state.player.x = clamp(
    state.player.x + direction * LATERAL_SPEED * FIXED_DT,
    PLAYER_HALF_WIDTH,
    WORLD_WIDTH - PLAYER_HALF_WIDTH,
  );

  state.scrollY += state.speed * FIXED_DT;

  const worldY = playerWorldY(state);
  ensureSegments(state.terrain, segmentIndexFor(worldY) + 2);
  ensureSpawns(
    state,
    segmentIndexFor(state.scrollY + WORLD_HEIGHT) + SPAWN_AHEAD_SEGMENTS,
  );

  updateEnemies(state);
  updateBullet(state, fire);
  resolveBulletHits(state);

  state.fuel = drainFuel(state.fuel, FIXED_DT);

  const jet = jetBox(state.player, state.scrollY);
  const depot = findRefuelDepot(state.entities, jet);
  if (depot) {
    state.fuel = refuel();
    depot.used = true;
  }

  const bankHit = detectBankCollision(state.terrain, state.player.x, worldY);
  state.player.collided = bankHit;
  const enemyHit =
    bankHit || state.respawnGrace > 0
      ? null
      : findJetEnemy(state.entities, jet);

  let reason = null;
  if (bankHit) reason = 'bank';
  else if (enemyHit) reason = 'enemy';
  else if (isFuelEmpty(state.fuel)) reason = 'fuel';

  if (reason) crash(state, reason);

  despawnBehind(state);
  return state;
}

export function advance(state, frames, input = {}) {
  const inputFor = typeof input === 'function' ? input : () => input;
  for (let frame = 0; frame < frames; frame += 1) {
    step(state, inputFor(frame));
  }
  return state;
}
