import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssetFile } from '../scripts/yaml-parse.mjs';

const fixture = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!114 &11400000
MonoBehaviour:
  m_Name: 100-1439-1442
  sprite1: {fileID: 21300000, guid: 596e981c4f62e4fd2a7787521a2af172, type: 3}
  sprite2: {fileID: 21300000, guid: 6929c634cc21f44359e5b5a99c246bbf, type: 3}
  diff: 100.78789
  alphaDiff: 0
  firstLevels: 0
`;

test('parseAssetFile extracts name, two sprite guids, diff', () => {
  const result = parseAssetFile(fixture);
  assert.equal(result.name, '100-1439-1442');
  assert.equal(result.sprite1Guid, '596e981c4f62e4fd2a7787521a2af172');
  assert.equal(result.sprite2Guid, '6929c634cc21f44359e5b5a99c246bbf');
  assert.equal(result.diff, 100.78789);
  assert.equal(result.first, false);
});

test('parseAssetFile handles firstLevels: 1', () => {
  const result = parseAssetFile(fixture.replace('firstLevels: 0', 'firstLevels: 1'));
  assert.equal(result.first, true);
});
