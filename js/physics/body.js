// A rigid body. Shape is always a capsule: the segment from (-halfLen, 0) to
// (+halfLen, 0) in local space, inflated by `radius`. halfLen === 0 gives a
// disc, which is how heads and hands are modelled.

let NEXT_ID = 1;

export class Body {
  constructor(opts = {}) {
    this.id = NEXT_ID++;
    this.type = opts.type || 'capsule';   // 'capsule' | 'plane'

    this.pos = { x: opts.x || 0, y: opts.y || 0 };
    this.angle = opts.angle || 0;
    this.vel = { x: 0, y: 0 };
    this.angVel = 0;
    this.force = { x: 0, y: 0 };
    this.torque = 0;

    this.halfLen = opts.halfLen || 0;
    this.radius = opts.radius ?? 0.1;

    // Half-plane parameters: the free side satisfies dot(p, normal) >= offset.
    this.normal = opts.normal || { x: 0, y: 1 };
    this.offset = opts.offset || 0;

    this.friction = opts.friction ?? 0.72;
    this.restitution = opts.restitution ?? 0.03;
    this.linearDamping = opts.linearDamping ?? 0.015;
    this.angularDamping = opts.angularDamping ?? 0.04;

    this.group = opts.group ?? 0;          // ragdoll id; 0 means world geometry
    this.noCollide = new Set();            // body ids this one ignores
    this.owner = null;                     // back-pointer to the Unit
    this.part = opts.part || '';           // 'head', 'shin.l', ...
    this.depth = opts.depth ?? 0;          // draw order / fake Z (-1 far, +1 near)
    this.tag = opts.tag || null;

    this.isStatic = !!opts.isStatic || this.type === 'plane';
    this.setDensity(opts.density ?? 1000);
    if (this.isStatic) this.freeze();

    // Set by the solver each step, used for damage + effects.
    this.contactImpulse = 0;
    this.awakeTimer = 1;
  }

  setDensity(d) {
    this.density = d;
    if (this.type === 'plane') { this.mass = Infinity; this.inertia = Infinity; return; }
    const hl = this.halfLen, r = this.radius;
    const mRect = 2 * hl * 2 * r * d;                // central box
    const mCaps = Math.PI * r * r * d;               // two half discs = one disc
    this.mass = mRect + mCaps;
    const iRect = mRect * ((2 * hl) ** 2 + (2 * r) ** 2) / 12;
    const iCaps = mCaps * (0.5 * r * r + hl * hl);   // parallel axis at +/-hl
    this.inertia = iRect + iCaps;
    this.invMass = 1 / this.mass;
    this.invInertia = 1 / this.inertia;
  }

  /** Rescale mass without touching geometry (used to hit a target body mass). */
  scaleMass(k) { this.setDensity(this.density * k); }

  freeze() {
    this.isStatic = true;
    this.invMass = 0; this.invInertia = 0;
    this.vel.x = 0; this.vel.y = 0; this.angVel = 0;
  }

  endpoints() {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const dx = c * this.halfLen, dy = s * this.halfLen;
    return [
      { x: this.pos.x - dx, y: this.pos.y - dy },
      { x: this.pos.x + dx, y: this.pos.y + dy },
    ];
  }

  localToWorld(p) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return { x: this.pos.x + p.x * c - p.y * s, y: this.pos.y + p.x * s + p.y * c };
  }

  worldToLocal(p) {
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    const dx = p.x - this.pos.x, dy = p.y - this.pos.y;
    return { x: dx * c + dy * s, y: -dx * s + dy * c };
  }

  /** Velocity of the world-space point at offset (rx, ry) from the centre. */
  pointVel(rx, ry) {
    return { x: this.vel.x - this.angVel * ry, y: this.vel.y + this.angVel * rx };
  }

  applyImpulse(px, py, rx = 0, ry = 0) {
    this.vel.x += px * this.invMass;
    this.vel.y += py * this.invMass;
    this.angVel += (rx * py - ry * px) * this.invInertia;
  }

  applyForce(fx, fy, rx = 0, ry = 0) {
    this.force.x += fx; this.force.y += fy;
    this.torque += rx * fy - ry * fx;
  }

  applyTorque(t) { this.torque += t; }

  aabb(margin = 0) {
    const c = Math.abs(Math.cos(this.angle)) * this.halfLen;
    const s = Math.abs(Math.sin(this.angle)) * this.halfLen;
    const r = this.radius + margin;
    return {
      minx: this.pos.x - c - r, maxx: this.pos.x + c + r,
      miny: this.pos.y - s - r, maxy: this.pos.y + s + r,
    };
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.y); }
  get kineticEnergy() {
    return 0.5 * this.mass * (this.vel.x ** 2 + this.vel.y ** 2)
         + 0.5 * this.inertia * this.angVel ** 2;
  }
}
