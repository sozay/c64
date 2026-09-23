// Dev harness for the River Raid gameplay layer (T-199).
//
// Portal integration is T-202's scope, so this standalone page mounts the game
// directly on a canvas at /game.html. The on-page status line is a harness
// readout (fuel, lives, game over), not a game HUD: the simulation keeps no
// HUD and the hash in scripts/simulate.js is the authoritative state.

import './styles/tokens.css';
import './styles/base.css';
import { selectElement } from './core/dom.js';
import { mount } from './games/river-raid/index.js';

const canvas = selectElement('#game-canvas');
const status = selectElement('#game-status');

const game = mount(canvas, { seed: 7 });

// Exposed for manual/console inspection during development.
globalThis.__riverRaid = game;

function report() {
  const { state } = game;
  if (state.gameOver) {
    status.dataset.status = 'game-over';
    status.textContent = `GAME OVER (${state.gameOverReason}) \u2014 reload to retry.`;
    return;
  }
  status.dataset.status = 'playing';
  status.textContent = `FUEL ${Math.round(state.fuel)} \u00b7 LIVES ${state.lives}`;
  requestAnimationFrame(report);
}

requestAnimationFrame(report);
