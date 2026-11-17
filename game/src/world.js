// The simulation: player, Core, enemies, bullets, pickups and waves, advanced in
// fixed steps. It knows nothing about screens or sound devices — it queues sound
// names and raises flags (justClearedWave, justEnded) that main.js turns into
// screen changes and audio. Rendering reads the same state and changes nothing.

import { COMBO, CORE, FIELD, PLAYER, SURVIVAL_POINTS, WAVES_TOTAL } from './config.js';
import { ENEMY_TYPES, buildSpawnQueue, draftUpgrades, hpScale } from './enemies.js';
import { createParticles } from './particles.js';
import { range } from './random.js';

const TAU = Math.PI * 2;

export function createWorld(random) {
  const particles = createParticles(random);

  const build = {
    damageMul: 1, rateMul: 1, extraShots: 0, pierce: 0, speedMul: 1,
    maxHpBonus: 0, heal: 0, coreMaxBonus: 0, coreHeal: 0, dashMul: 1,
    magnet: 60, regen: 0, upgradeCounts: {},
  };

  const state = {
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    overcharge: 0,
    survivalAcc: 0,
    player: {
      x: CORE.x, y: CORE.y + 190, angle: -Math.PI / 2, hp: PLAYER.maxHp,
      fireTimer: 0, dashTimer: 0, dashCooldown: 0, invuln: 0, moving: false,
    },
    core: { hp: CORE.maxHp, flash: 0 },
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    spawnQueue: [],
    spawnTimer: 0,
    announceTimer: 0,
    shake: 0,
    result: null, // 'over' | 'victory' once the run ends
    endReason: '',
    draft: [],
  };

  const sounds = [];
  const flags = { justClearedWave: false, justEnded: false };

  const playerMaxHp = () => PLAYER.maxHp + build.maxHpBonus;
  const coreMaxHp = () => CORE.maxHp + build.coreMaxBonus;
  const multiplier = () => 1 + Math.min(state.combo, 40) * COMBO.perKill;

  function reset() {
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.overcharge = 0;
    state.survivalAcc = 0;
    state.player.x = CORE.x;
    state.player.y = CORE.y + 190;
    state.player.hp = playerMaxHp();
    state.player.fireTimer = 0;
    state.player.dashTimer = 0;
    state.player.dashCooldown = 0;
    state.player.invuln = 0;
    state.core.hp = coreMaxHp();
    state.core.flash = 0;
    state.enemies.length = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.pickups.length = 0;
    state.spawnQueue = [];
    state.result = null;
    state.endReason = '';
    state.draft = [];
    flags.justClearedWave = false;
    flags.justEnded = false;
    particles.clear();
  }

  // NOTE for the transcript: build fields are reset by re-creating the world in
  // main.js for a fresh run, so reset() only clears per-run state above.

  function startWave() {
    state.wave += 1;
    state.spawnQueue = buildSpawnQueue(random, state.wave - 1);
    state.spawnTimer = 0.9;
    state.announceTimer = 1.8;
    sounds.push(state.wave === WAVES_TOTAL ? 'boss' : 'wave');
  }

  /** A point on the arena edge, at least 240px from the player. */
  function spawnPoint() {
    for (let tries = 0; tries < 8; tries += 1) {
      const side = Math.floor(random() * 4);
      const x = side === 0 ? FIELD.margin : side === 1 ? FIELD.width - FIELD.margin : range(random, FIELD.margin, FIELD.width - FIELD.margin);
      const y = side === 2 ? FIELD.margin : side === 3 ? FIELD.height - FIELD.margin : range(random, FIELD.margin, FIELD.height - FIELD.margin);
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      if (dx * dx + dy * dy > 240 * 240) return { x, y };
    }
    return { x: FIELD.margin, y: FIELD.margin };
  }

  function spawnEnemy(kind, at) {
    const def = ENEMY_TYPES[kind];
    const pos = at ?? spawnPoint();
    const hp = def.hp * hpScale(state.wave - 1);
    state.enemies.push({
      kind, def, x: pos.x, y: pos.y, vx: 0, vy: 0,
      hp, maxHp: hp, angle: 0, shootTimer: range(random, 1.2, 2.4),
      lungeTimer: range(random, 0.8, 1.6), lungeTime: 0, attackTimer: 0,
      hitFlash: 0, fadeIn: 0.45, wobble: random() * TAU, summonTimer: 5.5, burstTimer: 2.4,
    });
    particles.burst(pos.x, pos.y, def.color, 8, 140, 2.5);
  }

  function fireBullet(angle) {
    state.bullets.push({
      x: state.player.x + Math.cos(angle) * 20,
      y: state.player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      damage: PLAYER.bulletDamage * build.damageMul,
      pierce: build.pierce,
      life: 0.9,
    });
  }

  function enemyShoot(enemy, angle, speed = 235) {
    state.enemyBullets.push({
      x: enemy.x + Math.cos(angle) * (enemy.def.radius + 6),
      y: enemy.y + Math.sin(angle) * (enemy.def.radius + 6),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      damage: enemy.def.damage, life: 3.2,
    });
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (p.invuln > 0 || p.dashTimer > 0 || state.result) return;
    p.hp -= amount;
    p.invuln = PLAYER.contactInvulnerable;
    state.shake = Math.max(state.shake, 7);
    state.combo = 0;
    particles.burst(p.x, p.y, '#ff5d73', 14, 260, 3.5);
    sounds.push('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      endRun('over', 'The Bloomwarden fell. The garden goes dark.');
    }
  }

  function hurtCore(amount, bySapper = false) {
    if (state.result) return;
    state.core.hp -= amount;
    state.core.flash = 0.35;
    state.shake = Math.max(state.shake, bySapper ? 9 : 5);
    particles.burst(CORE.x, CORE.y, '#ffd76a', 12, 220, 3.5);
    sounds.push('coreHurt');
    if (state.core.hp <= 0) {
      state.core.hp = 0;
      endRun('over', 'The Last Light went out.');
    }
  }

  function endRun(result, reason) {
    if (state.result) return;
    state.result = result;
    state.endReason = reason;
    state.finalTime = state.time;
    flags.justEnded = true;
    sounds.push(result === 'victory' ? 'win' : 'over');
    if (result === 'victory') state.score += 1000;
  }

  function dropPickup(x, y) {
    const roll = random();
    let kind = null;
    if (roll < 0.09) kind = 'heart';
    else if (roll < 0.17) kind = 'cell';
    else if (roll < 0.23) kind = 'charge';
    else if (roll < 0.34) kind = 'star';
    if (!kind) return;
    state.pickups.push({ kind, x, y, vx: range(random, -30, 30), vy: range(random, -30, 30), life: 9, pulse: random() * TAU });
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    const gained = Math.round(enemy.def.score * multiplier());
    state.score += gained;
    particles.text(enemy.x, enemy.y - 14, `+${gained}`, enemy.def.color, enemy.def.boss ? 26 : 16);
    particles.burst(enemy.x, enemy.y, enemy.def.color, enemy.def.boss ? 60 : 16, enemy.def.boss ? 380 : 260, 3.5);
    state.shake = Math.max(state.shake, enemy.def.boss ? 14 : enemy.kind === 'brute' ? 8 : 3);
    sounds.push(enemy.def.boss || enemy.kind === 'brute' ? 'bigExplode' : 'explode');
    if (enemy.def.boss) {
      endRun('victory', 'The Warden shattered. The Bloom endures!');
    } else {
      dropPickup(enemy.x, enemy.y);
    }
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    const move = input.moveVector();
    p.moving = move.x !== 0 || move.y !== 0;
    p.angle = Math.atan2(input.pointer.y - p.y, input.pointer.x - p.x);

    if (input.takeDash() || (input.shiftHeld() && p.dashCooldown <= 0 && p.moving)) {
      if (p.dashCooldown <= 0) {
        p.dashTimer = PLAYER.dashTime;
        p.dashCooldown = PLAYER.dashCooldown * build.dashMul;
        sounds.push('dash');
      }
    }
    const dashing = p.dashTimer > 0;
    const speed = PLAYER.speed * build.speedMul * (dashing ? PLAYER.dashSpeed / PLAYER.speed : 1);
    const dirX = p.moving ? move.x : Math.cos(p.angle);
    const dirY = p.moving ? move.y : Math.sin(p.angle);
    if (p.moving || dashing) {
      p.x += dirX * speed * dt;
      p.y += dirY * speed * dt;
      if (dashing) particles.trail(p.x, p.y, '#5df2c8', 7);
    }
    p.x = Math.min(FIELD.width - FIELD.margin, Math.max(FIELD.margin, p.x));
    p.y = Math.min(FIELD.height - FIELD.margin, Math.max(FIELD.margin, p.y));
    // The Core is solid: slide around it rather than standing inside the light.
    const cdx = p.x - CORE.x;
    const cdy = p.y - CORE.y;
    const cd = Math.hypot(cdx, cdy);
    const minD = CORE.radius + PLAYER.radius + 4;
    if (cd > 0 && cd < minD) {
      p.x = CORE.x + (cdx / cd) * minD;
      p.y = CORE.y + (cdy / cd) * minD;
    }

    p.fireTimer -= dt;
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (build.regen > 0) p.hp = Math.min(playerMaxHp(), p.hp + build.regen * dt);

    if (input.firing && p.fireTimer <= 0 && !state.result) {
      const interval = PLAYER.fireInterval / build.rateMul * (state.overcharge > 0 ? 0.45 : 1);
      p.fireTimer = interval;
      const shots = 1 + build.extraShots;
      for (let i = 0; i < shots; i += 1) {
        const offset = shots === 1 ? 0 : (i - (shots - 1) / 2) * 0.085;
        fireBullet(p.angle + offset + range(random, -0.012, 0.012));
      }
      particles.trail(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, '#a8fff0', 4);
      sounds.push('shoot');
    }
    state.overcharge = Math.max(0, state.overcharge - dt);
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      e.fadeIn = Math.max(0, e.fadeIn - dt);
      e.wobble += dt * 2.2;

      const target = e.def.targets === 'core'
        ? { x: CORE.x, y: CORE.y }
        : e.def.targets === 'nearest'
          ? (Math.hypot(p.x - e.x, p.y - e.y) < Math.hypot(CORE.x - e.x, CORE.y - e.y) ? p : { x: CORE.x, y: CORE.y })
          : p;
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      e.angle = Math.atan2(dy, dx);
      let speed = e.def.speed * (e.def.boss && e.hp < e.maxHp * 0.3 ? 1.5 : 1);

      if (e.kind === 'rusher') {
        e.lungeTimer -= dt;
        if (e.lungeTime > 0) {
          e.lungeTime -= dt;
          speed = 470;
        } else if (e.lungeTimer <= 0 && dist < 280) {
          e.lungeTime = 0.34;
          e.lungeTimer = range(random, 1.1, 1.7);
          e.vx = ux; e.vy = uy;
        }
        const dirX = e.lungeTime > 0 ? e.vx : ux;
        const dirY = e.lungeTime > 0 ? e.vy : uy;
        e.x += dirX * speed * dt;
        e.y += dirY * speed * dt;
      } else if (e.kind === 'spitter') {
        const want = dist > 330 ? 1 : dist < 240 ? -1 : 0;
        const strafe = Math.sin(e.wobble) * 0.5;
        e.x += (ux * want - uy * strafe) * speed * dt;
        e.y += (uy * want + ux * strafe) * speed * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 540 && e.fadeIn <= 0) {
          e.shootTimer = range(random, 1.8, 2.4);
          enemyShoot(e, Math.atan2(p.y - e.y, p.x - e.x));
          sounds.push('hit');
        }
      } else {
        const wob = e.kind === 'drifter' ? Math.sin(e.wobble) * 0.35 : 0;
        e.x += (ux - uy * wob) * speed * dt;
        e.y += (uy + ux * wob) * speed * dt;
      }

      if (e.def.boss) {
        e.burstTimer -= dt;
        const enraged = e.hp < e.maxHp * 0.3;
        if (e.burstTimer <= 0 && e.fadeIn <= 0) {
          e.burstTimer = enraged ? 1.5 : 2.4;
          const count = enraged ? 18 : 12;
          const base = random() * TAU;
          for (let k = 0; k < count; k += 1) enemyShoot(e, base + (k / count) * TAU, 185);
          sounds.push('boss');
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0 && state.enemies.length < 9) {
          e.summonTimer = 5.5;
          spawnEnemy('drifter');
          spawnEnemy('rusher');
          particles.text(e.x, e.y - 56, 'THE WARDEN CALLS', '#ff3860', 20);
        }
      }

      // Contact: the player first, then the Core.
      const pd = Math.hypot(p.x - e.x, p.y - e.y);
      if (pd < e.def.radius + PLAYER.radius && e.fadeIn <= 0) {
        hurtPlayer(e.def.damage);
        e.x -= ux * 26;
        e.y -= uy * 26;
      }
      const cd = Math.hypot(CORE.x - e.x, CORE.y - e.y);
      if (cd < e.def.radius + CORE.radius && e.fadeIn <= 0) {
        if (e.kind === 'sapper') {
          hurtCore(9, true);
          particles.burst(e.x, e.y, e.def.color, 22, 300, 4);
          state.enemies.splice(i, 1);
          continue;
        }
        if (e.attackTimer <= 0) {
          e.attackTimer = 0.85;
          hurtCore(Math.max(3, Math.round(e.def.damage / 3)));
        }
        e.x -= (CORE.x - e.x) / (cd || 1) * 8;
        e.y -= (CORE.y - e.y) / (cd || 1) * 8;
      }
      e.x = Math.min(FIELD.width - 14, Math.max(14, e.x));
      e.y = Math.min(FIELD.height - 14, Math.max(14, e.y));
    }
    // Gentle separation so stacks read as individuals, not one blob.
    const list = state.enemies;
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const A = list[a];
        const B = list[b];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy);
        const min = (A.def.radius + B.def.radius) * 0.82;
        if (d > 0 && d < min) {
          const push = ((min - d) / d) * 0.5;
          A.x -= dx * push * 0.5; A.y -= dy * push * 0.5;
          B.x += dx * push * 0.5; B.y += dy * push * 0.5;
        }
      }
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > FIELD.width || b.y > FIELD.height;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          if (e.fadeIn > 0.25) continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < e.def.radius + 4) {
            e.hp -= b.damage;
            e.hitFlash = 0.09;
            e.x += (b.vx / PLAYER.bulletSpeed) * 3.5;
            e.y += (b.vy / PLAYER.bulletSpeed) * 3.5;
            particles.burst(b.x, b.y, e.def.color, 4, 170, 2.5);
            if (e.hp <= 0) killEnemy(e, j);
            if (b.pierce > 0) { b.pierce -= 1; } else { dead = true; }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > FIELD.width || b.y > FIELD.height;
      if (!dead && Math.hypot(state.player.x - b.x, state.player.y - b.y) < PLAYER.radius + 5) {
        hurtPlayer(b.damage);
        dead = true;
      }
      if (!dead && Math.hypot(CORE.x - b.x, CORE.y - b.y) < CORE.radius + 5) {
        hurtCore(Math.max(2, Math.round(b.damage / 3)));
        dead = true;
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }
  }

  function stepPickups(dt) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      pk.pulse += dt * 4;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < build.magnet) {
        pk.vx += (dx / d) * 620 * dt;
        pk.vy += (dy / d) * 620 * dt;
      }
      pk.vx *= 0.92; pk.vy *= 0.92;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      if (pk.life <= 0) { state.pickups.splice(i, 1); continue; }
      if (d < PLAYER.radius + 15) {
        if (pk.kind === 'heart') { p.hp = Math.min(playerMaxHp(), p.hp + 25); particles.text(p.x, p.y - 26, '+25 HP', '#ff5d8f'); }
        if (pk.kind === 'cell') { state.core.hp = Math.min(coreMaxHp(), state.core.hp + 22); particles.text(CORE.x, CORE.y - 52, '+22 CORE', '#ffd76a'); }
        if (pk.kind === 'charge') { state.overcharge = 8; particles.text(p.x, p.y - 26, 'OVERCHARGE!', '#7ab8ff'); }
        if (pk.kind === 'star') { state.score += 250; particles.text(p.x, p.y - 26, '+250', '#ffe95a'); }
        particles.burst(pk.x, pk.y, '#ffffff', 8, 150, 2.5);
        sounds.push('pickup');
        state.pickups.splice(i, 1);
      }
    }
  }

  /** Advance one fixed step. Input is the input module's live object. */
  function step(dt, input) {
    if (state.result) { particles.update(dt); return; }
    state.time += dt;
    state.announceTimer = Math.max(0, state.announceTimer - dt);
    state.core.flash = Math.max(0, state.core.flash - dt);
    state.shake = Math.max(0, state.shake - dt * 26);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    state.survivalAcc += SURVIVAL_POINTS * dt;
    if (state.survivalAcc >= 1) {
      const whole = Math.floor(state.survivalAcc);
      state.score += whole;
      state.survivalAcc -= whole;
    }
    if (random() < 0.3) particles.sparkle(CORE.x + range(random, -30, 30), CORE.y + range(random, -30, 30), '#ffd76a');

    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(0.42, 0.92 - state.wave * 0.05);
        spawnEnemy(state.spawnQueue.shift());
      }
    } else if (state.enemies.length === 0 && state.wave > 0) {
      if (state.wave >= WAVES_TOTAL) {
        endRun('victory', 'Every wave held. The Bloom endures!');
      } else {
        state.draft = draftUpgrades(random, build);
        flags.justClearedWave = true;
      }
      return;
    }

    stepPlayer(dt, input);
    stepEnemies(dt);
    stepBullets(dt);
    stepPickups(dt);
    particles.update(dt);
  }

  /** Apply a drafted upgrade and clear the draft. */
  function applyUpgrade(upgrade) {
    upgrade.apply(build);
    build.upgradeCounts[upgrade.id] = (build.upgradeCounts[upgrade.id] || 0) + 1;
    if (build.heal) {
      state.player.hp = Math.min(playerMaxHp(), state.player.hp + build.heal);
      build.heal = 0;
    }
    if (build.coreHeal) {
      state.core.hp = Math.min(coreMaxHp(), state.core.hp + build.coreHeal);
      build.coreHeal = 0;
    }
    state.draft = [];
    sounds.push('upgrade');
  }

  return {
    state, build, particles, sounds, flags,
    reset, startWave, applyUpgrade, step, spawnEnemy,
    playerMaxHp, coreMaxHp, multiplier,
  };
}
