// Data-driven games registry for the portal home page.
//
// The home page renders one card per entry and derives every card label from
// the `available` flag through `cardLabel()`. Later tickets flip availability
// (for example River Raid becoming PLAYABLE) with a one-line data edit and no
// UI changes, so this module is the single source of truth for the catalogue.

export const AVAILABILITY = Object.freeze({
  available: 'available',
  unavailable: 'unavailable',
});

export const CARD_LABELS = Object.freeze({
  [AVAILABILITY.available]: 'PLAYABLE',
  [AVAILABILITY.unavailable]: 'COMING SOON',
});

export const GAMES = Object.freeze([
  Object.freeze({
    id: 'river-raid',
    title: 'River Raid',
    available: false,
    tagline: 'Navigate the river, dodge the banks.',
    year: 1982,
    genre: 'Shoot \u2019em up',
    accent: 'primary',
  }),
]);

export function listGames() {
  return GAMES;
}

export function getGame(id) {
  return GAMES.find((game) => game.id === id) ?? null;
}

export function availabilityOf(game) {
  return game?.available === true
    ? AVAILABILITY.available
    : AVAILABILITY.unavailable;
}

export function isPlayable(game) {
  return availabilityOf(game) === AVAILABILITY.available;
}

export function cardLabel(game) {
  return CARD_LABELS[availabilityOf(game)];
}
