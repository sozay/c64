#!/usr/bin/env node
// River Raid performance and leak measurement harness (T-203).
//
// Serves the built dist/ production bundle with the dependency-free static
// server in this directory, drives the real portal journey in headless
// Chromium (launch river-raid from the portal -> scripted 60 s input -> exit to
// the portal) for N cycles, and logs per cycle:
//   - frame times (in-page requestAnimationFrame deltas) as p50/p95/max, and
//   - net registered-listener, net live-canvas and net live-context counters.
//
// Counting is GC-independent and net-based: a page-init script instruments
// addEventListener/removeEventListener, canvas creation/removal and getContext
// before any application code runs, so the exit code is deterministic and a
// correct implementation that creates a fresh canvas per launch (and removes
// the old one) cannot false-fail the monotonicity gate. Cumulative totals and
// GC-dependent live-object counts are reported for transparency but are NOT
// part of the gate.
//
// Hard gates (enforced by a non-zero exit):
//   - p95 frame time <= 20 ms in every cycle;
//   - net listener, net canvas and net context counters do not increase
//     between cycle 1 and cycle N (compared per counter).
//
// Usage:
//   node scripts/measure.js --cycles 3            # full 60 s x 3 clean run
//   npm run measure                               # same, via the npm script
//   node scripts/measure.js --cycles 2 --duration 10 --skip-build
//
// Options:
//   --cycles <n>     launch/exit cycles (default: 3)
//   --duration <s>   scripted play time per cycle in seconds (default: 60)
//   --out <path>     report path (default: reports/measure-report.json)
//   --port <n>       static server port (default: 0 = ephemeral)
//   --headful        run with a visible browser (default: headless)
//   --skip-build     reuse the existing dist/ instead of running npm run build
//   --help           print this usage

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startStaticServer } from './static-server.js';
import {
  P95_BUDGET_MS,
  buildReport,
  summarizeDeltas,
} from './measure-report.js';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const DEFAULT_REPORT_PATH = path.join(PROJECT_ROOT, 'reports', 'measure-report.json');

const HIGH_SCORE_KEY = 'river-raid.highscores';
const CARD_SELECTOR = '.game-card[data-game-id="river-raid"]';

const USAGE = `River Raid performance and leak measurement harness (T-203).

Usage:
  node scripts/measure.js --cycles 3
  npm run measure
  node scripts/measure.js --cycles 2 --duration 10 --skip-build

Options:
  --cycles <n>     launch/exit cycles (default: 3)
  --duration <s>   scripted play time per cycle in seconds (default: 60)
  --out <path>     report path (default: reports/measure-report.json)
  --port <n>       static server port (default: 0 = ephemeral)
  --headful        run with a visible browser (default: headless)
  --skip-build     reuse the existing dist/ instead of running npm run build
  --help           print this usage

Gates: p95 frame time <= ${P95_BUDGET_MS} ms every cycle; net listener, net canvas
and net context counters must not increase from cycle 1 to the last cycle.`;

function parseArgs(argv) {
  const options = {
    cycles: 3,
    duration: 60,
    out: DEFAULT_REPORT_PATH,
    port: 0,
    headful: false,
    skipBuild: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      options.help = true;
    } else if (token === '--headful') {
      options.headful = true;
    } else if (token === '--skip-build' || token === '--no-build') {
      options.skipBuild = true;
    } else if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${token}`);
      }
      i += 1;
      switch (key) {
        case 'cycles':
          options.cycles = Number(value);
          break;
        case 'duration':
          options.duration = Number(value);
          break;
        case 'out':
          options.out = path.resolve(PROJECT_ROOT, value);
          break;
        case 'port':
          options.port = Number(value);
          break;
        default:
          throw new Error(`Unknown option: ${token}`);
      }
    } else {
      throw new Error(`Unexpected argument: ${token}`);
    }
  }

  if (!Number.isInteger(options.cycles) || options.cycles < 1) {
    throw new Error(`--cycles must be a positive integer (got "${options.cycles}")`);
  }
  if (!Number.isFinite(options.duration) || options.duration <= 0) {
    throw new Error(`--duration must be a positive number of seconds (got "${options.duration}")`);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error(`--port must be between 0 and 65535 (got "${options.port}")`);
  }

  return options;
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Injected before any page script runs. Self-contained on purpose: Playwright
// serializes this function into the page, so it must not close over Node state.
function c64HarnessInstrumentation() {
  const metrics = {
    netListeners: 0,
    netCanvases: 0,
    netContexts: 0,
    createdCanvases: 0,
    removedCanvases: 0,
    createdContexts: 0,
    removedContexts: 0,
    cumulativeListenerAdds: 0,
    cumulativeListenerRemoves: 0,
  };

  // --- net registered-listener accounting -----------------------------------
  // Deduplicated exactly like the DOM: (target, type, capture, listener
  // identity). `once` listeners are not auto-decremented when they fire; the
  // application registers none, so the counters stay exact.
  const listenerRegistry = new WeakMap();
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;

  function captureFlag(options) {
    return typeof options === 'boolean' ? options : Boolean(options && options.capture);
  }

  EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
    if (listener != null) {
      let byKey = listenerRegistry.get(this);
      if (!byKey) {
        byKey = new Map();
        listenerRegistry.set(this, byKey);
      }
      const key = `${String(type)}|${captureFlag(options) ? 1 : 0}`;
      let set = byKey.get(key);
      if (!set) {
        set = new Set();
        byKey.set(key, set);
      }
      if (!set.has(listener)) {
        set.add(listener);
        metrics.netListeners += 1;
        metrics.cumulativeListenerAdds += 1;
      }
    }
    return originalAdd.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
    if (listener != null) {
      const byKey = listenerRegistry.get(this);
      const set = byKey && byKey.get(`${String(type)}|${captureFlag(options) ? 1 : 0}`);
      if (set && set.has(listener)) {
        set.delete(listener);
        metrics.netListeners -= 1;
        metrics.cumulativeListenerRemoves += 1;
      }
    }
    return originalRemove.call(this, type, listener, options);
  };

  // --- net live-canvas / live-context accounting ----------------------------
  const contextTypes = new WeakMap();
  const removedCanvases = new WeakSet();

  function registerCanvas() {
    metrics.netCanvases += 1;
    metrics.createdCanvases += 1;
  }

  const originalCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function createElement(name, options) {
    const element = originalCreateElement.call(this, name, options);
    if (typeof name === 'string' && name.toLowerCase() === 'canvas') registerCanvas();
    return element;
  };

  const originalCreateElementNS = Document.prototype.createElementNS;
  Document.prototype.createElementNS = function createElementNS(namespace, name, options) {
    const element = originalCreateElementNS.call(this, namespace, name, options);
    if (typeof name === 'string' && name.toLowerCase() === 'canvas') registerCanvas();
    return element;
  };

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
    const context = originalGetContext.call(this, type, ...rest);
    if (context) {
      let types = contextTypes.get(this);
      if (!types) {
        types = new Set();
        contextTypes.set(this, types);
      }
      if (!types.has(type)) {
        types.add(type);
        metrics.netContexts += 1;
        metrics.createdContexts += 1;
      }
    }
    return context;
  };

  function countRemovedCanvases(node) {
    const found = [];
    if (node && node.nodeType === 1) {
      if (node.tagName === 'CANVAS') found.push(node);
      if (typeof node.querySelectorAll === 'function') {
        for (const canvas of node.querySelectorAll('canvas')) found.push(canvas);
      }
    }
    for (const canvas of found) {
      if (removedCanvases.has(canvas)) continue;
      removedCanvases.add(canvas);
      metrics.netCanvases -= 1;
      metrics.removedCanvases += 1;
      const types = contextTypes.get(canvas);
      if (types) {
        metrics.netContexts -= types.size;
        metrics.removedContexts += types.size;
      }
    }
  }

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild(child) {
    countRemovedCanvases(child);
    return originalRemoveChild.call(this, child);
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function replaceChild(newChild, oldChild) {
    countRemovedCanvases(oldChild);
    return originalReplaceChild.call(this, newChild, oldChild);
  };

  const originalElementRemove = Element.prototype.remove;
  Element.prototype.remove = function remove() {
    countRemovedCanvases(this);
    return originalElementRemove.call(this);
  };

  // --- scripted input driver + frame sampler --------------------------------
  const harness = {
    active: false,
    deltas: [],
    restarts: 0,
    keyEvents: 0,
    startTime: 0,
    lastFrame: 0,
    raf: 0,
    gameOverSeen: false,
    held: Object.create(null),
  };

  function dispatchKey(type, code) {
    window.dispatchEvent(
      new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }),
    );
    harness.keyEvents += 1;
  }

  function setHeld(code, down) {
    if (harness.held[code] === down) return;
    harness.held[code] = down;
    dispatchKey(down ? 'keydown' : 'keyup', code);
  }

  function releaseAllKeys() {
    for (const code of Object.keys(harness.held)) {
      if (harness.held[code]) {
        harness.held[code] = false;
        dispatchKey('keyup', code);
      }
    }
  }

  function tick(now) {
    if (!harness.active) return;
    if (harness.lastFrame) harness.deltas.push(now - harness.lastFrame);
    harness.lastFrame = now;

    const elapsed = now - harness.startTime;
    const game = window.__riverRaid;
    const gameOver = Boolean(game && game.state && game.state.gameOver);

    if (gameOver) {
      // Deterministic restart: hold Enter down until the simulation consumes
      // input.restart and leaves the game-over state, so the scripted run keeps
      // measuring active gameplay rather than a frozen end screen.
      if (!harness.gameOverSeen) {
        harness.gameOverSeen = true;
        harness.restarts += 1;
      }
      setHeld('Enter', true);
    } else {
      harness.gameOverSeen = false;
      setHeld('Enter', false);
      setHeld('ArrowUp', true);
      const steerLeft = Math.floor(elapsed / 1500) % 2 === 0;
      setHeld('ArrowLeft', steerLeft);
      setHeld('ArrowRight', !steerLeft);
      setHeld('Space', elapsed % 600 < 140);
    }

    harness.raf = requestAnimationFrame(tick);
  }

  harness.start = function start() {
    harness.deltas = [];
    harness.restarts = 0;
    harness.keyEvents = 0;
    harness.lastFrame = 0;
    harness.gameOverSeen = false;
    harness.active = true;
    harness.startTime = performance.now();
    harness.raf = requestAnimationFrame(tick);
  };

  harness.stop = function stop() {
    harness.active = false;
    cancelAnimationFrame(harness.raf);
    releaseAllKeys();
    return {
      deltas: harness.deltas.slice(),
      restarts: harness.restarts,
      keyEvents: harness.keyEvents,
    };
  };

  window.__c64Harness = harness;
  window.__c64MetricsSnapshot = function snapshot() {
    return { ...metrics };
  };
}

async function waitForCondition(page, predicate, description, timeout = 30000) {
  try {
    await page.waitForFunction(predicate, undefined, { timeout, polling: 50 });
  } catch (error) {
    throw new Error(`Timed out waiting for ${description}: ${error.message}`);
  }
}

async function runCycle(page, cycle) {
  const card = page.locator(CARD_SELECTOR);
  await card.waitFor({ state: 'visible', timeout: 30000 });
  await card.focus();
  await page.keyboard.press('Enter');

  const canvas = page.locator('#game-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 30000 });
  await waitForCondition(
    page,
    () => (document.querySelector('#game-status')?.textContent ?? '').includes('SCORE'),
    'game status readout',
  );
  await waitForCondition(
    page,
    () => Boolean(window.__riverRaid && window.__riverRaid.running),
    'game loop running',
  );

  await page.evaluate(() => window.__c64Harness.start());
  await delay(runCycle.durationMs);
  const sample = await page.evaluate(() => window.__c64Harness.stop());

  await page.keyboard.press('Escape');
  await canvas.waitFor({ state: 'hidden', timeout: 30000 });
  await waitForCondition(page, () => window.__c64View === 'home', 'portal home');

  const metrics = await page.evaluate(() => window.__c64MetricsSnapshot());
  log(
    `cycle ${cycle}: p95=${summarizeDeltas(sample.deltas).p95 ?? 'n/a'}ms ` +
      `frames=${sample.deltas.length} restarts=${sample.restarts} ` +
      `netListeners=${metrics.netListeners} netCanvases=${metrics.netCanvases} ` +
      `netContexts=${metrics.netContexts}`,
  );

  return {
    cycle,
    frames: summarizeDeltas(sample.deltas),
    restarts: sample.restarts,
    keyEvents: sample.keyEvents,
    counters: {
      netListeners: metrics.netListeners,
      netCanvases: metrics.netCanvases,
      netContexts: metrics.netContexts,
    },
    cumulative: {
      createdCanvases: metrics.createdCanvases,
      removedCanvases: metrics.removedCanvases,
      createdContexts: metrics.createdContexts,
      removedContexts: metrics.removedContexts,
      listenerAdds: metrics.cumulativeListenerAdds,
      listenerRemoves: metrics.cumulativeListenerRemoves,
    },
  };
}

function runBuild() {
  log('building production bundle (npm run build)…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['run', 'build'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
}

function writeReport(reportPath, report) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    log(`${error.message}\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  if (!options.skipBuild) {
    try {
      runBuild();
    } catch (error) {
      log(`npm run build failed: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }

  if (!existsSync(path.join(DIST_DIR, 'index.html'))) {
    log(`No production build found at ${DIST_DIR}. Run npm run build (or drop --skip-build).`);
    process.exitCode = 1;
    return;
  }

  const startedAt = new Date().toISOString();
  const server = await startStaticServer(DIST_DIR, { port: options.port });
  const cycles = [];
  let browser = null;
  let report = null;

  try {
    browser = await chromium.launch({ headless: !options.headful });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(c64HarnessInstrumentation);
    const page = await context.newPage();
    runCycle.durationMs = Math.round(options.duration * 1000);

    log(`serving ${server.root} at ${server.url}`);
    await page.goto(server.url, { waitUntil: 'load' });
    await page.evaluate((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage may be unavailable; the run still measures.
      }
    }, HIGH_SCORE_KEY);

    for (let cycle = 1; cycle <= options.cycles; cycle += 1) {
      cycles.push(await runCycle(page, cycle));
    }

    const finishedAt = new Date().toISOString();
    report = buildReport({
      target: { url: server.url, artifact: 'dist/', servedRoot: server.root },
      browser: {
        name: 'chromium',
        version: browser.version(),
        headless: !options.headful,
        viewport: { width: 1280, height: 800 },
      },
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        playwright: require('@playwright/test/package.json').version,
      },
      cycles,
      cyclesRequested: options.cycles,
      durationSeconds: options.duration,
      startedAt,
      finishedAt,
      thresholds: { p95BudgetMs: P95_BUDGET_MS },
    });

    writeReport(options.out, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    log(`report written to ${options.out}`);
    log(
      report.passed
        ? `PASS: ${options.cycles} cycles within budget`
        : `FAIL:\n- ${report.gates.violations.join('\n- ')}`,
    );
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    log(`measurement failed: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  main().catch((error) => {
    log(`unexpected failure: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
