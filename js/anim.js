// Tile-shake, target-pop, non-target dim, star-pop, confetti.
// All driven by `anim.update(dt)` from the game loop.

const confetti = [];  // active particles, free-list
const confettiFree = [];

const STAR_POP_DURATION = 200;
const STAR_POP_STAGGER = 80;

const anim = {
  // Star pop state for the found-overlay sequence.
  stars: [0, 0, 0],     // 0..1 progress per star
  starStartedAt: -1,    // wall-clock ms when sequence started

  // Confetti spawn.
  spawnConfetti(cx, cy) {
    for (let i = 0; i < 80; i++) {
      const p = confettiFree.pop() || { x: 0, y: 0, vx: 0, vy: 0, color: '', life: 0 };
      p.x = cx; p.y = cy;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 600 + Math.random() * 600;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      p.life = 1.5;
      confetti.push(p);
    }
  },

  // Per-frame tick.
  update(dtMs, levelData) {
    const dt = dtMs / 1000;
    // Tile timers
    if (levelData) {
      for (const t of levelData.tiles) {
        if (t.shakeT > 0) {
          t.shakeT -= dtMs / 250;
          if (t.shakeT < 0) t.shakeT = 0;
        }
        if (t.popT > 0) {
          t.popT -= dtMs / 200;
          if (t.popT < 0) t.popT = 0;
        }
        if (t.dimTarget !== undefined && t.dimT !== t.dimTarget) {
          const step = (1 / 0.3) * dt;       // 300ms to lerp
          if (t.dimT > t.dimTarget) t.dimT = Math.max(t.dimTarget, t.dimT - step);
          else                      t.dimT = Math.min(t.dimTarget, t.dimT + step);
        }
      }
    }
    // Confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.vy += 1500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        confetti.splice(i, 1);
        confettiFree.push(p);
      }
    }
  },

  // Reset star sequence (call on found-state entry).
  startStarSequence(starsEarned) {
    anim.stars[0] = anim.stars[1] = anim.stars[2] = 0;
    anim.starStartedAt = performance.now();
    anim.starsEarned = starsEarned;
  },

  updateStars() {
    if (anim.starStartedAt < 0) return;
    const t = performance.now() - anim.starStartedAt;
    for (let i = 0; i < 3; i++) {
      const local = t - i * STAR_POP_STAGGER;
      if (local <= 0) anim.stars[i] = 0;
      else if (local >= STAR_POP_DURATION) anim.stars[i] = 1;
      else anim.stars[i] = local / STAR_POP_DURATION;
    }
  },

  drawConfetti() {
    for (const p of confetti) {
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
    }
    ctx.globalAlpha = 1;
  },
};

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c66bff', '#ff8d4d', '#7be0ff', '#ffffff'];
