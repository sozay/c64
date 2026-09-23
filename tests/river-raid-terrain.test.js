import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateTerrain,
  createTerrain,
  bankAt,
} from '../src/games/river-raid/terrain.js';
import {
  WORLD_WIDTH,
  SEGMENT_HEIGHT,
  MIN_RIVER_WIDTH,
  MAX_RIVER_WIDTH,
  RIVER_MARGIN,
} from '../src/games/river-raid/constants.js';

test('same seed produces identical terrain segments', () => {
  const first = generateTerrain(7, 200);
  const second = generateTerrain(7, 200);
  assert.deepEqual(first, second);
});

test('different seeds produce different terrain segments', () => {
  const first = generateTerrain(7, 200);
  const second = generateTerrain(8, 200);
  assert.notDeepEqual(first, second);
});

test('segment widths stay within the configured river bounds', () => {
  for (const segment of generateTerrain(42, 500)) {
    assert.ok(
      segment.width >= MIN_RIVER_WIDTH - 1e-9,
      `width ${segment.width} below minimum`,
    );
    assert.ok(
      segment.width <= MAX_RIVER_WIDTH + 1e-9,
      `width ${segment.width} above maximum`,
    );
  }
});

test('river banks stay inside the world', () => {
  for (const segment of generateTerrain(99, 500)) {
    const half = segment.width / 2;
    assert.ok(segment.center - half >= RIVER_MARGIN - 1e-9);
    assert.ok(segment.center + half <= WORLD_WIDTH - RIVER_MARGIN + 1e-9);
  }
});

test('lazy growth matches eager generation', () => {
  const lazy = createTerrain(7);
  const eager = generateTerrain(7, 64);
  bankAt(lazy, 63 * SEGMENT_HEIGHT);
  assert.deepEqual(lazy.segments.slice(0, 64), eager);
});

test('bankAt interpolates between adjacent segments', () => {
  const terrain = createTerrain(3);
  const [a, b] = terrain.segments;
  const mid = bankAt(terrain, SEGMENT_HEIGHT / 2);
  assert.ok(Math.abs(mid.center - (a.center + b.center) / 2) < 1e-9);
  assert.ok(Math.abs(mid.width - (a.width + b.width) / 2) < 1e-9);
  assert.equal(mid.left, mid.center - mid.width / 2);
  assert.equal(mid.right, mid.center + mid.width / 2);
});
