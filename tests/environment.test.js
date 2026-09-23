import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8'),
);

test('Node.js runtime supports the built-in test runner', () => {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  assert.ok(
    major >= 18,
    `expected Node.js >= 18, received ${process.versions.node}`,
  );
});

test('package is an ES module project', () => {
  assert.equal(packageJson.type, 'module');
});

test('no runtime dependencies and only the documented dev tooling', () => {
  assert.deepEqual(packageJson.dependencies ?? {}, {}, 'runtime dependencies stay empty');
  // Vite is the dev/build tooling; Playwright is the chain's documented
  // browser-test tool introduced by T-201 and reused by T-202/T-203. Any other
  // dependency must be an explicit, reviewed decision.
  assert.deepEqual(
    Object.keys(packageJson.devDependencies ?? {}).sort(),
    ['@playwright/test', 'vite'],
  );
});

test('npm test runs the node:test harness', () => {
  assert.match(packageJson.scripts.test, /node --test/);
});
