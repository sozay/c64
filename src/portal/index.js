// Portal home page: a cyberpunk game grid driven by the games registry.
//
// The view is intentionally thin: registry.js owns the catalogue and label
// mapping, navigation.js owns the keyboard rules, and this module binds both
// to real DOM nodes. Activation of a game is a stub (onLaunch) because the
// real launch/boot flow is T-202's scope; an unavailable card must show
// visible feedback and never navigate.

import { AVAILABILITY, CARD_LABELS, cardLabel, isPlayable, listGames } from './registry.js';
import { resolveKey } from './navigation.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCard(game, index) {
  const item = el('li', 'game-grid__item');
  const available = isPlayable(game);

  const card = el('button', 'game-card');
  card.type = 'button';
  card.dataset.gameId = game.id;
  card.dataset.available = String(available);
  card.dataset.index = String(index);
  card.setAttribute('aria-label', `${game.title} \u2014 ${cardLabel(game)}`);

  const cover = el('span', 'game-card__cover');
  cover.setAttribute('aria-hidden', 'true');
  cover.dataset.accent = game.accent ?? 'primary';

  const body = el('span', 'game-card__body');
  body.appendChild(el('span', 'game-card__title', game.title));
  body.appendChild(el('span', 'game-card__tagline', game.tagline));

  const meta = el('span', 'game-card__meta', `${game.year} \u00b7 ${game.genre}`);
  const label = el('span', 'game-card__label', cardLabel(game));
  label.dataset.available = String(available);

  card.append(cover, body, meta, label);
  item.appendChild(card);
  return item;
}

export function renderHome(container, { games = listGames(), onLaunch } = {}) {
  const root = el('section', 'portal');
  root.dataset.portal = 'home';

  const header = el('header', 'portal__header');
  header.appendChild(el('p', 'portal__eyebrow', 'C64 \u00b7 AMIGA \u00b7 ATARI'));
  header.appendChild(el('h1', 'portal__title', 'RETRO GRID'));
  header.appendChild(
    el(
      'p',
      'portal__subtitle',
      'Insert coin. Pick a cartridge. Use arrow keys and Enter.',
    ),
  );

  const grid = el('ul', 'game-grid');
  const items = games.map(createCard);
  items.forEach((item) => grid.appendChild(item));

  const status = el('p', 'portal__status', 'Select a game and press Enter.');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.dataset.status = 'idle';

  root.append(header, grid, status);
  container.appendChild(root);

  const cards = [...grid.querySelectorAll('.game-card')];
  let currentIndex = cards.length > 0 ? 0 : -1;

  const setStatus = (state, message) => {
    status.dataset.status = state;
    status.textContent = message;
  };

  const focusCard = (index) => {
    const card = cards[index];
    if (!card) return;
    currentIndex = index;
    card.focus();
  };

  const activate = (index) => {
    const game = games[index];
    if (!game) return;
    if (!isPlayable(game)) {
      setStatus(
        AVAILABILITY.unavailable,
        `${game.title} \u2014 ${CARD_LABELS[AVAILABILITY.unavailable]}. This game is not playable yet.`,
      );
      return;
    }
    setStatus('launching', `Launching ${game.title}\u2026`);
    if (typeof onLaunch === 'function') onLaunch(game);
  };

  const onKeyDown = (event) => {
    const result = resolveKey(event.code, currentIndex, cards.length);
    if (!result) return;
    event.preventDefault();
    if (result.type === 'move') {
      focusCard(result.index);
    } else if (result.type === 'activate') {
      activate(result.index);
    }
  };

  const onFocusIn = (event) => {
    const index = cards.indexOf(event.target);
    if (index >= 0) currentIndex = index;
  };

  const onCardClick = (event) => {
    const card = event.target.closest?.('.game-card');
    if (!card || !grid.contains(card)) return;
    activate(cards.indexOf(card));
  };

  grid.addEventListener('keydown', onKeyDown);
  grid.addEventListener('focusin', onFocusIn);
  grid.addEventListener('click', onCardClick);

  return {
    element: root,
    cards,
    status,
    activate,
    focus: focusCard,
    get currentIndex() {
      return currentIndex;
    },
    dispose() {
      grid.removeEventListener('keydown', onKeyDown);
      grid.removeEventListener('focusin', onFocusIn);
      grid.removeEventListener('click', onCardClick);
      root.remove();
    },
  };
}

export function mount(container, options = {}) {
  return renderHome(container, options);
}
