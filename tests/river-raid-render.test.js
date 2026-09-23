import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/games/river-raid/simulation.js';
import { render } from '../src/games/river-raid/render.js';

// A minimal recording 2D context: it proves the render function exercises the
// new bridge/HUD/game-over paths without throwing and emits the expected text.
// It is a smoke test for the draw layer, not a substitute for the manual
// browser check documented in the README.
function recordingContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    fillText: record('fillText'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    fill: record('fill'),
    save: record('save'),
    restore: record('restore'),
  };
}

function textsOf(context) {
  return context.calls.filter((call) => call.name === 'fillText').map((call) => call.args[0]);
}

test('the renderer draws the C64 HUD with score, level, lives and fuel', () => {
  const state = createInitialState(7);
  state.score = 1234;
  state.level = 3;

  const context = recordingContext();
  render(context, state);
  const texts = textsOf(context);

  assert.ok(texts.includes('SCORE 001234'), 'score is shown');
  assert.ok(texts.includes('LEVEL 03'), 'level is shown');
  assert.ok(texts.includes('LIVES 3'), 'lives are shown');
  assert.ok(texts.includes('FUEL'), 'fuel gauge is labelled');
});

test('the renderer draws bridges and the game-over screen', () => {
  const state = createInitialState(7);
  state.score = 500;
  state.entities = [
    {
      uid: 1,
      kind: 'bridge',
      type: 'bridge',
      worldY: 200,
      x: 320,
      halfWidth: 60,
      halfHeight: 6,
      dir: 0,
      used: false,
    },
  ];

  const context = recordingContext();
  render(context, state);
  assert.ok(
    context.calls.some((call) => call.name === 'fillRect'),
    'the bridge is drawn as rectangles',
  );

  state.gameOver = true;
  state.gameOverReason = 'enemy';
  render(context, state);
  const texts = textsOf(context);

  assert.ok(texts.includes('GAME OVER'), 'game-over title is shown');
  assert.ok(texts.includes('FINAL SCORE 500'), 'final score is shown');
  assert.ok(texts.includes('PRESS ENTER TO RESTART'), 'restart hint is shown');
});
