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
`throttle`, `mixed`), `--json`, and `--help`.

The scripted input is part of the run definition: the default `neutral` input
holds no keys on any frame, so identical `game`/`seed`/`frames`/`input`
arguments always print an identical hash.
