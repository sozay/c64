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
import { createAudio } from './games/river-raid/audio.js';

const canvas = selectElement('#game-canvas');
const status = selectElement('#game-status');

// The audio module is created here, in the browser entry, so the headless
// simulation driver's import graph never contains WebAudio (T-201).
const audio = createAudio();
const audioControls = audio.attachControls(globalThis);

const game = mount(canvas, { seed: 7, audio });

// Exposed for manual/console inspection during development and by the
// Playwright autoplay-guard test.
globalThis.__riverRaid = game;
globalThis.__riverRaidAudio = audio;
globalThis.__riverRaidAudioControls = audioControls;

function report() {
  const { state } = game;
  if (state.gameOver) {
    status.dataset.status = 'game-over';
    status.textContent = `GAME OVER (${state.gameOverReason}) \u2014 FINAL SCORE ${state.score} \u2014 press Enter to restart.`;
  } else {
    status.dataset.status = 'playing';
    const sound = audio.isMuted() ? 'SOUND MUTED (M)' : 'SOUND ON (M)';
    status.textContent = `SCORE ${state.score} \u00b7 LEVEL ${state.level} \u00b7 FUEL ${Math.round(state.fuel)} \u00b7 LIVES ${state.lives} \u00b7 ${sound}`;
  }
  requestAnimationFrame(report);
}

requestAnimationFrame(report);
