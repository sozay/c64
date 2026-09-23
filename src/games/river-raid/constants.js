// Shared constants for the River Raid simulation and render layers.
// Simulation code (prng, terrain, simulation) must not read from the DOM and
// must not call Math.random; every value here is deterministic.

export const WORLD_WIDTH = 640;
export const WORLD_HEIGHT = 400;

export const FIXED_DT = 1 / 60;
export const FIXED_STEP_MS = 1000 / 60;

export const SEGMENT_HEIGHT = 40;
export const INITIAL_SEGMENTS = 8;
export const MIN_RIVER_WIDTH = 70;
export const MAX_RIVER_WIDTH = 180;
export const MAX_CENTER_STEP = 26;
export const RIVER_MARGIN = 60;

export const PLAYER_SCREEN_Y = 320;
export const PLAYER_HALF_WIDTH = 7;
export const PLAYER_HALF_HEIGHT = 9;

export const CRUISE_SPEED = 90;
export const MAX_SPEED = 220;
export const THROTTLE_ACCEL = 260;
export const COAST_DECEL = 120;
export const LATERAL_SPEED = 150;

export const COLORS = Object.freeze({
  sky: '#0a0a12',
  land: '#2f6b2f',
  landEdge: '#1c451c',
  river: '#1b3a6b',
  riverEdge: '#4f8fd1',
  jet: '#e8e8f0',
  jetAccent: '#f2b134',
  jetCollided: '#e05050',
});
