const VERSION = 'v0.1.15';

// Board
const GRID_W = 9;
const GRID_H = 13;
const TILE_COUNT = GRID_W * GRID_H;   // 117

// Canvas (logical pixels)
const CANVAS_W = 1080;
const CANVAS_H = 1920;

// HUD layout (canvas px)
const HUD_HEIGHT = 200;
const FOUND_HEIGHT_RESERVE = 280;

// Tile layout (canvas px). Computed once; render and hit-test share these.
const TILE_W = 104;
const TILE_H = 104;
const GRID_TOTAL_W = TILE_W * GRID_W;          // 936
const GRID_TOTAL_H = TILE_H * GRID_H;          // 1352
const GRID_X = Math.floor((CANVAS_W - GRID_TOTAL_W) / 2);  // 72
const GRID_Y = HUD_HEIGHT + Math.floor(((CANVAS_H - HUD_HEIGHT) - GRID_TOTAL_H) / 2);

// Colours
const COL_BG = '#2c3e50';
const COL_HINT = '#5badee';
const COL_NEXT = '#2ecc71';
const COL_STAR_ON = '#ffffff';
const COL_STAR_OFF = '#1a2530';

// Special-level cadence (mirrors Unity's specialEveryXLevels = 20)
const SPECIAL_EVERY_X = 20;
