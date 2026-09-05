// Canvas renderer.
//
// The simulation is 2D but the units are drawn with a fake Z: each capsule
// carries a depth, far limbs are drawn first and pushed towards the
// background colour, near limbs last. That one trick is most of what stops a
// side-on ragdoll from reading as a paper doll.

import { clamp, mix, wrap } from './physics/vec2.js';

const GROUND_LINE = 0.80;   // where the horizon sits in the viewport
const SKY_TOP = '#0d1420';
const SKY_BOT = '#2a3444';

export class Camera {
  constructor() {
    this.x = 0; this.y = 1.2; this.zoom = 120;
    this.tx = 0; this.ty = 1.2; this.tzoom = 120;
    this.shake = 0;
    this.manual = false;
  }

  frame(bounds, w, h, dt) {
    if (!this.manual) {
      // The horizon is pinned to a fixed line on screen and the zoom is
      // chosen so the tallest body still fits above it. Framing on the
      // bounding box centre instead leaves a growing slab of empty ground
      // under a wide brawl.
      const cx = (bounds.minx + bounds.maxx) / 2;
      const span = Math.max(bounds.maxx - bounds.minx + 2.6, 4.4);
      const top = Math.max(bounds.maxy * 1.12 + 0.35, 2.4);
      this.tzoom = clamp(Math.min(w / span, (GROUND_LINE - 0.06) * h / top), 24, 200);
      this.tx = cx;
      this.ty = 0;
    }
    const k = 1 - Math.exp(-dt * 3.2);
    this.x = mix(this.x, this.tx, k);
    this.y = mix(this.y, this.ty, k);
    this.zoom = mix(this.zoom, this.tzoom, k);
    this.shake = Math.max(0, this.shake - dt * 2.6);
  }

  apply(ctx, w, h) {
    const s = this.shake;
    const jx = s > 0 ? (Math.random() - 0.5) * s * 26 : 0;
    const jy = s > 0 ? (Math.random() - 0.5) * s * 26 : 0;
    ctx.setTransform(this.zoom, 0, 0, -this.zoom,
      w / 2 - this.x * this.zoom + jx, h * GROUND_LINE + this.y * this.zoom + jy);
  }

  toWorld(px, py, w, h) {
    return {
      x: (px - (w / 2 - this.x * this.zoom)) / this.zoom,
      y: -(py - (h * GROUND_LINE + this.y * this.zoom)) / this.zoom,
    };
  }
}

export class Particles {
  constructor() { this.list = []; }

  spawn(x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = opts.angle + (Math.random() - 0.5) * (opts.spread ?? Math.PI);
      const sp = opts.speed * (0.35 + Math.random() * 0.9);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: opts.life * (0.6 + Math.random() * 0.8),
        age: 0,
        r: opts.r * (0.5 + Math.random()),
        color: opts.color,
        grav: opts.grav ?? 1,
        kind: opts.kind || 'spark',
      });
    }
    if (this.list.length > 1400) this.list.splice(0, this.list.length - 1400);
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age > p.life) { this.list.splice(i, 1); continue; }
      p.vy -= 9.81 * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < 0.01 && p.kind !== 'dust') { p.y = 0.01; p.vy *= -0.25; p.vx *= 0.7; }
      p.vx *= 1 - dt * (p.kind === 'dust' ? 2.2 : 0.5);
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = p.kind === 'dust' ? t * 0.35 : t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.kind === 'dust' ? 2 - t : t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

const TEAM_TINT = ['#6fa8ff', '#ff8a5c'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = new Camera();
    this.particles = new Particles();
    this.debug = { skeleton: false, contacts: false, balance: false, strain: false };
    this.flash = 0;
    this.marks = [];   // ground scuffs and blood pools
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.dpr = dpr;
  }

  /** Translate simulation events into things you can see and feel. */
  consume(events, arena) {
    for (const e of events) {
      if (e.type === 'hit' || e.type === 'graze') {
        const heavy = e.dmg > 8;
        this.particles.spawn(e.x, e.y, heavy ? 16 : 5, {
          angle: Math.atan2(e.ny, e.nx) + Math.PI,
          spread: 2.2,
          speed: 1.6 + e.dmg * 0.22,
          life: 0.55, r: 0.022, color: e.bite ? '#c8202a' : '#d8413f',
        });
        if (heavy) {
          this.particles.spawn(e.x, e.y, 10, {
            angle: Math.PI / 2, spread: Math.PI, speed: 1.2,
            life: 0.9, r: 0.03, color: '#8f1418',
          });
          this.camera.shake = Math.min(1, this.camera.shake + e.dmg * 0.022);
          this.flash = Math.min(0.5, this.flash + e.dmg * 0.012);
          this.marks.push({ x: e.x, y: 0.005, r: 0.05 + e.dmg * 0.01, a: 0.5, c: '#5c0f12' });
        }
      } else if (e.type === 'thud') {
        this.particles.spawn(e.x, e.y, 7, {
          angle: Math.PI / 2, spread: 2.4, speed: 0.9 + e.dmg * 0.1,
          life: 0.8, r: 0.05, color: '#6d6152', grav: 0.12, kind: 'dust',
        });
        this.camera.shake = Math.min(0.7, this.camera.shake + e.dmg * 0.01);
      }
    }
    if (this.marks.length > 90) this.marks.splice(0, this.marks.length - 90);
  }

  draw(arena, dt) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    this.particles.update(dt);
    this.camera.frame(arena.bounds(), w, h, dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSky(ctx, w, h);
    this.camera.apply(ctx, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawGround(ctx, arena);
    for (const u of arena.units) this.drawShadow(ctx, u);
    for (const u of arena.units) this.drawUnit(ctx, u, arena);
    this.particles.draw(ctx);
    if (this.debug.skeleton) this.drawSkeleton(ctx, arena);
    if (this.debug.contacts) this.drawContacts(ctx, arena);
    if (this.debug.balance) this.drawBalance(ctx, arena);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(255,235,220,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }
    this.drawVignette(ctx, w, h);
  }

  drawSky(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, SKY_TOP);
    g.addColorStop(0.62, SKY_BOT);
    g.addColorStop(1, '#3b4152');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawGround(ctx, arena) {
    const c = this.camera;
    const half = (this.canvas.width / c.zoom) / 2 + 2;
    const x0 = c.x - half, x1 = c.x + half;

    // Distant ridge, parallaxed.
    ctx.save();
    ctx.fillStyle = '#242b39';
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let x = x0; x <= x1; x += 0.5) {
      const p = x * 0.25;
      ctx.lineTo(x, 1.6 + Math.sin(p) * 0.6 + Math.sin(p * 2.3 + 1) * 0.3);
    }
    ctx.lineTo(x1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const g = ctx.createLinearGradient(0, 0, 0, -3);
    g.addColorStop(0, '#4a4234');
    g.addColorStop(1, '#241f18');
    ctx.fillStyle = g;
    ctx.fillRect(x0, -4, x1 - x0, 4);

    ctx.strokeStyle = '#6b5f49';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(x0, 0); ctx.lineTo(x1, 0);
    ctx.stroke();

    for (const m of this.marks) {
      ctx.globalAlpha = m.a;
      ctx.fillStyle = m.c;
      ctx.beginPath();
      ctx.ellipse(m.x, 0.004, m.r, m.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Metre ticks: a quiet reminder that this is a metres-and-newtons world.
    ctx.strokeStyle = 'rgba(140,130,110,0.25)';
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    for (let x = Math.ceil(x0); x <= x1; x++) {
      ctx.moveTo(x, 0); ctx.lineTo(x, -0.12);
    }
    ctx.stroke();
  }

  drawShadow(ctx, u) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const b of u.list) {
      const hgt = clamp(b.pos.y, 0, 2.4);
      const a = 0.34 * (1 - hgt / 2.6);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const spread = 1 + hgt * 0.5;
      ctx.beginPath();
      ctx.ellipse(b.pos.x, 0.006, (b.halfLen + b.radius) * spread, b.radius * 0.5 * spread, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawUnit(ctx, u, arena) {
    const pal = u.color || u.spec.palette;
    const parts = [...u.list].sort((a, b) => a.depth - b.depth);
    const dead = !u.alive;
    const fade = dead ? clamp(1 - (arena.world.time - u.deathTime) * 0.06, 0.55, 1) : 1;

    for (const b of parts) {
      const far = b.depth < 0;
      ctx.globalAlpha = fade;
      const base = far ? pal.skinDark : pal.skin;
      const cloth = far ? pal.clothDark : pal.cloth;
      const isCloth = /pelvis|chest/.test(b.part) && u.spec.id === 'human';
      this.capsule(ctx, b, isCloth ? cloth : base, far);
      if (u.spec.id === 'chimp' && !/head|hand|foot/.test(b.part)) this.fur(ctx, b, far);
      if (b.part === 'head') this.face(ctx, u, b, fade);
    }

    // Team ribbon so you can tell sides apart in a pile.
    const chest = u.chest;
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = TEAM_TINT[u.team % 2];
    ctx.lineWidth = 0.035;
    const [p, q] = chest.endpoints();
    ctx.beginPath();
    ctx.moveTo(mix(p.x, q.x, 0.25), mix(p.y, q.y, 0.25));
    ctx.lineTo(mix(p.x, q.x, 0.75), mix(p.y, q.y, 0.75));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  capsule(ctx, b, color, far) {
    const [p, q] = b.endpoints();
    // A whisper of lateral offset per depth layer. In a strict side view the
    // left and right limbs sit exactly on top of each other; nudging them
    // apart is the difference between a figure and a paper doll.
    const o = b.depth * 0.016;
    p.x += o; q.x += o;
    ctx.strokeStyle = color;
    ctx.lineWidth = b.radius * 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    ctx.stroke();
    // Rim light along the top edge.
    if (!far) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.radius * 0.5;
      const n = { x: -(q.y - p.y), y: q.x - p.x };
      const l = Math.hypot(n.x, n.y) || 1;
      const ox = (n.x / l) * b.radius * 0.6, oy = (n.y / l) * b.radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x + ox, p.y + oy); ctx.lineTo(q.x + ox, q.y + oy);
      ctx.stroke();
      ctx.restore();
    }
  }

  fur(ctx, b, far) {
    const [p, q] = b.endpoints();
    ctx.save();
    ctx.globalAlpha = far ? 0.25 : 0.4;
    ctx.strokeStyle = far ? '#0b0908' : '#171310';
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    const n = Math.max(2, Math.round((b.halfLen * 2) / 0.05));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = mix(p.x, q.x, t), y = mix(p.y, q.y, t);
      const dx = -(q.y - p.y), dy = q.x - p.x;
      const l = Math.hypot(dx, dy) || 1;
      const s = (i % 2 ? 1 : -1) * b.radius * 0.95;
      ctx.moveTo(x + (dx / l) * s * 0.5, y + (dy / l) * s * 0.5);
      ctx.lineTo(x + (dx / l) * s * 1.25 + 0.02, y + (dy / l) * s * 1.25 + 0.03);
    }
    ctx.stroke();
    ctx.restore();
  }

  face(ctx, u, head, fade) {
    const chimp = u.spec.id === 'chimp';
    const a = head.angle;
    const f = u.facing;
    const fwd = { x: Math.cos(a - Math.PI / 2) * f, y: Math.sin(a - Math.PI / 2) * f };
    const up = { x: Math.cos(a), y: Math.sin(a) };
    const cx = head.pos.x + head.depth * 0.016, cy = head.pos.y;
    const r = head.radius;
    ctx.save();
    ctx.globalAlpha = fade;

    if (chimp) {
      // Muzzle.
      ctx.fillStyle = '#4a3a30';
      ctx.beginPath();
      ctx.ellipse(cx + fwd.x * r * 0.62, cy + fwd.y * r * 0.62, r * 0.52, r * 0.40, a - Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      // Ears.
      ctx.fillStyle = '#3a2f28';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + up.x * r * 0.1 - fwd.x * r * 0.55 + s * 0.005, cy + up.y * r * 0.1 - fwd.y * r * 0.55, r * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Hair behind, face in front: two circles read as a head turned to the
      // side far better than any amount of detail does.
      ctx.fillStyle = u.spec.palette.hair;
      ctx.beginPath();
      ctx.arc(cx - fwd.x * r * 0.10 + up.x * r * 0.10, cy - fwd.y * r * 0.10 + up.y * r * 0.10, r * 1.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = u.spec.palette.skin;
      ctx.beginPath();
      ctx.arc(cx + fwd.x * r * 0.30, cy + fwd.y * r * 0.30, r * 0.80, 0, Math.PI * 2);
      ctx.fill();
    }

    const dead = !u.alive;
    const eyeX = cx + fwd.x * r * 0.42 + up.x * r * 0.16;
    const eyeY = cy + fwd.y * r * 0.42 + up.y * r * 0.16;
    ctx.strokeStyle = '#0b0b0d';
    ctx.lineWidth = r * 0.13;
    if (dead) {
      const s = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(eyeX - s, eyeY - s); ctx.lineTo(eyeX + s, eyeY + s);
      ctx.moveTo(eyeX - s, eyeY + s); ctx.lineTo(eyeX + s, eyeY - s);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#0b0b0d';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, r * 0.115, 0, Math.PI * 2);
      ctx.fill();
      if (u.stun > 0.4 || (u.brain && u.brain.state === 'attack')) {
        // Brow: angry when swinging, dazed when rattled.
        ctx.beginPath();
        const bx = eyeX - fwd.x * r * 0.02 + up.x * r * 0.2;
        const by = eyeY - fwd.y * r * 0.02 + up.y * r * 0.2;
        ctx.moveTo(bx - fwd.x * r * 0.22, by - fwd.y * r * 0.22);
        ctx.lineTo(bx + fwd.x * r * 0.2, by + fwd.y * r * 0.2 - r * 0.12);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- debug overlays ----------------------------------------------------

  drawSkeleton(ctx, arena) {
    ctx.lineWidth = 0.012;
    for (const u of arena.units) {
      for (const j of u.jointList) {
        const p = j.a.localToWorld(j.localA);
        const strain = this.debug.strain ? j.strain : 0;
        ctx.fillStyle = this.debug.strain
          ? `hsl(${(1 - strain) * 120}, 90%, 55%)`
          : 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.028, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      for (const b of u.list) {
        const [p, q] = b.endpoints();
        ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
  }

  drawContacts(ctx, arena) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 0.01;
    ctx.beginPath();
    for (const arb of arena.world.arbiters.values()) {
      for (const c of arb.points) {
        const s = 0.03 + Math.min(0.25, c.Pn * 0.002);
        ctx.moveTo(c.px, c.py);
        ctx.lineTo(c.px + c.nx * s, c.py + c.ny * s);
      }
    }
    ctx.stroke();
  }

  drawBalance(ctx, arena) {
    for (const u of arena.units) {
      if (!u.alive) continue;
      const com = u.com(), cv = u.comVel();
      const g = -arena.world.gravity.y;
      const cp = com.x + cv.x * Math.sqrt(Math.max(0.35, com.y) / g);
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath(); ctx.arc(com.x, com.y, 0.045, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(125,211,252,0.5)';
      ctx.lineWidth = 0.012;
      ctx.beginPath(); ctx.moveTo(com.x, com.y); ctx.lineTo(com.x, 0); ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(cp, 0.02, 0.04, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
