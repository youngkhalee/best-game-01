// Every tuning number and colour for VOID BLOOM in one place. The arena is a fixed
// 1280x720 logical field; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720, margin: 26 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The Last Light Core sits at the arena's heart. If it dies, the run dies with it. */
export const CORE = { x: 640, y: 360, radius: 34, maxHp: 120 };

export const PLAYER = {
  radius: 16,
  speed: 268,
  maxHp: 100,
  fireInterval: 0.145,
  bulletSpeed: 640,
  bulletDamage: 12,
  dashSpeed: 880,
  dashTime: 0.16,
  dashCooldown: 1.6,
  contactInvulnerable: 0.55,
};

export const WAVES_TOTAL = 10;

/** Score trickle for surviving, per second of play. */
export const SURVIVAL_POINTS = 2;

/** Combo: each kill refreshes the timer; the multiplier grows with the chain. */
export const COMBO = { window: 3.2, perKill: 0.06, maxBonus: 2.4 };

export const PALETTE = {
  backdrop: '#07060e',
  deep: '#0d0a1d',
  nebulaA: '#2a1650',
  nebulaB: '#0e2a4a',
  grid: '#1d1838',
  star: '#9d94c8',
  core: '#ffd76a',
  coreGlow: '#ff9d3c',
  player: '#5df2c8',
  playerDark: '#123f33',
  bullet: '#a8fff0',
  enemyBullet: '#ff7a59',
  text: '#f2efff',
  muted: '#a49ec4',
  panel: '#141126',
  panelEdge: '#3d3468',
  good: '#5df2c8',
  bad: '#ff5d73',
  gold: '#ffd76a',
  heart: '#ff5d8f',
  cell: '#ffd76a',
  starPickup: '#ffe95a',
  charge: '#7ab8ff',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'void-bloom.best';
