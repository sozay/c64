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
| `npm run build` | Build the static production bundle into `dist/`. |
| `npm run preview` | Serve the built `dist/` bundle locally. |

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
one-line data change with no UI edits.

Keyboard-only navigation: `Tab` moves focus through the cards in order; arrow
keys and `Home`/`End` move focus directly; `Enter`/`Space` activates the focused
card. Activating an unavailable game writes visible feedback to the
`role="status"` element (`[data-status="unavailable"]`) and does not navigate.

Subjective visual check (manual, alongside the objective checks in
`tests/portal-home.test.js`): with `npm run dev` open, the home page should read
as a cyberpunk C64/Amiga demo screen — dark palette, neon cyan/magenta glow on
the title and focused card, period display/mono typography, and a visible CRT
scanline overlay.

## Conventions

- Tests live in `tests/` and use the built-in `node:test` runner.
- Visual restyling happens through the custom properties in
  `src/styles/tokens.css`; markup structure should not need to change.
