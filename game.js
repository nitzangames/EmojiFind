var canvas, ctx;
var state = {
  mode: 'loading',          // 'loading' | 'inGame' | 'found' | 'settings'
  level: 1,
  levelData: null,
  pools: null,
};

async function bootstrap() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');

  await loadSave();
  state.level = getSave().currentLevel;

  const pairsRes = await fetch('assets/pairs.json');
  state.pools = await pairsRes.json();

  attachInput(canvas);
  initSettings();
  await startLevel(state.level);

  if (window.PlaySDK && window.PlaySDK.screenshotMode) {
    // Jump to a visually clean level for App Store captures.
    await startLevel(8);
  }

  let rafId = 0;
  if (window.PlaySDK) {
    if (typeof window.PlaySDK.onPause === 'function') {
      window.PlaySDK.onPause(() => { if (rafId) cancelAnimationFrame(rafId); rafId = 0; });
    }
    if (typeof window.PlaySDK.onResume === 'function') {
      window.PlaySDK.onResume(() => { if (!rafId) rafId = requestAnimationFrame(frame); });
    }
  }
  rafId = requestAnimationFrame(frame);
}

async function startLevel(level) {
  state.mode = 'loading';
  state.level = level;
  const data = buildLevel({
    level,
    pools: state.pools,
    indexSeed: (Date.now() % 100000) + level,
  });
  data.startedAt = performance.now();
  await loadImages([data.targetCodepoint, data.fillerCodepoint]);
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
