// Pure fuel math for the River Raid simulation (T-199).
//
// Kept separate from step() so the depletion/refuel rules are unit-testable in
// isolation and free of DOM, wall-clock and Math.random.

import { FUEL_MAX, FUEL_DRAIN_PER_SEC } from './constants.js';

export function drainFuel(fuel, dt) {
  const next = fuel - FUEL_DRAIN_PER_SEC * dt;
  return next < 0 ? 0 : next;
}

export function refuel() {
  return FUEL_MAX;
}

export function isFuelEmpty(fuel) {
  return fuel <= 0;
}
