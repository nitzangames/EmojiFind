// All drawing. Stateless; consumes a `state` object from game.js.
// state shape: { mode, level, levelData, save, hudButtons }.

const HINT_BTN = { x: CANVAS_W - 80 - 200, y: 50, w: 200, h: 100 };
const GEAR_BTN = { x: 80, y: 50, w: 100, h: 100 };
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
  // Settings pill (always visible) — left-side mirror of Hint
  drawPill(GEAR_BTN, COL_HINT, '⚙', '96px sans-serif');

  // Title (centered)
  ctx.textAlign = 'center';
  ctx.font = '72px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const title = state.levelData && state.levelData.isSpecial
    ? `Special ${Math.floor(state.levelData.level / SPECIAL_EVERY_X)}`
    : `Level ${state.level}`;
  ctx.fillText(title, CANVAS_W / 2, 80);

  // Star count — centered under the title
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'left';
  const starsText = String(totalStars());
  const starGlyph = '★ ';
  const glyphW = ctx.measureText(starGlyph).width;
  const numW = ctx.measureText(starsText).width;
  const starsStartX = CANVAS_W / 2 - (glyphW + numW) / 2;
  ctx.fillStyle = '#ffd84a';
  ctx.fillText(starGlyph, starsStartX, 152);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(starsText, starsStartX + glyphW, 152);

  // Hint button (only inGame and hintsUsed < 2)
  if (state.mode === 'inGame' && state.levelData && state.levelData.hintsUsed < 2) {
    drawPill(HINT_BTN, COL_HINT, 'Hint');
  }
}

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

  drawPill(NEXT_BTN, COL_NEXT, 'Next');
  if (levelData.level > 1) drawPill(PREV_BTN, COL_NEXT, '←');
}

function drawPill(r, color, text, font) {
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
  ctx.font = font || '48px sans-serif';
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
