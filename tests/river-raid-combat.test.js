import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  boxesOverlap,
  findBulletTarget,
  findJetEnemy,
  findRefuelDepot,
} from '../src/games/river-raid/combat.js';

function box(overrides = {}) {
  return {
    x: 100,
    worldY: 200,
    halfWidth: 10,
    halfHeight: 10,
    ...overrides,
  };
}

test('boxesOverlap detects overlap and separation on both axes', () => {
  assert.equal(boxesOverlap(box(), box({ x: 110 })), true, 'touching counts');
  assert.equal(boxesOverlap(box(), box({ worldY: 200 + 20 })), true);
  assert.equal(boxesOverlap(box(), box({ x: 121 })), false);
  assert.equal(boxesOverlap(box(), box({ worldY: 221 })), false);
});

test('findBulletTarget selects an overlapping enemy', () => {
  const enemy = { kind: 'enemy', type: 'ship', ...box() };
  assert.equal(findBulletTarget([enemy], box()), enemy);
});

test('findBulletTarget selects an overlapping depot so bullets are blocked', () => {
  const depot = { kind: 'depot', type: 'depot', used: false, ...box() };
  const enemy = { kind: 'enemy', type: 'ship', ...box({ worldY: 400 }) };
  assert.equal(findBulletTarget([depot, enemy], box()), depot);
});

test('findBulletTarget returns null when nothing overlaps', () => {
  const enemy = { kind: 'enemy', type: 'ship', ...box({ x: 400 }) };
  assert.equal(findBulletTarget([enemy], box()), null);
});

test('findJetEnemy ignores depots', () => {
  const depot = { kind: 'depot', type: 'depot', used: false, ...box() };
  assert.equal(findJetEnemy([depot], box()), null);

  const enemy = { kind: 'enemy', type: 'ship', ...box() };
  assert.equal(findJetEnemy([depot, enemy], box()), enemy);
});

test('findRefuelDepot ignores used depots', () => {
  const used = { kind: 'depot', type: 'depot', used: true, ...box() };
  assert.equal(findRefuelDepot([used], box()), null);

  const fresh = { kind: 'depot', type: 'depot', used: false, ...box() };
  assert.equal(findRefuelDepot([used, fresh], box()), fresh);
});
