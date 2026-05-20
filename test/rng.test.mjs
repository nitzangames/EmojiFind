import { test } from 'node:test';
import assert from 'node:assert/strict';

// js/rng.js is a browser-side <script>. Re-evaluate it under node by
// reading the source and eval'ing inside a sandbox-ish closure.
import { readFileSync } from 'node:fs';
const rngSource = readFileSync('./js/rng.js', 'utf8');
const ctx = {};
new Function('ctx', rngSource + '; ctx.makeRng = makeRng;')(ctx);
const { makeRng } = ctx;

test('makeRng is deterministic for the same seed', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  assert.deepEqual(seqA, seqB);
});

test('makeRng diverges for different seeds', () => {
  const a = makeRng(42).next();
  const b = makeRng(43).next();
  assert.notEqual(a, b);
});

test('next() returns floats in [0, 1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 100; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `bad value ${v}`);
  }
});
