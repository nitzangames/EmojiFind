import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Load js/rng.js and js/pairs.js into a shared context.
const rngSource = readFileSync('./js/rng.js', 'utf8');
const pairsSource = readFileSync('./js/pairs.js', 'utf8');
const ctx = {};
new Function('ctx',
  rngSource + ';' + pairsSource +
  ';ctx.makeRng = makeRng; ctx.pickPairForLevel = pickPairForLevel;'
)(ctx);
const { pickPairForLevel } = ctx;

const pools = {
  easy:   [{ a: 'e1', b: 'e2' }, { a: 'e3', b: 'e4' }],
  medium: [{ a: 'm1', b: 'm2' }],
  hard:   [{ a: 'h1', b: 'h2' }, { a: 'h3', b: 'h4' }, { a: 'h5', b: 'h6' }],
};

test('pickPairForLevel uses easy pool for levels < 25', () => {
  const pair = pickPairForLevel(10, pools);
  assert.ok(pools.easy.includes(pair), `expected easy pool, got ${JSON.stringify(pair)}`);
});

test('pickPairForLevel uses medium pool for levels 25-49', () => {
  const pair = pickPairForLevel(30, pools);
  assert.ok(pools.medium.includes(pair));
});

test('pickPairForLevel uses hard pool for levels >= 50', () => {
  const pair = pickPairForLevel(60, pools);
  assert.ok(pools.hard.includes(pair));
});

test('pickPairForLevel is deterministic for the same level number', () => {
  const a = pickPairForLevel(7, pools);
  const b = pickPairForLevel(7, pools);
  assert.deepEqual(a, b);
});
