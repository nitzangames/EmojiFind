import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ctx = {};
new Function('ctx',
  'const GRID_W = 9; const GRID_H = 13; const TILE_COUNT = 117;' +
  readFileSync('./js/hint.js', 'utf8') + ';' +
  'ctx.applyHint = applyHint;'
)(ctx);
const { applyHint } = ctx;

function freshTiles() {
  return Array.from({ length: 117 }, () => ({ dimT: 1 }));
}

test('applyHint(1) with target in low-row half dims rows 7-12', () => {
  // target at col=0 row=0 -> index 0
  const tiles = freshTiles();
  applyHint(1, 0, tiles);
  for (let i = 0; i < 117; i++) {
    const row = i % 13;
    assert.equal(tiles[i].dimT, row >= 7 ? 0.25 : 1, `tile ${i} row ${row}`);
  }
});

test('applyHint(1) with target in high-row half dims rows 0-6', () => {
  // target at col=0 row=12 -> index 12
  const tiles = freshTiles();
  applyHint(1, 12, tiles);
  for (let i = 0; i < 117; i++) {
    const row = i % 13;
    assert.equal(tiles[i].dimT, row < 7 ? 0.25 : 1);
  }
});

test('applyHint(2) with target in low-col half dims cols 5-8', () => {
  // target at col=0 row=0 -> index 0
  const tiles = freshTiles();
  applyHint(2, 0, tiles);
  for (let i = 0; i < 117; i++) {
    const col = Math.floor(i / 13);
    assert.equal(tiles[i].dimT, col >= 5 ? 0.25 : 1);
  }
});

test('applyHint(2) with target in high-col half dims cols 0-4', () => {
  // target at col=8 row=0 -> index 8*13+0 = 104
  const tiles = freshTiles();
  applyHint(2, 104, tiles);
  for (let i = 0; i < 117; i++) {
    const col = Math.floor(i / 13);
    assert.equal(tiles[i].dimT, col < 5 ? 0.25 : 1);
  }
});
