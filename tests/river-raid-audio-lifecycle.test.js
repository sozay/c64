import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAudio } from '../src/games/river-raid/audio.js';

// A window without any AudioContext constructor stands in for a browser where
// WebAudio is unavailable or was never unlocked: the clean-exit path must be a
// no-op, not a crash (T-202 scope item 3).
const noAudioWindow = {};

test('dispose is a no-op when no AudioContext was ever instantiated', () => {
  const audio = createAudio({ window: noAudioWindow, storage: null });

  assert.equal(audio.isUnlocked(), false);
  assert.equal(audio.getContext(), null);

  assert.doesNotThrow(() => audio.dispose());
  assert.equal(audio.getContext(), null);
});

test('a muted layer never creates an AudioContext and exits cleanly', () => {
  const audio = createAudio({ window: noAudioWindow, storage: null, muted: true });

  audio.unlock();
  assert.equal(audio.isUnlocked(), false, 'muted audio never instantiates a context');

  audio.dispose();
  assert.equal(audio.getContext(), null);
});

test('attachControls disposes its listeners without an AudioContext', () => {
  const listeners = new Map();
  const target = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  const audio = createAudio({ window: noAudioWindow, storage: null });
  const controls = audio.attachControls(target);
  assert.equal(listeners.size, 2, 'pointerdown and keydown are attached');

  controls.dispose();
  assert.equal(listeners.size, 0, 'both listeners are released');
  audio.dispose();
});
