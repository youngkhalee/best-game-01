// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 field is scaled to fit the window and centred. Neon shapes on a deep
// void: a starfield, two nebulae, the golden Core at the centre, and every body
// drawn as its own polygon so a wave reads at a glance in a screenshot.

import { CORE, FIELD, FONT, PALETTE, PLAYER, WAVES_TOTAL } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

/** The three upgrade cards, shared with main.js so clicks land where cards are drawn. */
export function cardRect(index) {
  return { x: 190 + index * 310, y: 268, width: 280, height: 190 };
}

function polygon(context, x, y, radius, sides, rotation) {
  context.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  // A fixed starfield, scattered once: the void looks the same every frame.
  const stars = [];
  let starSeed = 1234567;
  const starRandom = () => {
    starSeed = (Math.imul(starSeed, 1103515245) + 12345) | 0;
    return ((starSeed >>> 16) & 0x7fff) / 0x7fff;
  };
  for (let i = 0; i < 130; i += 1) {
    stars.push({ x: starRandom() * FIELD.width, y: starRandom() * FIELD.height, r: 0.6 + starRandom() * 1.5, a: 0.25 + starRandom() * 0.6 });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'center', bold = false) {
    context.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillText(value, x, y);
  }

  function bar(x, y, width, height, fraction, color, back = '#241f42') {
    context.fillStyle = back;
    context.fillRect(x, y, width, height);
    context.fillStyle = color;
    context.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
  }

  function drawBackground(state) {
    context.fillStyle = PALETTE.deep;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const nebA = context.createRadialGradient(240, 150, 40, 240, 150, 420);
    nebA.addColorStop(0, PALETTE.nebulaA);
    nebA.addColorStop(1, 'rgba(13,10,29,0)');
    context.fillStyle = nebA;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const nebB = context.createRadialGradient(1080, 600, 40, 1080, 600, 460);
    nebB.addColorStop(0, PALETTE.nebulaB);
    nebB.addColorStop(1, 'rgba(13,10,29,0)');
    context.fillStyle = nebB;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const s of stars) {
      context.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(state.time * 1.7 + s.x));
      context.fillStyle = PALETTE.star;
      context.fillRect(s.x, s.y, s.r, s.r);
    }
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 64; x < FIELD.width; x += 64) { context.moveTo(x, 0); context.lineTo(x, FIELD.height); }
    for (let y = 64; y < FIELD.height; y += 64) { context.moveTo(0, y); context.lineTo(FIELD.width, y); }
    context.stroke();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(FIELD.margin - 8, FIELD.margin - 8, FIELD.width - FIELD.margin * 2 + 16, FIELD.height - FIELD.margin * 2 + 16);
  }

  function drawCore(state, coreMaxHp) {
    const pulse = 1 + Math.sin(state.time * 2.4) * 0.05;
    const glow = context.createRadialGradient(CORE.x, CORE.y, 4, CORE.x, CORE.y, 110 * pulse);
    glow.addColorStop(0, 'rgba(255,215,106,0.5)');
    glow.addColorStop(1, 'rgba(255,157,60,0)');
    context.fillStyle = glow;
    context.fillRect(CORE.x - 120, CORE.y - 120, 240, 240);
    context.save();
    context.translate(CORE.x, CORE.y);
    context.rotate(state.time * 0.35);
    context.strokeStyle = PALETTE.coreGlow;
    context.lineWidth = 2;
    context.setLineDash([14, 10]);
    context.beginPath();
    context.arc(0, 0, (CORE.radius + 13) * pulse, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    context.setLineDash([]);
    const body = context.createRadialGradient(CORE.x - 8, CORE.y - 10, 4, CORE.x, CORE.y, CORE.radius);
    body.addColorStop(0, '#fff3c4');
    body.addColorStop(0.55, PALETTE.core);
    body.addColorStop(1, PALETTE.coreGlow);
    context.fillStyle = body;
    context.beginPath();
    context.arc(CORE.x, CORE.y, CORE.radius * pulse, 0, Math.PI * 2);
    context.fill();
    if (state.core.flash > 0) {
      context.globalAlpha = Math.min(1, state.core.flash * 2.4);
      context.fillStyle = '#ff5d73';
      context.beginPath();
      context.arc(CORE.x, CORE.y, CORE.radius * pulse, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    // Health arc around the Core itself, readable without looking at the HUD.
    context.strokeStyle = '#3a2c12';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(CORE.x, CORE.y, CORE.radius + 24, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = PALETTE.core;
    context.beginPath();
    context.arc(CORE.x, CORE.y, CORE.radius + 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (state.core.hp / coreMaxHp));
    context.stroke();
    text('LAST LIGHT', CORE.x, CORE.y + CORE.radius + 44, 13, PALETTE.gold, 'center', true);
  }

  function drawPickup(pk) {
    const bob = Math.sin(pk.pulse) * 3;
    const blink = pk.life < 2 ? (Math.sin(pk.pulse * 6) > 0 ? 1 : 0.25) : 1;
    context.globalAlpha = blink;
    const colors = { heart: PALETTE.heart, cell: PALETTE.cell, charge: PALETTE.charge, star: PALETTE.starPickup };
    context.fillStyle = '#141126';
    context.beginPath();
    context.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = colors[pk.kind];
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = colors[pk.kind];
    if (pk.kind === 'heart') {
      polygon(context, pk.x, pk.y + bob, 7, 4, Math.PI / 4);
      context.fill();
      text('+', pk.x, pk.y + bob + 1, 13, '#141126', 'center', true);
    } else if (pk.kind === 'cell') {
      polygon(context, pk.x, pk.y + bob, 7, 4, 0);
      context.fill();
    } else if (pk.kind === 'charge') {
      context.beginPath();
      context.moveTo(pk.x + 2, pk.y - 8 + bob);
      context.lineTo(pk.x - 4, pk.y + 1 + bob);
      context.lineTo(pk.x, pk.y + 1 + bob);
      context.lineTo(pk.x - 2, pk.y + 8 + bob);
      context.lineTo(pk.x + 4, pk.y - 1 + bob);
      context.lineTo(pk.x, pk.y - 1 + bob);
      context.closePath();
      context.fill();
    } else {
      polygon(context, pk.x, pk.y + bob, 8, 5, -Math.PI / 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawEnemy(e) {
    const alpha = e.fadeIn > 0 ? 1 - e.fadeIn / 0.45 : 1;
    context.globalAlpha = alpha;
    const color = e.hitFlash > 0 ? '#ffffff' : e.def.color;
    context.fillStyle = color;
    context.strokeStyle = 'rgba(0,0,0,0.35)';
    context.lineWidth = 2;
    const r = e.def.radius;
    if (e.def.shape === 'triangle') {
      polygon(context, e.x, e.y, r, 3, e.angle);
    } else if (e.def.shape === 'dart') {
      context.beginPath();
      context.moveTo(e.x + Math.cos(e.angle) * r * 1.3, e.y + Math.sin(e.angle) * r * 1.3);
      context.lineTo(e.x + Math.cos(e.angle + 2.5) * r, e.y + Math.sin(e.angle + 2.5) * r);
      context.lineTo(e.x + Math.cos(e.angle) * -r * 0.4, e.y + Math.sin(e.angle) * -r * 0.4);
      context.lineTo(e.x + Math.cos(e.angle - 2.5) * r, e.y + Math.sin(e.angle - 2.5) * r);
      context.closePath();
    } else if (e.def.shape === 'hexagon') {
      polygon(context, e.x, e.y, r, 6, e.angle * 0.4);
    } else if (e.def.shape === 'square') {
      polygon(context, e.x, e.y, r, 4, e.angle * 0.6);
    } else if (e.def.shape === 'octagon') {
      polygon(context, e.x, e.y, r, 8, e.angle * 0.25);
    } else { // warden: a crowned octagon with a burning eye
      polygon(context, e.x, e.y, r, 8, e.angle * 0.2);
      context.fill();
      context.stroke();
      context.fillStyle = '#2b0a18';
      polygon(context, e.x, e.y, r * 0.55, 8, -e.angle * 0.3);
      context.fill();
      context.fillStyle = '#ffe95a';
      context.beginPath();
      context.arc(e.x, e.y, 6 + Math.sin(e.wobble * 3) * 1.5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      if (e.hp < e.maxHp) bar(e.x - 46, e.y - r - 18, 92, 7, e.hp / e.maxHp, '#ff3860');
      return;
    }
    context.fill();
    context.stroke();
    if (e.kind === 'spitter' || e.kind === 'brute') {
      context.fillStyle = 'rgba(10,6,24,0.55)';
      context.beginPath();
      context.arc(e.x, e.y, r * 0.38, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if ((e.kind === 'brute') && e.hp < e.maxHp) {
      bar(e.x - 26, e.y - r - 14, 52, 5, e.hp / e.maxHp, e.def.color);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.invuln > 0 && p.dashTimer <= 0 && Math.floor(p.invuln * 14) % 2 === 0) return; // blink while hurt
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    const glow = context.createRadialGradient(0, 0, 2, 0, 0, 34);
    glow.addColorStop(0, 'rgba(93,242,200,0.4)');
    glow.addColorStop(1, 'rgba(93,242,200,0)');
    context.fillStyle = glow;
    context.fillRect(-36, -36, 72, 72);
    // Engine flame flickers while moving.
    if (p.moving || p.dashTimer > 0) {
      context.fillStyle = '#ff9d3c';
      context.beginPath();
      const flame = p.dashTimer > 0 ? 22 : 12 + Math.sin(state.time * 31) * 3;
      context.moveTo(-12, -5);
      context.lineTo(-12 - flame, 0);
      context.lineTo(-12, 5);
      context.closePath();
      context.fill();
    }
    context.fillStyle = PALETTE.player;
    context.strokeStyle = PALETTE.playerDark;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(20, 0);
    context.lineTo(-13, -12);
    context.lineTo(-7, 0);
    context.lineTo(-13, 12);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#eafff8';
    context.beginPath();
    context.arc(4, 0, 4.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Dash readiness ring under the ship.
    if (p.dashCooldown <= 0) {
      context.strokeStyle = 'rgba(93,242,200,0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, PLAYER.radius + 7, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawBullets(state) {
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.strokeStyle = PALETTE.bullet;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const b of state.enemyBullets) {
      context.fillStyle = PALETTE.enemyBullet;
      context.beginPath();
      context.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd9cf';
      context.beginPath();
      context.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHud(state, world) {
    const p = state.player;
    // Player health, top left.
    text('BLOOMWARDEN', 26, 30, 14, PALETTE.muted, 'left', true);
    bar(26, 42, 230, 15, p.hp / world.playerMaxHp(), p.hp < 30 ? PALETTE.bad : PALETTE.good);
    text(`${Math.ceil(p.hp)} / ${world.playerMaxHp()}`, 36, 50, 12, '#0b1520', 'left', true);
    // Wave and hostiles, top centre.
    text(`WAVE ${Math.max(1, state.wave)} / ${WAVES_TOTAL}`, FIELD.width / 2, 34, 24, PALETTE.text, 'center', true);
    const left = state.enemies.length + state.spawnQueue.length;
    text(state.wave === WAVES_TOTAL && state.enemies.some((e) => e.def.boss) ? 'THE WARDEN IS HERE' : `${left} hostile${left === 1 ? '' : 's'} remain`, FIELD.width / 2, 62, 15, PALETTE.muted);
    // Score, top right.
    text(`SCORE ${state.score}`, FIELD.width - 26, 32, 24, PALETTE.text, 'right', true);
    if (state.combo > 1) {
      const mult = world.multiplier().toFixed(1);
      text(`COMBO x${mult}`, FIELD.width - 26, 62, 16, PALETTE.gold, 'right', true);
      bar(FIELD.width - 146, 72, 120, 5, state.comboTimer / 3.2, PALETTE.gold);
    }
    // Core health, bottom left.
    text('LAST LIGHT CORE', 26, FIELD.height - 52, 14, PALETTE.gold, 'left', true);
    bar(26, FIELD.height - 42, 230, 13, state.core.hp / world.coreMaxHp(), PALETTE.gold);
    // Dash and overcharge, bottom right.
    const dashText = p.dashCooldown <= 0 ? 'DASH READY (SPACE)' : `DASH ${p.dashCooldown.toFixed(1)}s`;
    text(dashText, FIELD.width - 26, FIELD.height - 46, 15, p.dashCooldown <= 0 ? PALETTE.good : PALETTE.muted, 'right', true);
    if (state.overcharge > 0) text(`OVERCHARGE ${state.overcharge.toFixed(0)}s`, FIELD.width - 26, FIELD.height - 70, 15, PALETTE.charge, 'right', true);
    text('WASD move · Mouse aim · Hold click to fire · P pause · M mute', FIELD.width / 2, FIELD.height - 34, 14, PALETTE.muted);
    // Wave banner.
    if (state.announceTimer > 0 && state.wave >= 1) {
      context.globalAlpha = Math.min(1, state.announceTimer);
      text(state.wave === WAVES_TOTAL ? 'FINAL WAVE — THE WARDEN AWAKENS' : `WAVE ${state.wave}`, FIELD.width / 2, 150, 44, state.wave === WAVES_TOTAL ? PALETTE.bad : PALETTE.text, 'center', true);
      context.globalAlpha = 1;
    }
  }

  function panel(width, height) {
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7,6,14,0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    return { x, y };
  }

  function drawTitle(state, best) {
    const { y } = panel(680, 470);
    text('VOID BLOOM', FIELD.width / 2, y + 78, 68, PALETTE.good, 'center', true);
    text('A R E N A   O F   T H E   L A S T   L I G H T', FIELD.width / 2, y + 122, 17, PALETTE.gold, 'center', true);
    const lines = [
      'The Hollow are coming for the Last Light Core — and for you.',
      'Survive 10 waves. Guard the Core at the centre: if it dies, you fall.',
      '',
      'WASD / arrows — move      Mouse — aim      Hold click — fire',
      'SPACE / SHIFT — dash      P — pause      M — mute',
      'Between waves, choose 1 of 3 gifts to grow stronger.',
    ];
    lines.forEach((line, i) => text(line, FIELD.width / 2, y + 168 + i * 30, 18, i < 2 ? PALETTE.text : PALETTE.muted));
    if (best > 0) text(`BEST SCORE ${best}`, FIELD.width / 2, y + 372, 18, PALETTE.gold, 'center', true);
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('PRESS ENTER OR CLICK TO BEGIN', FIELD.width / 2, y + 420, 22, PALETTE.good, 'center', true);
  }

  function drawUpgrade(state, ui) {
    context.fillStyle = 'rgba(7,6,14,0.66)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} HELD!`, FIELD.width / 2, 128, 42, PALETTE.good, 'center', true);
    text('The Bloom offers a gift — choose one to grow stronger', FIELD.width / 2, 172, 20, PALETTE.text);
    text(`Score ${state.score} · Core ${Math.ceil(state.core.hp)} HP · Next: wave ${state.wave + 1} of ${WAVES_TOTAL}`, FIELD.width / 2, 204, 17, PALETTE.muted);
    state.draft.forEach((upgrade, i) => {
      const rect = cardRect(i);
      const hover = ui.pointer.x >= rect.x && ui.pointer.x <= rect.x + rect.width && ui.pointer.y >= rect.y && ui.pointer.y <= rect.y + rect.height;
      context.fillStyle = hover ? '#1e1840' : PALETTE.panel;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeStyle = hover ? PALETTE.good : PALETTE.panelEdge;
      context.lineWidth = hover ? 3 : 2;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      text(String(i + 1), rect.x + rect.width / 2, rect.y + 36, 20, PALETTE.gold, 'center', true);
      text(upgrade.name, rect.x + rect.width / 2, rect.y + 82, 25, PALETTE.text, 'center', true);
      text(upgrade.desc, rect.x + rect.width / 2, rect.y + 122, 17, PALETTE.muted);
      text('CLICK OR PRESS ' + (i + 1), rect.x + rect.width / 2, rect.y + 162, 13, PALETTE.muted, 'center', true);
    });
    text('Choose well — the Hollow grow stronger every wave', FIELD.width / 2, 522, 16, PALETTE.muted);
  }

  function drawEnd(state, best, victory) {
    const { y } = panel(620, 440);
    text(victory ? 'THE BLOOM ENDURES' : 'THE LIGHT FADES', FIELD.width / 2, y + 74, 44, victory ? PALETTE.gold : PALETTE.bad, 'center', true);
    text(state.endReason, FIELD.width / 2, y + 122, 19, PALETTE.text);
    const held = state.finalTime ?? state.time;
    const mins = Math.floor(held / 60);
    const secs = Math.floor(held % 60).toString().padStart(2, '0');
    const rows = [
      ['FINAL SCORE', String(state.score)],
      ['BEST SCORE', String(Math.max(best, state.score))],
      ['WAVE REACHED', `${Math.max(1, state.wave)} / ${WAVES_TOTAL}`],
      ['HOLLOW FELLED', String(state.kills)],
      ['TIME HELD', `${mins}:${secs}`],
    ];
    rows.forEach((row, i) => {
      text(row[0], FIELD.width / 2 - 40, y + 176 + i * 36, 18, PALETTE.muted, 'right', true);
      text(row[1], FIELD.width / 2 + 20, y + 176 + i * 36, 20, PALETTE.text, 'left', true);
    });
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('PRESS ENTER OR CLICK TO PLAY AGAIN', FIELD.width / 2, y + 392, 21, PALETTE.good, 'center', true);
  }

  /** Paint one frame. `ui` carries { pointer, best, muted }. */
  function draw(state, screen, world, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Screen shake: the whole field jolts when something big lands.
    if (state.shake > 0) {
      const s = state.shake;
      context.translate((Math.sin(state.time * 91) * s) / 2, (Math.cos(state.time * 83) * s) / 2);
    }
    drawBackground(state);
    drawCore(state, world.coreMaxHp());
    for (const pk of state.pickups) drawPickup(pk);
    for (const e of state.enemies) drawEnemy(e);
    drawBullets(state);
    if (screen !== SCREEN_TITLE) drawPlayer(state);
    world.particles.draw(context);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui.best);
      return;
    }
    drawHud(state, world);
    if (screen === SCREEN_PAUSED) {
      const { y } = panel(440, 220);
      text('PAUSED', FIELD.width / 2, y + 78, 40, PALETTE.text, 'center', true);
      text('The Hollow wait for no one — but they will wait for you.', FIELD.width / 2, y + 126, 16, PALETTE.muted);
      text('Press P to resume', FIELD.width / 2, y + 172, 19, PALETTE.good, 'center', true);
    } else if (screen === SCREEN_UPGRADE) {
      drawUpgrade(state, ui);
    } else if (screen === SCREEN_OVER) {
      drawEnd(state, ui.best, false);
    } else if (screen === SCREEN_VICTORY) {
      drawEnd(state, ui.best, true);
    }
    // Reticle at the pointer.
    if (ui.pointer.inside && screen === SCREEN_PLAY) {
      context.strokeStyle = PALETTE.good;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ui.pointer.x, ui.pointer.y, 9, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.good;
      context.fillRect(ui.pointer.x - 1, ui.pointer.y - 1, 2, 2);
    }
    if (ui.muted) text('MUTED', FIELD.width - 26, 92, 13, PALETTE.muted, 'right', true);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
