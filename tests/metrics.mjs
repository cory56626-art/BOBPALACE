// Behaviour metrics. Every number here is something the user complained
// about, measured rather than eyeballed.
import { Arena, FIXED_DT } from '../js/sim/arena.js';

const T = (s) => Math.round(s / FIXED_DT);

/** Drop a unit at an awkward attitude and see whether it ever stands again. */
export function recovery(species, seeds = 8, secs = 12, boost = null) {
  let ok = 0, times = [], flips = 0, ticks = 0;
  for (let s = 1; s <= seeds; s++) {
    const a = new Arena({ seed: s * 7919 });
    if (boost !== null) a.config.getupStrength = boost;
    const u = a.spawn(species, 0, 0, 1);
    const ang = ((s * 2) % 5) * 1.25 + 0.5;
    for (const b of u.list) {
      const dx = b.pos.x, dy = b.pos.y - 0.9;
      const c = Math.cos(ang), sn = Math.sin(ang);
      b.pos.x = dx * c - dy * sn; b.pos.y = dx * sn + dy * c + 1.25;
      b.angle += ang;
    }
    let up = -1, last = null, hold = 0;
    for (let i = 0; i < T(secs); i++) {
      a.step(); a.drainEvents();
      const st = u.brain.stage || u.brain.state;
      if (last !== null && st !== last) flips++;
      last = st; ticks++;
      const standing = u.uprightness() > 0.72 && u.com().y > u.legLength * 0.78
        && (u.footContact('l') || u.footContact('r'));
      hold = standing ? hold + 1 : 0;
      if (up < 0 && hold > T(0.4)) up = i * FIXED_DT;
    }
    if (up > 0) { ok++; times.push(up.toFixed(1)); } else times.push('--');
  }
  return { rate: ok / seeds, times, flipsPerSec: flips / (ticks * FIXED_DT) };
}

/** Walk a unit at a target speed and see how much of the time it is upright. */
export function walk(species, vel, seeds = 4, secs = 14) {
  let upTime = 0, dist = 0, ticks = 0, flips = 0;
  for (let s = 1; s <= seeds; s++) {
    const a = new Arena({ seed: s * 104729 });
    const u = a.spawn(species, 0, 0, 1);
    u.brain.update = function (dt) {
      const up = this.unit.uprightness();
      const grounded = this.unit.footContact('l') || this.unit.footContact('r');
      if (up < 0.45 || this.unit.head.pos.y < this.unit.spec.height * 0.36
          || (!grounded && this.unit.com().y < this.unit.legLength * 0.5)) {
        this.state = 'down'; this.downTime += dt; this.getup(dt); return;
      }
      this.downTime = 0; this.unit.boost = 1;
      this.state = 'walk'; this.locomote(dt, vel); this.guard(dt);
    };
    let x0 = 0, last = null;
    for (let i = 0; i < T(secs); i++) {
      a.step(); a.drainEvents();
      if (i === T(1)) x0 = u.com().x;
      if (u.uprightness() > 0.7 && u.com().y > u.legLength * 0.78) upTime++;
      const st = u.brain.stage || u.brain.state;
      if (last !== null && st !== last) flips++;
      last = st; ticks++;
    }
    dist += u.com().x - x0;
  }
  return {
    upright: upTime / ticks,
    speed: dist / (seeds * (secs - 1)),
    flipsPerSec: flips / (ticks * FIXED_DT),
  };
}

/** A full fight: who wins, how long, and how much of it is spent on the floor. */
export function fight(a1, n1, a2, n2, seeds = 10, secs = 45) {
  const w = [0, 0, 0]; const durs = []; let down = [0, 0], ticks = 0, flips = 0;
  for (let s = 1; s <= seeds; s++) {
    const a = new Arena({ seed: s * 15485863 });
    const gap = 1.4, sp = (n) => (n - 1) * gap / 2;
    for (let i = 0; i < n1; i++) a.spawn(a1, 0, -2.4 - sp(n1) + i * gap, 1);
    for (let i = 0; i < n2; i++) a.spawn(a2, 1, 2.4 + sp(n2) - i * gap, -1);
    const last = new Map();
    for (let i = 0; i < T(secs) && !a.over; i++) {
      a.step(); a.drainEvents(); ticks++;
      for (const u of a.units) {
        if (!u.alive) continue;
        if (u.brain.state === 'down') down[u.team]++;
        const st = u.brain.stage || u.brain.state;
        if (last.has(u.id) && last.get(u.id) !== st) flips++;
        last.set(u.id, st);
      }
    }
    if (!a.over) w[2]++; else w[a.winner]++;
    durs.push(Math.round(a.elapsed));
  }
  const tot = ticks * FIXED_DT;
  return {
    left: w[0], right: w[1], draw: w[2], durs,
    downL: down[0] / ticks / n1, downR: down[1] / ticks / n2,
    flipsPerSec: flips / tot,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  console.log('== recovery from a knockdown ==');
  for (const sp of ['human', 'chimp']) {
    const r = recovery(sp);
    console.log(`  ${sp.padEnd(6)} ${pct(r.rate)}  times=[${r.times.join(' ')}]  poseChanges=${r.flipsPerSec.toFixed(1)}/s`);
  }
  console.log('== walking ==');
  for (const sp of ['human', 'chimp']) {
    for (const v of [0.8, 1.3]) {
      const r = walk(sp, v);
      console.log(`  ${sp.padEnd(6)} target ${v}  upright=${pct(r.upright)}  actual=${r.speed.toFixed(2)} m/s  poseChanges=${r.flipsPerSec.toFixed(1)}/s`);
    }
  }
  console.log('== fights ==');
  for (const [x, n, y, m] of [['human', 1, 'chimp', 1], ['human', 3, 'chimp', 1], ['human', 4, 'chimp', 4]]) {
    const r = fight(x, n, y, m);
    console.log(`  ${n}x${x} vs ${m}x${y}: L${r.left} R${r.right} draw${r.draw}  t=[${r.durs.join(',')}]  onFloor L=${pct(r.downL)} R=${pct(r.downR)}  poseChanges=${r.flipsPerSec.toFixed(1)}/s`);
  }
}
