// Portal: the home page view plus the launch/boot/exit controller (T-202).
//
// `renderHome` stays a thin registry-driven view; `mount` wires it to the game
// canvas so the full keyboard-only journey works: home -> launch -> C64 boot
// sequence -> play -> game over -> clean exit back to the home page. The game
// canvas is created once in index.html and reused across launches, so repeated
// play does not leak 2D contexts (T-203's net-count gate).

import { selectElement } from '../core/dom.js';
import { AVAILABILITY, CARD_LABELS, cardLabel, isPlayable, listGames } from './registry.js';
import { resolveKey } from './navigation.js';
import { drawCoverArt } from './cover-art.js';
import { startBoot } from './boot.js';
import { bestScore, defaultStorage, formatScore } from '../games/river-raid/high-scores.js';
import { createAudio } from '../games/river-raid/audio.js';
import { mount as mountGame } from '../games/river-raid/index.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bestScoreText(storage, game) {
  const best = bestScore(storage, game?.highScoreKey);
  return best == null ? 'BEST ------' : `BEST ${formatScore(best)}`;
}

function createCard(game, index, storage) {
  const item = el('li', 'game-grid__item');
  const available = isPlayable(game);

  const card = el('button', 'game-card');
  card.type = 'button';
  card.dataset.gameId = game.id;
  card.dataset.available = String(available);
  card.dataset.index = String(index);
  card.setAttribute('aria-label', `${game.title} \u2014 ${cardLabel(game)}`);

  const cover = el('canvas', 'game-card__cover');
  cover.setAttribute('aria-hidden', 'true');
  cover.width = 320;
  cover.height = 180;
  drawCoverArt(cover, game);

  const body = el('span', 'game-card__body');
  body.appendChild(el('span', 'game-card__title', game.title));
  body.appendChild(el('span', 'game-card__tagline', game.tagline));

  const meta = el('span', 'game-card__meta', `${game.year} \u00b7 ${game.genre}`);
  const label = el('span', 'game-card__label', cardLabel(game));
  label.dataset.available = String(available);

  const score = el('span', 'game-card__score', bestScoreText(storage, game));

  card.append(cover, body, meta, label, score);
  item.appendChild(card);
  return { item, card, score };
}

export function renderHome(container, { games = listGames(), onLaunch, storage = defaultStorage() } = {}) {
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
  const created = games.map((game, index) => createCard(game, index, storage));
  created.forEach(({ item }) => grid.appendChild(item));

  const status = el('p', 'portal__status', 'Select a game and press Enter.');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.dataset.status = 'idle';

  root.append(header, grid, status);
  container.appendChild(root);

  const cards = created.map(({ card }) => card);
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
    if (typeof onLaunch === 'function') onLaunch(game, index);
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
    // Re-reads the persisted best scores without rebuilding the grid, so the
    // card canvases (and their 2D contexts) are created exactly once.
    refreshScores() {
      created.forEach(({ score }, index) => {
        score.textContent = bestScoreText(storage, games[index]);
      });
    },
    show() {
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
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

// Full application controller: owns the home view, the game view in index.html,
// the audio layer and the launch/exit transitions.
export function mount(container, options = {}) {
  const win = options.window ?? globalThis;
  const storage = options.storage ?? defaultStorage(win);
  const bootDuration = options.bootDuration;

  const gameView = selectElement('#game-view', container);
  const canvas = selectElement('#game-canvas', container);
  const bootScreen = selectElement('#boot-screen', container);
  const exitButton = selectElement('#game-exit', container);
  const gameStatus = selectElement('#game-status', container);

  let game = null;
  let audio = null;
  let audioControls = null;
  let boot = null;
  let exitHandler = null;
  let bootKeyHandler = null;
  let bootKeyTimer = 0;
  let lastIndex = 0;
  let lastStatusText = '';
  let currentView = 'home';
  win.__c64View = 'home';

  const setStatus = (kind, message) => {
    gameStatus.dataset.status = kind;
    gameStatus.textContent = message;
    lastStatusText = message;
  };

  const reportFrame = (state) => {
    let text;
    if (state.gameOver) {
      const best = game?.highScores?.[0] ?? state.score;
      text = `GAME OVER (${state.gameOverReason}) \u2014 FINAL SCORE ${state.score} \u2014 HIGH SCORE ${best} \u2014 PRESS ESC TO RETURN`;
    } else {
      text = `SCORE ${state.score} \u00b7 LEVEL ${state.level} \u00b7 LIVES ${state.lives} \u00b7 FUEL ${Math.round(state.fuel)}`;
    }
    if (text !== lastStatusText) {
      lastStatusText = text;
      gameStatus.textContent = text;
    }
  };

  const home = renderHome(container, {
    storage,
    onLaunch: (selected, index) => launch(selected, index),
  });

  gameView.hidden = true;

  function startGame(selected) {
    if (bootKeyTimer) {
      win.clearTimeout(bootKeyTimer);
      bootKeyTimer = 0;
    }
    if (bootKeyHandler) {
      win.removeEventListener('keydown', bootKeyHandler);
      bootKeyHandler = null;
    }
    if (boot) {
      boot.cancel();
      boot = null;
    }

    bootScreen.hidden = true;
    canvas.hidden = false;
    currentView = 'game';
    win.__c64View = 'game';

    audio = createAudio({ window: win, storage });
    audioControls = audio.attachControls(win);
    game = mountGame(canvas, {
      seed: selected.seed ?? 7,
      audio,
      storage,
      onFrame: reportFrame,
    });
    win.__riverRaid = game;
    win.__riverRaidAudio = audio;

    exitHandler = (event) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        exit();
      }
    };
    win.addEventListener('keydown', exitHandler);
    exitButton.onclick = () => exit();
    if (typeof gameView.focus === 'function') gameView.focus();
  }

  function launch(selected, index) {
    lastIndex = index;
    currentView = 'boot';
    win.__c64View = 'boot';
    home.hide();
    gameView.hidden = false;
    canvas.hidden = true;
    bootScreen.hidden = false;
    setStatus('loading', `Loading ${selected.title}\u2026`);

    boot = startBoot(bootScreen, selected, {
      duration: bootDuration,
      onDone: () => startGame(selected),
    });

    // Attach the skip listener on the next tick so the Enter keypress that
    // launched the game does not immediately skip the sequence it started.
    bootKeyHandler = (event) => {
      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        boot?.skip();
      }
    };
    bootKeyTimer = win.setTimeout(() => {
      if (bootKeyHandler) win.addEventListener('keydown', bootKeyHandler);
    }, 0);
  }

  function exit() {
    if (exitHandler) {
      win.removeEventListener('keydown', exitHandler);
      exitHandler = null;
    }
    exitButton.onclick = null;
    if (audioControls) {
      audioControls.dispose();
      audioControls = null;
    }
    if (game) {
      // Stops the loop, releases keyboard listeners and disposes the audio
      // layer (a no-op when WebAudio was never instantiated).
      const finished = game;
      finished.dispose();
      finished.renderer?.clear?.();
      game = null;
    }
    canvas.hidden = true;
    bootScreen.hidden = true;
    gameView.hidden = true;
    home.refreshScores();
    home.show();
    currentView = 'home';
    win.__c64View = 'home';
    home.focus(lastIndex);
  }

  return {
    home,
    launch,
    exit,
    get view() {
      return currentView;
    },
    get game() {
      return game;
    },
    dispose() {
      if (exitHandler) win.removeEventListener('keydown', exitHandler);
      if (bootKeyHandler) win.removeEventListener('keydown', bootKeyHandler);
      if (audioControls) audioControls.dispose();
      if (game) game.dispose();
      home.dispose();
    },
  };
}
