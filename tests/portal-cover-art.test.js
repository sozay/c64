import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawCoverArt } from '../src/portal/cover-art.js';

function recordingCanvas() {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
  };
  return {
    width: 320,
    height: 180,
    calls,
    getContext: () => context,
  };
}

test('drawCoverArt paints a procedural scene onto the card canvas', () => {
  const canvas = recordingCanvas();
  const context = drawCoverArt(canvas, { id: 'river-raid', accent: 'primary' });

  assert.equal(context, canvas.getContext());
  assert.ok(canvas.calls.some((call) => call.name === 'fillRect'), 'fills land/sky/river');
  assert.ok(canvas.calls.some((call) => call.name === 'stroke'), 'draws river edges');
  assert.ok(canvas.calls.length > 10, 'draws a non-trivial scene');
});

test('the cover is deterministic for the same game', () => {
  const first = recordingCanvas();
  const second = recordingCanvas();
  drawCoverArt(first, { id: 'river-raid' });
  drawCoverArt(second, { id: 'river-raid' });
  assert.deepEqual(first.calls, second.calls);
});

test('drawCoverArt is a safe no-op without a usable 2D context', () => {
  assert.equal(drawCoverArt(null), null);
  assert.equal(drawCoverArt({ width: 10, height: 10 }), null);
  assert.equal(drawCoverArt({ getContext: () => null }), null);
});
