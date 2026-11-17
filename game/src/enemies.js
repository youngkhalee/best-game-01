// The six kinds of Hollow that come for the Last Light, and the ten waves that
// send them. Each kind is a distinct shape, colour and behaviour:
//   drifter — a slow triangle that hunts the player
//   rusher  — a fast dart that pauses, then lunges
//   spitter — a hexagon that keeps its distance and spits orbs
//   sapper  — a square that ignores the player and burns the Core
//   brute   — a huge octagon, slow and hard to kill
//   warden  — the wave-10 boss: radial bursts, minion calls, an enrage

export const ENEMY_TYPES = {
  drifter: { hp: 24, speed: 92, radius: 15, score: 50, damage: 10, color: '#ff5d8f', shape: 'triangle', targets: 'player' },
  rusher: { hp: 16, speed: 128, radius: 12, score: 70, damage: 12, color: '#ff9d3c', shape: 'dart', targets: 'player' },
  spitter: { hp: 30, speed: 74, radius: 16, score: 90, damage: 8, color: '#8dff57', shape: 'hexagon', targets: 'player', shoots: true },
  sapper: { hp: 20, speed: 104, radius: 13, score: 80, damage: 6, color: '#ff3c3c', shape: 'square', targets: 'core' },
  brute: { hp: 130, speed: 46, radius: 27, score: 200, damage: 20, color: '#b46aff', shape: 'octagon', targets: 'nearest' },
  warden: { hp: 1150, speed: 38, radius: 44, score: 2000, damage: 25, color: '#ff3860', shape: 'warden', targets: 'nearest', shoots: true, boss: true },
};

/** Wave recipes: kind -> count. Wave 10 is the Warden plus a trickle. */
export const WAVE_RECIPES = [
  { drifter: 6 },
  { drifter: 8, rusher: 2 },
  { drifter: 8, spitter: 2, rusher: 2 },
  { drifter: 9, sapper: 3, rusher: 3 },
  { drifter: 10, spitter: 3, brute: 1, sapper: 2 },
  { rusher: 8, spitter: 3, drifter: 8, sapper: 3 },
  { drifter: 12, brute: 2, spitter: 3, rusher: 4 },
  { sapper: 6, rusher: 8, spitter: 4, drifter: 8 },
  { brute: 3, spitter: 5, rusher: 8, drifter: 10, sapper: 4 },
  { warden: 1, drifter: 6, rusher: 4 },
];

/** Flatten a recipe into a spawn queue, shuffled so kinds interleave. */
export function buildSpawnQueue(random, waveIndex) {
  const recipe = WAVE_RECIPES[waveIndex];
  const queue = [];
  for (const [kind, count] of Object.entries(recipe)) {
    for (let i = 0; i < count; i += 1) queue.push(kind);
  }
  // Fisher–Yates with the run's own generator: the same seed, the same wave.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  // The boss always enters first in its wave, announced.
  const bossAt = queue.indexOf('warden');
  if (bossAt > 0) { queue.splice(bossAt, 1); queue.unshift('warden'); }
  return queue;
}

/** Health scaling so late waves stay dangerous after upgrades. */
export function hpScale(waveIndex) {
  return 1 + waveIndex * 0.16;
}

/** The upgrade draft pool: each entry knows how to change the player's build. */
export const UPGRADES = [
  { id: 'damage', name: 'Ember Rounds', desc: '+25% bullet damage', apply: (b) => { b.damageMul *= 1.25; } },
  { id: 'rate', name: 'Quickbloom', desc: '+18% fire rate', apply: (b) => { b.rateMul *= 1.18; } },
  { id: 'split', name: 'Twin Bloom', desc: '+1 projectile per shot', apply: (b) => { b.extraShots += 1; }, max: 3 },
  { id: 'pierce', name: 'Thorn Lance', desc: 'Shots pierce +1 enemy', apply: (b) => { b.pierce += 1; }, max: 3 },
  { id: 'speed', name: 'Petal Drift', desc: '+10% move speed', apply: (b) => { b.speedMul *= 1.1; } },
  { id: 'vitality', name: 'Deep Roots', desc: '+20 max health, heal 20', apply: (b) => { b.maxHpBonus += 20; b.heal += 20; } },
  { id: 'plating', name: 'Core Plating', desc: '+30 Core max, repair 30', apply: (b) => { b.coreMaxBonus += 30; b.coreHeal += 30; } },
  { id: 'dash', name: 'Blink Pollen', desc: 'Dash recharges 30% faster', apply: (b) => { b.dashMul *= 0.7; }, max: 3 },
  { id: 'magnet', name: 'Nectar Pull', desc: 'Pickups fly to you from afar', apply: (b) => { b.magnet += 70; }, max: 3 },
  { id: 'regen', name: 'Photosynth', desc: 'Regrow 0.7 health a second', apply: (b) => { b.regen += 0.7; }, max: 3 },
];

/** Draw three distinct upgrades the build can still take. */
export function draftUpgrades(random, build) {
  const counts = build.upgradeCounts;
  const pool = UPGRADES.filter((u) => !u.max || (counts[u.id] || 0) < u.max);
  const draft = [];
  const copy = [...pool];
  while (draft.length < 3 && copy.length > 0) {
    const at = Math.floor(random() * copy.length);
    draft.push(copy.splice(at, 1)[0]);
  }
  return draft;
}
