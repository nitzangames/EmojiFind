// Save/load wrapper around PlaySDK. In-memory mirror is the source of truth
// during a session; SDK writes are fire-and-forget.

const SAVE_KEY = 'emoji-find:save';
const DEFAULT_SAVE = {
  currentLevel: 1,
  maxLevel: 1,
  levelStars: {},
  settings: { sound: true, haptics: true },
};

let mem = null;

async function loadSave() {
  let raw = null;
  try {
    if (window.PlaySDK && typeof window.PlaySDK.load === 'function') {
      raw = await window.PlaySDK.load(SAVE_KEY);
    }
  } catch (_) { /* ignore */ }
  if (!raw) {
    mem = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    return mem;
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    mem = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SAVE)), parsed);
    mem.settings = Object.assign({}, DEFAULT_SAVE.settings, mem.settings || {});
  } catch (_) {
    mem = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  }
  return mem;
}

function getSave() { return mem; }

function writeSave() {
  if (!mem) return;
  try {
    if (window.PlaySDK && typeof window.PlaySDK.save === 'function') {
      window.PlaySDK.save(SAVE_KEY, JSON.stringify(mem));
    }
  } catch (_) { /* ignore */ }
}

function resetSave() {
  mem = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  writeSave();
}

function totalStars() {
  if (!mem) return 0;
  let sum = 0;
  for (const k in mem.levelStars) sum += mem.levelStars[k] | 0;
  return sum;
}
