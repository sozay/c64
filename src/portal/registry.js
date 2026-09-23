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
    available: true,
    tagline: 'Navigate the river, dodge the banks.',
    year: 1982,
    genre: 'Shoot \u2019em up',
    accent: 'primary',
    // T-200 flipped this flag to PLAYABLE when it merged with the portal home
    // page already present; T-202 therefore has no flag edit to make (the flip
    // has exactly one owner on every path). `seed` and `highScoreKey` let the
    // portal launch the game and surface its persisted best score.
    seed: 7,
    highScoreKey: 'river-raid.highscores',
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
