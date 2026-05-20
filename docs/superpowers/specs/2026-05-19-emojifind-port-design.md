# EmojiFind — JS port design

**Status:** approved (brainstorming)
**Date:** 2026-05-19
**Source:** `/Users/nitzanwilnai/Programming/Unity/EmojiFind`
**Target:** nitzan.games / play.nitzan.games platform (slug `emoji-find`)

## Goal

Faithful 1:1 port of the Unity EmojiFind game to vanilla-JS canvas for the nitzan.games platform. Preserve the curated emoji-pair difficulty curve, the 9-wide × 13-tall grid, the 3-star / 2-hint scoring, and the "Special" level every 20 levels. Add cloud-synced progress and haptic feedback via PlaySDK. Add a small settings modal, wrong-tap shake, and a star-pop/confetti found animation (the Unity build already has the latter two in spirit; this codifies them).

## Out of scope

- Leaderboards. No timed scoring.
- Rewarded ads (no extra-hint flow).
- Daily challenge.
- Sound assets. The Sound toggle in Settings is wired up but the game ships with no SFX — toggle is forward-looking.
- Original Twemoji asset replacement. We reuse the exact 6,624 PNGs the Unity build is tuned against.

## Source-game reference

Unity `Emoji_GameController.cs` and `EmojiGroup.cs` are the behavioural reference. Key facts decoded from that code:

- Board: 9 columns × 13 rows. Unity stores tiles in a flat array with `x = i / 13`, `y = i % 13` (column-major).
- All tiles render `sprite2` (the "filler" emoji) except one at `targetIndex` which renders `sprite1` (the "lookalike"). Target is found by tap.
- `emojiGroupsFileList` defines a canonical id space for pair assets; `emojiGroupEasyList` / `emojiGroupMediumList` are integer subsets used for levels 1-24 / 25-49 respectively; everything else uses the full list (levels 50+).
- Every 20th level (`level % 20 == 0`) is a "Special" level: a random target codepoint is shown in the HUD, and the 117 tiles are filled with 117 distinct random codepoints from the full sprite atlas with the target placed at `targetIndex`.
- Stars per level = `3 - hintsUsed`. Stored per-level; total stars = sum.
- Hint 1 (re-derived from `Hint1()`): compares `targetIndex % 13` (the row) against 7. Dims the half whose row is on the opposite side. **Horizontal split**, 7-row vs 6-row bands.
- Hint 2 (re-derived from `Hint2()`): compares `targetIndex / 13` (the column) against 5. Dims the half whose column is on the opposite side. **Vertical split**, 5-col vs 4-col sides.
- After both hints, search space is one of {35, 30, 28, 24} tiles depending on which corner the target sits in.

We will keep Unity's column-major index scheme verbatim (`index = col * 13 + row`) so the modular math copies 1:1.

## Architecture

### File layout (game)

```
JSGames/EmojiFind/
├── index.html              ← canvas + PlaySDK script tag
├── meta.json               ← slug "emoji-find"
├── thumbnail.png           ← 512×512 with title visible
├── CLAUDE.md
├── game.js                 ← entry: rAF loop + state machine + glue
├── js/
│   ├── constants.js        ← VERSION, GRID_W=9, GRID_H=13, layout consts, colors
│   ├── pairs.js            ← loadPairs(), pickPairForLevel(level)
│   ├── level.js            ← startLevel(level): builds 117-tile array
│   ├── input.js            ← pointerdown handler, hit-test
│   ├── render.js           ← drawFrame(state): tiles + HUD + overlays
│   ├── anim.js             ← shake, star pop, confetti particles
│   ├── ui.js               ← settings modal (HTML overlay), button rects
│   └── save.js             ← PlaySDK.save/load wrapper, in-memory cache
└── assets/
    ├── pairs.json          ← from build script
    ├── all-emojis.json     ← from build script
    └── emoji/              ← 6,624 PNGs from build script
```

Vanilla JS, no bundler, no Phaser. Scripts loaded via `<script>` tags in dependency order.

### File layout (build-time)

```
JSGames/EmojiFind/scripts/
└── extract-unity-data.mjs  ← one-shot Node script, run manually
```

Outputs live under `assets/` and are committed to git so day-to-day dev does not require Unity.

## Asset pipeline (build script)

`scripts/extract-unity-data.mjs`, run from the EmojiFind dir with the Unity project path as `--unity=…`.

Steps:

1. Walk `<Unity>/Assets/EmojiGroupTwitterEmoji/*.asset` (and `EmojiGroupTwitterEmoji2/*` if non-empty). These are text YAML despite the `.asset` extension — they contain readable `m_Name`, `sprite1.guid`, `sprite2.guid`, `diff`, `firstLevels` fields.
2. For each `.asset`, parse it and resolve `sprite1.guid` / `sprite2.guid` to a PNG filename by scanning `<Unity>/Assets/Resources/tweetemoji-72x72/*.png.meta` (each `.meta` declares a `guid:` matching the `.asset`'s reference). The PNG sibling is the emoji codepoint, e.g. `1f600.png`.
3. Emit one pair row: `{ a: "1f600", b: "1f603", diff: 100.78, first: false }`. `a` is the lookalike (Unity's `sprite1`, used for the target tile); `b` is the filler (Unity's `sprite2`).
4. Read Unity's three resource lists from `<Unity>/Assets/Resources/`:
   - `emojiGroupList.txt` — canonical pair name list (comma-separated). Position in this list is the integer id used by easy/medium lists.
   - `emojiGroupEasyList.txt` — comma-separated integers → indices into the canonical list. Used for levels 1-24 in Unity.
   - `emojiGroupMediumList.txt` — same, used for levels 25-49.
5. Build three arrays:
   - `easy` — pair objects whose canonical id is in `emojiGroupEasyList`
   - `medium` — pair objects whose canonical id is in `emojiGroupMediumList`
   - `hard` — every canonical pair (NOT the complement of easy/medium). Mirrors Unity's behaviour: for levels 50+ Unity rolls `Random.Range(0, emojiGroups.Length)` against the full canonical list before any easy/medium override.
6. Write `assets/pairs.json`:
   ```json
   { "easy": [...], "medium": [...], "hard": [...] }
   ```
7. Copy every PNG under `<Unity>/Assets/Resources/tweetemoji-72x72/*.png` into `assets/emoji/<codepoint>.png`. ~6,624 files, ~30-40 MB total — comfortably under the 50 MB platform zip limit. **All PNGs unconditionally**, not just the referenced subset, because Special levels sample random codepoints from the full atlas.
8. Write `assets/all-emojis.json` — array of every codepoint that has a PNG. Used by Special levels.

The script is idempotent: re-running overwrites `assets/`. It is run manually when the Unity dataset changes (rarely). All outputs are committed.

## Runtime state machine

Single `gameState` enum (mirrors Unity's `BoardState`):

- `loading` — initial fetch of `pairs.json` + current-level images
- `inGame` — tiles drawn, tap-to-find active
- `found` — target tapped; "Emoji found!" overlay + stars + Next/Prev
- `settings` — settings modal open (HTML overlay)

There is no privacy-policy state (Unity had one — not needed; the platform handles consent at the iframe parent).

### Per-level data

Built in `level.js` on every `startLevel(level)`:

```js
{
  level: 17,
  isSpecial: false,            // (level % 20 === 0)
  targetCodepoint: "1f600",    // the "different" tile
  fillerCodepoint: "1f603",    // null on Special levels (each tile is its own random emoji)
  targetIndex: 73,             // 0..116, Unity col-major index
  tiles: [                     // length 117
    { codepoint, alpha: 1, shakeT: 0, dimT: 1 },
    …
  ],
  hintsUsed: 0,
  startedAt: performance.now()
}
```

### Level selection

Mirrors Unity exactly, using a small seeded RNG (xmur3 + sfc32 or similar):

```js
function startLevel(level) {
  const isSpecial = level > 0 && level % 20 === 0;
  const seedA = (Math.floor(performance.now()) % 100000);
  const rngA = makeRng(seedA);
  const targetIndex = Math.floor(rngA.next() * (GRID_W * GRID_H));

  const rngB = makeRng(level + 512);

  if (isSpecial) {
    // Pick a target codepoint + 116 distinct filler codepoints from all-emojis
    // (all different from each other AND from the target). Place target at
    // targetIndex, fillers fill the other 116 slots. Total distinct emojis: 117.
  } else {
    let pool = pairs.hard;
    if (level < 25) pool = pairs.easy;
    else if (level < 50) pool = pairs.medium;
    const pair = pool[Math.floor(rngB.next() * pool.length)];
    // targetCodepoint = pair.a; fillerCodepoint = pair.b;
  }
}
```

Note: Unity reseeds `Random.InitState` twice (once for `randomIndex`, once for `randomGroup`). We do the same with two RNG instances so behaviour matches: target position is variable per session, pair choice is deterministic per level number.

## Rendering

### Canvas

- `<canvas id="game" width="1080" height="1920">` per game-dev-notes.
- No DPR scaling on the backing store. CSS `object-fit: contain` letterboxes.
- `touch-action: none` on the canvas element itself.
- Body uses flexbox to center the canvas — no transforms, no `position: absolute`.

### Background

Solid `#2c3e50`-ish dark blue (sampled from Unity screenshots). Painted via `ctx.fillRect` first thing in each frame.

### Grid layout (canvas pixels)

- 9 columns × 13 rows = 117 tiles.
- Tile size: ~104 × 104 px (target ≥ 95% of available width for the column count, after HUD reserves the top).
- Top HUD reserves 200 px. Bottom Prev/Next row reserves ~280 px during `found` state; during `inGame` the grid is centered in the remaining ~1720 px vertical.
- Exact pixel rects computed in `constants.js` so render and hit-test stay in sync.

### Per-frame draw order

1. Clear bg.
2. HUD top bar: star count (left, Body Large), title "Level N" or "Special N" (center, Heading), Hint pill (right, Subheading) — Hint hidden after 2 hints used or when `state !== inGame`.
3. Special-level target indicator (only when `isSpecial`): "Find this →" + 96×96 preview, sits below HUD bar.
4. For each tile in `tiles`: `ctx.drawImage(emojiImage[t.codepoint], rect.x, rect.y, rect.w, rect.h)` with `ctx.globalAlpha = t.alpha * t.dimT`. If `t.shakeT > 0`, translate by `sin(t.shakeT * 30) * 12px` along x.
5. If `state === found`: "Emoji found!" banner (Title), 3 star slots (filled/empty per `3 - hintsUsed`), Next button (and Prev if `level > 1`). Star-pop and confetti animate.
6. Version stamp `v0.1.0` bottom-center, Caption (14px CSS / ~21px canvas), opacity 0.5.
7. Settings modal is HTML overlay — outside the canvas — and self-renders.

### Image loading

- On every `startLevel`: `new Image()` for target + filler (or 117 distinct codepoints on Special), block transition to `inGame` until all are decoded.
- LRU cache of decoded `Image` objects keyed by codepoint (size: 256 entries). Sized to comfortably hold a Special level's 117 emojis plus recently-seen levels for snappy Prev/Next.
- Show a small "Loading…" Caption-size string during the wait. Typical fetch ≤ 200 ms on broadband.

## Input

Single `pointerdown` listener on the canvas (per game-dev-notes — never `mousemove` on `document`, never `touch*` separately).

Hit-test order, top to bottom of priority:
1. Settings gear (top-right corner, 60×60)
2. Hint pill (only when visible)
3. Next / Prev buttons (only when `state === found`)
4. Grid cells: `col = floor((x - gridX) / tileW)`, `row = floor((y - gridY) / tileH)`, `index = col * 13 + row`. If in range, that's the tapped tile.

On grid tap:
- If `index === targetIndex` → enter `found`, run animations, save progress, increment `currentLevel`.
- Else → `tiles[index].shakeT = 1`, `PlaySDK.haptic('warning')`, no penalty (Unity behaviour).

Cache canvas bounding rect on resize.

## Hints

Re-derived from Unity (corrected: Hint 1 splits horizontally, Hint 2 splits vertically — comparison axis vs index axis was inverted in the first draft of this design):

```js
// Hint 1 — horizontal split, 7-row vs 6-row halves. Dim the half NOT
// containing the target. Whether rows 0-6 are visually "top" or "bottom"
// depends on canvas y-axis orientation; gameplay is the same either way.
function hint1() {
  const targetRow = targetIndex % 13;          // 0..12
  const targetInLowHalf = targetRow < 7;
  for (let i = 0; i < 117; i++) {
    const row = i % 13;
    const inDimHalf = targetInLowHalf ? row >= 7 : row < 7;
    if (inDimHalf) tiles[i].dimT = 0.25;
  }
}

// Hint 2 — vertical split, 5-col vs 4-col halves. Dim the half NOT
// containing the target.
function hint2() {
  const targetCol = Math.floor(targetIndex / 13);  // 0..8
  const targetInLowHalf = targetCol < 5;
  for (let i = 0; i < 117; i++) {
    const col = Math.floor(i / 13);
    const inDimHalf = targetInLowHalf ? col >= 5 : col < 5;
    if (inDimHalf) tiles[i].dimT = 0.25;
  }
}
```

`hintsUsed` increments on each tap. After 2 uses the Hint button is hidden (Unity behaviour).

## Save / load

Single PlaySDK key `emoji-find:save`. Value shape:

```js
{
  currentLevel: 17,
  maxLevel: 22,
  levelStars: { 1: 3, 2: 3, 3: 2, … },     // sparse, only completed levels
  settings: { sound: true, haptics: true }
}
```

Writes on:
- Level complete (`found` state entry)
- Prev / Next navigation
- Settings change
- "Reset progress" (writes a fresh default)

Reads once at startup. In-memory mirror is the source of truth during a session; `PlaySDK.save` is fire-and-forget.

Total stars = `sum(levelStars values)`.

## UI

### Top HUD bar (always during `inGame` and `found`)

- Height 200 px.
- Star count: ⭐ glyph 60×60 + total stars (Body Large, ~48-60px canvas), white, left-aligned at x≈80.
- Title: "Level N" or "Special N" (Heading, ~90px canvas), white, centered.
- Hint button (only when `state === inGame` and `hintsUsed < 2`): pill 200×100, fill `#5badee`, label "Hint" Subheading white, right-aligned at x≈980.
- Settings gear: 60×60, top-right corner above the HUD bar.

### Special-level target indicator

Below the HUD bar, centered: "Find this →" + 96×96 preview of `targetCodepoint`. Visible only when `isSpecial`.

### Found-state overlay

- "Emoji found!" banner (Title, ~126px canvas), centered, y ≈ 280.
- 3 star slots horizontal, each 120×120, gap 40, centered, y ≈ 400. Filled (white) or dark grey per `3 - hintsUsed`. Stars pop in sequentially.
- Next pill 600×140 green `#2ecc71`, "Next" Subheading white, centered, y ≈ 1700.
- Prev square 140×140 green, "←" arrow Subheading white, left at x ≈ 80, same y as Next. Hidden when `level === 1`.

### Settings modal (HTML overlay, not canvas)

- Hidden by default. Tapping gear shows it.
- Centered card, 800 px wide, semi-transparent dark backdrop.
- Heading "Settings". Three rows:
  - Sound: on/off toggle. Sets `settings.sound`. (No SFX in v1, toggle is forward-looking.)
  - Haptics: on/off toggle. Gates `PlaySDK.haptic(...)` calls.
  - Reset progress: button → confirm step ("Reset all progress?" / Cancel) → writes a fresh save and reloads to level 1.
- Close: ✕ top-right of the card or tap backdrop.
- DOM overlay positioned `position: absolute` over the canvas div, per game-dev-notes Pattern B for HTML chrome. Not part of the canvas hit-test.

## Animations (`anim.js`)

All timer-based, driven by per-frame `dt` from rAF.

- **Tile shake** on wrong tap. `shakeT: 1 → 0` over 250 ms, render offset `sin(shakeT * 30) * 12`. `PlaySDK.haptic('warning')`.
- **Found pop** on target tile. Scale `1 → 1.3 → 1` over 200 ms. `PlaySDK.haptic('success')`.
- **Non-target dim** on `found` entry. All non-target tiles `dimT: current → 0.25` over 300 ms.
- **Star pop** sequence. Three pops, each scale `0 → 1.2 → 1` over 200 ms, staggered 80 ms. `PlaySDK.haptic('light')` per visible star.
- **Confetti.** ~80 particles spawn at canvas center on `found`. Each particle `{x, y, vx, vy, color, life}`. Random initial velocity within a cone, gravity 1500 px/s², 1.5 s lifetime, 8 colors. Free-list to avoid alloc churn during repeated finds.

## Platform integration

### PlaySDK calls

- `PlaySDK.save("emoji-find:save", json)` / `PlaySDK.load("emoji-find:save")` — progress
- `PlaySDK.haptic("success" | "warning" | "light")` — only when `settings.haptics` is true
- `PlaySDK.onPause(() => cancelAnimationFrame(raf))` / `PlaySDK.onResume(...)` — battery
- `PlaySDK.screenshotMode` — if true at startup, jump straight to a chosen showcase level (TBD on which — pick a visually clean one once the game is running)

No leaderboards, no NBucks, no rewarded ads.

### Version stamp

`const VERSION = 'v0.1.0';` in `js/constants.js`. Rendered bottom-center as Caption 14px CSS / ~21px canvas, opacity 0.5. Bumped on every commit per the per-commit-version-bump rule.

### Display target

1080×1920 portrait canvas. Per game-dev-notes:
- No DPR backing-store scaling.
- No transforms.
- `touch-action: none` directly on canvas.

## Open questions

(None blocking implementation.)

- Which level should `PlaySDK.screenshotMode` jump to for App Store captures? Defer to first playthrough.
- Sound design (deferred — Settings sound toggle ships disabled-in-effect since there are no SFX yet).
