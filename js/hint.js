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
