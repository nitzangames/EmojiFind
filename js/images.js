// Image cache + loader. Decoded HTMLImageElement keyed by codepoint.
// LRU eviction at 256 entries.

const LRU_MAX = 256;
const imgCache = new Map();   // codepoint -> HTMLImageElement
const lruOrder = [];           // most-recent-last

function getImageNow(codepoint) {
  return imgCache.get(codepoint) || null;
}

function loadImage(codepoint) {
  const existing = imgCache.get(codepoint);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    touchLru(codepoint);
    return Promise.resolve(existing);
  }
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(existing), { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => {
      imgCache.set(codepoint, img);
      touchLru(codepoint);
      resolve(img);
    }, { once: true });
    img.addEventListener('error', reject, { once: true });
    img.src = 'assets/emoji/' + codepoint + '.png';
    imgCache.set(codepoint, img);   // cache the in-flight Image too
    touchLru(codepoint);
  });
}

function loadImages(codepoints) {
  return Promise.all(codepoints.map(loadImage));
}

function touchLru(codepoint) {
  const idx = lruOrder.indexOf(codepoint);
  if (idx !== -1) lruOrder.splice(idx, 1);
  lruOrder.push(codepoint);
  while (lruOrder.length > LRU_MAX) {
    const evict = lruOrder.shift();
    imgCache.delete(evict);
  }
}
