// The arena owns the world, the units and the rules.
//
// There is no scripted knockback anywhere in this file. Damage is read out of
// the impulses the solver actually applied, and the flight path afterwards is
// whatever those same impulses did to the bodies. If a chimp launches someone
// across the map it is because the constraint solver moved that much momentum.

import { World } from '../physics/world.js';
import { Body } from '../physics/body.js';
import { SPECIES } from './anatomy.js';
import { Unit } from './unit.js';
import { Brain } from './brain.js';
import { clamp, makeRng } from '../physics/vec2.js';

export const FIXED_DT = 1 / 200;

// Gait constants, shared by every unit. Found by direct search against an
// objective of "stays upright and actually tracks the requested speed"; the
// controller structure is principled, these numbers are not.
export const GAIT = {
  dK: 0.13,       // how far ahead of the feet the balance point is biased, per m/s
  capK: 1.05,      // capture-point gain in foot placement
  vK: 0.20,        // speed error fed back into step length
  leanK: 0.12,     // torso lean per m/s of speed error
  leanV: 0.075,    // torso lean per m/s of target speed
  stepTrig: 0.055, // capture-point excursion that triggers a step, metres
  stepT: 0.32,     // nominal step duration, seconds
  ankKp: 1.85,     // ankle balance stiffness, multiples of body weight per metre
  ankKv: 0.55,
  liftK: 0.20,     // swing foot clearance, fraction of leg length
  landBack: 0.45,  // furthest the swing foot may land behind the COM
};
globalThis.GAIT = GAIT;

// Get-up constants. Same story as the gait table: the structure is
// principled, these numbers came out of a direct search against "does it
// actually stand back up".
export const GETUP = {
  legPull: 0.95,  // how far each leg aims from its own hip towards the COM
  armPull: 0.0,   // arms brace straight down from the shoulder
  gain: 4.0,
  sway: 0.22,     // slow scrabble amplitude, metres
  targetY: 0.02,  // aim height; below zero presses into the floor
  // Handoff between getting up and standing. Deliberately asymmetric: quick
  // to hand control to the balance controller, slow to take it back.
  upExit: 0.28,   // uprightness at which the balance controller takes over
  comExit: 0.30,  // ... and how high the COM must be, as a fraction of leg
  upEnter: 0.25,  // uprightness below which the unit counts as down
  fallDwell: 0.04,
  spineGain: 2.2,
};
globalThis.GETUP = GETUP;

// Damage is impulse scaled by how fast the two surfaces were closing, with a
// speed threshold below which nothing is injured. Thresholding on *speed*
// rather than on impulse is what separates a footfall from a faceplant: both
// carry big impulses, only one arrives fast.
const COMBAT_SCALE = 0.22;
const COMBAT_MIN_SPEED = 1.6;
const WORLD_SCALE = 0.011;
const WORLD_MIN_SPEED = 7.0;
const ATTACKER_SHARE = 0.22;   // recoil damage onto the limb doing the hitting

export class Arena {
  constructor(opts = {}) {
    this.world = new World({ gravity: opts.gravity ?? -9.81, iterations: 10 });
    this.units = [];
    this.events = [];
    this.rng = makeRng(opts.seed ?? (Date.now() & 0xffff));
    this.groundY = 0;
    this.width = opts.width ?? 26;
    this.config = {
      gravity: -9.81,
      strength: 1,
      friction: 1,
      damage: 1,
      lethal: true,
      getupStrength: 5.0,
    };
    this.elapsed = 0;
    this.over = false;
    this.winner = null;
    this.bigHit = 0;
    this.hardest = null;
    this.peakLaunch = 0;
    this.buildTerrain();
  }

  buildTerrain() {
    const w = this.world;
    this.ground = w.add(new Body({
      type: 'plane', normal: { x: 0, y: 1 }, offset: 0,
      friction: 1.0, restitution: 0.0,
    }));
    w.add(new Body({ type: 'plane', normal: { x: 1, y: 0 }, offset: -this.width, friction: 0.3 }));
    w.add(new Body({ type: 'plane', normal: { x: -1, y: 0 }, offset: -this.width, friction: 0.3 }));
    // A high ceiling so a truly enormous hit still comes back down on screen.
    w.add(new Body({ type: 'plane', normal: { x: 0, y: -1 }, offset: -22, friction: 0.1 }));
  }

  reset() {
    for (const u of this.units) u.destroy();
    this.units.length = 0;
    this.events.length = 0;
    this.world.arbiters.clear();
    this.world.time = 0;
    this.elapsed = 0;
    this.over = false;
    this.winner = null;
    this.bigHit = 0;
    this.hardest = null;
    this.peakLaunch = 0;
  }

  spawn(speciesId, team, x, facing, opts = {}) {
    const spec = SPECIES[speciesId];
    if (!spec) throw new Error(`unknown species ${speciesId}`);
    // Individual variation. Six identical humans read as a sprite sheet;
    // a few percent of height and a nudge of colour reads as a crowd.
    const vary = 0.94 + this.rng() * 0.13;
    const u = new Unit(this.world, spec, {
      x, y: 0.01, facing, team,
      scale: (opts.scale ?? 1) * vary,
      strength: (opts.strength ?? 1) * this.config.strength,
      hpMul: opts.hpMul ?? 1,
    });
    u.brain = new Brain(u, { rng: this.rng, getupStrength: this.config.getupStrength });
    u.color = opts.color || tintPalette(spec.palette, this.rng);
    u.build = vary;
    this.units.push(u);
    return u;
  }

  setGravity(g) { this.world.gravity.y = g; this.config.gravity = g; }

  /** One fixed physics tick. */
  step() {
    const dt = FIXED_DT;
    const ctx = { units: this.units, arena: this };
    for (const u of this.units) if (u.brain) u.brain.update(dt, ctx);
    this.world.step(dt);
    this.resolveDamage();
    // The headline number: how fast a whole body has been sent. Nothing
    // computes it -- it is just how quickly a ragdoll happens to be moving
    // after the solver finished with it.
    for (const u of this.units) {
      const v = u.comVel();
      const sp = Math.hypot(v.x, v.y);
      if (sp > this.peakLaunch) this.peakLaunch = sp;
    }
    this.elapsed += dt;
    this.bigHit = Math.max(0, this.bigHit - dt);
    this.checkVictory();
  }

  resolveDamage() {
    const k = this.config.damage;
    for (const im of this.world.impacts) {
      const A = im.a.owner, B = im.b.owner;
      if (im.impulse <= 0) continue;

      if (A && B && A !== B) {
        const power = im.impulse * Math.max(0, im.closing - COMBAT_MIN_SPEED);
        const raw = power * COMBAT_SCALE * k;
        if (raw <= 0) continue;
        const friendly = A.team === B.team;
        const mulFF = friendly ? 0.25 : 1;

        const aStrike = strikeMultiplier(A, im.a, B);
        const bStrike = strikeMultiplier(B, im.b, A);
        // Each side takes the hit; the limb that is committed to the strike
        // is braced and takes only a fraction back.
        const toB = raw * aStrike * mulFF * (bStrike > 1 ? ATTACKER_SHARE : 1);
        const toA = raw * bStrike * mulFF * (aStrike > 1 ? ATTACKER_SHARE : 1);
        const dB = this.config.lethal || true ? B.damage(toB, im.b.part, A) : 0;
        const dA = A.damage(toA, im.a.part, B);
        const dmg = Math.max(dA, dB);
        if (dmg > 0.6) {
          this.events.push({
            type: dmg > 7 ? 'hit' : 'graze',
            x: im.x, y: im.y, nx: im.nx, ny: im.ny,
            dmg, power, victim: dB > dA ? B : A,
            part: dB > dA ? im.b.part : im.a.part,
            bite: (aStrike > 2.4 || bStrike > 2.4),
          });
          if (dmg > 9) this.bigHit = Math.max(this.bigHit, Math.min(0.55, dmg * 0.02));
          if (!this.hardest || dmg > this.hardest.dmg) {
            const v = dB > dA ? B : A;
            this.hardest = {
              dmg, impulse: im.impulse, closing: im.closing,
              attacker: (dB > dA ? A : B).spec.name,
              victim: v.spec.name,
              part: dB > dA ? im.b.part : im.a.part,
            };
          }
        }
      } else if ((A && !B) || (B && !A)) {
        const U = A || B;
        const part = A ? im.a.part : im.b.part;
        const power = im.impulse * Math.max(0, im.closing - WORLD_MIN_SPEED);
        const raw = power * WORLD_SCALE * k;
        if (raw <= 0) continue;
        const d = U.damage(raw, part, null);
        if (d > 0.5) {
          this.events.push({ type: 'thud', x: im.x, y: im.y, nx: im.nx, ny: im.ny, dmg: d, power, victim: U, part });
        }
      }
    }
  }

  checkVictory() {
    if (this.over) return;
    const alive = new Map();
    for (const u of this.units) if (u.alive) alive.set(u.team, (alive.get(u.team) || 0) + 1);
    if (this.units.length && alive.size <= 1) {
      this.over = true;
      this.winner = alive.size === 1 ? [...alive.keys()][0] : -1;
      this.events.push({ type: 'victory', team: this.winner });
    }
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  bounds() {
    let minx = Infinity, miny = 0, maxx = -Infinity, maxy = -Infinity;
    for (const u of this.units) {
      const b = u.bounds();
      if (b.minx < minx) minx = b.minx;
      if (b.maxx > maxx) maxx = b.maxx;
      if (b.maxy > maxy) maxy = b.maxy;
    }
    if (!isFinite(minx)) return { minx: -6, maxx: 6, miny: 0, maxy: 4 };
    return { minx, maxx, miny, maxy };
  }
}

/** Nudge a palette's lightness and warmth, deterministically per unit. */
function tintPalette(pal, rng) {
  const k = (rng() - 0.5) * 2;
  const shift = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c, i) =>
      clamp(Math.round(c * (1 + amt * (i === 0 ? 1.15 : i === 1 ? 1 : 0.85))), 0, 255));
    return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  };
  const out = {};
  for (const [key, v] of Object.entries(pal)) out[key] = shift(v, k * 0.13);
  return out;
}

/**
 * How much of a hit this limb is really delivering. A limb the controller is
 * actively driving through a strike counts for more than an elbow that
 * happened to be in the way -- not extra force (the physics already has the
 * force), but the difference between a knuckle and a flat forearm.
 */
function strikeMultiplier(unit, body, victim) {
  if (!unit.alive || !unit.brain) return 1;
  const br = unit.brain;
  const sp = unit.spec.stats;
  if (br.biting && body.part === 'head') return 3.1 * sp.bite * sp.strike;
  if (br.strikeHands.has(body)) {
    const k = body.part.startsWith('hand') || body.part.startsWith('foot') ? 1.85 : 1.25;
    return k * sp.strike;
  }
  return 1;
}
