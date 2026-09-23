import test from 'node:test';
import assert from 'node:assert/strict';

import {
  P95_BUDGET_MS,
  buildReport,
  evaluateGates,
  percentile,
  summarizeDeltas,
} from '../scripts/measure-report.js';

function cycle(cycleNumber, p95, counters) {
  return {
    cycle: cycleNumber,
    frames: { count: 100, p50: 16, p95, max: 30, mean: 17 },
    counters,
  };
}

const FLAT_COUNTERS = { netListeners: 3, netCanvases: 2, netContexts: 3 };

test('percentile interpolates between ranks', () => {
  const sorted = [10, 20, 30, 40, 50];
  assert.equal(percentile(sorted, 0), 10);
  assert.equal(percentile(sorted, 100), 50);
  assert.equal(percentile(sorted, 50), 30);
  assert.equal(percentile(sorted, 25), 20);
  assert.equal(percentile(sorted, 95), 48);
  assert.equal(percentile([], 50), null);
});

test('summarizeDeltas reports p50/p95/max and handles empty input', () => {
  const summary = summarizeDeltas([16, 16, 16, 16, 17, 17, 18, 18, 19, 40]);
  assert.equal(summary.count, 10);
  assert.equal(summary.p50, 17);
  assert.equal(summary.p95, 30.55);
  assert.equal(summary.max, 40);
  assert.deepEqual(summarizeDeltas([]), {
    count: 0,
    p50: null,
    p95: null,
    max: null,
    mean: null,
  });
});

test('gates pass when every cycle is within budget and counters are flat', () => {
  const gates = evaluateGates([
    cycle(1, 17, FLAT_COUNTERS),
    cycle(2, 18, FLAT_COUNTERS),
    cycle(3, 17, FLAT_COUNTERS),
  ]);
  assert.equal(gates.passed, true);
  assert.deepEqual(gates.violations, []);
  assert.deepEqual(gates.comparedCycles, [1, 3]);
});

test('gates fail when a cycle exceeds the p95 budget', () => {
  const gates = evaluateGates([
    cycle(1, 17, FLAT_COUNTERS),
    cycle(2, P95_BUDGET_MS + 0.01, FLAT_COUNTERS),
    cycle(3, 17, FLAT_COUNTERS),
  ]);
  assert.equal(gates.passed, false);
  assert.equal(gates.violations.length, 1);
  assert.match(gates.violations[0], /cycle 2: p95 frame time/);
});

test('gates fail when any net counter increases from cycle 1 to the last cycle', () => {
  const gates = evaluateGates([
    cycle(1, 17, { netListeners: 3, netCanvases: 2, netContexts: 3 }),
    cycle(2, 17, { netListeners: 3, netCanvases: 2, netContexts: 3 }),
    cycle(3, 17, { netListeners: 3, netCanvases: 2, netContexts: 4 }),
  ]);
  assert.equal(gates.passed, false);
  assert.deepEqual(gates.violations, [
    'netContexts increased from cycle 1 (3) to cycle 3 (4)',
  ]);
});

test('gates allow counters that fall or stay flat, per counter', () => {
  const gates = evaluateGates([
    cycle(1, 17, { netListeners: 5, netCanvases: 2, netContexts: 3 }),
    cycle(3, 17, { netListeners: 3, netCanvases: 1, netContexts: 3 }),
  ]);
  assert.equal(gates.passed, true);
});

test('gates report missing frame samples instead of treating them as success', () => {
  const gates = evaluateGates([
    { cycle: 1, frames: { count: 0, p50: null, p95: null, max: null }, counters: FLAT_COUNTERS },
  ]);
  assert.equal(gates.passed, false);
  assert.match(gates.violations[0], /no frame samples/);
});

test('buildReport carries the gate verdict and thresholds', () => {
  const report = buildReport({
    target: { url: 'http://127.0.0.1:1234/', artifact: 'dist/' },
    browser: { name: 'chromium', version: '1.0.0', headless: true },
    cycles: [cycle(1, 17, FLAT_COUNTERS), cycle(3, 17, FLAT_COUNTERS)],
    cyclesRequested: 2,
    durationSeconds: 60,
    startedAt: '2026-09-23T00:00:00.000Z',
    finishedAt: '2026-09-23T00:03:00.000Z',
  });
  assert.equal(report.passed, true);
  assert.equal(report.thresholds.p95BudgetMs, P95_BUDGET_MS);
  assert.equal(report.gates.passed, true);
  assert.equal(report.target.url, 'http://127.0.0.1:1234/');
  assert.equal(report.cycles.length, 2);
});
