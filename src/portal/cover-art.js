// Procedural canvas cover art for the portal game cards (T-202).
//
// Cards must not ship binary art assets, so each cover is drawn from the game's
// registry metadata with a small deterministic pseudo-random generator seeded by
// the game id. The same game always produces the same cover, and the draw is a
// no-op when a canvas 2D context is unavailable (for example the node:test fake
// DOM), so the view layer stays testable without a browser.

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const PALETTE = Object.freeze({
  sky: '#0a0a12',
  land: '#2f6b2f',
  landEdge: '#1c451c',
  river: '#1b3a6b',
  riverEdge: '#4f8fd1',
  jet: '#e8e8f0',
  accent: '#f2b134',
  accentSecondary: '#ff2fb9',
  bridge: '#d8d8c8',
});

// Draws a vertical river scene: banks left and right, a winding navigable
// channel, a checkpoint bridge, a couple of fuel depots and the jet. Returns the
// 2D context (or null when unavailable) so callers/tests can assert the draw.
export function drawCoverArt(canvas, game = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const width = canvas.width || 320;
  const height = canvas.height || 180;
  const random = createRandom(hashString(String(game.id ?? 'game')));
  const accent = game.accent === 'secondary' ? PALETTE.accentSecondary : PALETTE.accent;

  context.fillStyle = PALETTE.sky;
  context.fillRect(0, 0, width, height);

  // Land fills the full frame; the river is carved out on top of it.
  context.fillStyle = PALETTE.land;
  context.fillRect(0, 0, width, height);

  const segments = 12;
  const band = height / segments;
  const lefts = [];
  const rights = [];
  const centerBase = width / 2;
  let wobble = (random() - 0.5) * width * 0.12;

  for (let index = 0; index <= segments; index += 1) {
    wobble += (random() - 0.5) * width * 0.09;
    wobble = Math.max(-width * 0.16, Math.min(width * 0.16, wobble));
    const center = centerBase + wobble;
    const halfWidth = width * (0.12 + random() * 0.08);
    lefts.push(center - halfWidth);
    rights.push(center + halfWidth);
  }

  context.fillStyle = PALETTE.river;
  context.beginPath();
  context.moveTo(lefts[0], 0);
  for (let index = 1; index <= segments; index += 1) {
    context.lineTo(lefts[index], index * band);
  }
  for (let index = segments; index >= 0; index -= 1) {
    context.lineTo(rights[index], index * band);
  }
  context.closePath();
  context.fill();

  context.strokeStyle = PALETTE.riverEdge;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(lefts[0], 0);
  for (let index = 1; index <= segments; index += 1) context.lineTo(lefts[index], index * band);
  context.stroke();
  context.beginPath();
  context.moveTo(rights[0], 0);
  for (let index = 1; index <= segments; index += 1) context.lineTo(rights[index], index * band);
  context.stroke();

  // Checkpoint bridge across the channel.
  const bridgeRow = 3;
  context.fillStyle = PALETTE.bridge;
  context.fillRect(lefts[bridgeRow], bridgeRow * band + band / 2 - 3, rights[bridgeRow] - lefts[bridgeRow], 6);

  // A depot and a hazard marker on the banks.
  context.fillStyle = accent;
  context.fillRect(lefts[7] + 6, 7 * band + 4, 10, 10);
  context.fillStyle = PALETTE.jet;
  context.fillRect(rights[9] - 16, 9 * band + 4, 10, 6);

  // The jet, near the bottom of the channel.
  const jetX = (lefts[10] + rights[10]) / 2;
  const jetY = 10 * band + band * 0.4;
  context.fillStyle = PALETTE.jet;
  context.beginPath();
  context.moveTo(jetX, jetY - 7);
  context.lineTo(jetX - 7, jetY + 7);
  context.lineTo(jetX + 7, jetY + 7);
  context.closePath();
  context.fill();
  context.fillStyle = accent;
  context.fillRect(jetX - 1.5, jetY + 7, 3, 4);

  return context;
}
