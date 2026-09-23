import { test, expect } from '@playwright/test';

// Proves the T-201 autoplay guard: the page runs without input, then a user
// gesture creates exactly one AudioContext. The init script wraps the
// constructors before any application code runs, so it counts real context and
// node creation rather than trusting our own bookkeeping.
function installAudioProbe() {
  window.__audio = { contexts: 0, oscillators: 0, buffers: 0 };
  const Original = window.AudioContext || window.webkitAudioContext;
  if (!Original) return;

  function CountingAudioContext(...args) {
    window.__audio.contexts += 1;
    return new Original(...args);
  }
  CountingAudioContext.prototype = Original.prototype;

  const proto = Original.prototype;
  const originalOscillator = proto.createOscillator;
  proto.createOscillator = function (...args) {
    window.__audio.oscillators += 1;
    return originalOscillator.apply(this, args);
  };
  const originalBufferSource = proto.createBufferSource;
  proto.createBufferSource = function (...args) {
    window.__audio.buffers += 1;
    return originalBufferSource.apply(this, args);
  };

  window.AudioContext = CountingAudioContext;
  window.webkitAudioContext = CountingAudioContext;
}

const probe = (page) => page.evaluate(() => window.__audio);

test('no AudioContext exists before the first user gesture, one after', async ({ page }) => {
  await page.addInitScript(installAudioProbe);
  await page.goto('/game.html');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Let several simulation frames run with no input at all.
  await page.waitForTimeout(600);
  expect(await probe(page)).toEqual({ contexts: 0, oscillators: 0, buffers: 0 });

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await probe(page)).contexts).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__riverRaidAudio.isUnlocked())).toBe(true);
});

test('shooting after unlock synthesizes audio nodes', async ({ page }) => {
  await page.addInitScript(installAudioProbe);
  await page.goto('/game.html');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await probe(page)).contexts).toBeGreaterThan(0);

  // Hold fire across several simulation frames so a bullet is actually
  // spawned and announced (a bare press can start and end between frames).
  await page.keyboard.down('Space');
  // One oscillator for the engine hum plus at least one for the shot.
  await expect.poll(async () => (await probe(page)).oscillators).toBeGreaterThan(1);
  await page.keyboard.up('Space');
});

test('a muted layer never instantiates audio until M unmutes it', async ({ page }) => {
  await page.addInitScript(installAudioProbe);
  await page.addInitScript(() => {
    window.localStorage.setItem('river-raid.audio.muted', '1');
  });
  await page.goto('/game.html');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect((await probe(page)).contexts).toBe(0);
  expect(await page.evaluate(() => window.__riverRaidAudio.isMuted())).toBe(true);

  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => window.__riverRaidAudio.isMuted())).toBe(false);
  await expect.poll(async () => (await probe(page)).contexts).toBeGreaterThan(0);
});

test('M toggles mute and the preference survives a reload', async ({ page }) => {
  await page.goto('/game.html');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.__riverRaidAudio.isMuted())).toBe(false);

  await page.keyboard.press('m');
  await expect.poll(() => page.evaluate(() => window.__riverRaidAudio.isMuted())).toBe(true);
  expect(
    await page.evaluate(() => window.localStorage.getItem('river-raid.audio.muted')),
  ).toBe('1');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__riverRaidAudio.isMuted())).toBe(true);
});
