# scripts

Node tooling for the project lives here.

## `simulate.js`

Headless driver for the pure River Raid simulation. Runs N fixed-timestep
frames for a game and seed, then prints a deterministic state hash.

```sh
node scripts/simulate.js --game river-raid --seed 7 --frames 3600
# game=river-raid seed=7 frames=3600 input=neutral hash=1a2b3c4d
```

Options: `--game` (default `river-raid`), `--seed` (default `7`), `--frames`
(default `3600`), `--input` (`neutral` default, plus `left`, `right`,
`throttle`, `mixed`, `fire`, `combat`), `--json`, and `--help`.

The scripted input is part of the run definition: the default `neutral` input
holds no keys on any frame, so identical `game`/`seed`/`frames`/`input`
arguments always print an identical hash. The `combat` mode throttles, fires,
and alternates steering so the fuel/combat layer is exercised deterministically.

The state hash covers the combat layer (fuel, lives, respawn grace, bullet,
game-over state, and every live entity). `--json` additionally prints `fuel`,
`lives`, `gameOver`, `gameOverReason`, `enemies`, `depots`, and `bullet`.

## `measure.js`

Performance and leak measurement harness (T-203). Serves the built `dist/`
production bundle with the dependency-free static server in
`scripts/static-server.js`, drives the real portal journey in headless Chromium
(launch river-raid from the portal, scripted input, exit to the portal) for N
cycles, and writes a machine-readable JSON report to
`reports/measure-report.json`.

```sh
npm run measure                      # build + 3 cycles x 60 s, full clean run
node scripts/measure.js --cycles 2 --duration 10 --skip-build
```

Options: `--cycles` (default `3`), `--duration` (seconds per cycle, default
`60`), `--out` (report path), `--port` (static server port, default ephemeral),
`--headful`, `--skip-build`, and `--help`.

Per cycle it records in-page `requestAnimationFrame` deltas as p50/p95/max plus
GC-independent net counters: net registered listeners
(`addEventListener`/`removeEventListener`), net live canvases (creation/removal)
and net live 2D contexts (distinct `getContext` calls per canvas). The process
exits non-zero when any cycle's p95 exceeds 20 ms, or when a net counter grows
between the first and last cycle (compared per counter). Cumulative totals are
reported for transparency but are not gated.
