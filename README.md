# c64 — Retro Games Portal

Web application foundation for a retro-games portal hosting C64/Amiga/Atari-style
game replicas, starting with River Raid. Built with Vite and vanilla JavaScript;
a `<canvas>` element is the game rendering surface. No UI frameworks and no
runtime dependencies beyond the Vite dev/build tooling.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install Vite (the only dev dependency). |
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm test` | Run the headless `node:test` suite. |
| `npm run test:browser` | Run the Playwright browser tests (autoplay guard, mute persistence). |
| `npm run build` | Build the static production bundle into `dist/`. |
| `npm run preview` | Serve the built `dist/` bundle locally. |

Playwright is the chain's browser-test tool. Install its Chromium once after
`npm install`:

```sh
npx playwright install chromium
npm run test:browser
```

`@playwright/test` is pinned to `1.59.0`: newer releases dropped the bundled
Chromium build for macOS 13.

Verify the production build renders when served statically:

```sh
npm run build
npm run preview            # or: python3 -m http.server -d dist
```

## Project layout

```text
index.html            # entry document: #app and the #game-canvas element
vite.config.js        # Vite configuration (root, relative base, dist/ output)
src/
  main.js             # application entry; imports styles and bootstraps
  core/               # shared helpers (e.g. dom.js)
  portal/             # home page view, game registry, keyboard navigation
  games/              # game modules, starting with River Raid (T-198..T-201)
    river-raid/       # pure simulation + render, input, sound-events and audio adapters
  styles/
    tokens.css        # design-token CSS custom properties (palette, type, spacing)
    base.css          # baseline layout consuming the tokens
scripts/              # Node tooling (e.g. headless simulation drivers)
tests/                # node:test suites (environment + scaffolding)
```

## Portal home page

`src/main.js` mounts the portal home page (`src/portal/index.js`), which renders
one card per entry in the games registry (`src/portal/registry.js`). Availability
flags drive card labels (`PLAYABLE` / `COMING SOON`), so flipping a flag is a
one-line data change with no UI edits. T-200 flips River Raid to `PLAYABLE`
now that core gameplay is complete.

Keyboard-only navigation: `Tab` moves focus through the cards in order; arrow
keys and `Home`/`End` move focus directly; `Enter`/`Space` activates the focused
card. Activating an unavailable game writes visible feedback to the
`role="status"` element (`[data-status="unavailable"]`) and does not navigate.

Subjective visual check (manual, alongside the objective checks in
`tests/portal-home.test.js`): with `npm run dev` open, the home page should read
as a cyberpunk C64/Amiga demo screen — dark palette, neon cyan/magenta glow on
the title and focused card, period display/mono typography, and a visible CRT
scanline overlay.

## River Raid gameplay

The gameplay layer lives in `src/games/river-raid/` on top of the pure
simulation core: terrain-placed fuel depots, ships and helicopters, a single
bullet in flight, lives, level-checkpoint bridges, scoring, a C64-style HUD and
a game-over screen. Everything is a pure function of the seed plus the input
sequence, so `scripts/simulate.js` can fingerprint it:

```sh
node scripts/simulate.js --game river-raid --seed 7 --frames 7200
# two runs with the same seed and input print an identical hash
```

Progression (T-200): destroying a bridge (500 points) advances the level and
awards a fuel bonus (`remaining fuel x 5`). Each level raises the baseline
scroll speed and the enemy spawn density, both capped so a long run stays
playable, and the last destroyed bridge becomes the respawn checkpoint
(before the first bridge, respawn still uses the current segment start).
Scoring per target: depot 80, ship 30, helicopter 60, bridge 500.

Portal integration is T-202's scope, so the game is reachable through the dev
harness at `/game.html` while the home page stays the default entry:

```sh
npm run dev        # then open http://localhost:5173/game.html
```

Controls: arrow keys / `A`-`D` steer, `Up` / `W` throttle, `Space` (or `J`)
fires, and `Enter` (or `R`) restarts after game over. The canvas draws the HUD
(score, level, lives, fuel gauge) and the game-over screen (final score plus
restart hint); the dev harness also prints the same numbers. Flying over a
depot refuels the tank once, a bullet is consumed by the first enemy, depot or
bridge it hits, and a crash (bank, enemy, or empty tank) costs a life and
respawns the jet at the last checkpoint. `npm run dev` is the documented manual
check: fly, shoot, destroy at least two bridges, watch the level and speed
climb, refuel, crash, reach game over, and restart.

For a deterministic headless run that exercises bridges, levels and scoring,
use the state-aware autopilot input:

```sh
node scripts/simulate.js --game river-raid --seed 7 --frames 7200 --input pilot --json
# reports score, level, bridgesDestroyed, checkpointY and bridges in the JSON
```

## River Raid sound (T-201)

Sound is WebAudio-only: every effect is synthesized with oscillators, gain
envelopes and noise buffers, so there are no audio asset files and no runtime
dependencies. `src/games/river-raid/audio.js` is imported by the browser entry
(`src/game-dev.js`) only; the headless driver's import graph never contains it,
which keeps sound render-layer only.

The simulation emits plain-data sound events (shoot, destroy, refuel, engine
speed) onto `state.soundEvents`. The queue is drained once per display frame by
the audio adapter and is deliberately excluded from `hashState`, so the
deterministic state hash is unchanged (see `tests/river-raid-sound-events.test.js`).

Autoplay guard: no `AudioContext` is created until the first user gesture (a key
press or pointer press), and a muted layer never creates one. `M` toggles mute
and the preference is persisted in `localStorage` (`river-raid.audio.muted`), so
it survives a reload. The dev-harness status line shows the current sound state.

Manual check with `npm run dev` (open `/game.html`): the first key press starts
the engine hum; firing, explosions and refuel play as you fly; `M` mutes and
unmutes and the preference survives a reload. The automated checks live in
`tests/browser/river-raid-audio.spec.js` (`npm run test:browser`).

## Conventions

- Tests live in `tests/` and use the built-in `node:test` runner.
- Visual restyling happens through the custom properties in
  `src/styles/tokens.css`; markup structure should not need to change.
