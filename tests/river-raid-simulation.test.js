import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  step,
  advance,
  detectBankCollision,
  playerWorldY,
} from '../src/games/river-raid/simulation.js';
import { bankAt } from '../src/games/river-raid/terrain.js';
import { hashState } from '../src/games/river-raid/hash.js';
import {
  WORLD_WIDTH,
  PLAYER_HALF_WIDTH,
  CRUISE_SPEED,
  MAX_SPEED,
} from '../src/games/river-raid/constants.js';

test('jet horizontal movement is bounded by the world edges', () => {
  const left = advance(createInitialState(7), 600, { left: true });
  assert.equal(left.player.x, PLAYER_HALF_WIDTH);

  const right = advance(createInitialState(7), 600, { right: true });
  assert.equal(right.player.x, WORLD_WIDTH - PLAYER_HALF_WIDTH);
});

test('throttle raises speed toward the maximum and release decays to cruise', () => {
  const state = createInitialState(7);
  assert.equal(state.speed, CRUISE_SPEED);

  advance(state, 120, { throttle: true });
  assert.ok(state.speed > CRUISE_SPEED, 'throttle should accelerate');
  assert.ok(state.speed <= MAX_SPEED + 1e-9, 'speed must not exceed maximum');

  advance(state, 600, {});
  assert.ok(state.speed >= CRUISE_SPEED - 1e-9, 'speed must not drop below cruise');
  assert.ok(state.speed < MAX_SPEED, 'release should bleed off top speed');
});

test('throttle is capped at the maximum speed', () => {
  const state = advance(createInitialState(1), 1000, { throttle: true });
  assert.ok(state.speed <= MAX_SPEED + 1e-9);
});

test('bank collision is detected over land and clear over water', () => {
  const state = createInitialState(7);
  const worldY = playerWorldY(state);
  const banks = bankAt(state.terrain, worldY);

  assert.equal(
    detectBankCollision(state.terrain, banks.left - PLAYER_HALF_WIDTH - 5, worldY),
    true,
  );
  assert.equal(detectBankCollision(state.terrain, banks.center, worldY), false);
});

test('step flags a collision once the jet is over the bank', () => {
  const state = createInitialState(7);
  const banks = bankAt(state.terrain, playerWorldY(state));
  state.player.x = Math.max(PLAYER_HALF_WIDTH, banks.left - 20);

  step(state, {});
  assert.equal(state.player.collided, true);
});

test('step is deterministic and does not mutate its input', () => {
  const input = Object.freeze({ left: false, right: true, throttle: true });
  const start = createInitialState(7);

  const first = structuredClone(start);
  step(first, input);

  const second = structuredClone(start);
  step(second, input);

  assert.deepEqual(first, second, 'same start + input must reach same state');
  assert.deepEqual(input, { left: false, right: true, throttle: true });
});

test('the state object is the only mutation', () => {
  const state = createInitialState(11);
  const input = { left: true, throttle: true };
  const inputSnapshot = structuredClone(input);
  const terrainSeed = state.terrain.seed;

  step(state, input);

  assert.deepEqual(input, inputSnapshot, 'input must be left untouched');
  assert.equal(state.terrain.seed, terrainSeed);
  assert.equal(state.frame, 1);
});

test('identical seeds and input sequences produce identical state hashes', () => {
  const input = { throttle: true, left: false, right: false };
  const a = advance(createInitialState(7), 600, input);
  const b = advance(createInitialState(7), 600, input);
  assert.equal(hashState(a), hashState(b));
});
