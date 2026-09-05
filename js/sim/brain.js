// The controller.
//
// This file never sets a position, a velocity or a rotation. Its entire
// output is muscle *targets* and torque budgets. Balance is a SIMBICON-style
// feedback law: the swing hip is aimed in world space using the centre of
// mass offset and velocity, and the stance hip is handed whatever torque is
// left over after the torso and swing leg have taken theirs. The torso is
// therefore held upright by pushing against the ground through the stance
// leg -- the only place a standing body actually has to push.
//
// The consequence is that everything degrades honestly. Stun lowers the
// torque budget, so a staggered unit balances worse. A hard enough impact
// exceeds what the hips can produce, so the unit leaves the ground and the
// controller can do nothing about it until it lands.

import { clamp, wrap, mix } from '../physics/vec2.js';
import { Grip } from '../physics/joints.js';

const DOWN = -Math.PI / 2;   // world angle of a limb hanging straight down
const UP = Math.PI / 2;      // world angle of a torso standing straight up

export class Brain {
  constructor(unit, opts = {}) {
    this.unit = unit;
    this.rng = opts.rng || Math.random;
    this.swing = this.rng() < 0.5 ? 'l' : 'r';
    this.phase = this.rng();
    this.stepTime = (globalThis.GAIT.stepT) / unit.spec.stats.agility;
    this.stepActive = false;
    this.stepStart = 0;
    this.target = null;
    this.action = null;
    this.getupPhase = 0;
    this.downTime = 0;
    this.unit.boost = 1;
    this.state = 'stand';
    this.desiredVel = 0;
    this.blink = 0;
    this.aggro = unit.spec.stats.aggression;
    this.strikeHands = new Set();
    this.biting = false;
    this.wantGrab = false;
    this.faceFlip = 0;
  }

  // ---- top level ---------------------------------------------------------

  update(dt, ctx) {
    const u = this.unit;
    if (!u.alive) { this.state = 'dead'; return; }

    u.stun = Math.max(0, u.stun - dt * 1.15);
    u.attackCooldown -= dt;
    u.gripCooldown -= dt;
    this.biting = false;
    this.strikeHands.clear();

    this.pickTarget(ctx);
    this.expireGrips(dt);

    const up = u.uprightness();
    const grounded = u.footContact('l') || u.footContact('r');
    // Hand back to the standing controller as soon as the unit is on its
    // feet and roughly upright, even in a deep crouch: that controller is a
    // far better rise-from-squat than anything the getup sequence can do.
    const headLow = u.head.pos.y < u.spec.height * 0.36 * u.scale;

    if (up < 0.45 || headLow || (!grounded && u.com().y < u.legLength * 0.5)) {
      this.state = 'down';
      this.downTime += dt;
      this.pickTarget(ctx);
      this.getup(dt);
      // A unit on the floor is not out of the fight. It crawls at whatever
      // it was going for and still swings at anything within reach, which is
      // where most of the grappling in a real brawl happens anyway.
      const tgt = this.target;
      if (tgt) {
        const dx = tgt.com().x - u.com().x;
        if (Math.abs(dx) < (u.spec.reach + tgt.spec.reach) * 0.75 * u.scale) {
          if (!this.action && u.attackCooldown <= 0) this.chooseAttack(tgt, dx);
        }
      }
      if (this.action) this.runAction(dt, ctx);
      return;
    }
    this.downTime = 0;
    u.boost = 1;
    if (u.stun > 0.75) {
      this.state = 'stagger';
      this.stagger(dt);
      this.locomote(dt, 0);
      return;
    }

    const t = this.target;
    let want = 0;
    if (t) {
      const dx = t.com().x - u.com().x;
      // Close in further on someone already on the floor: a body lying down
      // has to be stood over, not squared up to.
      const low = t.com().y < 0.55 * u.legLength;
      const gap = Math.abs(dx)
        - (u.spec.reach * u.scale + t.spec.reach * t.scale) * (low ? 0.20 : 0.46);
      const dir = Math.sign(dx) || 1;
      if (this.action) {
        this.state = 'attack';
        want = gap > 0.15 ? dir * 0.5 : 0;
      } else if (gap > 0.05) {
        this.state = 'advance';
        want = dir * clamp(0.75 + gap * 0.55, 0.5, 1.35) * u.spec.stats.agility;
      } else {
        this.state = 'engage';
        want = 0;
        if (u.attackCooldown <= 0 && grounded) this.chooseAttack(t, dx);
      }
      // Opportunistic swing even while closing: a chimp will start the smash
      // on the way in, which is how it lands on someone still walking.
      if (!this.action && u.attackCooldown <= 0 && gap < 0.45 && this.rng() < 0.04 * this.aggro) {
        this.chooseAttack(t, dx);
      }
    }

    this.desiredVel = mix(this.desiredVel, want, 1 - Math.exp(-dt * 6));
    this.locomote(dt, this.desiredVel);
    if (this.action) this.runAction(dt, ctx); else this.guard(dt);
  }

  pickTarget(ctx) {
    const u = this.unit;
    if (this.target && (!this.target.alive)) this.target = null;
    if (this.target && this.rng() > 0.02) return;
    let best = null, bestD = Infinity;
    const me = u.com();
    for (const o of ctx.units) {
      if (o === u || !o.alive || o.team === u.team) continue;
      const d = Math.abs(o.com().x - me.x) + Math.abs(o.com().y - me.y) * 0.3;
      if (d < bestD) { bestD = d; best = o; }
    }
    this.target = best;
  }

  // ---- balance and gait --------------------------------------------------

  locomote(dt, desiredVel) {
    const u = this.unit;
    const f = u.facing;
    const com = u.com(), cv = u.comVel();
    const g = -u.world.gravity.y;
    const W = u.mass * g;
    const v = cv.x * f;
    const h = Math.max(0.35, com.y);

    const lc = u.footContact('l'), rc = u.footContact('r');
    const stance = [];
    if (lc) stance.push('l');
    if (rc) stance.push('r');

    const anklePos = (s) => {
      const j = u.joints[`ankle.${s}`];
      return j.a.localToWorld(j.anchorLocal);
    };
    const hipPos = (s) => {
      const j = u.joints[`hip.${s}`];
      return j.a.localToWorld(j.anchorLocal);
    };
    const localX = (x) => (x - com.x) * f;

    const T = globalThis.GAIT;
    const vd = desiredVel * f;
    // Travel is produced by moving the point the body balances over, not by
    // pushing the body along. Bias that setpoint forward and the unit starts
    // falling forward; the step reflex below catches it, one step at a time.
    // Walking is controlled falling, so that is exactly how it is built.
    const dTarget = clamp(vd * T.dK, -0.36, 0.36);

    let sx = 0;
    for (const s of stance) sx += anklePos(s).x;
    sx = stance.length ? sx / stance.length : com.x;
    const cp = (com.x - sx) * f - dTarget + v * Math.sqrt(h / g);

    if (stance.length === 0) { this.stepActive = false; this.airPose(); return; }

    // --- step lifecycle -----------------------------------------------
    if (!this.stepActive && Math.abs(cp) > T.stepTrig) {
      this.stepActive = true;
      this.phase = 0;
      this.swingLifted = false;
      // Swing whichever leg is trailing the fall; the other one is load bearing.
      const lx = localX(anklePos('l').x), rx = localX(anklePos('r').x);
      this.swing = (cp > 0) === (lx < rx) ? 'l' : 'r';
      // Never hand the swing role to the only leg holding the body up.
      if (stance.length === 1 && stance[0] === this.swing) {
        this.swing = this.swing === 'l' ? 'r' : 'l';
      }
      this.stepStart = localX(anklePos(this.swing).x);
    }
    if (this.stepActive) {
      this.phase += dt / this.stepTime;
      const swc = this.swing === 'l' ? lc : rc;
      if (!swc) this.swingLifted = true;
      if ((this.swingLifted && swc && this.phase > 0.3) || this.phase > 1.7) {
        this.stepActive = false;
        this.phase = 0;
      }
    }

    const lean = clamp((vd - v) * T.leanK + vd * T.leanV, -0.16, 0.42);
    this.lean = lean;
    u.setWorldAngle('spine', UP - lean * f, 0.85, 1);
    u.setWorldAngle('neck', UP - lean * 0.45 * f, 0.9, 1);
    const tauSpine = u.joints.spine.computeTorque();

    const wP = 8.5;
    const Ip = u.upperInertia;
    const hipPeak = u.joints['hip.l'].peakTorque;
    const tauRoot = clamp(
      Ip * wP * wP * wrap(UP - lean * f - u.root.angle) - 2 * wP * Ip * u.root.angVel,
      -hipPeak * 1.8, hipPeak * 1.8,
    );

    // The ankle keeps a standing body up, and the torque it needs scales with
    // body weight -- an inertia-derived PD gain on a foot is off by two orders
    // of magnitude. The proportional term also has to beat gravity's own gain
    // of exactly 1, or the equilibrium sits outside the foot and the unit
    // topples no matter how hard it pushes.
    const ankleTorque = (s, share) => {
      const d = (com.x - anklePos(s).x) * f - dTarget;
      return -W * (T.ankKp * d + T.ankKv * v) * share * f;
    };

    const holdStance = (s, share) => {
      // Drive the knee into its own extension limit and let that hard
      // constraint carry the load, the way a standing leg stacks on bone.
      // A muscle stiff enough to do the same job pumps the body upwards.
      u.setFlex(`knee.${s}`, -0.05, 6, 1);
      u.setTorque(`ankle.${s}`, ankleTorque(s, share), 0.9);
      u.setTorque(`hip.${s}`, (-tauRoot - tauSpine) * share, 1);
    };

    if (!this.stepActive) {
      const share = 1 / stance.length;
      for (const s of stance) holdStance(s, share);
      for (const s of ['l', 'r']) {
        if (stance.includes(s)) continue;
        u.setWorldAngle(`hip.${s}`, DOWN + 0.12 * f, 1.1, 0.8);
        u.setFlex(`knee.${s}`, 0.35, 1.5, 0.7);
        u.setFlex(`ankle.${s}`, 0.15, 2.0, 0.6);
      }
      return;
    }

    // --- swing leg: place the foot where the body can be caught ---------
    const sw = this.swing;
    const st = sw === 'l' ? 'r' : 'l';
    const ph = clamp(this.phase, 0, 1);
    const L = u.legLength;

    // Foot placement doubles as speed control: land it further forward to
    // slow down, further back to speed up. Same law, no separate throttle.
    const land = clamp(
      v * Math.sqrt(h / g) * T.capK - dTarget + (v - vd) * T.vK,
      -T.landBack * L, 0.80 * L,
    );
    const ease = ph * ph * (3 - 2 * ph);
    const targetLocalX = mix(this.stepStart, land, ease);
    const lift = T.liftK * L * Math.sin(Math.PI * ph);

    const flat = (side) => -wrap(u.bodies[`shin.${side}`].angle + Math.PI / 2) * f;
    this.aimFoot(sw, { x: com.x + targetLocalX * f, y: lift }, 1.5, 1);
    u.setFlex(`ankle.${sw}`, flat(sw) + mix(0.26, 0.02, ph), 2.5, 0.6);

    // --- stance leg -----------------------------------------------------
    const grounded = stance.includes(st);
    if (grounded) {
      u.setFlex(`knee.${st}`, -0.05, 6, 1);
      u.setTorque(`ankle.${st}`, ankleTorque(st, 1), 0.9);
      const tauSwing = u.joints[`hip.${sw}`].computeTorque();
      u.setTorque(`hip.${st}`, -tauRoot - tauSpine - tauSwing, 1);
    } else {
      u.setWorldAngle(`hip.${st}`, DOWN + 0.1 * f, 1.2, 0.9);
      u.setFlex(`knee.${st}`, 0.25, 2.0, 0.8);
      u.setFlex(`ankle.${st}`, 0.1, 2.0, 0.6);
    }
  }

  /**
   * Two-link IK: drive one leg so its sole reaches a world point. The joints
   * are still only being *asked* -- if the foot is already planted, the same
   * torques push the body over the foot instead, which is precisely what
   * standing up from the floor is.
   */
  aimFoot(side, target, gain = 1.4, frac = 1) {
    const u = this.unit, f = u.facing;
    const j = u.joints[`hip.${side}`];
    const hip = j.a.localToWorld(j.anchorLocal);
    let dx = target.x - hip.x, dy = target.y - hip.y;
    const L1 = u.legL1, L2 = u.legL2;
    let r = Math.hypot(dx, dy);
    // Never fully straighten: a locked knee lands like a pogo stick.
    const rMin = Math.abs(L1 - L2) + 0.03, rMax = (L1 + L2) * 0.965;
    if (r > rMax) { const k = rMax / r; dx *= k; dy *= k; r = rMax; }
    if (r < rMin) { const k = rMin / Math.max(r, 1e-6); dx *= k; dy *= k; r = rMin; }
    const beta = Math.atan2(dy, dx);
    const alpha = Math.acos(clamp((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r), -1, 1));
    let thigh = beta + alpha * f;        // knee bends the way a knee bends
    // Keep the aim inside what the hip can actually reach. Asking for an
    // angle past the joint limit just pins the muscle at full torque doing
    // nothing, which is how a unit ends up welded to the floor.
    {
      const ref = j.refAngle + j.a.angle;
      const lo = ref + j.lower, hi = ref + j.upper;
      const off = wrap(thigh - (lo + hi) / 2);
      const half = (hi - lo) / 2;
      thigh = (lo + hi) / 2 + clamp(off, -half + 0.05, half - 0.05);
    }
    const kx = hip.x + Math.cos(thigh) * L1, ky = hip.y + Math.sin(thigh) * L1;
    const shin = Math.atan2(hip.y + dy - ky, hip.x + dx - kx);
    u.setWorldAngle(`hip.${side}`, thigh, gain, frac);
    u.setJointAngle(`knee.${side}`, wrap(shin - thigh), gain * 1.1, frac);
    return { thigh, shin };
  }

  /** No ground to push against: tuck for the landing and stop flailing. */
  airPose() {
    const u = this.unit;
    const f = u.facing;
    u.setWorldAngle('spine', UP, 0.8, 1);
    for (const s of ['l', 'r']) {
      u.setWorldAngle(`hip.${s}`, DOWN + 0.25 * f, 1.0, 0.8);
      u.setFlex(`knee.${s}`, 0.55, 1.2, 0.7);
      u.setFlex(`ankle.${s}`, 0.20, 2.0, 0.5);
    }
  }

  // ---- postures ----------------------------------------------------------

  guard(dt) {
    const u = this.unit;
    const chimp = u.spec.id === 'chimp';
    if (chimp) {
      // Hunched, arms low and forward: ready to lunge or grab.
      for (const s of ['l', 'r']) {
        u.setFlex(`shoulder.${s}`, 0.55 + Math.sin(this.unit.world.time * 2 + (s === 'l' ? 0 : 1.7)) * 0.10, 0.7, 0.55);
        u.setFlex(`elbow.${s}`, 1.05, 0.7, 0.55);
        u.setFlex(`wrist.${s}`, 0.15, 0.6, 0.5);
      }
    } else {
      for (const s of ['l', 'r']) {
        u.setFlex(`shoulder.${s}`, 0.55, 0.9, 0.6);
        u.setFlex(`elbow.${s}`, 1.95, 0.9, 0.6);
        u.setFlex(`wrist.${s}`, 0.2, 0.6, 0.5);
      }
    }
  }

  stagger(dt) {
    const u = this.unit;
    const t = u.world.time * 9;
    for (const s of ['l', 'r']) {
      const k = s === 'l' ? 1 : -1;
      u.setFlex(`shoulder.${s}`, 1.4 + Math.sin(t * 1.3 + k) * 1.0, 0.5, 0.45);
      u.setFlex(`elbow.${s}`, 0.9 + Math.sin(t + k * 2) * 0.7, 0.4, 0.35);
    }
    u.setFlex('spine', -0.15 + Math.sin(t * 0.7) * 0.25, 0.5, 0.5);
  }

  /**
   * Push the pelvis towards a world orientation through whichever feet are on
   * the ground. Same trick the standing controller uses: a torso is held up
   * by pushing on the floor, so the torque has to be delivered by a leg.
   */
  pelvisDrive(targetAngle) {
    const u = this.unit;
    // Prefer pushing through a planted foot, but a knee on the ground works
    // just as well -- and on all fours it is the only thing available.
    let feet = ['l', 'r'].filter((s) => u.footContact(s));
    if (!feet.length) {
      feet = ['l', 'r'].filter((s) => u.bodies[`shin.${s}`].contactImpulse > 0);
    }
    if (!feet.length) feet = ['l', 'r'];
    const Ip = u.upperInertia, wP = 8.5;
    const peak = u.joints['hip.l'].peakTorque;
    const tauRoot = clamp(
      Ip * wP * wP * wrap(targetAngle - u.root.angle) - 2 * wP * Ip * u.root.angVel,
      -peak * 1.8, peak * 1.8,
    );
    const tauSpine = u.joints.spine.computeTorque();
    for (const s of feet) u.setTorque(`hip.${s}`, (-tauRoot - tauSpine) / feet.length, 1);
  }

  /**
   * Getting up.
   *
   * The obvious version -- reach both feet to the floor and push -- fails
   * from flat on your back: the hip cannot bend that far, the target sits
   * past the joint limit, and the muscle saturates doing nothing. Sitting up
   * first fails differently, and more insidiously; the unit ends up parked in
   * a seated crouch with its hip already at maximum flexion and no
   * quasi-static path left that gets the centre of mass over its feet.
   *
   * So the route is through all fours -- the one shape reachable from prone
   * AND from seated, and the only one a body can actually push up out of.
   * Hands planted, knees tucked, torso horizontal, then bring a foot under
   * and stand. Every stage is chosen by what the body is doing right now, not
   * by an animation clock, so a chimp landing on you mid-sequence knocks you
   * back a stage. It fails plenty. That is not a bug in the controller; it is
   * what a torque budget feels like from the inside.
   */
  getup(dt) {
    const u = this.unit;
    u.boost = this.getupStrength;
    const f = u.facing;
    const com = u.com();
    const upright = u.uprightness();
    this.getupPhase += dt;

    const hipPos = u.joints['hip.l'].a.localToWorld(u.joints['hip.l'].anchorLocal);
    const handY = Math.min(u.bodies['hand.l'].pos.y, u.bodies['hand.r'].pos.y);
    const onAllFours = hipPos.y > u.legLength * 0.40
                    && handY < 0.30 * u.scale
                    && Math.abs(com.x - hipPos.x) < 0.5 * u.scale;

    u.setWorldAngle('neck', UP - 0.8 * f, 1.2, 1);

    if (upright < 0.30 && handY > 0.30 * u.scale) {
      // --- sit up ----------------------------------------------------------
      // Flat on your back you cannot reach all fours in one move. Legs
      // straight out along the floor, then crunch the torso up against them.
      // Tucking the knees first feels more natural and is exactly wrong: with
      // nothing anchoring the pelvis the body pikes the other way -- legs in
      // the air, chest still on the ground -- and folds itself in half
      // forever.
      this.stage = 'situp';
      const beat = Math.sin(this.getupPhase * 5.5) * 0.12;
      u.setWorldAngle('spine', UP - 0.25 * f, 2.6, 1);
      for (const s of ['l', 'r']) {
        const jitter = (s === 'l' ? beat : -beat);
        u.setFlex(`hip.${s}`, 0.05 + jitter, 2.4, 1);
        u.setFlex(`knee.${s}`, 0.10 + jitter, 2.4, 1);
        u.setFlex(`ankle.${s}`, 0.20, 1.8, 1);
        u.setFlex(`shoulder.${s}`, -1.20, 2.2, 1);
        u.setFlex(`elbow.${s}`, 0.30, 2.2, 1);
        u.setFlex(`wrist.${s}`, 0.10, 1.2, 1);
      }
      return;
    }

    if (!onAllFours) {
      this.stage = 'quad';
      // Torso horizontal, arms straight down in front, knees under the hips.
      u.setWorldAngle('spine', UP - 1.15 * f, 2.6, 1);
      for (const s of ['l', 'r']) {
        u.setFlex(`hip.${s}`, 1.80, 2.6, 1);
        u.setFlex(`knee.${s}`, 2.20, 2.6, 1);
        u.setFlex(`ankle.${s}`, -0.50, 2.2, 1);
        // Aim the upper arms straight down in world space: whatever the
        // torso happens to be doing, "put your hands on the floor" is a
        // world-frame instruction.
        u.setWorldAngle(`shoulder.${s}`, DOWN + 0.30 * f, 2.6, 1);
        u.setFlex(`elbow.${s}`, 0.08, 2.6, 1);
        u.setFlex(`wrist.${s}`, 0.0, 1.4, 1);
      }
      // Crawl: alternate limbs and drag along the floor towards the target.
      if (this.target) {
        const dir = Math.sign(this.target.com().x - com.x) || 1;
        const ph = this.getupPhase * 5.0;
        for (const s of ['l', 'r']) {
          const k = s === 'l' ? 1 : -1;
          u.setWorldAngle(`shoulder.${s}`, DOWN + Math.sin(ph + (k > 0 ? 0 : Math.PI)) * 0.55 * dir, 2.4, 1);
          u.setWorldAngle(`hip.${s}`, DOWN + Math.sin(ph + (k > 0 ? Math.PI : 0)) * 0.45 * dir, 2.4, 1);
        }
      }
      this.pelvisDrive(UP - 1.15 * f);
      return;
    }

    this.stage = 'rise';
    const lead = this.swing;
    const trail = lead === 'l' ? 'r' : 'l';
    this.aimFoot(lead, { x: com.x + 0.10 * f, y: 0.02 }, 2.4, 1);
    u.setFlex(`ankle.${lead}`, 0.12, 2.2, 1);
    u.setFlex(`hip.${trail}`, 1.10, 2.4, 1);
    u.setFlex(`knee.${trail}`, 1.65, 2.4, 1);
    u.setFlex(`ankle.${trail}`, -0.30, 2.0, 1);
    for (const s of ['l', 'r']) {
      u.setFlex(`shoulder.${s}`, 1.05, 2.2, 1);
      u.setFlex(`elbow.${s}`, 0.15, 2.2, 1);
    }
    u.setWorldAngle('spine', UP - 0.60 * f, 2.4, 1);
    this.pelvisDrive(UP - 0.45 * f);
  }

  // ---- attacks -----------------------------------------------------------

  chooseAttack(target, dx) {
    const u = this.unit;
    const r = this.rng();
    const chimp = u.spec.id === 'chimp';
    // Something already on the floor needs a downward answer. Swinging at
    // head height over a prone body is how a fight stalls out at forty
    // seconds with both sides still alive.
    const low = target.com().y < 0.55 * u.legLength;
    let type;
    if (low && u.footContact('l') | u.footContact('r')) {
      type = chimp ? (r < 0.6 ? 'smash' : 'bite') : (r < 0.6 ? 'stomp' : 'shove');
      const side = this.rng() < 0.5 ? 'l' : 'r';
      const dur = type === 'stomp' ? 0.62 : type === 'smash' ? 0.66 : type === 'bite' ? 0.5 : 0.5;
      this.action = { type, side, t: 0, dur, fired: false, low: true };
      u.attackCooldown = dur + 0.18 + this.rng() * 0.4 / this.aggro;
      return;
    }
    if (chimp) {
      const grabbing = u.grips.length > 0;
      if (grabbing) type = 'throw';
      else if (r < 0.30 && u.gripCooldown <= 0) type = 'grab';
      else if (r < 0.58) type = 'smash';
      else if (r < 0.82) type = 'bite';
      else type = 'hook';
    } else {
      if (r < 0.40) type = 'hook';
      else if (r < 0.68) type = 'jab';
      else if (r < 0.88) type = 'kick';
      else type = 'shove';
    }
    const side = this.rng() < 0.5 ? 'l' : 'r';
    const dur = { hook: 0.62, jab: 0.34, kick: 0.72, shove: 0.5,
                  smash: 0.66, bite: 0.5, grab: 0.7, throw: 0.55 }[type];
    this.action = { type, side, t: 0, dur, fired: false };
    u.attackCooldown = dur + 0.25 + this.rng() * 0.55 / this.aggro;
  }

  runAction(dt, ctx) {
    const a = this.action;
    const u = this.unit;
    a.t += dt;
    const p = clamp(a.t / a.dur, 0, 1);
    const s = a.side, o = s === 'l' ? 'r' : 'l';

    switch (a.type) {
      case 'hook': {
        if (p < 0.32) {                       // load
          u.setFlex(`shoulder.${s}`, -1.15, 1.4, 0.8);
          u.setFlex(`elbow.${s}`, 1.5, 1.2, 0.7);
          u.setFlex('spine', -0.22, 1.2, 1);
        } else if (p < 0.62) {                // drive
          u.setFlex(`shoulder.${s}`, 1.35, 3.2, 1);
          u.setFlex(`elbow.${s}`, 0.10, 2.6, 1);
          u.setFlex(`wrist.${s}`, 0.0, 2.0, 1);
          u.setFlex('spine', 0.30, 1.8, 1);
          this.strikeHands.add(u.bodies[`hand.${s}`]);
          this.strikeHands.add(u.bodies[`forearm.${s}`]);
        } else {                              // recover
          u.setFlex(`shoulder.${s}`, 0.5, 0.9, 0.5);
          u.setFlex(`elbow.${s}`, 1.8, 0.9, 0.5);
        }
        u.setFlex(`shoulder.${o}`, 0.6, 0.9, 0.6);
        u.setFlex(`elbow.${o}`, 2.0, 0.9, 0.6);
        break;
      }
      case 'jab': {
        if (p < 0.30) {
          u.setFlex(`shoulder.${s}`, 0.35, 1.4, 0.7);
          u.setFlex(`elbow.${s}`, 2.2, 1.4, 0.7);
        } else if (p < 0.68) {
          u.setFlex(`shoulder.${s}`, 1.25, 3.0, 1);
          u.setFlex(`elbow.${s}`, 0.05, 3.0, 1);
          this.strikeHands.add(u.bodies[`hand.${s}`]);
        } else {
          u.setFlex(`shoulder.${s}`, 0.55, 1.0, 0.5);
          u.setFlex(`elbow.${s}`, 1.95, 1.0, 0.5);
        }
        break;
      }
      case 'kick': {
        if (p < 0.34) {
          u.setFlex(`hip.${s}`, 1.15, 1.6, 1);
          u.setFlex(`knee.${s}`, 1.9, 1.6, 1);
          u.setFlex('spine', -0.25, 1.2, 1);
        } else if (p < 0.66) {
          u.setFlex(`hip.${s}`, 1.55, 2.6, 1);
          u.setFlex(`knee.${s}`, 0.06, 3.0, 1);
          u.setFlex(`ankle.${s}`, -0.4, 1.5, 1);
          this.strikeHands.add(u.bodies[`foot.${s}`]);
          this.strikeHands.add(u.bodies[`shin.${s}`]);
        } else {
          u.setFlex(`hip.${s}`, 0.2, 1.0, 0.8);
          u.setFlex(`knee.${s}`, 0.6, 1.0, 0.8);
        }
        break;
      }
      case 'stomp': {
        // Weight up, then drive the heel straight down.
        if (p < 0.36) {
          u.setFlex(`hip.${s}`, 1.45, 2.0, 1);
          u.setFlex(`knee.${s}`, 1.9, 2.0, 1);
          u.setFlex('spine', -0.15, 1.4, 1);
        } else if (p < 0.72) {
          u.setFlex(`hip.${s}`, 0.55, 3.0, 1);
          u.setFlex(`knee.${s}`, 0.05, 3.4, 1);
          u.setFlex(`ankle.${s}`, -0.5, 2.2, 1);
          u.setFlex('spine', 0.35, 1.8, 1);
          this.strikeHands.add(u.bodies[`foot.${s}`]);
          this.strikeHands.add(u.bodies[`shin.${s}`]);
        } else {
          u.setFlex(`hip.${s}`, 0.2, 1.2, 0.8);
          u.setFlex(`knee.${s}`, 0.5, 1.2, 0.8);
        }
        break;
      }
      case 'shove': {
        const k = p < 0.4 ? 0 : 1;
        for (const side of ['l', 'r']) {
          u.setFlex(`shoulder.${side}`, k ? 1.15 : 0.2, k ? 2.4 : 1.2, 1);
          u.setFlex(`elbow.${side}`, k ? 0.15 : 2.2, k ? 2.4 : 1.2, 1);
          if (k) { this.strikeHands.add(u.bodies[`hand.${side}`]); }
        }
        u.setFlex('spine', k ? 0.3 : -0.15, 1.5, 1);
        break;
      }
      case 'smash': {
        // Both arms overhead, then straight down. 250 N.m shoulders on a
        // 61 kg frame is the entire point of the matchup.
        if (p < 0.38) {
          for (const side of ['l', 'r']) {
            u.setFlex(`shoulder.${side}`, 2.95, 1.8, 1);
            u.setFlex(`elbow.${side}`, 0.7, 1.4, 1);
          }
          u.setFlex('spine', -0.35, 1.4, 1);
        } else if (p < 0.72) {
          for (const side of ['l', 'r']) {
            u.setFlex(`shoulder.${side}`, 0.55, 4.0, 1);
            u.setFlex(`elbow.${side}`, 0.05, 3.0, 1);
            u.setFlex(`wrist.${side}`, 0.0, 2.0, 1);
            this.strikeHands.add(u.bodies[`hand.${side}`]);
            this.strikeHands.add(u.bodies[`forearm.${side}`]);
          }
          u.setFlex('spine', a.low ? 0.95 : 0.55, 2.4, 1);
          u.setFlex('neck', 0.2, 1.4, 1);
          if (a.low) for (const side of ['l', 'r']) u.setFlex(`knee.${side}`, 0.85, 2.0, 1);
        } else {
          for (const side of ['l', 'r']) {
            u.setFlex(`shoulder.${side}`, 0.7, 1.0, 0.6);
            u.setFlex(`elbow.${side}`, 1.0, 1.0, 0.6);
          }
        }
        break;
      }
      case 'bite': {
        if (p < 0.35) {
          u.setFlex('neck', -0.6, 1.6, 1);
          u.setFlex('spine', -0.3, 1.4, 1);
          for (const side of ['l', 'r']) u.setFlex(`shoulder.${side}`, 1.5, 1.4, 1);
        } else if (p < 0.75) {
          u.setFlex('neck', 0.55, 3.0, 1);
          u.setFlex('spine', a.low ? 1.0 : 0.5, 2.4, 1);
          if (a.low) for (const side of ['l', 'r']) u.setFlex(`knee.${side}`, 1.0, 2.0, 1);
          for (const side of ['l', 'r']) {
            u.setFlex(`hip.${side}`, -0.3, 1.6, 1);   // lunge off the ground
            u.setFlex(`knee.${side}`, 0.05, 2.0, 1);
            u.setFlex(`ankle.${side}`, -0.6, 1.8, 1);
          }
          this.biting = true;
        } else {
          u.setFlex('neck', -0.1, 1.0, 0.7);
        }
        break;
      }
      case 'grab': {
        this.wantGrab = p > 0.25 && p < 0.85;
        for (const side of ['l', 'r']) {
          u.setFlex(`shoulder.${side}`, p < 0.25 ? 0.6 : 1.45, 2.2, 1);
          u.setFlex(`elbow.${side}`, p < 0.25 ? 1.4 : 0.25, 2.0, 1);
          u.setFlex(`wrist.${side}`, 0.3, 1.4, 1);
        }
        if (this.wantGrab) this.tryGrab(ctx);
        break;
      }
      case 'throw': {
        // Pull in hard, then whip and let go. The victim's trajectory is
        // whatever the constraint impulses actually gave it.
        if (p < 0.45) {
          for (const side of ['l', 'r']) {
            u.setFlex(`shoulder.${side}`, -0.9, 3.0, 1);
            u.setFlex(`elbow.${side}`, 2.4, 3.0, 1);
          }
          u.setFlex('spine', -0.5, 2.0, 1);
        } else if (p < 0.82) {
          for (const side of ['l', 'r']) {
            u.setFlex(`shoulder.${side}`, 2.6, 4.0, 1);
            u.setFlex(`elbow.${side}`, 0.2, 3.0, 1);
          }
          u.setFlex('spine', 0.35, 2.0, 1);
        } else if (!a.fired) {
          a.fired = true;
          u.releaseGrips();
          u.gripCooldown = 1.4;
        }
        break;
      }
    }

    if (a.t >= a.dur) this.action = null;
  }

  tryGrab(ctx) {
    const u = this.unit;
    if (u.grips.length >= 2) return;
    for (const side of ['l', 'r']) {
      const hand = u.bodies[`hand.${side}`];
      if (u.grips.some((g) => g.a === hand)) continue;
      for (const o of ctx.units) {
        if (o === u || o.team === u.team || !o.alive) continue;
        for (const b of o.list) {
          if (b.part === 'head') continue;
          const d = Math.hypot(b.pos.x - hand.pos.x, b.pos.y - hand.pos.y);
          if (d < hand.radius + b.radius + 0.10) {
            const anchor = { x: (hand.pos.x + b.pos.x) / 2, y: (hand.pos.y + b.pos.y) / 2 };
            const g = new Grip(hand, b, anchor, {
              breakForce: 2600 * u.spec.stats.strength,
              holdTime: 2.2,
            });
            u.world.addJoint(g);
            u.grips.push(g);
            return;
          }
        }
      }
    }
  }

  expireGrips(dt) {
    const u = this.unit;
    for (let i = u.grips.length - 1; i >= 0; i--) {
      const g = u.grips[i];
      g.age += dt;
      if (g.broken || g.age > g.holdTime) {
        u.world.removeJoint(g);
        u.grips.splice(i, 1);
        u.gripCooldown = 0.9;
      }
    }
  }
}
