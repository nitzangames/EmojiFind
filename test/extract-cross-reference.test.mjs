import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionPairs } from '../scripts/extract-unity-data.mjs';

test('partitionPairs splits pairs by easy/medium/hard lists', () => {
  // Canonical list of pair names by id 0..4
  const canonical = ['pa', 'pb', 'pc', 'pd', 'pe'];
  const easyIds = [0, 2];        // pa, pc
  const mediumIds = [1];          // pb
  // remaining ids 3, 4 => pd, pe go to hard

  const pairsByName = {
    pa: { a: '1f600', b: '1f601', diff: 100, first: false },
    pb: { a: '1f602', b: '1f603', diff: 90,  first: false },
    pc: { a: '1f604', b: '1f605', diff: 80,  first: true  },
    pd: { a: '1f606', b: '1f607', diff: 70,  first: false },
    pe: { a: '1f608', b: '1f609', diff: 60,  first: false },
  };

  const out = partitionPairs(canonical, easyIds, mediumIds, pairsByName);

  assert.deepEqual(out.easy.map(p => p.a), ['1f600', '1f604']);
  assert.deepEqual(out.medium.map(p => p.a), ['1f602']);
  assert.deepEqual(out.hard.map(p => p.a), ['1f606', '1f608']);
});

test('partitionPairs skips canonical entries missing from pairsByName', () => {
  const canonical = ['pa', 'missing', 'pc'];
  const out = partitionPairs(canonical, [0, 1, 2], [], {
    pa: { a: 'A', b: 'B', diff: 1, first: false },
    pc: { a: 'C', b: 'D', diff: 1, first: false },
  });
  assert.equal(out.easy.length, 2);  // pa + pc, missing skipped
});
