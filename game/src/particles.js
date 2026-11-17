// Particles and floating texts, both pooled: bursts on hits and deaths, dash
// trails, pickup sparkles, and the little score popups that make every action
// readable. Nothing here allocates during play beyond the fixed pools.

const MAX_PARTICLES = 420;
const MAX_TEXTS = 28;

export function createParticles(random) {
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 1 });
  }
  const texts = [];
  for (let i = 0; i < MAX_TEXTS; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, value: '', color: '#fff', size: 18 });
  }
  let cursor = 0;
  let textCursor = 0;

  function spawn(x, y, vx, vy, life, size, color, drag) {
    const p = particles[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.color = color; p.drag = drag;
  }

  return {
    /** A radial burst of sparks in one colour. */
    burst(x, y, color, count = 12, speed = 240, size = 3) {
      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const v = speed * (0.3 + random() * 0.7);
        spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.35 + random() * 0.4, size * (0.6 + random() * 0.8), color, 3.2);
      }
    },
    /** A soft upward drift of motes, for the Core and pickups. */
    sparkle(x, y, color) {
      spawn(x, y, (random() - 0.5) * 30, -30 - random() * 40, 0.7 + random() * 0.5, 2, color, 0.4);
    },
    /** One fading dot behind a dashing or moving body. */
    trail(x, y, color, size = 5) {
      spawn(x, y, (random() - 0.5) * 16, (random() - 0.5) * 16, 0.3, size, color, 1.5);
    },
    /** A floating label that rises and fades (score popups, warnings). */
    text(x, y, value, color = '#f2efff', size = 18) {
      const t = texts[textCursor];
      textCursor = (textCursor + 1) % MAX_TEXTS;
      t.active = true;
      t.x = x; t.y = y; t.value = value; t.color = color; t.size = size;
      t.life = 0.9; t.maxLife = 0.9;
    },
    update(dt) {
      for (const p of particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { p.active = false; continue; }
        const dragFactor = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragFactor;
        p.vy *= dragFactor;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (const t of texts) {
        if (!t.active) continue;
        t.life -= dt;
        if (t.life <= 0) { t.active = false; continue; }
        t.y -= 34 * dt;
      }
    },
    draw(context) {
      for (const p of particles) {
        if (!p.active) continue;
        context.globalAlpha = Math.max(0, p.life / p.maxLife);
        context.fillStyle = p.color;
        context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      context.globalAlpha = 1;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (const t of texts) {
        if (!t.active) continue;
        context.globalAlpha = Math.max(0, t.life / t.maxLife);
        context.font = `bold ${t.size}px "Segoe UI", system-ui, sans-serif`;
        context.fillStyle = t.color;
        context.fillText(t.value, t.x, t.y);
      }
      context.globalAlpha = 1;
    },
    clear() {
      for (const p of particles) p.active = false;
      for (const t of texts) t.active = false;
    },
  };
}
