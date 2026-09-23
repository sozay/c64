// C64 boot/loading sequence shown between the portal and the game canvas
// (T-202). The sequence is timed (not asset-based) and exposes a skip() so the
// keyboard-only journey can move on with Enter. Timers are injectable so
// node:test can drive the sequence without a browser.

export const BOOT_DURATION_MS = 1500;

export function bootLines(game = {}) {
  const title = String(game.title ?? 'GAME').toUpperCase();
  return {
    header: '**** COMMODORE 64 BASIC V2 ****',
    memory: '64K RAM SYSTEM  38911 BASIC BYTES FREE',
    searching: `SEARCHING FOR ${title}`,
    loading: `LOADING ${title}`,
    ready: 'READY.',
  };
}

export function startBoot(element, game, options = {}) {
  const duration = options.duration ?? BOOT_DURATION_MS;
  const onDone = options.onDone ?? (() => {});
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const lines = bootLines(game);

  const action = element?.querySelector?.('[data-boot-action]') ?? null;
  const progress = element?.querySelector?.('[data-boot-progress]') ?? null;
  const bar = element?.querySelector?.('[data-boot-bar]') ?? null;

  if (action) action.textContent = lines.searching;
  if (progress) progress.textContent = lines.loading;
  if (bar) {
    bar.style.width = '0%';
    // Restart the CSS transition from zero; the reflow read is browser-only.
    if (typeof bar.offsetWidth === 'number') void bar.offsetWidth;
    bar.style.transitionDuration = `${duration}ms`;
    bar.style.width = '100%';
  }

  let finished = false;
  const timer = setTimer(() => finish(), duration);

  function finish() {
    if (finished) return;
    finished = true;
    clearTimer(timer);
    onDone();
  }

  return {
    lines,
    skip: finish,
    cancel() {
      if (finished) return;
      finished = true;
      clearTimer(timer);
    },
    get finished() {
      return finished;
    },
  };
}
