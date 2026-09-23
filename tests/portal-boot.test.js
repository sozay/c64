import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOOT_DURATION_MS, bootLines, startBoot } from '../src/portal/boot.js';

// Minimal element stub: startBoot only queries the three data hooks and writes
// text/style, so this stands in for the real DOM without a browser.
function stubElement() {
  const nodes = {};
  return {
    nodes,
    querySelector(selector) {
      const key = selector.replace(/[[\]]/g, '');
      if (!nodes[key]) nodes[key] = { textContent: '', style: {} };
      return nodes[key];
    },
  };
}

function fakeTimers() {
  const pending = new Map();
  let id = 0;
  return {
    setTimer(fn) {
      id += 1;
      pending.set(id, fn);
      return id;
    },
    clearTimer(timerId) {
      pending.delete(timerId);
    },
    fire() {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach((fn) => fn());
    },
    get count() {
      return pending.size;
    },
  };
}

test('bootLines names the game and keeps the C64 header', () => {
  const lines = bootLines({ title: 'River Raid' });
  assert.match(lines.header, /COMMODORE 64/);
  assert.equal(lines.searching, 'SEARCHING FOR RIVER RAID');
  assert.equal(lines.loading, 'LOADING RIVER RAID');
  assert.match(lines.memory, /BASIC BYTES FREE/);
});

test('the sequence shows the loading copy and completes after its duration', () => {
  const element = stubElement();
  const timers = fakeTimers();
  let done = 0;

  const boot = startBoot(element, { title: 'River Raid' }, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onDone: () => {
      done += 1;
    },
  });

  assert.equal(element.nodes['data-boot-action'].textContent, 'SEARCHING FOR RIVER RAID');
  assert.equal(element.nodes['data-boot-progress'].textContent, 'LOADING RIVER RAID');
  assert.equal(element.nodes['data-boot-bar'].style.width, '100%');
  assert.equal(element.nodes['data-boot-bar'].style.transitionDuration, `${BOOT_DURATION_MS}ms`);
  assert.equal(done, 0);

  timers.fire();
  assert.equal(done, 1);
  assert.equal(boot.finished, true);
});

test('skip() completes the sequence exactly once', () => {
  const element = stubElement();
  const timers = fakeTimers();
  let done = 0;
  const boot = startBoot(element, { title: 'River Raid' }, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onDone: () => {
      done += 1;
    },
  });

  boot.skip();
  boot.skip();
  timers.fire();
  assert.equal(done, 1);
  assert.equal(boot.finished, true);
});

test('cancel() prevents the completion callback', () => {
  const element = stubElement();
  const timers = fakeTimers();
  let done = 0;
  const boot = startBoot(element, { title: 'River Raid' }, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onDone: () => {
      done += 1;
    },
  });

  boot.cancel();
  timers.fire();
  assert.equal(done, 0);
  assert.equal(boot.finished, true);
});
