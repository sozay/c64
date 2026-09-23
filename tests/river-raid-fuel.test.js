import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drainFuel, refuel, isFuelEmpty } from '../src/games/river-raid/fuel.js';
import {
  FUEL_MAX,
  FUEL_DRAIN_PER_SEC,
  FIXED_DT,
} from '../src/games/river-raid/constants.js';

test('fuel depletes at the configured rate', () => {
  const frames = 60;
  let fuel = FUEL_MAX;
  for (let frame = 0; frame < frames; frame += 1) {
    fuel = drainFuel(fuel, FIXED_DT);
  }

  const expected = FUEL_MAX - FUEL_DRAIN_PER_SEC * frames * FIXED_DT;
  assert.ok(Math.abs(fuel - expected) < 1e-9, `expected ${expected}, got ${fuel}`);
});

test('fuel is clamped at zero and reported empty', () => {
  let fuel = 0.5;
  for (let frame = 0; frame < 1000; frame += 1) {
    fuel = drainFuel(fuel, FIXED_DT);
  }

  assert.equal(fuel, 0);
  assert.equal(isFuelEmpty(fuel), true);
  assert.equal(isFuelEmpty(FUEL_MAX), false);
});

test('refuel restores the tank to full', () => {
  assert.equal(refuel(), FUEL_MAX);
});
