// Canvas render layer for River Raid.
//
// The renderer consumes a simulation snapshot (the state object) and draws it
// at display rate. It owns no simulation logic: the fixed-timestep core is
// advanced elsewhere, so rendering and simulation stay decoupled.

import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SEGMENT_HEIGHT,
  PLAYER_SCREEN_Y,
  PLAYER_HALF_WIDTH,
  PLAYER_HALF_HEIGHT,
  FUEL_MAX,
  COLORS,
} from './constants.js';
import { bankAt, segmentIndexFor } from './terrain.js';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  return {
    draw(state) {
      render(context, state);
    },
  };
}

export function render(context, state) {
  context.fillStyle = COLORS.sky;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const firstIndex = Math.max(0, segmentIndexFor(state.scrollY) - 1);
  const lastIndex = segmentIndexFor(state.scrollY + WORLD_HEIGHT) + 1;

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const worldTop = index * SEGMENT_HEIGHT;
    const screenTop = worldTop - state.scrollY;
    const banks = bankAt(state.terrain, worldTop + SEGMENT_HEIGHT / 2);
    const bandHeight = SEGMENT_HEIGHT + 1;

    context.fillStyle = COLORS.land;
    context.fillRect(0, screenTop, WORLD_WIDTH, bandHeight);

    context.fillStyle = COLORS.river;
    context.fillRect(banks.left, screenTop, banks.right - banks.left, bandHeight);

    context.fillStyle = COLORS.riverEdge;
    context.fillRect(banks.left - 2, screenTop, 2, bandHeight);
    context.fillRect(banks.right, screenTop, 2, bandHeight);
  }

  for (const entity of state.entities) {
    const screenY = entity.worldY - state.scrollY;
    if (screenY < -SEGMENT_HEIGHT || screenY > WORLD_HEIGHT + SEGMENT_HEIGHT) {
      continue;
    }
    if (entity.kind === 'depot') drawDepot(context, entity, screenY);
    else if (entity.kind === 'bridge') drawBridge(context, entity, screenY);
    else drawEnemy(context, entity, screenY);
  }

  if (state.bullet) {
    const bulletY = state.bullet.worldY - state.scrollY;
    context.fillStyle = COLORS.bullet;
    context.fillRect(
      state.bullet.x - 2,
      bulletY - 6,
      4,
      12,
    );
  }

  const { x, collided } = state.player;
  context.fillStyle = collided ? COLORS.jetCollided : COLORS.jet;
  context.beginPath();
  context.moveTo(x, PLAYER_SCREEN_Y - PLAYER_HALF_HEIGHT);
  context.lineTo(x - PLAYER_HALF_WIDTH, PLAYER_SCREEN_Y + PLAYER_HALF_HEIGHT);
  context.lineTo(x + PLAYER_HALF_WIDTH, PLAYER_SCREEN_Y + PLAYER_HALF_HEIGHT);
  context.closePath();
  context.fill();

  context.fillStyle = COLORS.jetAccent;
  context.fillRect(
    x - 1.5,
    PLAYER_SCREEN_Y + PLAYER_HALF_HEIGHT,
    3,
    4,
  );

  drawHud(context, state);
  if (state.gameOver) drawGameOver(context, state);
}

// C64-style status band: score, level, lives and a fuel gauge, all drawn on
// the game surface so the HUD travels with the canvas (portal integration is
// T-202's scope). The simulation keeps no HUD state beyond the numbers shown.
function drawHud(context, state) {
  const pad = 8;
  const panelHeight = 26;

  context.save();
  context.fillStyle = COLORS.hudPanel;
  context.fillRect(0, 0, WORLD_WIDTH, panelHeight);

  context.font = 'bold 13px "Courier New", ui-monospace, monospace';
  context.textBaseline = 'top';
  context.fillStyle = COLORS.hud;

  context.textAlign = 'left';
  context.fillText(`SCORE ${String(state.score).padStart(6, '0')}`, pad, 7);
  context.textAlign = 'center';
  context.fillText(`LEVEL ${String(state.level).padStart(2, '0')}`, WORLD_WIDTH / 2, 7);
  context.textAlign = 'right';
  context.fillText(`LIVES ${state.lives}`, WORLD_WIDTH - pad, 7);

  drawFuelGauge(context, state, pad, WORLD_HEIGHT - 22, 130, 12);
  context.restore();
}

function drawFuelGauge(context, state, x, y, width, height) {
  const ratio = Math.max(0, Math.min(1, state.fuel / FUEL_MAX));
  context.save();
  context.font = 'bold 11px "Courier New", ui-monospace, monospace';
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillStyle = COLORS.hud;
  context.fillText('FUEL', x, y + height / 2);

  const barX = x + 42;
  const barWidth = width - 42;
  context.strokeStyle = COLORS.hud;
  context.lineWidth = 2;
  context.strokeRect(barX, y, barWidth, height);
  context.fillStyle = ratio <= 0.25 ? COLORS.fuelLow : COLORS.fuelHigh;
  context.fillRect(barX + 2, y + 2, Math.max(0, (barWidth - 4) * ratio), height - 4);
  context.restore();
}

function drawGameOver(context, state) {
  context.save();
  context.fillStyle = COLORS.gameOverPanel;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = COLORS.jetCollided;
  context.font = 'bold 44px "Courier New", ui-monospace, monospace';
  context.fillText('GAME OVER', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 70);

  context.fillStyle = COLORS.hud;
  context.font = 'bold 20px "Courier New", ui-monospace, monospace';
  context.fillText(`FINAL SCORE ${state.score}`, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 10);
  context.fillText(
    `LEVEL ${state.level} \u00b7 REASON ${String(state.gameOverReason).toUpperCase()}`,
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2 + 22,
  );

  context.fillStyle = COLORS.jetAccent;
  context.font = 'bold 16px "Courier New", ui-monospace, monospace';
  context.fillText('PRESS ENTER TO RESTART', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 70);
  context.restore();
}

function drawBridge(context, entity, screenY) {
  const { x, halfWidth, halfHeight } = entity;
  context.fillStyle = COLORS.bridgeAccent;
  context.fillRect(x - halfWidth, screenY - halfHeight, halfWidth * 2, halfHeight * 2);
  context.fillStyle = COLORS.bridge;
  for (let sx = x - halfWidth; sx < x + halfWidth; sx += 12) {
    const segmentWidth = Math.min(7, x + halfWidth - sx);
    context.fillRect(sx, screenY - halfHeight + 1, segmentWidth, halfHeight * 2 - 2);
  }
}

function drawDepot(context, entity, screenY) {
  const { x, halfWidth, halfHeight, used } = entity;
  context.fillStyle = used ? COLORS.depotUsed : COLORS.depot;
  context.fillRect(x - halfWidth, screenY - halfHeight, halfWidth * 2, halfHeight * 2);
  context.fillStyle = COLORS.sky;
  context.fillRect(x - halfWidth + 3, screenY - halfHeight + 3, halfWidth * 2 - 6, halfHeight * 2 - 6);
  context.fillStyle = used ? COLORS.depotUsed : COLORS.depot;
  context.fillRect(x - 2, screenY - halfHeight + 3, 4, halfHeight * 2 - 6);
}

function drawEnemy(context, entity, screenY) {
  const { x, halfWidth, halfHeight, type } = entity;

  if (type === 'helicopter') {
    context.fillStyle = COLORS.helicopterAccent;
    context.fillRect(x - halfWidth - 4, screenY - halfHeight - 4, halfWidth * 2 + 8, 2);
    context.fillStyle = COLORS.helicopter;
    context.fillRect(x - halfWidth, screenY - halfHeight, halfWidth * 2, halfHeight * 2);
    return;
  }

  context.fillStyle = COLORS.shipAccent;
  context.fillRect(x - halfWidth, screenY + halfHeight - 3, halfWidth * 2, 3);
  context.fillStyle = COLORS.ship;
  context.beginPath();
  context.moveTo(x - halfWidth, screenY + halfHeight - 3);
  context.lineTo(x + halfWidth, screenY + halfHeight - 3);
  context.lineTo(x + halfWidth - 3, screenY - halfHeight);
  context.lineTo(x - halfWidth + 3, screenY - halfHeight);
  context.closePath();
  context.fill();
}
