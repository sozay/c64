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

// Fuel layer (T-199). Fuel drains continuously and is restored to full by
// flying over a depot; an empty tank is a crash cause.
export const FUEL_MAX = 100;
export const FUEL_DRAIN_PER_SEC = 2;

// Fuel depots. Placement is a pure function of the seed and the segment index
// (see terrain.depotForSegment); DEPOT_CHANCE is the per-segment probability.
export const DEPOT_CHANCE = 0.22;
export const DEPOT_HALF_WIDTH = 12;
export const DEPOT_HALF_HEIGHT = 10;
export const DEPOT_COUNTER_BASE = 0x10000000;

// Enemies. Spawn placement is a pure function of the seed and segment index
// (see entities.enemyForSegment); direction changes are seed-determined.
export const ENEMY_CHANCE = 0.35;
export const ENEMY_COUNTER_BASE = 0x20000000;
export const HELICOPTER_COUNTER_BASE = 0x30000000;
export const SHIP_SHARE = 0.5;
export const SHIP_HALF_WIDTH = 12;
export const SHIP_HALF_HEIGHT = 8;
export const SHIP_LATERAL_SPEED = 30;
export const HELICOPTER_HALF_WIDTH = 10;
export const HELICOPTER_HALF_HEIGHT = 8;
export const HELICOPTER_LATERAL_SPEED = 70;
export const HELICOPTER_MIN_CHANGE_FRAMES = 45;
export const HELICOPTER_MAX_CHANGE_FRAMES = 150;

// Single bullet. Only one shot may be in flight at a time.
export const BULLET_SPEED = 420;
export const BULLET_HALF_WIDTH = 2;
export const BULLET_HALF_HEIGHT = 6;

// Lives and respawn. Respawn here is a placeholder (current segment's river
// centre); checkpoint respawn arrives with the progression ticket.
export const INITIAL_LIVES = 3;

// After a respawn the jet is briefly immune to enemy collisions so a crash
// cannot immediately repeat; the bank and fuel rules still apply.
export const RESPAWN_INVULNERABLE_FRAMES = 90;

// Bridges (T-200). A bridge spans the full navigable river at a segment
// boundary and is a pure function of the seed plus the segment index (see
// terrain.bridgeForSegment). Destroying it advances the level and awards the
// bridge score plus a fuel bonus.
export const BRIDGE_FIRST_SEGMENT = 10;
export const BRIDGE_INTERVAL = 12;
export const BRIDGE_INTERVAL_JITTER = 3;
export const BRIDGE_MIN_INTERVAL = 8;
export const BRIDGE_COUNTER_BASE = 0x40000000;
export const BRIDGE_HALF_HEIGHT = 6;
export const BRIDGE_SCORE = 500;

// Scoring (T-200). Points per destroyed target, matching the original River
// Raid feel. Depots award 80, ships 30, helicopters 60 and bridges 500.
export const SCORE_VALUES = Object.freeze({
  depot: 80,
  ship: 30,
  helicopter: 60,
  bridge: BRIDGE_SCORE,
});

// Level progression (T-200). Each destroyed bridge advances the level, which
// scales the baseline scroll speed and the enemy spawn density. Both scalings
// are capped so a long run stays playable; bridges remain a pure function of
// the seed, so the level is deterministic for a given input sequence.
export const LEVEL_SPEED_STEP = 0.1;
export const LEVEL_DENSITY_STEP = 0.2;
export const MAX_SPEED_MULTIPLIER = 2.5;
export const MAX_ENEMY_CHANCE = 0.85;

// Fuel bonus (T-200): awarded when a bridge is destroyed, scaled by the fuel
// left in the tank at that moment.
export const FUEL_BONUS_PER_UNIT = 5;

// Entity lifecycle. Spawns are generated ahead of the leading edge and dropped
// once they scroll behind the trailing edge.
export const SPAWN_AHEAD_SEGMENTS = 4;
export const DESPAWN_MARGIN = 40;

export const COLORS = Object.freeze({
  sky: '#0a0a12',
  land: '#2f6b2f',
  landEdge: '#1c451c',
  river: '#1b3a6b',
  riverEdge: '#4f8fd1',
  jet: '#e8e8f0',
  jetAccent: '#f2b134',
  jetCollided: '#e05050',
  depot: '#f2b134',
  depotUsed: '#6f5f34',
  ship: '#c8c8dc',
  shipAccent: '#7a7a98',
  helicopter: '#d29aec',
  helicopterAccent: '#8a5aa8',
  bullet: '#f6f6b0',
  bridge: '#d8d8c8',
  bridgeAccent: '#7d7d6a',
  hud: '#8fe0ff',
  hudPanel: 'rgba(6, 10, 20, 0.72)',
  fuelHigh: '#4fd1ff',
  fuelLow: '#e05050',
  gameOverPanel: 'rgba(4, 6, 14, 0.82)',
});
