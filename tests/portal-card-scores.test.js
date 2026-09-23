import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFakeDocument } from './helpers/fake-dom.js';
import { renderHome } from '../src/portal/index.js';
import { GAMES } from '../src/portal/registry.js';
import { HIGH_SCORE_KEY, recordHighScore } from '../src/games/river-raid/high-scores.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function setup(storage) {
  const document = createFakeDocument();
  globalThis.document = document;
  const container = document.createElement('div');
  const view = renderHome(container, { storage });
  return { view };
}

test('a card shows the persisted best score, or a placeholder when empty', () => {
  const empty = setup(memoryStorage());
  assert.equal(
    empty.view.cards[0].querySelector('.game-card__score').textContent,
    'BEST ------',
  );

  const storage = memoryStorage();
  recordHighScore(storage, 4321);
  const populated = setup(storage);
  assert.equal(
    populated.view.cards[0].querySelector('.game-card__score').textContent,
    'BEST 004321',
  );
});

test('refreshScores updates the card without rebuilding it', () => {
  const storage = memoryStorage();
  const { view } = setup(storage);
  const card = view.cards[0];

  recordHighScore(storage, 777);
  view.refreshScores();

  assert.equal(card.querySelector('.game-card__score').textContent, 'BEST 000777');
  assert.equal(view.cards[0], card, 'the same card node is reused');
});

test('the river-raid card uses the registry high-score key', () => {
  const game = GAMES.find((entry) => entry.id === 'river-raid');
  assert.equal(game.highScoreKey, HIGH_SCORE_KEY);
});
