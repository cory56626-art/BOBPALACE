// Joints and muscles.
//
// The pin and the angular limits are hard constraints solved by sequential
// impulses. The *muscle* is a spring-damper on the joint angle solved
// implicitly in the same loop, with its accumulated impulse clamped to
// maxTorque * dt.
//
// That clamp is the whole design. It is a real torque ceiling, so a muscle
// can always be overpowered -- punch a unit hard enough and its muscles
// simply lose, and it goes wherever the impulse sent it. Solving the spring
// implicitly rather than as an explicit PD is what makes that ceiling usable:
// an explicit controller stiff enough to hold up a standing body pumps energy
// on every landing and pogo-sticks the ragdoll into the air.

import { wrap, clamp } from './vec2.js';

const BAUMGARTE = 0.22;
const LINEAR_SLOP = 0.002;

export class Revolute {
  /**
   * @param {Body} a parent
   * @param {Body} b child
   * @param {{x,y}} anchor world-space pivot at construction time
   */
  constructor(a, b, anchor, opts = {}) {
    this.a = a;
    this.b = b;
    this.localA = a.worldToLocal(anchor);
    this.localB = b.worldToLocal(anchor);
    this.refAngle = b.angle - a.angle;

    this.enableLimit = opts.enableLimit ?? true;
    this.lower = opts.lower ?? -Math.PI;
    this.upper = opts.upper ?? Math.PI;
    this.name = opts.name || '';

    // Muscle
    this.mode = 'off';        // 'off' | 'servo' | 'servoWorld' | 'torque'
    this.target = 0;          // radians (relative, or world for servoWorld)
    this.kp = 0;
    this.kd = 0;
    this.maxTorque = 0;
    this.cmdTorque = 0;
    this.lastTorque = 0;
    this.strain = 0;          // 0..1, how hard the muscle is saturating

    // Structural failure
    this.breakForce = opts.breakForce ?? Infinity;
    this.broken = false;
    this.enabled = true;

    this.Px = 0; this.Py = 0;
    this.Plower = 0; this.Pupper = 0;
    this.Pm = 0;
    this.muscleActive = false;

    a.noCollide.add(b.id);
    b.noCollide.add(a.id);
  }

  /** Relative angle, zero at the pose the joint was built in. */
  angle() { return wrap(this.b.angle - this.a.angle - this.refAngle); }
  angVelRel() { return this.b.angVel - this.a.angVel; }

  /**
   * The torque this muscle is delivering. For direct-torque mode that is the
   * clamped command; for the spring modes it is what the solver actually
   * applied last step. The balance controller feeds these back into the
   * stance hip, and a one-tick lag at 200 Hz is invisible.
   */
  computeTorque() {
    if (this.broken || !this.enabled) return 0;
    if (this.mode === 'torque') return clamp(this.cmdTorque, -this.maxTorque, this.maxTorque);
    if (this.mode === 'off') return 0;
    return this.lastTorque;
  }

  /** Direct-torque muscles are the only ones applied as an external torque. */
  applyMuscle() {
    if (this.broken || !this.enabled) return;
    if (this.mode !== 'torque') return;
    const t = clamp(this.cmdTorque, -this.maxTorque, this.maxTorque);
    this.lastTorque = t;
    this.strain = this.maxTorque > 0 ? Math.abs(t) / this.maxTorque : 0;
    this.b.torque += t;
    this.a.torque -= t;
  }

  preStepMuscle(dt, invDt) {
    this.muscleActive = false;
    if (this.broken || !this.enabled) return;
    if (this.mode !== 'servo' && this.mode !== 'servoWorld') { this.Pm = 0; return; }
    const a = this.a, b = this.b;
    const iA = a.invInertia, iB = b.invInertia;

    const world = this.mode === 'servoWorld';
    const C = world ? wrap(b.angle - this.target) : wrap(this.angle() - this.target);
    const kp = this.kp, kd = this.kd;
    if (kp <= 0 && kd <= 0) { this.Pm = 0; return; }

    this.gammaM = 1 / (dt * (kd + dt * kp));
    const beta = dt * kp * this.gammaM;
    this.biasM = C * beta;
    // A world-frame aim is a torque law, not a true constraint: the error is
    // measured on the child alone while the reaction still lands on the
    // parent, which is exactly how SIMBICON steers a swing leg.
    const denom = (world ? iB : iA + iB) + this.gammaM;
    this.massM = denom > 0 ? 1 / denom : 0;
    this.maxPm = this.maxTorque * dt;
    this.worldM = world;
    this.muscleActive = true;

    this.Pm = clamp(this.Pm || 0, -this.maxPm, this.maxPm);
    a.angVel -= iA * this.Pm;
    b.angVel += iB * this.Pm;
  }

  solveMuscle() {
    if (!this.muscleActive) return;
    const a = this.a, b = this.b;
    const w = this.worldM ? b.angVel : b.angVel - a.angVel;
    let imp = -this.massM * (w + this.biasM + this.gammaM * this.Pm);
    const old = this.Pm;
    this.Pm = clamp(old + imp, -this.maxPm, this.maxPm);
    imp = this.Pm - old;
    a.angVel -= a.invInertia * imp;
    b.angVel += b.invInertia * imp;
  }

  preStep(dt, invDt) {
    if (this.broken || !this.enabled) return;
    this.preStepMuscle(dt, invDt);
    const a = this.a, b = this.b;
    const ca = Math.cos(a.angle), sa = Math.sin(a.angle);
    const cb = Math.cos(b.angle), sb = Math.sin(b.angle);
    const rax = this.localA.x * ca - this.localA.y * sa;
    const ray = this.localA.x * sa + this.localA.y * ca;
    const rbx = this.localB.x * cb - this.localB.y * sb;
    const rby = this.localB.x * sb + this.localB.y * cb;
    this.rax = rax; this.ray = ray; this.rbx = rbx; this.rby = rby;

    const mA = a.invMass, mB = b.invMass, iA = a.invInertia, iB = b.invInertia;
    const k11 = mA + mB + iA * ray * ray + iB * rby * rby;
    const k12 = -iA * rax * ray - iB * rbx * rby;
    const k22 = mA + mB + iA * rax * rax + iB * rbx * rbx;
    const det = k11 * k22 - k12 * k12;
    const inv = det !== 0 ? 1 / det : 0;
    this.m11 = k22 * inv; this.m12 = -k12 * inv; this.m22 = k11 * inv;

    const pax = a.pos.x + rax, pay = a.pos.y + ray;
    const pbx = b.pos.x + rbx, pby = b.pos.y + rby;
    let cx = pbx - pax, cy = pby - pay;
    const cl = Math.hypot(cx, cy);
    if (cl > LINEAR_SLOP) {
      const k = (cl - LINEAR_SLOP) / cl;
      cx *= k; cy *= k;
    } else { cx = 0; cy = 0; }
    this.biasX = -BAUMGARTE * invDt * cx;
    this.biasY = -BAUMGARTE * invDt * cy;

    // Warm start
    a.applyImpulse(-this.Px, -this.Py, rax, ray);
    b.applyImpulse(this.Px, this.Py, rbx, rby);

    // Angular limit
    this.limitState = 0;
    if (this.enableLimit) {
      const denom = iA + iB;
      this.limitMass = denom > 0 ? 1 / denom : 0;
      const ang = this.angle();
      if (ang <= this.lower) {
        this.limitState = -1;
        this.limitBias = -BAUMGARTE * invDt * Math.min(0, ang - this.lower + 0.015);
      } else if (ang >= this.upper) {
        this.limitState = 1;
        this.limitBias = -BAUMGARTE * invDt * Math.max(0, ang - this.upper - 0.015);
      } else {
        this.Plower = 0; this.Pupper = 0;
      }
      if (this.limitState !== 0) {
        const P = this.limitState < 0 ? this.Plower : this.Pupper;
        a.angVel -= iA * P; b.angVel += iB * P;
      }
    }
  }

  solve() {
    if (this.broken || !this.enabled) return;
    const a = this.a, b = this.b;

    this.solveMuscle();

    if (this.limitState !== 0) {
      const wRel = b.angVel - a.angVel;
      if (this.limitState < 0) {
        let l = this.limitMass * (-wRel + this.limitBias);
        const old = this.Plower;
        this.Plower = Math.max(old + l, 0);
        l = this.Plower - old;
        a.angVel -= a.invInertia * l; b.angVel += b.invInertia * l;
      } else {
        let l = this.limitMass * (-wRel + this.limitBias);
        const old = this.Pupper;
        this.Pupper = Math.min(old + l, 0);
        l = this.Pupper - old;
        a.angVel -= a.invInertia * l; b.angVel += b.invInertia * l;
      }
    }

    const dvx = (b.vel.x - b.angVel * this.rby) - (a.vel.x - a.angVel * this.ray) - this.biasX;
    const dvy = (b.vel.y + b.angVel * this.rbx) - (a.vel.y + a.angVel * this.rax) - this.biasY;
    const px = -(this.m11 * dvx + this.m12 * dvy);
    const py = -(this.m12 * dvx + this.m22 * dvy);
    this.Px += px; this.Py += py;
    a.applyImpulse(-px, -py, this.rax, this.ray);
    b.applyImpulse(px, py, this.rbx, this.rby);
  }

  postStep(invDt) {
    if (this.broken) return;
    if (this.muscleActive) {
      this.lastTorque = this.Pm * invDt;
      this.strain = this.maxPm > 0 ? Math.abs(this.Pm) / this.maxPm : 0;
    }
    const f = Math.hypot(this.Px, this.Py) * invDt;
    this.reactionForce = f;
    if (f > this.breakForce) this.broken = true;
  }
}

/**
 * A grab. Structurally the same pin constraint, but with no limits, a short
 * lifetime and a low break force -- a chimp holding onto an arm, or your
 * mouse cursor holding onto a torso.
 */
export class Grip extends Revolute {
  constructor(a, b, anchor, opts = {}) {
    super(a, b, anchor, { ...opts, enableLimit: false });
    this.mode = 'off';
    this.holdTime = opts.holdTime ?? 3.0;
    this.age = 0;
    // A grip must not disable limb-vs-limb collision the way a skeletal
    // joint does, otherwise grabbed bodies sink into each other.
    a.noCollide.delete(b.id);
    b.noCollide.delete(a.id);
  }
}

/** Soft point constraint dragging a body towards a world target. */
export class MouseJoint {
  constructor(body, worldPoint, opts = {}) {
    this.b = body;
    this.local = body.worldToLocal(worldPoint);
    this.target = { x: worldPoint.x, y: worldPoint.y };
    this.maxForce = opts.maxForce ?? 4000;
    this.frequency = opts.frequency ?? 7;
    this.damping = opts.damping ?? 0.9;
    this.Px = 0; this.Py = 0;
  }

  preStep(dt, invDt) {
    const b = this.b;
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const rx = this.local.x * c - this.local.y * s;
    const ry = this.local.x * s + this.local.y * c;
    this.rx = rx; this.ry = ry;

    const m = b.mass;
    const omega = 2 * Math.PI * this.frequency;
    const d = 2 * m * this.damping * omega;
    const k = m * omega * omega;
    this.gamma = 1 / (dt * (d + dt * k));
    const beta = dt * k * this.gamma;

    const mB = b.invMass, iB = b.invInertia;
    const k11 = mB + iB * ry * ry + this.gamma;
    const k12 = -iB * rx * ry;
    const k22 = mB + iB * rx * rx + this.gamma;
    const det = k11 * k22 - k12 * k12;
    const inv = det !== 0 ? 1 / det : 0;
    this.m11 = k22 * inv; this.m12 = -k12 * inv; this.m22 = k11 * inv;

    const cx = b.pos.x + rx - this.target.x;
    const cy = b.pos.y + ry - this.target.y;
    this.biasX = cx * beta; this.biasY = cy * beta;

    b.applyImpulse(this.Px, this.Py, rx, ry);
  }

  solve(dt) {
    const b = this.b;
    const vx = b.vel.x - b.angVel * this.ry;
    const vy = b.vel.y + b.angVel * this.rx;
    const ax = vx + this.biasX + this.gamma * this.Px;
    const ay = vy + this.biasY + this.gamma * this.Py;
    let px = -(this.m11 * ax + this.m12 * ay);
    let py = -(this.m12 * ax + this.m22 * ay);

    const oldX = this.Px, oldY = this.Py;
    this.Px += px; this.Py += py;
    const maxP = dt * this.maxForce;
    const mag = Math.hypot(this.Px, this.Py);
    if (mag > maxP) { const k = maxP / mag; this.Px *= k; this.Py *= k; }
    px = this.Px - oldX; py = this.Py - oldY;
    b.applyImpulse(px, py, this.rx, this.ry);
  }
}
