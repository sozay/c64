import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const REQUIRED_TOKENS = [
  '--color-bg',
  '--color-primary',
  '--color-text',
  '--font-body',
];

test('index.html provides the canvas rendering surface', async () => {
  const html = await read('index.html');
  assert.match(html, /<canvas\b/);
  assert.match(html, /id="game-canvas"/);
  assert.match(html, /src="\/src\/main\.js"/);
});

test('design tokens are defined and wired into the entry module', async () => {
  const tokens = await read('src/styles/tokens.css');
  const main = await read('src/main.js');
  assert.match(tokens, /:root\s*\{/);
  for (const token of REQUIRED_TOKENS) {
    assert.ok(tokens.includes(`${token}:`), `missing design token ${token}`);
  }
  assert.match(main, /import '\.\/styles\/tokens\.css'/);
});

test('project layout matches the scaffolding convention', async () => {
  for (const dir of ['src/portal', 'src/games', 'src/core', 'scripts', 'tests']) {
    const info = await stat(new URL(dir, root));
    assert.ok(info.isDirectory(), `${dir} should be a directory`);
  }
  const mainInfo = await stat(new URL('src/main.js', root));
  assert.ok(mainInfo.isFile(), 'src/main.js should exist');
});
