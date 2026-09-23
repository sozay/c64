#!/usr/bin/env node
// Headless River Raid simulation driver.
//
// Runs N fixed-timestep frames of the pure simulation for a game + seed and
// prints a deterministic state hash. The scripted input is fixed by --input
// (default: "neutral" = no left/right/throttle on any frame), so two runs with
// the same game, seed, frames and input always print the same hash.
//
// Usage:
//   node scripts/simulate.js --game river-raid --seed 7 --frames 3600
//   node scripts/simulate.js --seed 7 --frames 600 --input throttle --json
//
// Options:
//   --game <id>      game to simulate (default: river-raid)
//   --seed <n>       PRNG seed (default: 7)
//   --frames <n>     fixed-timestep frames to run (default: 3600)
//   --input <mode>   neutral | left | right | throttle | mixed (default: neutral)
//   --json           print a JSON object instead of the key=value line
//   --help           print this usage

import { riverRaid } from '../src/games/river-raid/index.js';

const GAMES = {
  [riverRaid.id]: riverRaid,
};

const INPUT_MODES = ['neutral', 'left', 'right', 'throttle', 'mixed'];

const USAGE = `Headless River Raid simulation driver.

Usage:
  node scripts/simulate.js --game river-raid --seed 7 --frames 3600
  node scripts/simulate.js --seed 7 --frames 600 --input throttle --json

Options:
  --game <id>      game to simulate (default: river-raid)
  --seed <n>       PRNG seed (default: 7)
  --frames <n>     fixed-timestep frames to run (default: 3600)
  --input <mode>   ${INPUT_MODES.join(' | ')} (default: neutral)
  --json           print a JSON object instead of the key=value line
  --help           print this usage

The default "neutral" input holds no keys on any frame; identical
game/seed/frames/input arguments always print an identical hash.`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${token}`);
      }
      args[key] = value;
      i += 1;
    } else {
      throw new Error(`Unexpected argument: ${token}`);
    }
  }
  return args;
}

function makeInput(mode) {
  switch (mode) {
    case 'neutral':
      return () => ({});
    case 'left':
      return () => ({ left: true });
    case 'right':
      return () => ({ right: true });
    case 'throttle':
      return () => ({ throttle: true });
    case 'mixed':
      return (frame) => {
        const steer = Math.floor(frame / 60) % 2 === 0 ? 'left' : 'right';
        return { throttle: true, [steer]: true };
      };
    default:
      throw new Error(
        `Unknown input mode "${mode}" (expected ${INPUT_MODES.join(', ')})`,
      );
  }
}

function fail(message) {
  process.stderr.write(`${message}\n\n${USAGE}\n`);
  process.exit(1);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
  }

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const gameId = args.game ?? 'river-raid';
  const game = GAMES[gameId];
  if (!game) {
    fail(`Unknown game "${gameId}" (available: ${Object.keys(GAMES).join(', ')})`);
  }

  const seed = Number(args.seed ?? 7);
  const frames = Number(args.frames ?? 3600);
  const inputMode = args.input ?? 'neutral';

  if (!Number.isFinite(seed)) fail(`Invalid --seed "${args.seed}"`);
  if (!Number.isInteger(frames) || frames < 0) {
    fail(`Invalid --frames "${args.frames}"`);
  }

  let inputFor;
  try {
    inputFor = makeInput(inputMode);
  } catch (error) {
    fail(error.message);
  }

  const state = game.createInitialState(seed);
  game.advance(state, frames, inputFor);
  const hash = game.hashState(state);

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({
        game: game.id,
        seed: state.seed,
        frames,
        input: inputMode,
        hash,
        scrollY: state.scrollY,
        speed: state.speed,
        playerX: state.player.x,
        collided: state.player.collided,
        segments: state.terrain.segments.length,
      })}\n`,
    );
    return;
  }

  process.stdout.write(
    `game=${game.id} seed=${state.seed} frames=${frames} input=${inputMode} hash=${hash}\n`,
  );
}

main();
