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

test('no runtime dependencies beyond Vite tooling', () => {
  assert.deepEqual(packageJson.dependencies ?? {}, {});
  assert.deepEqual(Object.keys(packageJson.devDependencies ?? {}), ['vite']);
});

test('npm test runs the node:test harness', () => {
  assert.match(packageJson.scripts.test, /node --test/);
});
