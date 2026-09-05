// The world: broad phase, contact caching, and a sequential-impulse solver.
//
// Nothing in here knows what a chimp is. It integrates forces, resolves
// contacts and joints, and reports the impulses it applied. Everything the
// simulation calls "a punch" or "a knockout" is read back out of those
// impulses afterwards.

import { Body } from './body.js';
import { collide, SLOP } from './collide.js';

const BETA = 0.2;                 // Baumgarte position feedback
const RESTITUTION_THRESHOLD = 1.0; // m/s below which impacts do not bounce
const MAX_ARBITER_AGE = 0.5;

class Arbiter {
  constructor(a, b) {
    this.a = a; this.b = b;
    this.points = [];
    this.friction = Math.sqrt(a.friction * b.friction);
    this.restitution = Math.max(a.restitution, b.restitution);
    this.totalImpulse = 0;
    this.closingSpeed = 0;
    this.touching = false;
    this.stamp = 0;
  }

  update(fresh) {
    // Carry accumulated impulses across frames (warm starting) by matching
    // manifold feature ids. Without this, piles of limbs sink and shiver.
    for (const nc of fresh) {
      for (const oc of this.points) {
        if (oc.id === nc.id) { nc.Pn = oc.Pn; nc.Pt = oc.Pt; break; }
      }
    }
    this.points = fresh;
  }

  preStep(invDt) {
    const a = this.a, b = this.b;
    this.closingSpeed = 0;
    for (const c of this.points) {
      const rax = c.px - a.pos.x, ray = c.py - a.pos.y;
      const rbx = c.px - b.pos.x, rby = c.py - b.pos.y;
      c.rax = rax; c.ray = ray; c.rbx = rbx; c.rby = rby;

      const rnA = rax * c.ny - ray * c.nx;
      const rnB = rbx * c.ny - rby * c.nx;
      const kN = a.invMass + b.invMass + a.invInertia * rnA * rnA + b.invInertia * rnB * rnB;
      c.massN = kN > 0 ? 1 / kN : 0;

      const tx = -c.ny, ty = c.nx;
      const rtA = rax * ty - ray * tx;
      const rtB = rbx * ty - rby * tx;
      const kT = a.invMass + b.invMass + a.invInertia * rtA * rtA + b.invInertia * rtB * rtB;
      c.massT = kT > 0 ? 1 / kT : 0;

      const dvx = (b.vel.x - b.angVel * rby) - (a.vel.x - a.angVel * ray);
      const dvy = (b.vel.y + b.angVel * rbx) - (a.vel.y + a.angVel * rax);
      const vn = dvx * c.nx + dvy * c.ny;
      if (-vn > this.closingSpeed) this.closingSpeed = -vn;

      let bias = -invDt * (c.sep > 0 ? c.sep : BETA * Math.min(0, c.sep + SLOP));
      if (vn < -RESTITUTION_THRESHOLD) bias = Math.max(bias, -this.restitution * vn);
      c.bias = bias;

      // Warm start
      const px = c.Pn * c.nx + c.Pt * tx;
      const py = c.Pn * c.ny + c.Pt * ty;
      a.applyImpulse(-px, -py, rax, ray);
      b.applyImpulse(px, py, rbx, rby);
    }
  }

  solve() {
    const a = this.a, b = this.b;
    for (const c of this.points) {
      let dvx = (b.vel.x - b.angVel * c.rby) - (a.vel.x - a.angVel * c.ray);
      let dvy = (b.vel.y + b.angVel * c.rbx) - (a.vel.y + a.angVel * c.rax);

      const vn = dvx * c.nx + dvy * c.ny;
      let dPn = c.massN * (-vn + c.bias);
      const oldPn = c.Pn;
      c.Pn = Math.max(oldPn + dPn, 0);
      dPn = c.Pn - oldPn;
      a.applyImpulse(-dPn * c.nx, -dPn * c.ny, c.rax, c.ray);
      b.applyImpulse(dPn * c.nx, dPn * c.ny, c.rbx, c.rby);

      const tx = -c.ny, ty = c.nx;
      dvx = (b.vel.x - b.angVel * c.rby) - (a.vel.x - a.angVel * c.ray);
      dvy = (b.vel.y + b.angVel * c.rbx) - (a.vel.y + a.angVel * c.rax);
      const vt = dvx * tx + dvy * ty;
      let dPt = c.massT * -vt;
      const maxPt = this.friction * c.Pn;
      const oldPt = c.Pt;
      c.Pt = Math.max(-maxPt, Math.min(maxPt, oldPt + dPt));
      dPt = c.Pt - oldPt;
      a.applyImpulse(-dPt * tx, -dPt * ty, c.rax, c.ray);
      b.applyImpulse(dPt * tx, dPt * ty, c.rbx, c.rby);
    }
  }
}

export class World {
  constructor(opts = {}) {
    this.bodies = [];
    this.planes = [];
    this.joints = [];
    this.mouseJoints = [];
    this.arbiters = new Map();
    this.gravity = { x: 0, y: opts.gravity ?? -9.81 };
    this.iterations = opts.iterations ?? 10;
    this.impacts = [];
    this.time = 0;
    this.stamp = 0;
    this._scratch = [];
  }

  add(bodyOrOpts) {
    const b = bodyOrOpts instanceof Body ? bodyOrOpts : new Body(bodyOrOpts);
    if (b.type === 'plane') this.planes.push(b); else this.bodies.push(b);
    return b;
  }

  remove(b) {
    let i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    i = this.planes.indexOf(b);
    if (i >= 0) this.planes.splice(i, 1);
    for (const [k, arb] of this.arbiters) {
      if (arb.a === b || arb.b === b) this.arbiters.delete(k);
    }
    this.joints = this.joints.filter((j) => j.a !== b && j.b !== b);
    this.mouseJoints = this.mouseJoints.filter((j) => j.b !== b);
  }

  addJoint(j) { this.joints.push(j); return j; }
  removeJoint(j) {
    const i = this.joints.indexOf(j);
    if (i >= 0) this.joints.splice(i, 1);
  }

  clear() {
    this.bodies.length = 0;
    this.planes.length = 0;
    this.joints.length = 0;
    this.mouseJoints.length = 0;
    this.arbiters.clear();
    this.impacts.length = 0;
  }

  canCollide(a, b) {
    if (a.invMass === 0 && b.invMass === 0) return false;
    if (a.noCollide.has(b.id)) return false;
    return true;
  }

  /** Sweep and prune on x. Cheap, and the arena is wide and flat. */
  broadphase(pairs) {
    const list = this.bodies;
    const n = list.length;
    const boxes = new Array(n);
    for (let i = 0; i < n; i++) boxes[i] = { b: list[i], ...list[i].aabb(0.02) };
    boxes.sort((p, q) => p.minx - q.minx);

    for (let i = 0; i < n; i++) {
      const bi = boxes[i];
      for (let j = i + 1; j < n; j++) {
        const bj = boxes[j];
        if (bj.minx > bi.maxx) break;
        if (bi.miny > bj.maxy || bj.miny > bi.maxy) continue;
        if (!this.canCollide(bi.b, bj.b)) continue;
        pairs.push(bi.b.id < bj.b.id ? [bi.b, bj.b] : [bj.b, bi.b]);
      }
    }
    for (const pl of this.planes) {
      for (const b of list) {
        if (b.invMass === 0) continue;
        const box = b.aabb(0.02);
        const far = Math.min(
          box.minx * pl.normal.x + box.miny * pl.normal.y,
          box.maxx * pl.normal.x + box.miny * pl.normal.y,
          box.minx * pl.normal.x + box.maxy * pl.normal.y,
          box.maxx * pl.normal.x + box.maxy * pl.normal.y,
        );
        if (far - pl.offset < 0.05) pairs.push([pl, b]);
      }
    }
    return pairs;
  }

  narrowphase() {
    const pairs = this._scratch;
    pairs.length = 0;
    this.broadphase(pairs);
    this.stamp++;

    for (const [a, b] of pairs) {
      const key = a.id * 1048576 + b.id;
      const fresh = [];
      if (!collide(a, b, fresh)) { this.arbiters.delete(key); continue; }
      let arb = this.arbiters.get(key);
      if (!arb) { arb = new Arbiter(a, b); this.arbiters.set(key, arb); }
      arb.update(fresh);
      arb.stamp = this.stamp;
    }
    for (const [k, arb] of this.arbiters) {
      if (arb.stamp !== this.stamp) this.arbiters.delete(k);
    }
  }

  step(dt) {
    const invDt = dt > 0 ? 1 / dt : 0;
    this.impacts.length = 0;

    for (const j of this.joints) j.applyMuscle();

    for (const b of this.bodies) {
      if (b.invMass === 0) { b.force.x = 0; b.force.y = 0; b.torque = 0; continue; }
      b.vel.x += (this.gravity.x + b.force.x * b.invMass) * dt;
      b.vel.y += (this.gravity.y + b.force.y * b.invMass) * dt;
      b.angVel += b.torque * b.invInertia * dt;
      const ld = 1 / (1 + dt * b.linearDamping);
      const ad = 1 / (1 + dt * b.angularDamping);
      b.vel.x *= ld; b.vel.y *= ld; b.angVel *= ad;
      b.force.x = 0; b.force.y = 0; b.torque = 0;
      b.contactImpulse = 0;
    }

    this.narrowphase();

    for (const arb of this.arbiters.values()) { arb.preStep(invDt); arb.totalImpulse = 0; }
    for (const j of this.joints) { j.Px *= 0.75; j.Py *= 0.75; j.preStep(dt, invDt); }
    for (const mj of this.mouseJoints) mj.preStep(dt, invDt);

    for (let i = 0; i < this.iterations; i++) {
      for (const j of this.joints) j.solve();
      for (const mj of this.mouseJoints) mj.solve(dt);
      for (const arb of this.arbiters.values()) arb.solve();
    }

    for (const b of this.bodies) {
      if (b.invMass === 0) continue;
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.angle += b.angVel * dt;
    }

    for (const arb of this.arbiters.values()) {
      let sum = 0, px = 0, py = 0;
      for (const c of arb.points) { sum += c.Pn; px += c.px; py += c.py; }
      arb.totalImpulse = sum;
      if (sum > 0) {
        const n = arb.points.length;
        arb.a.contactImpulse += sum;
        arb.b.contactImpulse += sum;
        this.impacts.push({
          a: arb.a, b: arb.b,
          impulse: sum,
          closing: arb.closingSpeed,
          x: px / n, y: py / n,
          nx: arb.points[0].nx, ny: arb.points[0].ny,
        });
      }
    }

    for (const j of this.joints) j.postStep(invDt);
    this.joints = this.joints.filter((j) => !j.broken);

    this.time += dt;
  }

  /** Nearest body whose surface is within `radius` of the point. */
  queryPoint(x, y, radius = 0.05) {
    let best = null, bestD = Infinity;
    for (const b of this.bodies) {
      if (b.invMass === 0) continue;
      const [p, q] = b.endpoints();
      const dx = q.x - p.x, dy = q.y - p.y;
      const l2 = dx * dx + dy * dy;
      let t = 0;
      if (l2 > 1e-9) t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / l2));
      const cx = p.x + dx * t, cy = p.y + dy * t;
      const d = Math.hypot(x - cx, y - cy) - b.radius;
      if (d < radius && d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
}

export { Body };
