// Pure reporting and gate helpers for the T-203 measurement harness.
//
// These functions contain no browser or filesystem code so node:test can drive
// them directly. The gate semantics are the ticket's hard acceptance criteria:
// p95 frame time <= budget in every cycle, and the net listener / net live
// canvas-context counters must not increase between the first and last cycle
// (compared per counter).

export const P95_BUDGET_MS = 20;

// Linear-interpolated percentile (numpy "linear" method) over an ascending
// array. Input is expected to be already sorted; callers use summarizeDeltas.
export function percentile(sortedValues, p) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  if (p <= 0) return sortedValues[0];
  if (p >= 100) return sortedValues[sortedValues.length - 1];
  const rank = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedValues[lower];
  const fraction = rank - lower;
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * fraction;
}

function round(value, digits = 3) {
  if (value == null || !Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Summarizes raw rAF deltas (milliseconds) into the per-cycle frame statistics.
export function summarizeDeltas(deltas) {
  const values = (Array.isArray(deltas) ? deltas : []).filter((value) =>
    Number.isFinite(value),
  );
  if (values.length === 0) {
    return { count: 0, p50: null, p95: null, max: null, mean: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    count: sorted.length,
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    max: round(sorted[sorted.length - 1]),
    mean: round(mean),
  };
}

export const GATE_COUNTERS = Object.freeze(['netListeners', 'netCanvases', 'netContexts']);

// Evaluates the hard acceptance gates. Returns the violations rather than
// throwing so the report can carry the reason and the process can exit non-zero.
export function evaluateGates(cycles, { p95Budget = P95_BUDGET_MS } = {}) {
  const list = Array.isArray(cycles) ? cycles : [];
  const violations = [];

  for (const cycle of list) {
    const p95 = cycle?.frames?.p95;
    if (p95 == null) {
      violations.push(`cycle ${cycle?.cycle}: no frame samples collected`);
    } else if (p95 > p95Budget) {
      violations.push(
        `cycle ${cycle.cycle}: p95 frame time ${p95}ms exceeds ${p95Budget}ms`,
      );
    }
  }

  const comparedCycles = list.length >= 2 ? [list[0].cycle, list[list.length - 1].cycle] : [];
  if (list.length >= 2) {
    const first = list[0];
    const last = list[list.length - 1];
    for (const counter of GATE_COUNTERS) {
      const before = first?.counters?.[counter];
      const after = last?.counters?.[counter];
      if (before == null || after == null) {
        violations.push(
          `cycle ${last.cycle}: counter "${counter}" missing from the report`,
        );
      } else if (after > before) {
        violations.push(
          `${counter} increased from cycle ${first.cycle} (${before}) to cycle ${last.cycle} (${after})`,
        );
      }
    }
  }

  return {
    passed: violations.length === 0,
    p95Budget,
    comparedCycles,
    violations,
  };
}

// Assembles the machine-readable report committed as the clean-run artifact.
export function buildReport({
  target,
  browser,
  cycles,
  cyclesRequested,
  durationSeconds,
  startedAt,
  finishedAt,
  thresholds = { p95BudgetMs: P95_BUDGET_MS },
  environment = {},
}) {
  const gates = evaluateGates(cycles, { p95Budget: thresholds.p95BudgetMs });
  return {
    tool: 'river-raid-measure',
    schemaVersion: 1,
    generatedAt: finishedAt,
    startedAt,
    finishedAt,
    target,
    browser,
    environment,
    cyclesRequested,
    durationSeconds,
    cycles,
    thresholds,
    gates,
    passed: gates.passed,
  };
}
