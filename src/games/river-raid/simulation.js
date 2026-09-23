// Pure, fixed-timestep River Raid simulation core.
//
// step(state, input) advances exactly one fixed tick. It mutates and returns
// the provided state object and nothing else: it never touches `input`, never
// reads the DOM, and never calls Math.random. Identical seeds plus identical
// input sequences therefore always produce identical states.

import {
  WORLD_WIDTH,
  FIXED_DT,
  PLAYER_SCREEN_Y,
  PLAYER_HALF_WIDTH,
  CRUISE_SPEED,
  MAX_SPEED,
  THROTTLE_ACCEL,
  COAST_DECEL,
  LATERAL_SPEED,
} from './constants.js';
import { clamp } from './prng.js';
import {
  createTerrain,
  ensureSegments,
  segmentIndexFor,
  bankAt,
} from './terrain.js';

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

export function step(state, input = {}) {
  const left = Boolean(input.left);
  const right = Boolean(input.right);
  const throttle = Boolean(input.throttle);

  state.frame += 1;
  state.time += FIXED_DT;

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
  state.player.collided = detectBankCollision(
    state.terrain,
    state.player.x,
    worldY,
  );

  return state;
}

export function advance(state, frames, input = {}) {
  const inputFor = typeof input === 'function' ? input : () => input;
  for (let frame = 0; frame < frames; frame += 1) {
    step(state, inputFor(frame));
  }
  return state;
}
