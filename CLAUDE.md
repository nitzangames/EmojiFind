# CLAUDE.md

## Project

EmojiFind — port of the Unity EmojiFind game. 117 emojis arranged 9×13, one is a slight lookalike of the rest; tap to find it. 3 stars, lose one per hint used.

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
