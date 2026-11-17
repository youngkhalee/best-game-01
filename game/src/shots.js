// Deterministic screenshot scenes: ?shot=play|title|upgrade|victory&seed=N stages
// that scene in the world instead of running the loop, so the maker's screenshots
// are real renders of the game's own code, identical on every capture.

import { CORE } from './config.js';
import { UPGRADES } from './enemies.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY } from './render.js';

function place(world, kind, x, y, hpFraction = 1) {
  world.spawnEnemy(kind, { x, y });
  const enemy = world.state.enemies[world.state.enemies.length - 1];
  enemy.fadeIn = 0;
  enemy.hp = enemy.maxHp * hpFraction;
  enemy.angle = Math.atan2(world.state.player.y - y, world.state.player.x - x);
  return enemy;
}

function stagePlay(world) {
  const s = world.state;
  s.wave = 4;
  s.time = 96.4;
  s.score = 1840;
  s.kills = 37;
  s.combo = 9;
  s.comboTimer = 2.4;
  s.player.x = 430;
  s.player.y = 478;
  s.player.hp = 78;
  s.player.angle = Math.atan2(300 - 478, 760 - 430);
  s.core.hp = 96;
  s.spawnQueue = ['drifter', 'sapper', 'rusher', 'spitter', 'drifter'];
  place(world, 'drifter', 760, 300, 0.55);
  place(world, 'spitter', 905, 190, 0.8);
  place(world, 'rusher', 640, 120, 1);
  place(world, 'sapper', 1010, 470, 0.7);
  place(world, 'brute', 180, 210, 0.62);
  place(world, 'drifter', 1085, 610, 1);
  place(world, 'drifter', 560, 175, 0.9);
  place(world, 'rusher', 955, 385, 1);
  place(world, 'spitter', 235, 520, 0.75);
  // A short bullet stream from the player toward the nearest drifter.
  for (let i = 0; i < 4; i += 1) {
    const t = i / 4;
    s.bullets.push({
      x: 430 + (760 - 430) * t * 0.55,
      y: 478 + (300 - 478) * t * 0.55,
      vx: 520, vy: -280, damage: 12, pierce: 0, life: 0.8,
    });
  }
  s.enemyBullets.push({ x: 830, y: 230, vx: -160, vy: 110, damage: 8, life: 3 });
  s.pickups.push({ kind: 'heart', x: 560, y: 250, vx: 0, vy: 0, life: 8, pulse: 1.2 });
  s.pickups.push({ kind: 'star', x: 880, y: 520, vx: 0, vy: 0, life: 8, pulse: 2.6 });
  world.particles.burst(760, 300, '#ff5d8f', 10, 200, 3);
  world.particles.burst(905, 190, '#8dff57', 12, 230, 3);
  world.particles.burst(955, 385, '#ff9d3c', 8, 180, 3);
  world.particles.text(760, 262, '+90', '#ff5d8f', 17);
  world.particles.text(905, 152, '+135', '#8dff57', 16);
  return SCREEN_PLAY;
}

function stageTitle(world) {
  const s = world.state;
  s.time = 10;
  s.core.hp = 120;
  place(world, 'drifter', 150, 120);
  place(world, 'spitter', 1130, 140);
  place(world, 'rusher', 1090, 600);
  place(world, 'sapper', 170, 590);
  return SCREEN_TITLE;
}

function stageUpgrade(world) {
  const s = world.state;
  s.wave = 3;
  s.time = 64.2;
  s.score = 2310;
  s.kills = 29;
  s.player.x = 520;
  s.player.y = 470;
  s.player.hp = 64;
  s.core.hp = 88;
  const wanted = ['split', 'damage', 'plating'];
  s.draft = UPGRADES.filter((u) => wanted.includes(u.id));
  return SCREEN_UPGRADE;
}

function stageVictory(world) {
  const s = world.state;
  s.wave = 10;
  s.time = 402.7;
  s.finalTime = 402.7;
  s.score = 12480;
  s.kills = 148;
  s.result = 'victory';
  s.endReason = 'The Warden shattered. The Bloom endures!';
  s.player.x = CORE.x - 120;
  s.player.y = CORE.y + 150;
  s.player.hp = 55;
  s.core.hp = 37;
  world.particles.burst(CORE.x + 60, CORE.y - 40, '#ffd76a', 26, 300, 4);
  world.particles.burst(CORE.x - 90, CORE.y + 30, '#5df2c8', 18, 240, 3);
  return SCREEN_VICTORY;
}

const SCENES = { play: stagePlay, title: stageTitle, upgrade: stageUpgrade, victory: stageVictory };

/** Stage the named scene in the world and return the screen to draw. */
export function stageShot(name, world) {
  world.reset();
  const scene = SCENES[name] ?? stagePlay;
  return scene(world);
}
