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
