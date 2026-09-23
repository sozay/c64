import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABILITY,
  CARD_LABELS,
  GAMES,
  availabilityOf,
  cardLabel,
  getGame,
  isPlayable,
  listGames,
} from '../src/portal/registry.js';

test('registry exposes a non-empty, frozen list of games', () => {
  assert.ok(Array.isArray(GAMES));
  assert.ok(GAMES.length > 0);
  assert.ok(Object.isFrozen(GAMES));
  assert.equal(listGames(), GAMES);
});

test('every game has the card metadata the home page renders', () => {
  const ids = new Set();
  for (const game of GAMES) {
    assert.equal(typeof game.id, 'string');
    assert.ok(game.id.length > 0);
    assert.ok(!ids.has(game.id), `duplicate game id ${game.id}`);
    ids.add(game.id);
    assert.equal(typeof game.title, 'string');
    assert.ok(game.title.length > 0);
    assert.equal(typeof game.available, 'boolean');
    assert.equal(typeof game.tagline, 'string');
    assert.equal(typeof game.year, 'number');
    assert.equal(typeof game.genre, 'string');
    assert.equal(typeof game.accent, 'string');
    assert.ok(Object.isFrozen(game));
  }
});

test('river-raid is registered and PLAYABLE after the T-200 flag flip', () => {
  const riverRaid = getGame('river-raid');
  assert.ok(riverRaid, 'river-raid should be registered');
  assert.equal(riverRaid.available, true);
  assert.equal(isPlayable(riverRaid), true);
  assert.equal(availabilityOf(riverRaid), AVAILABILITY.available);
  assert.equal(cardLabel(riverRaid), 'PLAYABLE');
});

test('getGame returns null for an unknown id', () => {
  assert.equal(getGame('does-not-exist'), null);
});

test('availability flag drives the card label', () => {
  assert.equal(
    cardLabel({ available: true }),
    CARD_LABELS[AVAILABILITY.available],
  );
  assert.equal(
    cardLabel({ available: false }),
    CARD_LABELS[AVAILABILITY.unavailable],
  );
  assert.equal(cardLabel(undefined), CARD_LABELS[AVAILABILITY.unavailable]);
});

test('a one-line availability flip changes the label with no other edits', () => {
  const riverRaid = getGame('river-raid');
  const flipped = { ...riverRaid, available: false };
  assert.equal(cardLabel(riverRaid), 'PLAYABLE');
  assert.equal(cardLabel(flipped), 'COMING SOON');
  assert.equal(isPlayable(flipped), false);
});
