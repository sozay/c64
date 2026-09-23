// River Raid game module: deterministic simulation core plus its render and
// input adapters. The simulation exports (createInitialState, step, advance,
// hashState) are DOM-free and are what scripts/simulate.js drives headlessly.

import { FIXED_STEP_MS } from './constants.js';
import {
  createInitialState,
  step,
  advance,
  restart,
  playerWorldY,
  detectBankCollision,
} from './simulation.js';
import { hashState } from './hash.js';
import { createRenderer } from './render.js';
import { attachKeyboard } from './input.js';
import { drainSoundEvents } from './sound-events.js';
import { defaultStorage, readHighScores, recordHighScore } from './high-scores.js';

export {
  createInitialState,
  step,
  advance,
  restart,
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
  restart,
  hashState,
});

// Browser entry: runs the fixed-timestep simulation with an accumulator and
// draws each display frame. Not called by the headless driver.
//
// `audio` is an optional render-layer adapter (see audio.js). The browser entry
// injects it so this module never imports WebAudio itself: the headless driver
// shares this module and must have no audio code in its import graph. The
// adapter receives the drained sound-event queue once per display frame.
//
// `storage` is an optional Web Storage-like object for the high-score table
// (T-202); it defaults to the window's localStorage. `onFrame` is an optional
// per-frame observer the portal uses for its status readout.
export function mount(canvas, { seed = 7, audio = null, storage = defaultStorage(), onFrame = null } = {}) {
  const renderer = createRenderer(canvas);
  const keyboard = attachKeyboard(globalThis);
  const state = createInitialState(seed);

  let accumulator = 0;
  let previous = performance.now();
  let frameHandle = 0;
  let running = true;
  let ticks = 0;
  let highScores = readHighScores(storage);
  let isNewHighScore = false;
  let recordedGameOver = false;

  const loop = (now) => {
    if (!running) return;
    accumulator += Math.min(now - previous, 250);
    previous = now;
    while (accumulator >= FIXED_STEP_MS) {
      step(state, keyboard.state);
      ticks += 1;
      accumulator -= FIXED_STEP_MS;
    }

    // Persist the finished run exactly once per game-over transition, and reset
    // the marker when a restart returns the state to play.
    if (state.gameOver && !recordedGameOver) {
      recordedGameOver = true;
      const result = recordHighScore(storage, state.score);
      highScores = result.scores;
      isNewHighScore = result.isNewHighScore;
    } else if (!state.gameOver && recordedGameOver) {
      recordedGameOver = false;
      isNewHighScore = false;
    }

    if (audio) audio.handleEvents(drainSoundEvents(state), state);
    renderer.draw(state, { highScores, isNewHighScore });
    if (typeof onFrame === 'function') onFrame(state);
    frameHandle = requestAnimationFrame(loop);
  };

  frameHandle = requestAnimationFrame(loop);

  // Deterministic loop-status hook for tests and manual inspection: it reports
  // whether the loop is still scheduling frames and how many fixed simulation
  // ticks have run, so a stopped loop is provable without console capture.
  function getStatus() {
    return {
      running,
      ticks,
      frame: state.frame,
      gameOver: state.gameOver,
      score: state.score,
      level: state.level,
      lives: state.lives,
    };
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameHandle);
    keyboard.dispose();
  }

  // Clean exit: stop the loop, release keyboard listeners, and tear down the
  // injected audio layer. audio.dispose() is a no-op when the layer was never
  // instantiated, so a silent run exits without touching WebAudio.
  function dispose() {
    stop();
    if (audio && typeof audio.dispose === 'function') audio.dispose();
  }

  return {
    state,
    renderer,
    keyboard,
    audio,
    get ticks() {
      return ticks;
    },
    get running() {
      return running;
    },
    get highScores() {
      return highScores;
    },
    getStatus,
    stop,
    dispose,
  };
}
