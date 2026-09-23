import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  createInitialState,
  step,
  playerWorldY,
} from '../src/games/river-raid/simulation.js';
import { hashState } from '../src/games/river-raid/hash.js';
import {
  SOUND_EVENT,
  MAX_SOUND_EVENTS,
  drainSoundEvents,
  emitSoundEvent,
} from '../src/games/river-raid/sound-events.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const simulateScript = fileURLToPath(new URL('scripts/simulate.js', root));

function eventsOf(state, type) {
  return drainSoundEvents(state).filter((event) => event.type === type);
}

// Places an entity of the given kind directly under the jet so a step() will
// resolve a bullet hit or a refuel deterministically.
function placeOnJet(state, entity) {
  return {
    uid: 999,
    worldY: playerWorldY(state),
    x: state.player.x,
    dir: 0,
    used: false,
    ...entity,
  };
}

function stepWithBulletOnJet(state, entity) {
  const target = placeOnJet(state, entity);
  state.entities = [target];
  state.bullet = {
    x: target.x,
    worldY: target.worldY,
    halfWidth: 2,
    halfHeight: 6,
  };
  step(state, {});
  return target;
}

test('firing emits a shoot event once per bullet actually in flight', () => {
  const state = createInitialState(7);

  step(state, { fire: true });
  assert.equal(eventsOf(state, SOUND_EVENT.SHOOT).length, 1, 'first shot is announced');

  step(state, { fire: true });
  assert.equal(
    eventsOf(state, SOUND_EVENT.SHOOT).length,
    0,
    'a bullet already in flight is not re-announced',
  );
});

test('destroying an enemy ship emits a destroy event with its kind', () => {
  const state = createInitialState(7);
  stepWithBulletOnJet(state, {
    kind: 'enemy',
    type: 'ship',
    halfWidth: 12,
    halfHeight: 8,
    changeCount: 0,
    changeCountdown: 45,
  });

  const destroys = drainSoundEvents(state).filter(
    (event) => event.type === SOUND_EVENT.DESTROY,
  );
  assert.equal(destroys.length, 1);
  assert.equal(destroys[0].kind, 'enemy');
  assert.equal(destroys[0].targetType, 'ship');
});

test('destroying a helicopter, depot and bridge each emit a destroy event', () => {
  const cases = [
    {
      label: 'helicopter',
      entity: {
        kind: 'enemy',
        type: 'helicopter',
        halfWidth: 10,
        halfHeight: 8,
        changeCount: 0,
        changeCountdown: 45,
      },
      kind: 'enemy',
      targetType: 'helicopter',
    },
    {
      label: 'depot',
      entity: { kind: 'depot', type: 'depot', halfWidth: 12, halfHeight: 10 },
      kind: 'depot',
      targetType: 'depot',
    },
    {
      label: 'bridge',
      entity: { kind: 'bridge', type: 'bridge', halfWidth: 60, halfHeight: 6 },
      kind: 'bridge',
      targetType: 'bridge',
    },
  ];

  for (const scenario of cases) {
    const state = createInitialState(7);
    stepWithBulletOnJet(state, scenario.entity);
    const destroys = drainSoundEvents(state).filter(
      (event) => event.type === SOUND_EVENT.DESTROY,
    );
    assert.equal(destroys.length, 1, `${scenario.label} emits one destroy event`);
    assert.equal(destroys[0].kind, scenario.kind);
    assert.equal(destroys[0].targetType, scenario.targetType);
  }
});

test('flying over an unused depot emits a refuel event', () => {
  const state = createInitialState(7);
  state.fuel = 10;
  state.entities = [
    placeOnJet(state, {
      kind: 'depot',
      type: 'depot',
      halfWidth: 12,
      halfHeight: 10,
    }),
  ];

  step(state, {});

  const refuels = drainSoundEvents(state).filter(
    (event) => event.type === SOUND_EVENT.REFUEL,
  );
  assert.equal(refuels.length, 1);
  assert.equal(state.fuel, 100, 'the depot actually refuels the tank');
});

test('engine events carry the scroll speed on the first step and on changes', () => {
  const state = createInitialState(7);

  step(state, {});
  const initial = drainSoundEvents(state).filter(
    (event) => event.type === SOUND_EVENT.ENGINE,
  );
  assert.equal(initial.length, 1, 'the initial engine speed is announced');
  assert.equal(typeof initial[0].speed, 'number');
  assert.ok(initial[0].speed > 0);

  step(state, {});
  assert.equal(
    drainSoundEvents(state).filter((event) => event.type === SOUND_EVENT.ENGINE).length,
    0,
    'a steady speed is not re-announced',
  );

  state.lives = 1000;
  let changes = 0;
  for (let frame = 0; frame < 180; frame += 1) {
    step(state, { throttle: true });
    changes += drainSoundEvents(state).filter(
      (event) => event.type === SOUND_EVENT.ENGINE,
    ).length;
  }
  assert.ok(changes >= 1, 'throttling across a speed bucket announces a change');
});

test('the sound-event queue is bounded and does not affect the state hash', () => {
  const state = createInitialState(7);
  for (let i = 0; i < MAX_SOUND_EVENTS * 8; i += 1) {
    emitSoundEvent(state, { type: SOUND_EVENT.SHOOT });
  }
  assert.ok(
    state.soundEvents.length <= MAX_SOUND_EVENTS,
    `queue stays bounded, got ${state.soundEvents.length}`,
  );

  const run = (drain) => {
    const s = createInitialState(7);
    for (let frame = 0; frame < 1200; frame += 1) {
      step(s, { throttle: true, fire: true });
      if (drain) drainSoundEvents(s);
    }
    return hashState(s);
  };

  assert.equal(run(false), run(false), 'undrained runs stay deterministic');
  assert.equal(run(true), run(false), 'draining the queue must not change the state');
});

test('identical runs emit identical sound-event sequences', () => {
  const sequence = () => {
    const state = createInitialState(42);
    const events = [];
    for (let frame = 0; frame < 900; frame += 1) {
      step(state, { throttle: true, fire: true });
      events.push(...drainSoundEvents(state));
    }
    return events;
  };

  assert.deepEqual(sequence(), sequence());
});

test('the definition-of-done seed 42 run is unchanged by the sound layer', () => {
  const run = () => {
    const result = spawnSync(
      process.execPath,
      [simulateScript, '--game', 'river-raid', '--seed', '42', '--frames', '3600'],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const match = /hash=([0-9a-f]+)/.exec(result.stdout);
    assert.ok(match, `expected a hash, received: ${result.stdout}`);
    return match[1];
  };

  // b89b4380 is the committed T-200 baseline for seed 42 / 3600 frames. Sound is
  // render-layer only, so the audited value must not move (T-201 DoD).
  assert.equal(run(), 'b89b4380');
  assert.equal(run(), run());
});

test('the headless import graph never includes the WebAudio module', async () => {
  const [index, entry, simulate, audio, soundEvents] = await Promise.all([
    read('src/games/river-raid/index.js'),
    read('src/game-dev.js'),
    read('scripts/simulate.js'),
    read('src/games/river-raid/audio.js'),
    read('src/games/river-raid/sound-events.js'),
  ]);

  const importsAudio = /(?:import|from)\s*['"][^'"]*audio\.js['"]/;
  assert.doesNotMatch(index, importsAudio, 'index.js must not import WebAudio');
  assert.doesNotMatch(simulate, importsAudio, 'simulate.js must not import WebAudio');
  assert.match(entry, importsAudio, 'the browser entry owns the WebAudio module');
  assert.match(audio, /AudioContext/, 'the audio module is the WebAudio adapter');
  assert.doesNotMatch(soundEvents, /window|document|AudioContext/);
});
