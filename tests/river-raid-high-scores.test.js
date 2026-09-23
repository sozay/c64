import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HIGH_SCORE_KEY,
  MAX_HIGH_SCORES,
  bestScore,
  formatScore,
  normalizeScores,
  readHighScores,
  recordHighScore,
} from '../src/games/river-raid/high-scores.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    dump() {
      return map;
    },
  };
}

test('an empty or corrupt store reads as an empty table', () => {
  assert.deepEqual(readHighScores(memoryStorage()), []);
  assert.deepEqual(readHighScores(memoryStorage({ [HIGH_SCORE_KEY]: 'not json' })), []);
  assert.deepEqual(readHighScores(memoryStorage({ [HIGH_SCORE_KEY]: '{"a":1}' })), []);
  assert.deepEqual(readHighScores(null), []);
});

test('normalizeScores drops non-numeric and negative entries and sorts descending', () => {
  assert.deepEqual(normalizeScores([10, 'x', -5, 30, 20, null, 15]), [30, 20, 15, 10]);
  assert.deepEqual(normalizeScores('nope'), []);
});

test('recordHighScore keeps the top five and reports rank and a new best', () => {
  const storage = memoryStorage();

  const first = recordHighScore(storage, 100);
  assert.deepEqual(first.scores, [100]);
  assert.equal(first.rank, 1);
  assert.equal(first.isNewHighScore, true);
  assert.equal(first.recorded, true);

  const second = recordHighScore(storage, 50);
  assert.deepEqual(second.scores, [100, 50]);
  assert.equal(second.rank, 2);
  assert.equal(second.isNewHighScore, false);

  for (const score of [10, 20, 30, 40, 5]) recordHighScore(storage, score);
  const stored = readHighScores(storage);
  assert.equal(stored.length, MAX_HIGH_SCORES);
  assert.deepEqual(stored, [100, 50, 40, 30, 20]);
  assert.equal(bestScore(storage), 100);
});

test('a run that ties the best is not reported as a new high score', () => {
  const storage = memoryStorage();
  recordHighScore(storage, 200);
  const tie = recordHighScore(storage, 200);
  assert.equal(tie.isNewHighScore, false);
  assert.equal(tie.rank, 1);
});

test('an unusable score is not recorded and leaves the table intact', () => {
  const storage = memoryStorage();
  recordHighScore(storage, 42);
  const result = recordHighScore(storage, Number.NaN);
  assert.equal(result.recorded, false);
  assert.equal(result.rank, null);
  assert.deepEqual(result.scores, [42]);
});

test('a storage that throws degrades to a safe no-op', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.deepEqual(readHighScores(blocked), []);
  const result = recordHighScore(blocked, 10);
  assert.equal(result.recorded, true);
  assert.deepEqual(result.scores, [10]);
});

test('formatScore pads to six digits and rejects unusable input', () => {
  assert.equal(formatScore(0), '000000');
  assert.equal(formatScore(1234), '001234');
  assert.equal(formatScore(999999), '999999');
  assert.equal(formatScore(-1), '------');
  assert.equal(formatScore('x'), '------');
});
