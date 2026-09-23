import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeDocument } from './helpers/fake-dom.js';
import { renderHome } from '../src/portal/index.js';
import { GAMES, cardLabel } from '../src/portal/registry.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function setup(games = GAMES) {
  const document = createFakeDocument();
  globalThis.document = document;
  const container = document.createElement('div');
  const view = renderHome(container, { games });
  return { document, container, view };
}

function key(card, code) {
  card.dispatchEvent({ type: 'keydown', code, bubbles: true });
}

test('renders one card per registry entry with availability-driven labels', () => {
  const { view } = setup();
  assert.equal(view.cards.length, GAMES.length);

  view.cards.forEach((card, index) => {
    const game = GAMES[index];
    assert.equal(card.dataset.gameId, game.id);
    assert.equal(card.dataset.available, String(game.available));
    assert.ok(
      card.textContent.includes(cardLabel(game)),
      `card for ${game.id} should show its availability label`,
    );
    assert.ok(card.textContent.includes(game.title));
  });

  assert.equal(view.status.dataset.status, 'idle');
});

test('keyboard navigation moves focus between cards in order', () => {
  const games = [
    { ...GAMES[0] },
    { ...GAMES[0], id: 'synthetic-two', title: 'Synthetic Two', available: true },
  ];
  const { document, view } = setup(games);

  view.cards[0].focus();
  assert.equal(document.activeElement, view.cards[0]);
  assert.equal(view.currentIndex, 0);

  key(view.cards[0], 'ArrowRight');
  assert.equal(document.activeElement, view.cards[1]);
  assert.equal(view.currentIndex, 1);

  key(view.cards[1], 'ArrowRight');
  assert.equal(document.activeElement, view.cards[0], 'wraps to the first card');

  key(view.cards[0], 'ArrowLeft');
  assert.equal(document.activeElement, view.cards[1], 'wraps to the last card');

  key(view.cards[1], 'Home');
  assert.equal(document.activeElement, view.cards[0]);

  key(view.cards[0], 'End');
  assert.equal(document.activeElement, view.cards[1]);
});

test('Enter on an unavailable card shows DOM feedback and never launches', () => {
  const games = [
    { ...GAMES[0], id: 'locked', title: 'Locked Game', available: false },
    { ...GAMES[0], id: 'ready', title: 'Ready Game', available: true },
  ];
  const launched = [];
  const document = createFakeDocument();
  globalThis.document = document;
  const container = document.createElement('div');
  const view = renderHome(container, {
    games,
    onLaunch: (game) => launched.push(game.id),
  });

  view.cards[0].focus();
  key(view.cards[0], 'Enter');

  assert.equal(view.status.dataset.status, 'unavailable');
  assert.ok(view.status.textContent.includes('Locked Game'));
  assert.ok(view.status.textContent.includes('COMING SOON'));
  assert.deepEqual(launched, [], 'unavailable activation must not launch');

  view.cards[1].focus();
  key(view.cards[1], 'Enter');

  assert.equal(view.status.dataset.status, 'launching');
  assert.deepEqual(launched, ['ready']);
});

test('index.html carries the CRT scanline overlay element', async () => {
  const html = await read('index.html');
  assert.match(html, /class="scanlines"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /id="app"/);
});

test('neon CSS custom properties are defined in the design tokens', async () => {
  const tokens = await read('src/styles/tokens.css');
  for (const token of ['--neon-primary', '--neon-secondary', '--neon-accent']) {
    assert.ok(tokens.includes(`${token}:`), `missing neon token ${token}`);
  }
});

test('portal stylesheet defines the scanline overlay and card focus glow', async () => {
  const css = await read('src/styles/portal.css');
  assert.match(css, /\.scanlines\s*\{/);
  assert.match(css, /\.game-card:focus-visible\s*\{/);
});

test('entry module mounts the portal home page with its styles', async () => {
  const main = await read('src/main.js');
  assert.match(main, /import '\.\/styles\/portal\.css'/);
  assert.match(main, /from '\.\/portal\/index\.js'/);
  assert.match(main, /mount\(app\)/);
});
