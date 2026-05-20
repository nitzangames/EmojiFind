import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ctx = {};
new Function('ctx',
  'const SPECIAL_EVERY_X = 20; const GRID_W = 9; const GRID_H = 13; const TILE_COUNT = 117;' +
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
const allEmojis = Array.from({ length: 200 }, (_, i) => 'z' + i.toString(16));

test('buildLevel for a normal level fills 117 tiles with target + filler', () => {
  const lvl = buildLevel({ level: 5, pools, allEmojis, indexSeed: 12345 });
  assert.equal(lvl.tiles.length, 117);
  assert.equal(lvl.isSpecial, false);
  const target = lvl.tiles[lvl.targetIndex];
  assert.equal(target.codepoint, lvl.targetCodepoint);
  // every other tile uses filler
  for (let i = 0; i < lvl.tiles.length; i++) {
    if (i === lvl.targetIndex) continue;
    assert.equal(lvl.tiles[i].codepoint, lvl.fillerCodepoint);
  }
});

test('buildLevel for a Special level uses 117 distinct codepoints incl. target', () => {
  const lvl = buildLevel({ level: 20, pools, allEmojis, indexSeed: 999 });
  assert.equal(lvl.isSpecial, true);
  assert.equal(lvl.fillerCodepoint, null);
  const codepoints = new Set(lvl.tiles.map(t => t.codepoint));
  assert.equal(codepoints.size, 117);
  assert.equal(lvl.tiles[lvl.targetIndex].codepoint, lvl.targetCodepoint);
});

test('buildLevel targetIndex is within [0, 117)', () => {
  for (let level = 1; level <= 5; level++) {
    const lvl = buildLevel({ level, pools, allEmojis, indexSeed: level * 17 });
    assert.ok(lvl.targetIndex >= 0 && lvl.targetIndex < 117);
  }
});
