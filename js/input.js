// Single pointerdown handler on canvas. Hit-test order:
// gear -> hint (if visible) -> prev/next (if in found) -> grid.
let canvasRect = null;
let canvasScaleX = 1, canvasScaleY = 1;

function tryHaptic(kind) {
  const s = getSave();
  if (!s || !s.settings.haptics) return;
  if (window.PlaySDK && typeof window.PlaySDK.haptic === 'function') {
    try { window.PlaySDK.haptic(kind); } catch (_) {}
  }
}

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
    state.levelData.tiles[idx].shakeT = 1;
    tryHaptic('warning');
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

  // Target pop + non-target dim + stars + confetti
  lvl.tiles[lvl.targetIndex].popT = 1;
  for (let i = 0; i < lvl.tiles.length; i++) {
    if (i !== lvl.targetIndex) lvl.tiles[i].dimTarget = 0.25;
  }
  anim.startStarSequence(3 - lvl.hintsUsed);
  anim.spawnConfetti(CANVAS_W / 2, CANVAS_H / 2);
  tryHaptic('success');
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
