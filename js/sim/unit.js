// A Unit is one ragdoll: bodies, joints, muscles, and the bookkeeping that
// turns physics impulses into damage.
//
// Muscle gains are derived from the actual rotational inertia of the limb
// chain hanging off each joint, so a chimp's short heavy thigh and a human's
// long light forearm both end up critically damped at the frequency the
// anatomy asks for. Peak torque, by contrast, is a hard budget from the
// species table -- that is the ceiling everything else has to live under.

import { Body } from '../physics/body.js';
import { Revolute } from '../physics/joints.js';
import { clamp, wrap } from '../physics/vec2.js';

let NEXT_UNIT = 1;

export class Unit {
  constructor(world, spec, opts = {}) {
    this.world = world;
    this.spec = spec;
    this.id = NEXT_UNIT++;
    this.team = opts.team ?? 0;
    this.facing = opts.facing ?? 1;
    this.scale = opts.scale ?? 1;
    this.name = opts.name || spec.name;
    this.strengthMul = opts.strength ?? 1;

    this.bodies = {};
    this.list = [];
    this.joints = {};
    this.jointList = [];

    this.maxHp = spec.hp * (opts.hpMul ?? 1);
    this.hp = this.maxHp;
    this.alive = true;
    this.stun = 0;
    this.limpTimer = 0;
    this.deathTime = -1;
    this.lastHitBy = null;
    this.grips = [];
    this.gripCooldown = 0;
    this.attackCooldown = 0.4 + Math.random() * 0.5;
    this.brain = null;
    this.damageDealt = 0;
    // Temporary muscle boost while scrambling off the floor. It is a
    // multiplier on the joint torque *ceiling*, not an external force: a
    // boosted unit is still a ragdoll, can still be overpowered, and still
    // goes flying if something hits it hard enough. Levering a body upright
    // off the ground genuinely takes several times the torque that standing
    // does, and without it a downed unit is down forever.
    this.boost = 1;

    this._build(opts.x ?? 0, opts.y ?? 0);
  }

  _build(ox, oy) {
    const { spec, facing, scale } = this;
    const mir = facing < 0 ? -1 : 1;
    const px = (p) => ({ x: ox + p[0] * scale * mir, y: oy + p[1] * scale });

    let massSum = 0;
    for (const [name, p] of Object.entries(spec.parts)) {
      const a = px(p.a), b = px(p.b);
      const dx = b.x - a.x, dy = b.y - a.y;
      const l = Math.hypot(dx, dy);
      const body = new Body({
        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
        angle: Math.atan2(dy, dx),
        halfLen: l / 2,
        radius: p.r * scale,
        density: p.d,
        group: this.id,
        part: name,
        depth: p.depth * mir,
        friction: name.startsWith('foot') ? 1.05 : 0.62,
        restitution: 0.02,
        linearDamping: 0.02,
        angularDamping: 0.06,
      });
      body.owner = this;
      body.proximal = a; body.distal = b;
      this.bodies[name] = body;
      this.list.push(body);
      this.world.add(body);
      massSum += body.mass;
    }

    // Normalise to the species mass so proportions can be tuned freely.
    const k = (spec.mass * scale * scale) / massSum;
    for (const b of this.list) b.scaleMass(k);
    this.mass = spec.mass * scale * scale;

    // In a side view the limbs are co-planar with the torso, so self
    // collision would mostly be wrong (and would have a ragdoll wrestling
    // itself). Joint limits do the anatomy policing instead.
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        this.list[i].noCollide.add(this.list[j].id);
        this.list[j].noCollide.add(this.list[i].id);
      }
    }

    for (const js of spec.joints) {
      const parent = this.bodies[js.p], child = this.bodies[js.c];
      const anchor = px(js.at);
      const lo = mir > 0 ? js.lo : -js.hi;
      const hi = mir > 0 ? js.hi : -js.lo;
      const joint = new Revolute(parent, child, anchor, {
        lower: lo, upper: hi, enableLimit: true, name: js.n,
      });
      joint.flex = js.flex * mir;
      joint.spec = js;
      joint.peakTorque = js.tq * this.strengthMul * scale * scale * scale;
      joint.maxTorque = joint.peakTorque;
      joint.anchorLocal = parent.worldToLocal(anchor);
      joint.freq = js.w;
      this.joints[js.n] = joint;
      this.jointList.push(joint);
      this.world.addJoint(joint);
    }

    // Gains from the inertia of everything below each joint.
    const kids = {};
    for (const js of spec.joints) (kids[js.p] ||= []).push(js);
    const subtreeInertia = (partName, anchor) => {
      let I = 0;
      const walk = (n) => {
        const b = this.bodies[n];
        I += b.inertia + b.mass * ((b.pos.x - anchor.x) ** 2 + (b.pos.y - anchor.y) ** 2);
        for (const cj of kids[n] || []) walk(cj.c);
      };
      walk(partName);
      return I;
    };
    for (const js of spec.joints) {
      const j = this.joints[js.n];
      const anchor = px(js.at);
      const I = subtreeInertia(js.c, anchor);
      const w = js.w;
      j.inertiaAbout = I;
      j.baseKp = I * w * w;
      j.baseKd = 2 * 1.0 * w * I;
      j.kp = j.baseKp;
      j.kd = j.baseKd;
      j.mode = 'servo';
      j.target = 0;
    }

    // Inertia of everything ABOVE the hips, about the hip pivot. The leg
    // muscles have to move this to keep the torso up, and it is emphatically
    // not the same number as the leg-chain inertia used for the limb gains.
    {
      const hipAnchor = px(spec.joints.find((j) => j.n === 'hip.l').at);
      let I = 0;
      for (const [name, b] of Object.entries(this.bodies)) {
        if (/^(thigh|shin|foot)\./.test(name)) continue;
        I += b.inertia + b.mass * ((b.pos.x - hipAnchor.x) ** 2 + (b.pos.y - hipAnchor.y) ** 2);
      }
      this.upperInertia = I;
    }

    // Leg link lengths, for the foot-placement IK.
    {
      const hipY = spec.joints.find((j) => j.n === 'hip.l').at[1] * scale;
      const kneeY = spec.joints.find((j) => j.n === 'knee.l').at[1] * scale;
      this.legL1 = hipY - kneeY;
      this.legL2 = kneeY;
      this.legLength = hipY;
      const shY = spec.joints.find((j) => j.n === 'shoulder.l').at[1] * scale;
      const elY = spec.joints.find((j) => j.n === 'elbow.l').at[1] * scale;
      this.armL1 = shY - elY;
    }

    this.root = this.bodies.pelvis;
    this.chest = this.bodies.chest;
    this.head = this.bodies.head;
    this.feet = [this.bodies['foot.l'], this.bodies['foot.r']];
  }

  // ---- queries -----------------------------------------------------------

  com() {
    let x = 0, y = 0, m = 0;
    for (const b of this.list) { x += b.pos.x * b.mass; y += b.pos.y * b.mass; m += b.mass; }
    return { x: x / m, y: y / m };
  }

  comVel() {
    let x = 0, y = 0, m = 0;
    for (const b of this.list) { x += b.vel.x * b.mass; y += b.vel.y * b.mass; m += b.mass; }
    return { x: x / m, y: y / m };
  }

  /** How upright the torso is: 1 fully upright, 0 horizontal, -1 upside down. */
  uprightness() {
    return Math.cos(wrap(this.chest.angle - Math.PI / 2));
  }

  headHeight() { return this.head.pos.y; }

  bounds() {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const b of this.list) {
      const bb = b.aabb();
      if (bb.minx < minx) minx = bb.minx;
      if (bb.miny < miny) miny = bb.miny;
      if (bb.maxx > maxx) maxx = bb.maxx;
      if (bb.maxy > maxy) maxy = bb.maxy;
    }
    return { minx, miny, maxx, maxy };
  }

  footContact(side, groundY = 0) {
    const f = this.bodies[`foot.${side}`];
    const [p, q] = f.endpoints();
    return Math.min(p.y, q.y) - f.radius < groundY + 0.035;
  }

  vulnOf(partName) {
    const v = this.spec.vuln;
    return v[partName] ?? v[partName.split('.')[0]] ?? v.default;
  }

  // ---- state -------------------------------------------------------------

  damage(amount, partName, source = null) {
    if (!this.alive || amount <= 0) return 0;
    const dealt = amount * this.vulnOf(partName);
    this.hp -= dealt;
    this.lastHitBy = source;
    // Muscle tone collapses briefly under a heavy hit; that stagger is what
    // makes a big impact read as a big impact instead of a rigid shove.
    this.stun = Math.min(1.6, this.stun + dealt * 0.028);
    if (source) source.damageDealt += dealt;
    if (this.hp <= 0) { this.hp = 0; this.kill(); }
    return dealt;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.deathTime = this.world.time;
    this.goLimp();
  }

  goLimp() {
    for (const j of this.jointList) {
      j.mode = 'off';
      j.maxTorque = 0;
      j.kp = 0; j.kd = 0;
      // Zero the readings in the same breath, so a unit killed mid-step is
      // never briefly reported as producing torque it no longer has.
      j.Pm = 0; j.lastTorque = 0; j.strain = 0; j.muscleActive = false;
    }
    for (const b of this.list) { b.angularDamping = 0.5; b.linearDamping = 0.05; }
    this.releaseGrips();
  }

  releaseGrips() {
    for (const g of this.grips) this.world.removeJoint(g);
    this.grips.length = 0;
  }

  /**
   * The get-up boost, sanitised. A NaN reaching the joint's torque ceiling
   * does not merely misbehave, it removes the ceiling entirely -- clamping
   * against NaN bounds is a no-op -- so the one guarantee this whole
   * simulation rests on has to be defended from arithmetic, not just from
   * bad intentions.
   */
  get torqueBoost() {
    return Number.isFinite(this.boost) ? clamp(this.boost, 0, 12) : 1;
  }

  /** Fraction of full muscle authority available right now. */
  tone() {
    if (!this.alive) return 0;
    return clamp(1 - this.stun * 0.75, 0.06, 1);
  }

  destroy() {
    this.releaseGrips();
    for (const j of this.jointList) this.world.removeJoint(j);
    for (const b of this.list) this.world.remove(b);
  }

  // ---- muscle helpers used by the brain ----------------------------------

  /** Drive a joint towards a flexion amount (positive = forward / bend). */
  setFlex(name, amount, gain = 1, torqueFrac = 1) {
    const j = this.joints[name];
    if (!j || j.broken) return;
    j.mode = 'servo';
    j.target = clamp(amount * j.flex, j.lower, j.upper);
    const tone = this.tone();
    j.kp = j.baseKp * gain * tone;
    j.kd = j.baseKd * Math.sqrt(gain) * tone;
    j.maxTorque = j.peakTorque * torqueFrac * tone * this.torqueBoost;
  }

  /** Drive a limb towards an absolute world orientation. */
  setWorldAngle(name, angle, gain = 1, torqueFrac = 1) {
    const j = this.joints[name];
    if (!j || j.broken) return;
    j.mode = 'servoWorld';
    j.target = angle;
    const tone = this.tone();
    j.kp = j.baseKp * gain * tone;
    j.kd = j.baseKd * Math.sqrt(gain) * tone;
    j.maxTorque = j.peakTorque * torqueFrac * tone * this.torqueBoost;
  }

  /** Drive a joint to a raw relative angle (used by the leg IK). */
  setJointAngle(name, angle, gain = 1, torqueFrac = 1) {
    const j = this.joints[name];
    if (!j || j.broken) return;
    j.mode = 'servo';
    j.target = clamp(angle, j.lower, j.upper);
    const tone = this.tone();
    j.kp = j.baseKp * gain * tone;
    j.kd = j.baseKd * Math.sqrt(gain) * tone;
    j.maxTorque = j.peakTorque * torqueFrac * tone * this.torqueBoost;
  }

  setTorque(name, torque, torqueFrac = 1) {
    const j = this.joints[name];
    if (!j || j.broken) return;
    j.mode = 'torque';
    j.cmdTorque = torque;
    j.maxTorque = j.peakTorque * torqueFrac * this.tone();
  }

  relax(name, torqueFrac = 0.12) {
    const j = this.joints[name];
    if (!j || j.broken) return;
    j.mode = 'servo';
    j.target = clamp(0, j.lower, j.upper);
    j.kp = j.baseKp * 0.12;
    j.kd = j.baseKd * 0.35;
    j.maxTorque = j.peakTorque * torqueFrac;
  }
}
