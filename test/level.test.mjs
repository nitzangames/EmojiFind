import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ctx = {};
new Function('ctx',
  'const GRID_W = 9; const GRID_H = 13; const TILE_COUNT = 117;' +
  readFileSync('./js/rng.js', 'utf8') + ';' +
  readFileSync('./js/pairs.js', 'utf8') + ';' +
  readFileSync('./js/level.js', 'utf8') + ';' +
  'ctx.buildLevel = buildLevel;'
)(ctx);
const { buildLevel } = ctx;

const pools = {
  easy:   [{ a: 'e1', b: 'e2', diff: 1, first: false }],
  medium: [{ a: 'm1', b: 'm2', diff: 1, first: false }],
  hard:   [{ a: 'h1', b: 'h2', diff: 1, first: false }],
};

test('buildLevel fills 117 tiles with target + filler', () => {
  const lvl = buildLevel({ level: 5, pools, indexSeed: 12345 });
  assert.equal(lvl.tiles.length, 117);
  const target = lvl.tiles[lvl.targetIndex];
  assert.equal(target.codepoint, lvl.targetCodepoint);
  for (let i = 0; i < lvl.tiles.length; i++) {
    if (i === lvl.targetIndex) continue;
    assert.equal(lvl.tiles[i].codepoint, lvl.fillerCodepoint);
  }
});

test('buildLevel targetIndex is within [0, 117)', () => {
  for (let level = 1; level <= 5; level++) {
    const lvl = buildLevel({ level, pools, indexSeed: level * 17 });
    assert.ok(lvl.targetIndex >= 0 && lvl.targetIndex < 117);
  }
});
