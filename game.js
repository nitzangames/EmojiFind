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

var lastFrameTs = 0;
function frame(ts) {
  const dt = lastFrameTs === 0 ? 16 : Math.min(50, ts - lastFrameTs);
  lastFrameTs = ts;
  anim.update(dt, state.levelData);
  anim.updateStars();
  drawFrame(state);
  requestAnimationFrame(frame);
}

window.addEventListener('load', bootstrap);
