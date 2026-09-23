// Deterministic, stateless PRNG for the River Raid simulation.
//
// The generator is counter based: random01(seed, counter) is a pure function of
// its arguments, so identical (seed, counter) pairs always produce identical
// values regardless of call order. This is what makes the terrain stream fully
// determined by the seed and keeps the simulation free of mutable global state
// and Math.random.

export function hash32(seed, counter) {
  let h = (seed >>> 0) ^ Math.imul(counter >>> 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = (h ^ (h >>> 15)) >>> 0;
  return h;
}

export function random01(seed, counter) {
  return hash32(seed, counter) / 4294967296;
}

export function randomBetween(seed, counter, min, max) {
  return min + random01(seed, counter) * (max - min);
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
