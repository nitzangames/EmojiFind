// Seedable RNG: xmur3 (hash seed -> initial state) + sfc32 (PRNG step).
// Deterministic across browsers and Node. Public API: makeRng(seedInt).
function makeRng(seed) {
  // xmur3
  let h = 1779033703 ^ seed;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  // four 32-bit state words
  let a = h | 0;
  let b = (h ^ 0x6c078965) | 0;
  let c = (h ^ 0xb979a7e1) | 0;
  let d = (h ^ 0x5f3759df) | 0;
  return {
    next() {
      // sfc32
      a |= 0; b |= 0; c |= 0; d |= 0;
      let t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ (b >>> 9);
      b = c + (c << 3) | 0;
      c = (c << 21) | (c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
  };
}
