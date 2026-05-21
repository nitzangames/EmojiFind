// Build a per-level state object. Pure: takes pools and seeds;
// returns a fully-formed level. Mirrors Unity's StartLevel().

function buildLevel({ level, pools, indexSeed }) {
  // Two seed streams, mirroring Unity's two Random.InitState calls.
  const indexRng = makeRng(indexSeed);
  const targetIndex = Math.floor(indexRng.next() * TILE_COUNT);

  const pair = pickPairForLevel(level, pools);
  const targetCodepoint = pair.a;
  const fillerCodepoint = pair.b;
  const tiles = new Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i++) {
    tiles[i] = {
      codepoint: (i === targetIndex) ? targetCodepoint : fillerCodepoint,
      alpha: 1, shakeT: 0, dimT: 1, popT: 0,
    };
  }

  return {
    level,
    targetIndex,
    targetCodepoint,
    fillerCodepoint,
    tiles,
    hintsUsed: 0,
    startedAt: 0,  // filled by caller (performance.now() at level start)
  };
}
