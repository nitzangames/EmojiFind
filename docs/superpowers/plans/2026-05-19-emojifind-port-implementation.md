# EmojiFind Port Implementation Plan

> **Historical note (2026-05-21):** This plan describes the original port, which included a "Special level" every 20 levels (random emojis, target shown in HUD). That feature was later removed — `SPECIAL_EVERY_X`, `isSpecialLevel`, `drawSpecialTarget`, `state.allEmojis`, and `assets/all-emojis.json` no longer exist. Treat any references to them below as period documentation, not current behavior.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faithful 1:1 port of the Unity EmojiFind game to vanilla-JS canvas, deployable to play.nitzan.games.

**Architecture:** Vanilla JS, no bundler. Single-page HTML5 canvas (1080×1920). Build-time Node script extracts Unity's curated lookalike-pair dataset (`.asset` YAML + `.meta` guids) into `assets/pairs.json` + 6,624 Twemoji PNGs in `assets/emoji/`. Runtime is a simple state machine (`loading | inGame | found | settings`). PlaySDK provides save/load + haptics.

**Tech Stack:** Vanilla JS (ES2020), HTML5 Canvas 2D, Node 20+ (for the build script only), PlaySDK. No npm dependencies in the shipped game. Build script uses only Node built-ins (`fs`, `path`).

**Spec reference:** `docs/superpowers/specs/2026-05-19-emojifind-port-design.md`. Each task below cross-references the spec section it implements.

**Working directory:** `/Users/nitzanwilnai/Programming/Claude/JSGames/EmojiFind/`. The repo is freshly `git init`'d locally; no remote yet. All paths below are relative to this directory unless otherwise noted.

**Unity source path** (read-only): `/Users/nitzanwilnai/Programming/Unity/EmojiFind/`. Referenced by the build script. Never modified.

**Version stamp policy:** Per `feedback_per_commit_version_bump.md` — every commit in this plan bumps `VERSION` in `js/constants.js` AND the `<meta name="game-version">` in `index.html`. Start at `v0.1.0`, increment patch number on every commit (`v0.1.0` → `v0.1.1` → `v0.1.2` …). Each task lists the version bump in its commit step.

---

## Milestone A — Project skeleton + asset pipeline

Goal: by end of milestone, `assets/pairs.json`, `assets/all-emojis.json`, and `assets/emoji/*.png` exist and are committed. No game UI yet.

### Task 1: Project skeleton files

**Spec ref:** Architecture / File layout (game).

**Files:**
- Create: `meta.json`
- Create: `.gitignore`
- Create: `.zipignore`
- Create: `CLAUDE.md`
- Create: `index.html`
- Create: `js/constants.js`

- [ ] **Step 1: Create `meta.json`**

```json
{
  "slug": "emoji-find",
  "title": "Emoji Find",
  "description": "Spot the one emoji that's slightly different. 117 tiles, one is the odd one out. Find it fast for 3 stars.",
  "tags": ["puzzle", "casual"],
  "author": "Nitzan",
  "thumbnail": "thumbnail.png"
}
```

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
node_modules/
/build/
*.log
```

- [ ] **Step 3: Create `.zipignore`** (Mirrors how `EmojiFlow/.zipignore` excludes dev files from deploy.)

```
.git/
.gitignore
.zipignore
docs/
scripts/
test/
node_modules/
.DS_Store
*.md
package.json
package-lock.json
```

- [ ] **Step 4: Create `CLAUDE.md`**

```markdown
# CLAUDE.md

## Project

EmojiFind — port of the Unity EmojiFind game. 117 emojis arranged 9×13, one is a slight lookalike of the rest; tap to find it. 3 stars, lose one per hint used. Every 20 levels = "Special" (random emojis, target shown in HUD).

Spec: `docs/superpowers/specs/2026-05-19-emojifind-port-design.md`
Plan: `docs/superpowers/plans/2026-05-19-emojifind-port-implementation.md`

## Development

- Open `index.html` in a browser to run. No build step for the game itself.
- Asset pipeline: `node scripts/extract-unity-data.mjs --unity=/Users/nitzanwilnai/Programming/Unity/EmojiFind` — one-shot, outputs to `assets/`. Run only when the Unity dataset changes. Outputs are committed.
- Vanilla JS, no Phaser, no bundler. Scripts loaded via `<script>` tags in `index.html`.

## Architecture

Pure logic in `js/`:
- `constants.js` — VERSION, layout dims, colours
- `rng.js` — seeded RNG (xmur3 + sfc32)
- `pairs.js` — pair pool loader + level → pair picker
- `level.js` — startLevel(): builds the 117-tile array
- `save.js` — PlaySDK save/load wrapper
- `input.js` — pointerdown handler + hit-test
- `render.js` — draws HUD + tiles + overlays
- `anim.js` — tile shake, star pop, confetti particles
- `ui.js` — Settings modal (HTML overlay)

`game.js` is the entry point — rAF loop + state machine glue.

## Platform constraints

- 1080×1920 portrait canvas. No DPR backing-store scaling. `touch-action: none` on canvas. No transforms; flexbox-centered.
- localStorage prefix `emoji-find:` (single key `emoji-find:save`).
- Bump VERSION on every commit.
```

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="game-version" content="v0.1.0">
  <title>Emoji Find</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #2c3e50;
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: white;
    }
    canvas {
      display: block;
      max-width: 100%; max-height: 100%;
      object-fit: contain;
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <canvas id="game" width="1080" height="1920"></canvas>
  <script src="https://nitzan.games/play-sdk.js"></script>
  <script src="js/constants.js?v=1"></script>
  <script src="game.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 6: Create `js/constants.js`**

```javascript
const VERSION = 'v0.1.0';

// Board
const GRID_W = 9;
const GRID_H = 13;
const TILE_COUNT = GRID_W * GRID_H;   // 117

// Canvas (logical pixels)
const CANVAS_W = 1080;
const CANVAS_H = 1920;

// HUD layout (canvas px)
const HUD_HEIGHT = 200;
const FOUND_HEIGHT_RESERVE = 280;

// Tile layout (canvas px). Computed once; render and hit-test share these.
const TILE_W = 104;
const TILE_H = 104;
const GRID_TOTAL_W = TILE_W * GRID_W;          // 936
const GRID_TOTAL_H = TILE_H * GRID_H;          // 1352
const GRID_X = Math.floor((CANVAS_W - GRID_TOTAL_W) / 2);  // 72
const GRID_Y = HUD_HEIGHT + Math.floor(((CANVAS_H - HUD_HEIGHT) - GRID_TOTAL_H) / 2);

// Colours
const COL_BG = '#2c3e50';
const COL_HINT = '#5badee';
const COL_NEXT = '#2ecc71';
const COL_STAR_ON = '#ffffff';
const COL_STAR_OFF = '#1a2530';

// Special-level cadence (mirrors Unity's specialEveryXLevels = 20)
const SPECIAL_EVERY_X = 20;
```

- [ ] **Step 7: Create stub `game.js`**

```javascript
(function() {
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  function drawFrame() {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.font = '21px sans-serif';
    ctx.fillText(VERSION, CANVAS_W / 2, CANVAS_H - 24);

    requestAnimationFrame(drawFrame);
  }
  requestAnimationFrame(drawFrame);
})();
```

- [ ] **Step 8: Sanity-check the skeleton loads**

Open `index.html` in a browser. Expected: dark blue background, `v0.1.0` text bottom-center. No console errors.

- [ ] **Step 9: Commit**

```bash
git add meta.json .gitignore .zipignore CLAUDE.md index.html js/constants.js game.js
git commit -m "feat: project skeleton (meta, html, version stamp, canvas bg)"
```

---

### Task 2: Build-script package + YAML parser

**Spec ref:** Asset pipeline (build script), Steps 1-3.

**Files:**
- Create: `scripts/extract-unity-data.mjs`
- Create: `scripts/yaml-parse.mjs`
- Create: `test/yaml-parse.test.mjs`
- Create: `package.json`

- [ ] **Step 1: Create `package.json`** (build-time only; not shipped)

```json
{
  "name": "emojifind-build",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "extract": "node scripts/extract-unity-data.mjs --unity=/Users/nitzanwilnai/Programming/Unity/EmojiFind",
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Write failing test for the YAML parser**

Create `test/yaml-parse.test.mjs`:

```javascript
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
```

- [ ] **Step 3: Run test to confirm failure**

Run: `node --test test/yaml-parse.test.mjs`
Expected: FAIL with `Cannot find module '../scripts/yaml-parse.mjs'`.

- [ ] **Step 4: Implement `scripts/yaml-parse.mjs`**

```javascript
// Parse a Unity .asset YAML for the fields EmojiFind cares about.
// Unity .asset files are text YAML with predictable inline maps; we parse with
// regex instead of pulling in a YAML library.

export function parseAssetFile(text) {
  return {
    name:        extractKey(text, /^\s*m_Name:\s*(.+)$/m),
    sprite1Guid: extractGuid(text, /^\s*sprite1:\s*\{[^}]*guid:\s*([0-9a-f]+)/m),
    sprite2Guid: extractGuid(text, /^\s*sprite2:\s*\{[^}]*guid:\s*([0-9a-f]+)/m),
    diff:        parseFloat(extractKey(text, /^\s*diff:\s*([-\d.eE+]+)$/m)),
    first:       extractKey(text, /^\s*firstLevels:\s*(\d+)$/m) === '1',
  };
}

function extractKey(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1].trim();
}

function extractGuid(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  return m[1];
}

// Parse a .png.meta file to get its guid.
export function parseMetaGuid(text) {
  const m = text.match(/^guid:\s*([0-9a-f]+)/m);
  return m ? m[1] : null;
}
```

- [ ] **Step 5: Run test to confirm pass**

Run: `node --test test/yaml-parse.test.mjs`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/yaml-parse.mjs test/yaml-parse.test.mjs
git commit -m "feat: Unity .asset YAML field extractor + tests"
```

---

### Task 3: Build script — pair extraction + cross-reference + emit JSON

**Spec ref:** Asset pipeline, Steps 1-6 (no PNG copy yet).

**Files:**
- Modify: `scripts/extract-unity-data.mjs`
- Create: `test/extract-cross-reference.test.mjs`

- [ ] **Step 1: Write failing test for the easy/medium/hard partitioning logic**

Create `test/extract-cross-reference.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionPairs } from '../scripts/extract-unity-data.mjs';

test('partitionPairs splits pairs by easy/medium/hard lists', () => {
  // Canonical list of pair names by id 0..4
  const canonical = ['pa', 'pb', 'pc', 'pd', 'pe'];
  const easyIds = [0, 2];        // pa, pc
  const mediumIds = [1];          // pb
  // hard contains every canonical pair (mirrors Unity: levels 50+ roll
  // against the full emojiGroups list, not the complement of easy/medium).

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
  assert.deepEqual(out.hard.map(p => p.a), ['1f600', '1f602', '1f604', '1f606', '1f608']);
});

test('partitionPairs skips canonical entries missing from pairsByName', () => {
  const canonical = ['pa', 'missing', 'pc'];
  const out = partitionPairs(canonical, [0, 1, 2], [], {
    pa: { a: 'A', b: 'B', diff: 1, first: false },
    pc: { a: 'C', b: 'D', diff: 1, first: false },
  });
  assert.equal(out.easy.length, 2);  // pa + pc, missing skipped
  assert.equal(out.hard.length, 2);  // only the two non-missing pairs land in hard
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `node --test test/extract-cross-reference.test.mjs`
Expected: FAIL (module doesn't exist or export missing).

- [ ] **Step 3: Implement the build script (without PNG copy yet)**

Create `scripts/extract-unity-data.mjs`:

```javascript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseAssetFile, parseMetaGuid } from './yaml-parse.mjs';

// --- Pure helper, exported for tests ---

export function partitionPairs(canonical, easyIds, mediumIds, pairsByName) {
  const easySet = new Set(easyIds);
  const mediumSet = new Set(mediumIds);
  const easy = [], medium = [], hard = [];
  for (let i = 0; i < canonical.length; i++) {
    const name = canonical[i];
    const pair = pairsByName[name];
    if (!pair) continue;  // skip missing
    if (easySet.has(i))   easy.push(pair);
    if (mediumSet.has(i)) medium.push(pair);
    hard.push(pair);  // hard always includes every pair (mirrors Unity)
  }
  return { easy, medium, hard };
}

// --- CLI entry ---

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await main();
}

async function main() {
  const unityRoot = args.unity;
  if (!unityRoot) {
    console.error('Usage: node scripts/extract-unity-data.mjs --unity=/path/to/Unity/EmojiFind');
    process.exit(1);
  }
  const outDir = path.resolve('assets');
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'emoji'), { recursive: true });

  console.log('Building guid -> codepoint map …');
  const guidToCodepoint = await buildGuidToCodepointMap(unityRoot);
  console.log(`  ${Object.keys(guidToCodepoint).length} PNGs indexed`);

  console.log('Parsing .asset files …');
  const pairsByName = await parseAllAssetFiles(unityRoot, guidToCodepoint);
  console.log(`  ${Object.keys(pairsByName).length} pairs extracted`);

  console.log('Reading canonical / easy / medium lists …');
  const canonical = await readCommaList(path.join(unityRoot, 'Assets/Resources/emojiGroupList.txt'));
  const easyIds = (await readCommaList(path.join(unityRoot, 'Assets/Resources/emojiGroupEasyList.txt'))).map(Number);
  const mediumIds = (await readCommaList(path.join(unityRoot, 'Assets/Resources/emojiGroupMediumList.txt'))).map(Number);

  const partitioned = partitionPairs(canonical, easyIds, mediumIds, pairsByName);
  console.log(`  easy: ${partitioned.easy.length}, medium: ${partitioned.medium.length}, hard: ${partitioned.hard.length}`);

  await fs.writeFile(path.join(outDir, 'pairs.json'), JSON.stringify(partitioned));
  console.log('Wrote assets/pairs.json');

  // PNG copy + all-emojis.json happen in the next task.
}

async function buildGuidToCodepointMap(unityRoot) {
  const dir = path.join(unityRoot, 'Assets/Resources/tweetemoji-72x72');
  const entries = await fs.readdir(dir);
  const map = {};
  for (const entry of entries) {
    if (!entry.endsWith('.png.meta')) continue;
    const guid = parseMetaGuid(await fs.readFile(path.join(dir, entry), 'utf8'));
    if (!guid) continue;
    const codepoint = entry.replace(/\.png\.meta$/, '');
    map[guid] = codepoint;
  }
  return map;
}

async function parseAllAssetFiles(unityRoot, guidToCodepoint) {
  const dirs = [
    path.join(unityRoot, 'Assets/EmojiGroupTwitterEmoji'),
    path.join(unityRoot, 'Assets/EmojiGroupTwitterEmoji2'),
  ];
  const pairsByName = {};
  for (const dir of dirs) {
    let entries;
    try { entries = await fs.readdir(dir); } catch { continue; }
    for (const entry of entries) {
      if (!entry.endsWith('.asset')) continue;
      const parsed = parseAssetFile(await fs.readFile(path.join(dir, entry), 'utf8'));
      const a = guidToCodepoint[parsed.sprite1Guid];
      const b = guidToCodepoint[parsed.sprite2Guid];
      if (!a || !b) continue;          // skip orphans
      pairsByName[parsed.name] = { a, b, diff: parsed.diff, first: parsed.first };
    }
  }
  return pairsByName;
}

async function readCommaList(file) {
  const text = await fs.readFile(file, 'utf8');
  return text.trim().split(',').map(s => s.trim()).filter(Boolean);
}
```

- [ ] **Step 4: Run the cross-reference test**

Run: `node --test test/extract-cross-reference.test.mjs`
Expected: PASS — 2 tests.

- [ ] **Step 5: Run the full extractor end-to-end (no PNG copy yet)**

Run: `node scripts/extract-unity-data.mjs --unity=/Users/nitzanwilnai/Programming/Unity/EmojiFind`

Expected output (numbers approximate):
```
Building guid -> codepoint map …
  ~6600 PNGs indexed
Parsing .asset files …
  ~15700 pairs extracted
Reading canonical / easy / medium lists …
  easy: ~N, medium: ~N, hard: ~N
Wrote assets/pairs.json
```

If any number is 0 or far below expectation, investigate — likely a path or regex issue.

- [ ] **Step 6: Spot-check `assets/pairs.json`**

Run: `node -e "const p = require('./assets/pairs.json'); console.log('easy[0]:', p.easy[0]); console.log('totals:', {easy: p.easy.length, medium: p.medium.length, hard: p.hard.length});"`

Expected: `easy[0]` is an object like `{ a: '1f600', b: '1f603', diff: 100.78, first: false }` (codepoints lowercase hex). Totals match the run output.

- [ ] **Step 7: Commit (script + outputs, but PNGs come next)**

```bash
git add scripts/extract-unity-data.mjs test/extract-cross-reference.test.mjs assets/pairs.json
git commit -m "feat: extract Unity lookalike pair dataset to pairs.json"
```

---

### Task 4: Build script — copy PNGs + emit all-emojis.json

**Spec ref:** Asset pipeline, Steps 7-8.

**Files:**
- Modify: `scripts/extract-unity-data.mjs` (add PNG copy + all-emojis emit)

- [ ] **Step 1: Extend `main()` to copy PNGs and write all-emojis.json**

Add to the end of `main()` in `scripts/extract-unity-data.mjs`, before the closing brace:

```javascript
  console.log('Copying Twemoji PNGs …');
  const srcEmojiDir = path.join(unityRoot, 'Assets/Resources/tweetemoji-72x72');
  const dstEmojiDir = path.join(outDir, 'emoji');
  const allCodepoints = [];
  for (const guid of Object.keys(guidToCodepoint)) {
    const codepoint = guidToCodepoint[guid];
    const src = path.join(srcEmojiDir, `${codepoint}.png`);
    const dst = path.join(dstEmojiDir, `${codepoint}.png`);
    await fs.copyFile(src, dst);
    allCodepoints.push(codepoint);
  }
  allCodepoints.sort();
  await fs.writeFile(path.join(outDir, 'all-emojis.json'), JSON.stringify(allCodepoints));
  console.log(`  copied ${allCodepoints.length} PNGs; wrote assets/all-emojis.json`);
```

- [ ] **Step 2: Re-run the extractor**

Run: `node scripts/extract-unity-data.mjs --unity=/Users/nitzanwilnai/Programming/Unity/EmojiFind`

Expected last line: `copied ~6624 PNGs; wrote assets/all-emojis.json`.

- [ ] **Step 3: Spot-check outputs**

```bash
ls assets/emoji/ | wc -l         # expect ~6624
ls assets/emoji/1f600.png        # expect "exists"
node -e "console.log(require('./assets/all-emojis.json').length)"  # ~6624
du -sh assets/emoji/             # expect roughly 30-40 MB
```

If the dir is far larger than 50 MB, stop — the platform's 50 MB zip cap would be violated. (Unlikely, but worth verifying.)

- [ ] **Step 4: Commit (track the PNGs)**

Note: `git add assets/emoji/` will stage ~6.6k files. This is intentional — the spec calls for committing the outputs so day-to-day dev doesn't need Unity.

```bash
git add scripts/extract-unity-data.mjs assets/all-emojis.json assets/emoji/
git commit -m "feat: copy 6624 Twemoji PNGs + emit all-emojis.json"
```

---

## Milestone B — Pure logic with tests

Goal: by end of milestone, the RNG, level → pair picker, hint logic, and save shape are implemented and unit-tested. No UI changes.

### Task 5: Seeded RNG

**Spec ref:** Level selection (mirrors Unity's two `Random.InitState` calls).

**Files:**
- Create: `js/rng.js`
- Create: `test/rng.test.mjs`

- [ ] **Step 1: Write failing test for the RNG**

Create `test/rng.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run test to confirm failure**

Run: `node --test test/rng.test.mjs`
Expected: FAIL — `./js/rng.js` does not exist yet.

- [ ] **Step 3: Implement `js/rng.js`**

```javascript
// Seedable RNG: xmur3 (hash seed -> initial state) + sfc32 (PRNG step).
// Deterministic across browsers and Node. Public API: makeRng(seedInt).
function makeRng(seed) {
  // xmur3
  let h = 1779033703 ^ seed;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  // four 32-bit state words
  let a = h | 0;
  let b = (h ^ 0x6c078965) | 0;
  let c = (h ^ 0xb979a7e1) | 0;
  let d = (h ^ 0x5f3759df) | 0;
  return {
    next() {
      // sfc32
      a |= 0; b |= 0; c |= 0; d |= 0;
      let t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ (b >>> 9);
      b = c + (c << 3) | 0;
      c = (c << 21) | (c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
  };
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `node --test test/rng.test.mjs`
Expected: PASS — 3 tests.

- [ ] **Step 5: Bump VERSION + commit**

Edit `js/constants.js`: `const VERSION = 'v0.1.1';`. Edit `index.html`: `<meta name="game-version" content="v0.1.1">`.

```bash
git add js/rng.js js/constants.js index.html test/rng.test.mjs
git commit -m "feat: seedable RNG (xmur3 + sfc32)"
```

---

### Task 6: Level → pair picker (mirrors Unity)

**Spec ref:** Level selection (Runtime state machine).

**Files:**
- Create: `js/pairs.js`
- Create: `test/pairs.test.mjs`

- [ ] **Step 1: Write failing tests for pair-picking determinism + difficulty bucketing**

Create `test/pairs.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Load js/rng.js and js/pairs.js into a shared context.
const rngSource = readFileSync('./js/rng.js', 'utf8');
const pairsSource = readFileSync('./js/pairs.js', 'utf8');
const ctx = {};
new Function('ctx',
  rngSource + ';' + pairsSource +
  ';ctx.makeRng = makeRng; ctx.pickPairForLevel = pickPairForLevel; ctx.isSpecialLevel = isSpecialLevel;'
)(ctx);
const { pickPairForLevel, isSpecialLevel } = ctx;

const pools = {
  easy:   [{ a: 'e1', b: 'e2' }, { a: 'e3', b: 'e4' }],
  medium: [{ a: 'm1', b: 'm2' }],
  hard:   [{ a: 'h1', b: 'h2' }, { a: 'h3', b: 'h4' }, { a: 'h5', b: 'h6' }],
};

test('isSpecialLevel triggers every 20 levels (not on 0)', () => {
  assert.equal(isSpecialLevel(0), false);
  assert.equal(isSpecialLevel(1), false);
  assert.equal(isSpecialLevel(19), false);
  assert.equal(isSpecialLevel(20), true);
  assert.equal(isSpecialLevel(40), true);
});

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
```

- [ ] **Step 2: Run test to confirm failure**

Run: `node --test test/pairs.test.mjs`
Expected: FAIL — `js/pairs.js` does not exist.

- [ ] **Step 3: Implement `js/pairs.js`**

```javascript
// Pair-pool indexing. Mirrors Unity's StartLevel():
//   - levels < 25: pick from easy pool
//   - levels 25..49: pick from medium pool
//   - else: pick from hard pool
//   - level seeded by (level + 512) to mirror Unity's Random.InitState
// `pools` shape: { easy: [], medium: [], hard: [] }, each entry { a, b, diff, first }.

function isSpecialLevel(level) {
  return level > 0 && (level % SPECIAL_EVERY_X) === 0;
}

function poolForLevel(level, pools) {
  if (level < 25) return pools.easy;
  if (level < 50) return pools.medium;
  return pools.hard;
}

function pickPairForLevel(level, pools) {
  const rng = makeRng(level + 512);
  const pool = poolForLevel(level, pools);
  const idx = Math.floor(rng.next() * pool.length);
  return pool[idx];
}
```

(Note: `SPECIAL_EVERY_X` comes from `js/constants.js`. The test harness has to define a stub — see below.)

- [ ] **Step 4: Update the test to stub `SPECIAL_EVERY_X`**

In `test/pairs.test.mjs`, change the `new Function(...)` line to inject the constant before evaluating:

```javascript
new Function('ctx',
  'const SPECIAL_EVERY_X = 20;' +
  rngSource + ';' + pairsSource +
  ';ctx.makeRng = makeRng; ctx.pickPairForLevel = pickPairForLevel; ctx.isSpecialLevel = isSpecialLevel;'
)(ctx);
```

- [ ] **Step 5: Run test to confirm pass**

Run: `node --test test/pairs.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 6: Wire pairs.js into `index.html`**

Edit `index.html` — add the script tags before `game.js`:

```html
  <script src="js/rng.js?v=1"></script>
  <script src="js/pairs.js?v=1"></script>
```

- [ ] **Step 7: Bump VERSION + commit**

`v0.1.2`.

```bash
git add js/pairs.js js/constants.js index.html test/pairs.test.mjs
git commit -m "feat: level -> pair picker (easy/medium/hard, seeded)"
```

---

### Task 7: Level builder (pure, no rendering)

**Spec ref:** Per-level data, Level selection.

**Files:**
- Create: `js/level.js`
- Create: `test/level.test.mjs`

- [ ] **Step 1: Write failing test**

Create `test/level.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run test to confirm failure**

Run: `node --test test/level.test.mjs`
Expected: FAIL — `js/level.js` does not exist.

- [ ] **Step 3: Implement `js/level.js`**

```javascript
// Build a per-level state object. Pure: takes pools, allEmojis, and seeds;
// returns a fully-formed level. Mirrors Unity's StartLevel().

function buildLevel({ level, pools, allEmojis, indexSeed }) {
  // Two seed streams, mirroring Unity's two Random.InitState calls.
  const indexRng = makeRng(indexSeed);
  const targetIndex = Math.floor(indexRng.next() * TILE_COUNT);

  const special = isSpecialLevel(level);
  let targetCodepoint, fillerCodepoint;
  const tiles = new Array(TILE_COUNT);

  if (special) {
    fillerCodepoint = null;
    const pickRng = makeRng(level + 512);
    const used = new Set();
    targetCodepoint = allEmojis[Math.floor(pickRng.next() * allEmojis.length)];
    used.add(targetCodepoint);
    for (let i = 0; i < TILE_COUNT; i++) {
      if (i === targetIndex) {
        tiles[i] = { codepoint: targetCodepoint, alpha: 1, shakeT: 0, dimT: 1, popT: 0 };
        continue;
      }
      let cp;
      do { cp = allEmojis[Math.floor(pickRng.next() * allEmojis.length)]; }
      while (used.has(cp));
      used.add(cp);
      tiles[i] = { codepoint: cp, alpha: 1, shakeT: 0, dimT: 1, popT: 0 };
    }
  } else {
    const pair = pickPairForLevel(level, pools);
    targetCodepoint = pair.a;
    fillerCodepoint = pair.b;
    for (let i = 0; i < TILE_COUNT; i++) {
      tiles[i] = {
        codepoint: (i === targetIndex) ? targetCodepoint : fillerCodepoint,
        alpha: 1, shakeT: 0, dimT: 1, popT: 0,
      };
    }
  }

  return {
    level,
    isSpecial: special,
    targetIndex,
    targetCodepoint,
    fillerCodepoint,
    tiles,
    hintsUsed: 0,
    startedAt: 0,  // filled by caller (performance.now() at level start)
  };
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `node --test test/level.test.mjs`
Expected: PASS — 3 tests.

- [ ] **Step 5: Wire level.js into `index.html`**

Add before `game.js`:

```html
  <script src="js/level.js?v=1"></script>
```

- [ ] **Step 6: Bump VERSION + commit**

`v0.1.3`.

```bash
git add js/level.js js/constants.js index.html test/level.test.mjs
git commit -m "feat: buildLevel — 117-tile state for normal + Special levels"
```

---

### Task 8: Hint logic (pure)

**Spec ref:** Hints section.

**Files:**
- Create: `js/hint.js`
- Create: `test/hint.test.mjs`

- [ ] **Step 1: Write failing tests for both hints**

Create `test/hint.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run test to confirm failure**

Run: `node --test test/hint.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `js/hint.js`**

```javascript
// Apply hint 1 (horizontal split) or hint 2 (vertical split) to the tile
// dim state. Sets dimT to 0.25 on tiles in the half NOT containing the
// target. Mirrors Unity's Hint1()/Hint2() — see spec for derivation.
function applyHint(which, targetIndex, tiles) {
  if (which === 1) {
    const targetRow = targetIndex % 13;        // 0..12
    const targetInLowHalf = targetRow < 7;
    for (let i = 0; i < tiles.length; i++) {
      const row = i % 13;
      const inDimHalf = targetInLowHalf ? row >= 7 : row < 7;
      if (inDimHalf) tiles[i].dimT = 0.25;
    }
  } else if (which === 2) {
    const targetCol = Math.floor(targetIndex / 13);  // 0..8
    const targetInLowHalf = targetCol < 5;
    for (let i = 0; i < tiles.length; i++) {
      const col = Math.floor(i / 13);
      const inDimHalf = targetInLowHalf ? col >= 5 : col < 5;
      if (inDimHalf) tiles[i].dimT = 0.25;
    }
  }
}
```

- [ ] **Step 4: Run test to confirm pass**

Run: `node --test test/hint.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Wire hint.js into `index.html`**

Add before `game.js`:

```html
  <script src="js/hint.js?v=1"></script>
```

- [ ] **Step 6: Bump VERSION + commit**

`v0.1.4`.

```bash
git add js/hint.js js/constants.js index.html test/hint.test.mjs
git commit -m "feat: hint logic (horizontal + vertical dim halves)"
```

---

### Task 9: Save module (PlaySDK wrapper)

**Spec ref:** Save / load section.

**Files:**
- Create: `js/save.js`

(No test — this is glue over the PlaySDK; the SDK isn't available under Node and mocking it doesn't add much. We'll smoke-test it in the browser in Task 16.)

- [ ] **Step 1: Implement `js/save.js`**

```javascript
// Save/load wrapper around PlaySDK. In-memory mirror is the source of truth
// during a session; SDK writes are fire-and-forget.

const SAVE_KEY = 'emoji-find:save';
const DEFAULT_SAVE = {
  currentLevel: 1,
  maxLevel: 1,
  levelStars: {},
  settings: { sound: true, haptics: true },
};

let mem = null;

async function loadSave() {
  let raw = null;
  try {
    if (window.PlaySDK && typeof window.PlaySDK.load === 'function') {
      raw = await window.PlaySDK.load(SAVE_KEY);
    }
  } catch (_) { /* ignore */ }
  if (!raw) {
    mem = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    return mem;
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    mem = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SAVE)), parsed);
    mem.settings = Object.assign({}, DEFAULT_SAVE.settings, mem.settings || {});
  } catch (_) {
    mem = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }
  return mem;
}

function getSave() { return mem; }

function writeSave() {
  if (!mem) return;
  try {
    if (window.PlaySDK && typeof window.PlaySDK.save === 'function') {
      window.PlaySDK.save(SAVE_KEY, JSON.stringify(mem));
    }
  } catch (_) { /* ignore */ }
}

function resetSave() {
  mem = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  writeSave();
}

function totalStars() {
  if (!mem) return 0;
  let sum = 0;
  for (const k in mem.levelStars) sum += mem.levelStars[k] | 0;
  return sum;
}
```

- [ ] **Step 2: Wire save.js into `index.html`**

Add before `game.js`:

```html
  <script src="js/save.js?v=1"></script>
```

- [ ] **Step 3: Bump VERSION + commit**

`v0.1.5`.

```bash
git add js/save.js js/constants.js index.html
git commit -m "feat: save/load wrapper (PlaySDK + in-memory mirror)"
```

---

## Milestone C — Game runs end-to-end

Goal: by end of milestone, the game boots, loads pairs, displays a level, accepts taps, advances on found, and saves progress. No polish animations yet.

### Task 10: Image loader + LRU cache

**Spec ref:** Image loading.

**Files:**
- Create: `js/images.js`

- [ ] **Step 1: Implement `js/images.js`**

```javascript
// Image cache + loader. Decoded HTMLImageElement keyed by codepoint.
// LRU eviction at 256 entries (enough for a Special level's 117 + history).

const LRU_MAX = 256;
const imgCache = new Map();   // codepoint -> HTMLImageElement
const lruOrder = [];           // most-recent-last

function getImageNow(codepoint) {
  return imgCache.get(codepoint) || null;
}

function loadImage(codepoint) {
  const existing = imgCache.get(codepoint);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    touchLru(codepoint);
    return Promise.resolve(existing);
  }
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => {
      imgCache.set(codepoint, img);
      touchLru(codepoint);
      resolve(img);
    }, { once: true });
    img.addEventListener('error', reject, { once: true });
    img.src = 'assets/emoji/' + codepoint + '.png';
    imgCache.set(codepoint, img);   // cache the in-flight Image too
    touchLru(codepoint);
  });
}

function loadImages(codepoints) {
  return Promise.all(codepoints.map(loadImage));
}

function touchLru(codepoint) {
  const idx = lruOrder.indexOf(codepoint);
  if (idx !== -1) lruOrder.splice(idx, 1);
  lruOrder.push(codepoint);
  while (lruOrder.length > LRU_MAX) {
    const evict = lruOrder.shift();
    imgCache.delete(evict);
  }
}
```

- [ ] **Step 2: Wire images.js into `index.html`**

Add before `game.js`:

```html
  <script src="js/images.js?v=1"></script>
```

- [ ] **Step 3: Bump VERSION + commit**

`v0.1.6`.

```bash
git add js/images.js js/constants.js index.html
git commit -m "feat: image loader with LRU cache (256)"
```

---

### Task 11: Renderer — HUD + grid (no animations)

**Spec ref:** Rendering (Per-frame draw order), UI (Top HUD bar).

**Files:**
- Create: `js/render.js`

- [ ] **Step 1: Implement `js/render.js`**

```javascript
// All drawing. Stateless; consumes a `state` object from game.js.
// state shape: { mode, level, levelData, save, hudButtons }.

const HINT_BTN = { x: CANVAS_W - 80 - 200, y: 50, w: 200, h: 100 };
const GEAR_BTN = { x: CANVAS_W - 80, y: 20, w: 60, h: 60 };
const NEXT_BTN = { x: (CANVAS_W - 600) / 2, y: 1700, w: 600, h: 140 };
const PREV_BTN = { x: 80, y: 1700, w: 140, h: 140 };

function drawFrame(state) {
  ctx.fillStyle = COL_BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawHud(state);
  if (state.mode === 'loading') {
    drawLoading();
  } else {
    drawGrid(state.levelData);
    if (state.levelData.isSpecial) drawSpecialTarget(state.levelData);
    if (state.mode === 'found') drawFoundOverlay(state.levelData);
  }
  drawVersion();
}

function drawHud(state) {
  // Star count
  ctx.fillStyle = '#ffd84a';
  ctx.font = '60px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 60, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = '48px sans-serif';
  ctx.fillText(String(totalStars()), 120, 100);

  // Title
  ctx.textAlign = 'center';
  ctx.font = '72px sans-serif';
  ctx.fillStyle = '#ffffff';
  const title = state.levelData && state.levelData.isSpecial
    ? `Special ${Math.floor(state.levelData.level / SPECIAL_EVERY_X)}`
    : `Level ${state.level}`;
  ctx.fillText(title, CANVAS_W / 2, 100);

  // Hint button (only inGame and hintsUsed < 2)
  if (state.mode === 'inGame' && state.levelData && state.levelData.hintsUsed < 2) {
    drawPill(HINT_BTN, COL_HINT, 'Hint');
  }

  // Settings gear
  ctx.fillStyle = '#ffffff';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙', GEAR_BTN.x + GEAR_BTN.w / 2, GEAR_BTN.y + GEAR_BTN.h / 2);
}

function drawGrid(levelData) {
  for (let i = 0; i < TILE_COUNT; i++) {
    const t = levelData.tiles[i];
    const col = Math.floor(i / GRID_H);
    const row = i % GRID_H;
    const x = GRID_X + col * TILE_W;
    const y = GRID_Y + row * TILE_H;
    const img = getImageNow(t.codepoint);
    if (img) {
      ctx.globalAlpha = t.alpha * t.dimT;
      ctx.drawImage(img, x, y, TILE_W, TILE_H);
      ctx.globalAlpha = 1;
    }
  }
}

function drawSpecialTarget(levelData) {
  const cx = CANVAS_W / 2;
  const y = HUD_HEIGHT - 8;
  ctx.fillStyle = '#ffffff';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('Find this →', cx - 60, y);
  const img = getImageNow(levelData.targetCodepoint);
  if (img) ctx.drawImage(img, cx - 48, y - 48, 96, 96);
}

function drawFoundOverlay(levelData) {
  ctx.fillStyle = '#ffffff';
  ctx.font = '108px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Emoji found!', CANVAS_W / 2, 280);

  // Stars (no animation yet — fixed positions)
  const starsEarned = 3 - levelData.hintsUsed;
  const starSize = 120, gap = 40;
  const totalW = 3 * starSize + 2 * gap;
  const startX = (CANVAS_W - totalW) / 2;
  ctx.textBaseline = 'middle';
  ctx.font = '120px sans-serif';
  for (let s = 0; s < 3; s++) {
    ctx.fillStyle = s < starsEarned ? COL_STAR_ON : COL_STAR_OFF;
    ctx.fillText('★', startX + s * (starSize + gap) + starSize / 2, 460);
  }

  drawPill(NEXT_BTN, COL_NEXT, 'Next');
  if (levelData.level > 1) drawPill(PREV_BTN, COL_NEXT, '←');
}

function drawPill(r, color, text) {
  const radius = r.h / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r.x + radius, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, radius);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, radius);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, radius);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
}

function drawLoading() {
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading…', CANVAS_W / 2, CANVAS_H / 2);
}

function drawVersion() {
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '21px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(VERSION, CANVAS_W / 2, CANVAS_H - 24);
}

// Export button rects for input.js to reuse.
const RENDER_RECTS = { HINT_BTN, GEAR_BTN, NEXT_BTN, PREV_BTN };
```

Note: `ctx` is a global from `game.js` (we'll redefine the game.js stub in the next task to expose it).

- [ ] **Step 2: Wire render.js into `index.html`**

Add before `game.js`:

```html
  <script src="js/render.js?v=1"></script>
```

- [ ] **Step 3: Bump VERSION + commit**

`v0.1.7`.

```bash
git add js/render.js js/constants.js index.html
git commit -m "feat: renderer — HUD, grid, found overlay (static)"
```

---

### Task 12: Game loop + first playable level

**Spec ref:** Runtime state machine, Input section.

**Files:**
- Rewrite: `game.js`
- Create: `js/input.js`

- [ ] **Step 1: Rewrite `game.js` to bootstrap a level**

```javascript
var canvas, ctx;
var state = {
  mode: 'loading',          // 'loading' | 'inGame' | 'found' | 'settings'
  level: 1,
  levelData: null,
  pools: null,
  allEmojis: null,
};

async function bootstrap() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  await loadSave();
  state.level = getSave().currentLevel;

  const pairsRes = await fetch('assets/pairs.json');
  state.pools = await pairsRes.json();
  const allRes = await fetch('assets/all-emojis.json');
  state.allEmojis = await allRes.json();

  attachInput(canvas);
  await startLevel(state.level);

  requestAnimationFrame(frame);
}

async function startLevel(level) {
  state.mode = 'loading';
  state.level = level;
  const data = buildLevel({
    level,
    pools: state.pools,
    allEmojis: state.allEmojis,
    indexSeed: (Date.now() % 100000) + level,
  });
  data.startedAt = performance.now();
  // Preload images for this level
  const needed = new Set();
  needed.add(data.targetCodepoint);
  if (data.fillerCodepoint) needed.add(data.fillerCodepoint);
  for (const t of data.tiles) needed.add(t.codepoint);
  await loadImages(Array.from(needed));
  state.levelData = data;
  state.mode = 'inGame';
}

function frame() {
  drawFrame(state);
  requestAnimationFrame(frame);
}

window.addEventListener('load', bootstrap);
```

- [ ] **Step 2: Implement `js/input.js`**

```javascript
// Single pointerdown handler on canvas. Hit-test order:
// gear -> hint (if visible) -> prev/next (if in found) -> grid.
let canvasRect = null;
let canvasScaleX = 1, canvasScaleY = 1;

function refreshRect() {
  canvasRect = canvas.getBoundingClientRect();
  canvasScaleX = canvas.width / canvasRect.width;
  canvasScaleY = canvas.height / canvasRect.height;
}

function attachInput(cv) {
  refreshRect();
  window.addEventListener('resize', refreshRect);
  cv.addEventListener('pointerdown', onPointerDown);
}

function hit(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function onPointerDown(e) {
  if (!canvasRect) refreshRect();
  const x = (e.clientX - canvasRect.left) * canvasScaleX;
  const y = (e.clientY - canvasRect.top) * canvasScaleY;
  e.preventDefault();

  if (state.mode === 'settings') return;  // settings modal swallows input

  if (hit(RENDER_RECTS.GEAR_BTN, x, y)) {
    openSettings();
    return;
  }
  if (state.mode === 'found') {
    if (hit(RENDER_RECTS.NEXT_BTN, x, y)) { onNext(); return; }
    if (state.levelData.level > 1 && hit(RENDER_RECTS.PREV_BTN, x, y)) { onPrev(); return; }
    return;
  }
  if (state.mode === 'inGame') {
    if (state.levelData.hintsUsed < 2 && hit(RENDER_RECTS.HINT_BTN, x, y)) {
      onHint();
      return;
    }
    // Grid hit-test
    const col = Math.floor((x - GRID_X) / TILE_W);
    const row = Math.floor((y - GRID_Y) / TILE_H);
    if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return;
    const idx = col * GRID_H + row;
    onGridTap(idx);
  }
}

function onGridTap(idx) {
  if (idx === state.levelData.targetIndex) {
    onFound();
  } else {
    // Will get shake + haptic in Task 14.
  }
}

function onFound() {
  const lvl = state.levelData;
  state.mode = 'found';
  const starsEarned = 3 - lvl.hintsUsed;
  const save = getSave();
  save.levelStars[lvl.level] = Math.max(save.levelStars[lvl.level] || 0, starsEarned);
  save.maxLevel = Math.max(save.maxLevel, lvl.level + 1);
  save.currentLevel = lvl.level + 1;
  writeSave();
}

function onNext() { startLevel(state.levelData.level + 1); }
function onPrev() { startLevel(state.levelData.level - 1); }
function onHint() {
  const lvl = state.levelData;
  applyHint(lvl.hintsUsed + 1, lvl.targetIndex, lvl.tiles);
  lvl.hintsUsed++;
}

// Stub — full settings modal arrives in Task 18.
function openSettings() { /* no-op for now */ }
```

- [ ] **Step 3: Wire input.js into `index.html`**

Add before `game.js`:

```html
  <script src="js/input.js?v=1"></script>
```

Final `<body>` script order should be: `play-sdk`, `constants`, `rng`, `pairs`, `level`, `hint`, `save`, `images`, `render`, `input`, `game`.

- [ ] **Step 4: Manual smoke test in browser**

Open `index.html` in a browser (use a local server — `python3 -m http.server 8083` from the project root, then visit `http://localhost:8083`). Expected:

1. Loading state briefly, then 117 emoji tiles appear (one is the lookalike).
2. Tap the wrong tile → nothing happens yet (shake comes in Task 14).
3. Tap the right tile → "Emoji found!" overlay appears with 3 stars + Next button.
4. Tap Next → next level loads with a different pair.
5. Tap the Hint button → half the board dims. Tap Hint again → a different half dims. Hint button disappears.
6. Refresh the page → resumes at the level you reached.

If any of those fail, debug before commit.

- [ ] **Step 5: Bump VERSION + commit**

`v0.1.8`.

```bash
git add game.js js/input.js js/constants.js index.html
git commit -m "feat: playable game loop — tap to find, next, prev, hints, save"
```

---

## Milestone D — Polish, platform, deploy

Goal: by end of milestone, animations are wired up, PlaySDK haptics/pause/resume/screenshotMode are integrated, the settings modal works, the thumbnail is in place, and the game is ready to deploy.

### Task 13: Animations module — shake, dim, pop, confetti

**Spec ref:** Animations section.

**Files:**
- Create: `js/anim.js`
- Modify: `js/render.js` (apply shake + pop transforms in drawGrid)
- Modify: `game.js` (drive anim timers each frame)

- [ ] **Step 1: Create `js/anim.js`**

```javascript
// Tile-shake, target-pop, non-target dim, star-pop, confetti.
// All driven by `anim.update(dt)` from the game loop.

const confetti = [];  // active particles, free-list
const confettiFree = [];

const STAR_POP_DURATION = 200;
const STAR_POP_STAGGER = 80;

const anim = {
  // Star pop state for the found-overlay sequence.
  stars: [0, 0, 0],     // 0..1 progress per star
  starStartedAt: -1,    // wall-clock ms when sequence started

  // Confetti spawn.
  spawnConfetti(cx, cy) {
    for (let i = 0; i < 80; i++) {
      const p = confettiFree.pop() || { x: 0, y: 0, vx: 0, vy: 0, color: '', life: 0 };
      p.x = cx; p.y = cy;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 600 + Math.random() * 600;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      p.life = 1.5;
      confetti.push(p);
    }
  },

  // Per-frame tick.
  update(dtMs, levelData) {
    const dt = dtMs / 1000;
    // Tile timers
    if (levelData) {
      for (const t of levelData.tiles) {
        if (t.shakeT > 0) {
          t.shakeT -= dtMs / 250;
          if (t.shakeT < 0) t.shakeT = 0;
        }
        if (t.popT > 0) {
          t.popT -= dtMs / 200;
          if (t.popT < 0) t.popT = 0;
        }
        if (t.dimTarget !== undefined && t.dimT !== t.dimTarget) {
          const step = (1 / 0.3) * dt;       // 300ms to lerp
          if (t.dimT > t.dimTarget) t.dimT = Math.max(t.dimTarget, t.dimT - step);
          else                      t.dimT = Math.min(t.dimTarget, t.dimT + step);
        }
      }
    }
    // Confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.vy += 1500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        confetti.splice(i, 1);
        confettiFree.push(p);
      }
    }
  },

  // Reset star sequence (call on found-state entry).
  startStarSequence(starsEarned) {
    anim.stars[0] = anim.stars[1] = anim.stars[2] = 0;
    anim.starStartedAt = performance.now();
    anim.starsEarned = starsEarned;
  },

  updateStars() {
    if (anim.starStartedAt < 0) return;
    const t = performance.now() - anim.starStartedAt;
    for (let i = 0; i < 3; i++) {
      const local = t - i * STAR_POP_STAGGER;
      if (local <= 0) anim.stars[i] = 0;
      else if (local >= STAR_POP_DURATION) anim.stars[i] = 1;
      else anim.stars[i] = local / STAR_POP_DURATION;
    }
  },

  drawConfetti() {
    for (const p of confetti) {
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    }
    ctx.globalAlpha = 1;
  },
};

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c66bff', '#ff8d4d', '#7be0ff', '#ffffff'];
```

- [ ] **Step 2: Modify `js/render.js:drawGrid` to apply shake + pop**

Replace the `drawGrid(levelData)` body with:

```javascript
function drawGrid(levelData) {
  for (let i = 0; i < TILE_COUNT; i++) {
    const t = levelData.tiles[i];
    const col = Math.floor(i / GRID_H);
    const row = i % GRID_H;
    const x = GRID_X + col * TILE_W;
    const y = GRID_Y + row * TILE_H;
    const img = getImageNow(t.codepoint);
    if (!img) continue;

    const shakeOffset = t.shakeT > 0 ? Math.sin(t.shakeT * 30) * 12 : 0;
    let scale = 1;
    if (t.popT > 0) {
      // 0..1: 0->0.5 grows to 1.3, 0.5->1 shrinks to 1.0
      scale = t.popT > 0.5 ? 1 + (1 - t.popT) * 0.6 : 1 + t.popT * 0.6;
    }
    const drawX = x + shakeOffset + (TILE_W - TILE_W * scale) / 2;
    const drawY = y + (TILE_H - TILE_H * scale) / 2;
    ctx.globalAlpha = t.alpha * t.dimT;
    ctx.drawImage(img, drawX, drawY, TILE_W * scale, TILE_H * scale);
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 3: Modify `js/render.js:drawFoundOverlay` to use animated star progress + confetti**

Replace the stars loop in `drawFoundOverlay` with:

```javascript
  const starsEarned = 3 - levelData.hintsUsed;
  const starSize = 120, gap = 40;
  const totalW = 3 * starSize + 2 * gap;
  const startX = (CANVAS_W - totalW) / 2;
  ctx.font = '120px sans-serif';
  ctx.textBaseline = 'middle';
  for (let s = 0; s < 3; s++) {
    const p = anim.stars[s];          // 0..1
    if (p <= 0) continue;             // not visible yet
    // bounce: scale 0 -> 1.2 -> 1
    const scale = p < 0.5 ? p * 2.4 : 2.4 - p * 1.2;  // 0->1.2 then 1.2->1
    const cx = startX + s * (starSize + gap) + starSize / 2;
    ctx.fillStyle = s < starsEarned ? COL_STAR_ON : COL_STAR_OFF;
    ctx.save();
    ctx.translate(cx, 460);
    ctx.scale(scale, scale);
    ctx.fillText('★', 0, 0);
    ctx.restore();
  }

  anim.drawConfetti();
```

- [ ] **Step 4: Modify `game.js` to call `anim.update` each frame and wire hooks**

In `game.js`, replace the `frame` function with:

```javascript
var lastFrameTs = 0;
function frame(ts) {
  const dt = lastFrameTs === 0 ? 16 : Math.min(50, ts - lastFrameTs);
  lastFrameTs = ts;
  anim.update(dt, state.levelData);
  anim.updateStars();
  drawFrame(state);
  requestAnimationFrame(frame);
}
```

And update the `frame` initial-call:

```javascript
requestAnimationFrame(frame);  // (already there)
```

- [ ] **Step 5: Modify `js/input.js` to trigger animations**

In `onFound()`, append:

```javascript
  // Target pop + non-target dim + stars + confetti
  lvl.tiles[lvl.targetIndex].popT = 1;
  for (let i = 0; i < lvl.tiles.length; i++) {
    if (i !== lvl.targetIndex) lvl.tiles[i].dimTarget = 0.25;
  }
  anim.startStarSequence(3 - lvl.hintsUsed);
  anim.spawnConfetti(CANVAS_W / 2, CANVAS_H / 2);
```

In `onGridTap` (wrong tap branch), replace the comment with:

```javascript
    state.levelData.tiles[idx].shakeT = 1;
```

- [ ] **Step 6: Wire anim.js into `index.html`**

Add before `render.js`:

```html
  <script src="js/anim.js?v=1"></script>
```

- [ ] **Step 7: Manual smoke test**

Open the game. Expected:
- Wrong tap → that tile shakes briefly.
- Correct tap → target pops, others dim, "Emoji found!" appears, 3 stars pop in one at a time, confetti spawns and falls.

- [ ] **Step 8: Bump VERSION + commit**

`v0.1.9`.

```bash
git add js/anim.js js/render.js js/input.js game.js js/constants.js index.html
git commit -m "feat: animations (shake, pop, dim, star-pop, confetti)"
```

---

### Task 14: PlaySDK haptics

**Spec ref:** PlaySDK calls.

**Files:**
- Modify: `js/input.js`

- [ ] **Step 1: Add a haptic helper that respects the settings flag**

In `js/input.js`, add at the top:

```javascript
function tryHaptic(kind) {
  const s = getSave();
  if (!s || !s.settings.haptics) return;
  if (window.PlaySDK && typeof window.PlaySDK.haptic === 'function') {
    try { window.PlaySDK.haptic(kind); } catch (_) {}
  }
}
```

- [ ] **Step 2: Wire haptic calls**

In `onGridTap` wrong-tap branch (after `shakeT = 1`):

```javascript
    tryHaptic('warning');
```

In `onFound` (just after the existing setup):

```javascript
  tryHaptic('success');
```

In `anim.startStarSequence` consumers — call `tryHaptic('light')` for each star as it becomes visible. Easiest: track which stars have already popped and fire haptic on transition. In `js/anim.js`, replace `updateStars()` with:

```javascript
  updateStars() {
    if (anim.starStartedAt < 0) return;
    const t = performance.now() - anim.starStartedAt;
    for (let i = 0; i < 3; i++) {
      const prev = anim.stars[i];
      const local = t - i * STAR_POP_STAGGER;
      if (local <= 0) anim.stars[i] = 0;
      else if (local >= STAR_POP_DURATION) anim.stars[i] = 1;
      else anim.stars[i] = local / STAR_POP_DURATION;
      if (prev === 0 && anim.stars[i] > 0 && i < (anim.starsEarned || 0)) {
        tryHaptic('light');
      }
    }
  },
```

- [ ] **Step 3: Manual smoke test on mobile (or desktop, where haptic is a no-op)**

Open on a touch device if possible. Wrong tap should trigger a "warning" haptic, found should trigger "success" + a "light" per visible star. Desktop: no haptic, no errors in console.

- [ ] **Step 4: Bump VERSION + commit**

`v0.1.10`.

```bash
git add js/input.js js/anim.js js/constants.js index.html
git commit -m "feat: haptics on wrong tap, found, and star pop"
```

---

### Task 15: PlaySDK pause/resume + screenshot mode

**Spec ref:** PlaySDK calls.

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Wire pause/resume in `bootstrap()`**

Append to `bootstrap()` just before `requestAnimationFrame(frame)`:

```javascript
  let rafId = 0;
  if (window.PlaySDK) {
    if (typeof window.PlaySDK.onPause === 'function') {
      window.PlaySDK.onPause(() => { if (rafId) cancelAnimationFrame(rafId); rafId = 0; });
    }
    if (typeof window.PlaySDK.onResume === 'function') {
      window.PlaySDK.onResume(() => { if (!rafId) rafId = requestAnimationFrame(frame); });
    }
  }
```

And change the final line of `bootstrap()` to:

```javascript
  rafId = requestAnimationFrame(frame);
```

`frame()` already calls `requestAnimationFrame(frame)` recursively — leave that. The pause cancels the next frame; resume kicks one off again.

- [ ] **Step 2: Wire `screenshotMode`**

After `await startLevel(state.level);` in `bootstrap()`:

```javascript
  if (window.PlaySDK && window.PlaySDK.screenshotMode) {
    // Jump to a visually clean level for App Store captures.
    await startLevel(8);
  }
```

(Level 8 picked arbitrarily — it's in the easy bucket; revise later after a playthrough if a different level looks better.)

- [ ] **Step 3: Manual smoke test**

In DevTools, switch tabs / minimize the window — game should pause. Return — should resume. If you can toggle `window.PlaySDK.screenshotMode = true` before load via the URL or a query parameter, verify it jumps to level 8.

- [ ] **Step 4: Bump VERSION + commit**

`v0.1.11`.

```bash
git add game.js js/constants.js index.html
git commit -m "feat: PlaySDK pause/resume + screenshotMode entry"
```

---

### Task 16: Settings modal (HTML overlay)

**Spec ref:** UI / Settings modal section.

**Files:**
- Modify: `index.html` (add overlay HTML + CSS)
- Modify: `js/input.js` (handle gear tap)
- Create: `js/ui.js`

- [ ] **Step 1: Add the modal HTML + CSS to `index.html`**

Inside `<body>`, after the canvas (and before the scripts), add:

```html
<div id="settings-backdrop" hidden></div>
<div id="settings-modal" hidden>
  <div class="card">
    <button id="settings-close" aria-label="Close">✕</button>
    <h2>Settings</h2>
    <label class="row"><span>Sound</span><input type="checkbox" id="settings-sound"></label>
    <label class="row"><span>Haptics</span><input type="checkbox" id="settings-haptics"></label>
    <div class="reset">
      <button id="settings-reset">Reset progress</button>
      <div id="settings-reset-confirm" hidden>
        <p>Reset all progress?</p>
        <button id="settings-reset-yes">Yes, reset</button>
        <button id="settings-reset-no">Cancel</button>
      </div>
    </div>
  </div>
</div>
```

Add to the `<style>` block:

```css
#settings-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 10;
}
#settings-modal {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 11;
}
#settings-modal .card {
  background: #34495e; color: white;
  width: 80%; max-width: 800px;
  padding: 40px; border-radius: 24px;
  position: relative;
  font-size: 24px;
}
#settings-modal h2 { font-size: 44px; margin-bottom: 24px; }
#settings-modal .row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 0; font-size: 32px;
}
#settings-modal input[type="checkbox"] { width: 32px; height: 32px; }
#settings-close {
  position: absolute; top: 16px; right: 16px;
  background: transparent; color: white; border: none;
  font-size: 32px; cursor: pointer;
}
#settings-modal button {
  background: #5badee; color: white; border: none;
  padding: 12px 24px; border-radius: 12px; font-size: 24px;
  cursor: pointer;
}
#settings-modal .reset { margin-top: 24px; }
#settings-modal #settings-reset-confirm { margin-top: 16px; }
#settings-modal #settings-reset-yes { background: #e74c3c; margin-right: 8px; }
```

- [ ] **Step 2: Implement `js/ui.js`**

```javascript
// Settings modal controller. Reads/writes via save.js.
function initSettings() {
  const backdrop = document.getElementById('settings-backdrop');
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('settings-close');
  const sound = document.getElementById('settings-sound');
  const haptics = document.getElementById('settings-haptics');
  const reset = document.getElementById('settings-reset');
  const confirm = document.getElementById('settings-reset-confirm');
  const yes = document.getElementById('settings-reset-yes');
  const no = document.getElementById('settings-reset-no');

  function refresh() {
    const s = getSave();
    sound.checked = !!s.settings.sound;
    haptics.checked = !!s.settings.haptics;
    confirm.hidden = true;
  }
  function show() { state.mode = 'settings'; refresh(); backdrop.hidden = false; modal.hidden = false; }
  function hide() { backdrop.hidden = true; modal.hidden = true; state.mode = state.levelData ? 'inGame' : 'loading'; }

  backdrop.addEventListener('click', hide);
  closeBtn.addEventListener('click', hide);
  sound.addEventListener('change', () => { getSave().settings.sound = sound.checked; writeSave(); });
  haptics.addEventListener('change', () => { getSave().settings.haptics = haptics.checked; writeSave(); });
  reset.addEventListener('click', () => { confirm.hidden = false; });
  no.addEventListener('click', () => { confirm.hidden = true; });
  yes.addEventListener('click', () => {
    resetSave();
    hide();
    startLevel(1);
  });

  // Expose `openSettings` to input.js.
  window.openSettings = show;
}
```

- [ ] **Step 3: Wire ui.js into `index.html`** and call `initSettings` from bootstrap

Add before `game.js`:

```html
  <script src="js/ui.js?v=1"></script>
```

In `game.js` `bootstrap()`, after `attachInput(canvas)`:

```javascript
  initSettings();
```

Note: `js/input.js` already calls `openSettings()` — `ui.js` assigns that to `window.openSettings` so the reference resolves at call time.

- [ ] **Step 4: Adjust the inGame-mode return when settings closes**

`hide()` in ui.js sets `state.mode` back to `inGame`, but if the player tapped the gear during the `found` state, we should restore to `found`. Update `hide()`:

```javascript
  function hide() {
    backdrop.hidden = true; modal.hidden = true;
    if (state.priorMode) { state.mode = state.priorMode; state.priorMode = null; }
    else if (state.levelData) { state.mode = 'inGame'; }
    else { state.mode = 'loading'; }
  }
```

And in `show()`:

```javascript
  function show() {
    state.priorMode = state.mode;
    state.mode = 'settings';
    refresh();
    backdrop.hidden = false; modal.hidden = false;
  }
```

- [ ] **Step 5: Manual smoke test**

Tap the gear icon. Modal opens. Toggle sound/haptics → setting persists across refresh. Tap "Reset progress" → confirm appears → "Yes" wipes save and returns to level 1. "Cancel" hides confirm. Close button + backdrop tap both close the modal and return to gameplay.

- [ ] **Step 6: Bump VERSION + commit**

`v0.1.12`.

```bash
git add js/ui.js index.html game.js js/constants.js
git commit -m "feat: settings modal (sound, haptics, reset progress)"
```

---

### Task 17: Thumbnail + final polish pass

**Spec ref:** meta.json thumbnail, platform requirements.

**Files:**
- Create: `thumbnail.png` (512×512, with title visible)

- [ ] **Step 1: Generate or design the thumbnail**

The platform requires 512×512 PNG with the game title visible. Options:
1. Take a screenshot of a Special level (visually busy) at 1080×1920, crop a 1:1 region (e.g. centered on the title bar + a few grid rows), scale to 512×512, and overlay the title text in white.
2. Hand-draw in Figma / Sketch.

Quickest path: load the running game in browser, take a screenshot of the canvas at zoom level that yields a 512px square crop around interesting content, add "EMOJI FIND" centered overlay in a graphics tool.

Save as `thumbnail.png` in the project root. Filename must match `meta.json:thumbnail`.

- [ ] **Step 2: Visual check**

Confirm dimensions are exactly 512×512: `file thumbnail.png` or `identify thumbnail.png`. Confirm the title text is legible at 256×256 (the size it renders on the platform home grid).

- [ ] **Step 3: Bump VERSION + commit**

`v0.1.13`.

```bash
git add thumbnail.png js/constants.js index.html
git commit -m "feat: thumbnail (512x512 with title)"
```

---

### Task 18: Pre-deploy verification + deploy

**Spec ref:** Platform integration / Deployment.

**Files:** none. This task validates and ships.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all `node --test` files pass (yaml-parse, extract-cross-reference, rng, pairs, level, hint).

- [ ] **Step 2: Browser smoke playthrough**

Start a local server and run through the full game cycle:
- Open `index.html` (via `python3 -m http.server 8083` then `http://localhost:8083`).
- Confirm: level 1 loads, version stamp `v0.1.13` is visible bottom-center.
- Tap wrong tile → shakes + warning haptic on mobile.
- Tap correct → pop, dim, stars pop, confetti, Next button.
- Tap Next → level 2 with a different pair.
- Tap Hint twice → board halves dim, hint button disappears, next found shows 1 star.
- Reach level 20 (use Settings reset and a developer console `state.level = 19; startLevel(20)` shortcut) → Special level renders, target indicator visible at top.
- Refresh page → resumes at the level you'd reached.
- Open Settings → toggle works, reset works.

- [ ] **Step 3: Confirm the deploy zip would stay under platform limits**

```bash
du -sh assets/emoji/
ls -1 | grep -vE '\.(git|md|json)$|^(docs|scripts|test|node_modules|package.*)' | xargs du -sh 2>&1 | tail -1
```

Aim for total shipped content well under 50 MB. The `.zipignore` already excludes `docs/`, `scripts/`, `test/`, `node_modules/`, and `package*.json`.

- [ ] **Step 4: Confirm `meta.json` and `index.html` are at root, thumbnail filename matches**

```bash
ls meta.json index.html thumbnail.png
```

Expected: all three exist.

- [ ] **Step 5: Deploy via the platform script**

Note: per `feedback_deploy_gating.md`, do NOT run platform deploy without per-action confirmation. **Stop here and ask the user to verify locally first**, then deploy when they confirm. The deploy command (for reference, not auto-executed):

```bash
cd /Users/nitzanwilnai/Programming/Claude/GamesPlatform
./scripts/deploy-game.sh /Users/nitzanwilnai/Programming/Claude/JSGames/EmojiFind
```

- [ ] **Step 6: Post-deploy verification**

After the user confirms deploy:
- Visit https://play.nitzan.games/play/emoji-find
- Confirm version stamp matches the local build.
- Play through one level on web.

- [ ] **Step 7: Final commit (if anything changed during verification)**

If you patched anything during verification, bump VERSION and commit; otherwise the deploy ships `v0.1.13`.

---

## Self-Review

### Spec coverage

Walking the spec sections against tasks:

| Spec section                       | Implementing task |
|------------------------------------|-------------------|
| Asset pipeline (build script)      | Tasks 2-4 |
| File layout (game)                 | Task 1 (skeleton), grown by every later task |
| Runtime state machine + per-level  | Task 7 (buildLevel), Task 12 (state in game.js) |
| Level selection (RNG + buckets)    | Tasks 5, 6, 7 |
| Rendering                          | Tasks 11, 13 (animations layered on) |
| Image loading                      | Task 10 |
| Input + hit-testing                | Task 12 |
| Hints                              | Tasks 8, 12 (wiring) |
| Save / load                        | Tasks 9, 12 (wiring) |
| UI (HUD, Found overlay, Special)   | Task 11, Task 13 (animated) |
| Settings modal                     | Task 16 |
| Animations                         | Task 13 |
| Platform — PlaySDK haptics         | Task 14 |
| Platform — pause/resume, screenshot| Task 15 |
| Version stamp                      | Task 1, bumped every commit |
| meta.json / thumbnail              | Tasks 1, 17 |
| Deployment                         | Task 18 |

All sections covered. No spec requirement is unrepresented.

### Placeholder scan

- No "TBD" / "TODO" / "implement later" tokens in the plan.
- Every code step contains the actual code, not a description.
- Cross-task references use the exact symbol names (e.g. `buildLevel`, `pickPairForLevel`, `applyHint`, `loadImage`, `RENDER_RECTS`).

### Type / name consistency

Spot-checked:
- `buildLevel({ level, pools, allEmojis, indexSeed })` — defined in Task 7, called with same arg shape in Task 12.
- `applyHint(which, targetIndex, tiles)` — defined Task 8, called as `applyHint(lvl.hintsUsed + 1, lvl.targetIndex, lvl.tiles)` in Task 12. Match.
- `pickPairForLevel(level, pools)` — defined Task 6, used inside `buildLevel` (Task 7). Match.
- Tile shape `{ codepoint, alpha, shakeT, dimT, popT }` — defined Task 7, animated Task 13. Adds `dimTarget` in Task 13 (lerp target) — that's a new prop set by `onFound`, read by `anim.update`. Consistent within Task 13.
- `RENDER_RECTS` — defined Task 11, used in Task 12. Match.
- Save shape `{ currentLevel, maxLevel, levelStars, settings }` — defined Task 9, used in Tasks 12, 16. Match.

Plan is self-consistent.
