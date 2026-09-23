// River Raid game module: deterministic simulation core plus its render and
// input adapters. The simulation exports (createInitialState, step, advance,
// hashState) are DOM-free and are what scripts/simulate.js drives headlessly.

import { FIXED_STEP_MS } from './constants.js';
import {
  createInitialState,
  step,
  advance,
  playerWorldY,
  detectBankCollision,
} from './simulation.js';
import { hashState } from './hash.js';
import { createRenderer } from './render.js';
import { attachKeyboard } from './input.js';

export {
  createInitialState,
  step,
  advance,
  playerWorldY,
  detectBankCollision,
  hashState,
};

export const riverRaid = Object.freeze({
  id: 'river-raid',
  title: 'River Raid',
  createInitialState,
  step,
  advance,
  hashState,
});

// Browser entry: runs the fixed-timestep simulation with an accumulator and
// draws each display frame. Not called by the headless driver.
export function mount(canvas, { seed = 7 } = {}) {
  const renderer = createRenderer(canvas);
  const keyboard = attachKeyboard(globalThis);
  const state = createInitialState(seed);

  let accumulator = 0;
  let previous = performance.now();
  let frameHandle = 0;
  let running = true;

  const loop = (now) => {
    if (!running) return;
    accumulator += Math.min(now - previous, 250);
    previous = now;
    while (accumulator >= FIXED_STEP_MS) {
      step(state, keyboard.state);
      accumulator -= FIXED_STEP_MS;
    }
    renderer.draw(state);
    frameHandle = requestAnimationFrame(loop);
  };

  frameHandle = requestAnimationFrame(loop);

  return {
    state,
    renderer,
    keyboard,
    stop() {
      running = false;
      cancelAnimationFrame(frameHandle);
      keyboard.dispose();
    },
  };
}
