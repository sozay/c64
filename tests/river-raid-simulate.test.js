import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/simulate.js', import.meta.url));

function run(args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function hashOf(stdout) {
  const match = /hash=([0-9a-f]+)/.exec(stdout);
  assert.ok(match, `expected a hash in output, received: ${stdout}`);
  return match[1];
}

test('the definition-of-done command prints a state hash', () => {
  const output = run([
    '--game',
    'river-raid',
    '--seed',
    '7',
    '--frames',
    '3600',
  ]);
  assert.match(output, /game=river-raid seed=7 frames=3600 input=neutral hash=[0-9a-f]{8}/);
});

test('two runs with the same seed print identical hashes', () => {
  const args = ['--game', 'river-raid', '--seed', '7', '--frames', '3600'];
  assert.equal(hashOf(run(args)), hashOf(run(args)));
});

test('different seeds print different hashes', () => {
  const first = run(['--game', 'river-raid', '--seed', '7', '--frames', '3600']);
  const second = run(['--game', 'river-raid', '--seed', '8', '--frames', '3600']);
  assert.notEqual(hashOf(first), hashOf(second));
});

test('different input scripts print different hashes', () => {
  const neutral = run(['--seed', '7', '--frames', '600', '--input', 'neutral']);
  const throttle = run(['--seed', '7', '--frames', '600', '--input', 'throttle']);
  assert.notEqual(hashOf(neutral), hashOf(throttle));
});

test('the driver documents the neutral default input', () => {
  assert.match(run(['--help']), /neutral/);
});
