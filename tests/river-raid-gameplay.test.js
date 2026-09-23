import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  step,
  playerWorldY,
} from '../src/games/river-raid/simulation.js';
import { bankAt } from '../src/games/river-raid/terrain.js';
import {
  FUEL_MAX,
  FUEL_DRAIN_PER_SEC,
  FIXED_DT,
  INITIAL_LIVES,
  BULLET_SPEED,
  PLAYER_HALF_HEIGHT,
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

function makeEnemy(state, overrides = {}) {
  return {
    uid: 1,
    kind: 'enemy',
    type: 'ship',
    worldY: playerWorldY(state),
    x: state.player.x,
    halfWidth: 12,
    halfHeight: 8,
    dir: 1,
    changeCount: 0,
    changeCountdown: 120,
    ...overrides,
  };
}

function makeDepot(state, overrides = {}) {
  return {
    uid: 1,
    kind: 'depot',
    type: 'depot',
    worldY: playerWorldY(state),
    x: state.player.x,
    halfWidth: 12,
    halfHeight: 10,
    dir: 0,
    used: false,
    ...overrides,
  };
}

test('only one bullet can be in flight at a time', () => {
  const state = isolatedState();
  step(state, { fire: true });

  const first = state.bullet;
  assert.ok(first, 'the first shot is fired');

  step(state, { fire: true });
  assert.equal(state.bullet, first, 'holding fire does not spawn a second bullet');
  assert.ok(state.bullet.worldY > first.worldY - 1e-9, 'the bullet keeps travelling');
});

test('a bullet destroys the enemy it hits', () => {
  const state = isolatedState();
  step(state, { fire: true });

  const targetY = state.bullet.worldY + BULLET_SPEED * FIXED_DT;
  state.entities.push(makeEnemy(state, { worldY: targetY }));

  step(state, {});

  assert.equal(state.entities.length, 0, 'the enemy is destroyed');
  assert.equal(state.bullet, null, 'the bullet is consumed');
});

test('a depot blocks the bullet and is itself destroyed', () => {
  const state = isolatedState();
  step(state, { fire: true });

  const targetY = state.bullet.worldY + BULLET_SPEED * FIXED_DT;
  state.entities.push(makeDepot(state, { worldY: targetY }));
  state.entities.push(makeEnemy(state, { uid: 2, worldY: targetY + 14 }));

  step(state, {});

  assert.equal(state.bullet, null, 'the bullet is consumed by the depot');
  assert.equal(state.entities.length, 1, 'the enemy behind the depot survives');
  assert.equal(state.entities[0].kind, 'enemy');
});

test('a bullet that misses eventually leaves the world', () => {
  const state = isolatedState();
  step(state, { fire: true });

  for (let frame = 0; frame < 60 && state.bullet; frame += 1) {
    step(state, {});
  }

  assert.equal(state.bullet, null);
});

test('flying over a depot refuels the tank once', () => {
  const state = isolatedState();
  state.fuel = 10;
  const depot = makeDepot(state);
  state.entities.push(depot);

  step(state, {});

  assert.equal(state.fuel, FUEL_MAX, 'the tank is refilled');
  assert.equal(depot.used, true, 'the depot is marked used');

  state.fuel = 10;
  step(state, {});

  assert.ok(state.fuel < FUEL_MAX, 'a used depot does not refuel again');
});

test('an enemy collision costs a life and clears the enemy', () => {
  const state = isolatedState();
  state.entities.push(makeEnemy(state));

  step(state, {});

  assert.equal(state.lives, INITIAL_LIVES - 1);
  assert.equal(state.entities.length, 0, 'the respawn point is cleared');
  assert.equal(state.gameOver, false);
});

test('respawn grants a grace window that blocks an immediate second enemy death', () => {
  const state = isolatedState();
  state.entities.push(makeEnemy(state));

  step(state, {});
  assert.equal(state.lives, INITIAL_LIVES - 1, 'the first collision costs a life');
  assert.ok(state.respawnGrace > 0, 'respawn sets the grace window');

  state.entities.push(makeEnemy(state, { uid: 9 }));
  step(state, {});

  assert.equal(state.lives, INITIAL_LIVES - 1, 'the grace window blocks the second death');
});

test('running out of fuel costs a life and refills on respawn', () => {
  const state = isolatedState();
  state.fuel = FUEL_DRAIN_PER_SEC * FIXED_DT * 0.5;

  step(state, {});

  assert.equal(state.lives, INITIAL_LIVES - 1);
  assert.equal(state.fuel, FUEL_MAX);
});

test('reaching zero lives enters the game-over placeholder and freezes', () => {
  const state = isolatedState();
  state.lives = 1;
  state.fuel = FUEL_DRAIN_PER_SEC * FIXED_DT * 0.5;

  step(state, {});

  assert.equal(state.lives, 0);
  assert.equal(state.gameOver, true);
  assert.equal(state.gameOverReason, 'fuel');

  const frozen = JSON.stringify(state);
  const frame = state.frame;

  step(state, { left: true, throttle: true, fire: true });

  assert.equal(state.frame, frame, 'the simulation does not advance after game over');
  assert.equal(JSON.stringify(state), frozen, 'game over freezes all state');
});
