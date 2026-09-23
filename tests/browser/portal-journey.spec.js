import { test, expect } from '@playwright/test';

// Full keyboard-only portal journey (T-202): home -> launch -> C64 boot ->
// play -> game over -> high score saved -> back to portal -> loop stopped and
// audio released. The AudioContext probe wraps the constructor before any app
// code runs and records the real context instances so the "no active
// AudioContext after exit" assertion is about browser state, not our bookkeeping.
function installAudioProbe() {
  window.__audioContexts = [];
  const Original = window.AudioContext || window.webkitAudioContext;
  if (!Original) return;

  function CountingAudioContext(...args) {
    const context = new Original(...args);
    window.__audioContexts.push(context);
    return context;
  }
  CountingAudioContext.prototype = Original.prototype;

  window.AudioContext = CountingAudioContext;
  window.webkitAudioContext = CountingAudioContext;
}

const HIGH_SCORE_KEY = 'river-raid.highscores';

test('keyboard-only journey: launch, boot, game over, high score, clean exit', async ({ page }) => {
  await page.addInitScript(installAudioProbe);

  await page.goto('/');
  // Clear once, not via addInitScript: that would also wipe the score on the
  // reload used to prove persistence.
  await page.evaluate((key) => window.localStorage.removeItem(key), HIGH_SCORE_KEY);

  const card = page.locator('.game-card[data-game-id="river-raid"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('PLAYABLE');

  // Keyboard-only entry: Tab focuses the first card, Enter launches it.
  await page.keyboard.press('Tab');
  await expect(card).toBeFocused();
  await page.keyboard.press('Enter');

  // The C64 boot/loading sequence is visible before the canvas takes over.
  const boot = page.locator('#boot-screen');
  await expect(boot).toBeVisible();
  await expect(boot).toContainText('RIVER RAID');
  await expect(boot).toContainText('LOADING');

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();
  await expect(boot).toBeHidden();
  await expect(page.locator('#game-status')).toContainText('SCORE');

  // Play to game over deterministically: hold left until the jet crashes out
  // of its three lives against the river bank.
  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(() => page.evaluate(() => window.__riverRaid?.state?.gameOver ?? false), {
      timeout: 25000,
    })
    .toBe(true);
  await page.keyboard.up('ArrowLeft');

  const finalScore = await page.evaluate(() => window.__riverRaid.state.score);

  // The finished run is persisted to browser storage and shown on screen.
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '[]').length, HIGH_SCORE_KEY))
    .toBeGreaterThan(0);
  const saved = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '[]'), HIGH_SCORE_KEY);
  expect(saved[0]).toBe(finalScore);
  await expect(page.locator('#game-status')).toContainText('HIGH SCORE');

  // Clean exit back to the portal.
  await page.keyboard.press('Escape');
  await expect(canvas).toBeHidden();
  await expect(boot).toBeHidden();
  await expect(card).toBeVisible();

  // The loop is stopped: running is false and the tick counter is frozen.
  const status = await page.evaluate(() => window.__riverRaid.getStatus());
  expect(status.running).toBe(false);
  await page.waitForTimeout(400);
  const statusLater = await page.evaluate(() => window.__riverRaid.getStatus());
  expect(statusLater.ticks).toBe(status.ticks);

  // Audio released: every created context is closed and the layer is torn down.
  const audioStates = await page.evaluate(() => window.__audioContexts.map((context) => context.state));
  expect(audioStates.length).toBeGreaterThan(0);
  expect(audioStates.every((state) => state === 'closed')).toBe(true);
  expect(await page.evaluate(() => window.__riverRaidAudio.getContext())).toBe(null);

  // The portal card reflects the persisted best score.
  const best = String(finalScore).padStart(6, '0');
  await expect(card.locator('.game-card__score')).toContainText(`BEST ${best}`);

  // And the best score survives a reload.
  await page.reload();
  await expect(page.locator('.game-card[data-game-id="river-raid"] .game-card__score')).toContainText(
    `BEST ${best}`,
  );
});
