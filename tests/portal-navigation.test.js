import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_KEYS,
  nextIndex,
  prevIndex,
  resolveKey,
} from '../src/portal/navigation.js';

test('nextIndex walks cards in order and wraps at the end', () => {
  assert.equal(nextIndex(0, 3), 1);
  assert.equal(nextIndex(1, 3), 2);
  assert.equal(nextIndex(2, 3), 0);
});

test('prevIndex walks cards in reverse order and wraps at the start', () => {
  assert.equal(prevIndex(2, 3), 1);
  assert.equal(prevIndex(1, 3), 0);
  assert.equal(prevIndex(0, 3), 2);
});

test('index helpers degrade safely for an empty grid', () => {
  assert.equal(nextIndex(0, 0), -1);
  assert.equal(prevIndex(0, 0), -1);
});

test('every card is reachable in order by repeated next', () => {
  const count = 4;
  const visited = [];
  let index = 0;
  for (let step = 0; step < count; step += 1) {
    visited.push(index);
    index = nextIndex(index, count);
  }
  assert.deepEqual(visited, [0, 1, 2, 3]);
  assert.equal(index, 0);
});

test('arrow keys resolve to movement intents', () => {
  assert.deepEqual(resolveKey('ArrowRight', 0, 3), { type: 'move', index: 1 });
  assert.deepEqual(resolveKey('ArrowDown', 0, 3), { type: 'move', index: 1 });
  assert.deepEqual(resolveKey('ArrowLeft', 0, 3), { type: 'move', index: 2 });
  assert.deepEqual(resolveKey('ArrowUp', 2, 3), { type: 'move', index: 1 });
});

test('Home and End jump to the first and last card', () => {
  assert.deepEqual(resolveKey('Home', 2, 5), { type: 'move', index: 0 });
  assert.deepEqual(resolveKey('End', 0, 5), { type: 'move', index: 4 });
});

test('Enter and Space resolve to an activation intent', () => {
  assert.deepEqual(resolveKey('Enter', 1, 3), { type: 'activate', index: 1 });
  assert.deepEqual(resolveKey('Space', 1, 3), { type: 'activate', index: 1 });
  assert.deepEqual(resolveKey('Enter', -1, 3), { type: 'activate', index: 0 });
});

test('non-navigation keys and empty grids resolve to null', () => {
  assert.equal(resolveKey('KeyA', 0, 3), null);
  assert.equal(resolveKey('Tab', 0, 3), null);
  assert.equal(resolveKey('ArrowRight', 0, 0), null);
  assert.equal(NAV_KEYS.Tab, undefined);
});
