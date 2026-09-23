import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  step,
  playerWorldY,
} from '../src/games/river-raid/simulation.js';
import { bankAt, bridgeForSegment } from '../src/games/river-raid/terrain.js';
import {
  scoreForTarget,
  fuelBonus,
  levelSpeedMultiplier,
  levelDensityMultiplier,
  enemyChanceForLevel,
  SCORE_VALUES,
} from '../src/games/river-raid/progression.js';
import {
  FIXED_DT,
  FUEL_DRAIN_PER_SEC,
  FUEL_MAX,
  FUEL_BONUS_PER_UNIT,
  INITIAL_LIVES,
  BULLET_SPEED,
  CRUISE_SPEED,
  ENEMY_CHANCE,
  MAX_ENEMY_CHANCE,
  MAX_SPEED_MULTIPLIER,
} from '../src/games/river-raid/constants.js';

// A controlled state: the jet sits over water, the seed-driven spawn table is
// disabled, and the entity list is empty so each test injects exactly the
// entities it wants to exercise.
function isolatedState(seed = 7) {
  const state = createInitialState(seed);
  state.player.x = bankAt(state.terrain, playerWorldY(state)).center;
  state.nextSpawnIndex = 1_000_000;
  state.entities = [];
  return state;
}

function makeBridge(state, overrides = {}) {
  return {
    uid: 1000,
    kind: 'bridge',
    type: 'bridge',
    worldY: playerWorldY(state),
    x: state.player.x,
    halfWidth: 40,
    halfHeight: 6,
    dir: 0,
    used: false,
    ...overrides,
  };
}

test('the scoring table matches the River Raid targets', () => {
  assert.equal(SCORE_VALUES.depot, 80);
  assert.equal(SCORE_VALUES.ship, 30);
  assert.equal(SCORE_VALUES.helicopter, 60);
  assert.equal(SCORE_VALUES.bridge, 500);

  assert.equal(scoreForTarget({ kind: 'depot', type: 'depot' }), 80);
  assert.equal(scoreForTarget({ kind: 'enemy', type: 'ship' }), 30);
  assert.equal(scoreForTarget({ kind: 'enemy', type: 'helicopter' }), 60);
  assert.equal(scoreForTarget({ kind: 'bridge', type: 'bridge' }), 500);
  assert.equal(scoreForTarget({ kind: 'enemy', type: 'unknown' }), 0);
  assert.equal(scoreForTarget(null), 0);
});

test('the fuel bonus scales with the fuel left in the tank', () => {
  assert.equal(fuelBonus(0), 0);
  assert.equal(fuelBonus(40), 40 * FUEL_BONUS_PER_UNIT);
  assert.equal(fuelBonus(40.4), 40 * FUEL_BONUS_PER_UNIT, 'rounds down');
  assert.equal(fuelBonus(40.6), 41 * FUEL_BONUS_PER_UNIT, 'rounds up');
  assert.equal(fuelBonus(-5), 0, 'negative fuel cannot subtract points');
});

test('level scaling raises speed and density then caps', () => {
  assert.equal(levelSpeedMultiplier(1), 1, 'level 1 is the unscaled speed');
  assert.ok(levelSpeedMultiplier(2) > levelSpeedMultiplier(1));
  assert.ok(levelSpeedMultiplier(100) <= MAX_SPEED_MULTIPLIER + 1e-9);

  assert.equal(levelDensityMultiplier(1), 1, 'level 1 is the T-199 density');
  assert.equal(enemyChanceForLevel(1), ENEMY_CHANCE);
  assert.ok(enemyChanceForLevel(3) > ENEMY_CHANCE);
  assert.ok(enemyChanceForLevel(100) <= MAX_ENEMY_CHANCE + 1e-9);
});

test('a bridge is placed on the first checkpoint boundary and repeats by seed', () => {
  const first = bridgeForSegment(7, 10);
  assert.ok(first, 'the first bridge sits on segment 10');
  assert.equal(first.worldY, 400);
  assert.deepEqual(bridgeForSegment(7, 10), first, 'placement is seed-deterministic');
  assert.equal(bridgeForSegment(7, 9), null, 'no bridge before the first checkpoint');
});

test('a bullet destroys a depot and awards its score', () => {
  const state = isolatedState();
  step(state, { fire: true });

  const depot = {
    uid: 1,
    kind: 'depot',
    type: 'depot',
    worldY: state.bullet.worldY + BULLET_SPEED * FIXED_DT,
    x: state.player.x,
    halfWidth: 12,
    halfHeight: 10,
    dir: 0,
    used: false,
  };
  state.entities.push(depot);

  step(state, {});

  assert.equal(state.entities.length, 0, 'the depot is destroyed');
  assert.equal(state.score, SCORE_VALUES.depot);
});

test('a bullet awards the ship and helicopter scores', () => {
  for (const [type, expected] of [
    ['ship', SCORE_VALUES.ship],
    ['helicopter', SCORE_VALUES.helicopter],
  ]) {
    const state = isolatedState();
    step(state, { fire: true });
    state.entities.push({
      uid: 1,
      kind: 'enemy',
      type,
      worldY: state.bullet.worldY + BULLET_SPEED * FIXED_DT,
      x: state.player.x,
      halfWidth: 12,
      halfHeight: 8,
      dir: 1,
      changeCount: 0,
      changeCountdown: 120,
    });

    step(state, {});
    assert.equal(state.score, expected, `${type} should score ${expected}`);
  }
});

test('destroying a bridge advances the level, scores and sets the checkpoint', () => {
  const state = isolatedState();
  state.fuel = 40;
  step(state, { fire: true });

  const bridge = makeBridge(state, {
    worldY: state.bullet.worldY + BULLET_SPEED * FIXED_DT,
  });
  state.entities.push(bridge);

  step(state, {});

  assert.equal(state.entities.length, 0, 'the bridge is destroyed');
  assert.equal(state.bridgesDestroyed, 1);
  assert.equal(state.level, 2, 'destroying the bridge advances the level');
  assert.equal(state.score, SCORE_VALUES.bridge + fuelBonus(40));
  assert.equal(state.checkpointY, bridge.worldY, 'the checkpoint is the bridge row');
});

test('level progression raises the baseline speed in step', () => {
  const state = isolatedState();
  state.level = 3;
  const multiplier = levelSpeedMultiplier(3);

  step(state, {});

  assert.ok(
    state.speed >= CRUISE_SPEED * multiplier - 1e-9,
    `expected cruise >= ${CRUISE_SPEED * multiplier}, got ${state.speed}`,
  );
});

test('respawn returns the jet to the last bridge checkpoint', () => {
  const state = isolatedState();
  state.scrollY = 100;
  state.checkpointY = 800;
  state.fuel = FUEL_DRAIN_PER_SEC * FIXED_DT * 0.5;

  step(state, {});

  assert.equal(state.lives, INITIAL_LIVES - 1);
  assert.equal(state.fuel, FUEL_MAX, 'respawn refuels');
  assert.equal(playerWorldY(state), 800, 'respawn uses the checkpoint row');
});

test('without a checkpoint the respawn still uses the current segment start', () => {
  const state = isolatedState();
  state.scrollY = 140;
  assert.equal(state.checkpointY, null);
  state.fuel = FUEL_DRAIN_PER_SEC * FIXED_DT * 0.5;

  step(state, {});

  assert.equal(state.lives, INITIAL_LIVES - 1);
  assert.equal(playerWorldY(state), 440, 'segment 11 starts at worldY 440');
});

test('game over freezes until restart resets the same state object', () => {
  const state = isolatedState();
  state.lives = 1;
  state.score = 1234;
  state.level = 4;
  state.bridgesDestroyed = 3;
  state.fuel = FUEL_DRAIN_PER_SEC * FIXED_DT * 0.5;

  step(state, {});
  assert.equal(state.gameOver, true);
  assert.equal(state.gameOverReason, 'fuel');

  const reference = state;
  step(state, { restart: true });

  assert.equal(state, reference, 'restart reuses the game-over state object');
  assert.equal(state.gameOver, false);
  assert.equal(state.lives, INITIAL_LIVES);
  assert.equal(state.level, 1);
  assert.equal(state.score, 0);
  assert.equal(state.bridgesDestroyed, 0);
  assert.equal(state.checkpointY, null);
  assert.equal(state.frame, 0);
});

test('a restart input is ignored while the game is running', () => {
  const state = isolatedState();
  step(state, { restart: true });
  assert.equal(state.gameOver, false);
  assert.equal(state.frame, 1);
});
