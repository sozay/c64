// Deterministic river terrain generator.
//
// Terrain is a stream of fixed-height segments, each carrying the river center
// x and width for that slice of the world. The whole stream is a pure function
// of the seed: no Math.random, no wall-clock, no external state. Segments are
// grown lazily as the world scrolls, but the growth rule is stateless (counter
// based PRNG), so generating N segments always yields the same result.

import {
  WORLD_WIDTH,
  SEGMENT_HEIGHT,
  MIN_RIVER_WIDTH,
  MAX_RIVER_WIDTH,
  MAX_CENTER_STEP,
  RIVER_MARGIN,
  INITIAL_SEGMENTS,
  DEPOT_CHANCE,
  DEPOT_COUNTER_BASE,
  BRIDGE_FIRST_SEGMENT,
  BRIDGE_INTERVAL,
  BRIDGE_INTERVAL_JITTER,
  BRIDGE_MIN_INTERVAL,
  BRIDGE_COUNTER_BASE,
} from './constants.js';
import { randomBetween, random01, clamp, lerp } from './prng.js';

const DEFAULT_CENTER = WORLD_WIDTH / 2;
const DEFAULT_WIDTH = (MIN_RIVER_WIDTH + MAX_RIVER_WIDTH) / 2;

function nextSegment(seed, index, prevCenter, prevWidth) {
  const widthTarget = randomBetween(
    seed,
    index * 2,
    MIN_RIVER_WIDTH,
    MAX_RIVER_WIDTH,
  );
  const width = clamp(
    prevWidth + (widthTarget - prevWidth) * 0.5,
    MIN_RIVER_WIDTH,
    MAX_RIVER_WIDTH,
  );

  const drift = (randomBetween(seed, index * 2 + 1, 0, 1) * 2 - 1) * MAX_CENTER_STEP;
  const half = width / 2;
  const center = clamp(
    prevCenter + drift,
    RIVER_MARGIN + half,
    WORLD_WIDTH - RIVER_MARGIN - half,
  );

  return { center, width };
}

export function ensureSegments(terrain, count) {
  const { seed, segments } = terrain;
  while (segments.length < count) {
    const index = segments.length;
    const previous = segments[index - 1];
    const prevCenter = previous ? previous.center : DEFAULT_CENTER;
    const prevWidth = previous ? previous.width : DEFAULT_WIDTH;
    segments.push(nextSegment(seed, index, prevCenter, prevWidth));
  }
  return terrain;
}

export function createTerrain(seed, segmentCount = INITIAL_SEGMENTS) {
  const terrain = { seed: seed >>> 0, segments: [] };
  ensureSegments(terrain, segmentCount);
  return terrain;
}

export function generateTerrain(seed, segmentCount) {
  return createTerrain(seed, segmentCount).segments;
}

export function segmentIndexFor(worldY) {
  return Math.max(0, Math.floor(worldY / SEGMENT_HEIGHT));
}

// The terrain generator places fuel depots on river segments. Placement is a
// pure function of (seed, segment index): the same seed always yields the same
// depots, so the combat layer stays deterministic. The returned `lateral` is a
// 0..1 fraction across the navigable river at that segment (0 = left bank,
// 1 = right bank); null means the segment has no depot.
export function depotForSegment(seed, index) {
  const roll = random01(seed, DEPOT_COUNTER_BASE + index * 4);
  if (roll >= DEPOT_CHANCE) return null;
  const lateral = random01(seed, DEPOT_COUNTER_BASE + index * 4 + 1);
  return { lateral };
}

// The terrain generator places level-checkpoint bridges on segment boundaries.
// Placement is a pure function of (seed, segment index): the first bridge sits
// at BRIDGE_FIRST_SEGMENT and subsequent bridges follow at a seed-jittered
// interval, so the same seed always yields the same checkpoints. Returns null
// or { worldY } where worldY is the segment boundary the bridge spans.
export function bridgeForSegment(seed, index) {
  if (index < BRIDGE_FIRST_SEGMENT) return null;
  const jitter = Math.round(
    randomBetween(
      seed,
      BRIDGE_COUNTER_BASE,
      -BRIDGE_INTERVAL_JITTER,
      BRIDGE_INTERVAL_JITTER,
    ),
  );
  const interval = Math.max(BRIDGE_MIN_INTERVAL, BRIDGE_INTERVAL + jitter);
  if ((index - BRIDGE_FIRST_SEGMENT) % interval !== 0) return null;
  return { worldY: index * SEGMENT_HEIGHT };
}

// Returns the interpolated river cross-section at a world row. This read may
// extend the terrain stream so callers always get a defined answer near the
// leading edge; the extension is deterministic and part of the passed state.
export function bankAt(terrain, worldY) {
  const raw = Math.max(0, worldY / SEGMENT_HEIGHT);
  const index = Math.floor(raw);
  ensureSegments(terrain, index + 2);

  const t = clamp(raw - index, 0, 1);
  const a = terrain.segments[index];
  const b = terrain.segments[index + 1] ?? a;
  const center = lerp(a.center, b.center, t);
  const width = lerp(a.width, b.width, t);
  const half = width / 2;

  return { center, width, left: center - half, right: center + half };
}
