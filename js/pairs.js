// Pair-pool indexing. Mirrors Unity's StartLevel():
//   - levels < 25: pick from easy pool
//   - levels 25..49: pick from medium pool
//   - else: pick from hard pool
//   - level seeded by (level + 512) to mirror Unity's Random.InitState
// `pools` shape: { easy: [], medium: [], hard: [] }, each entry { a, b, diff, first }.

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
