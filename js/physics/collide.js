// Narrow phase. Every dynamic shape in this engine is a capsule (a segment
// with a radius) which means a *single* routine -- closest point between two
// segments -- resolves every dynamic pair. Static world geometry is either a
// capsule or a half-plane.
//
// Manifolds carry up to two points. That matters more than it sounds: a limb
// resting on the floor needs two points or it pivots and jitters forever, and
// jittering ragdolls read as "fake".

import { closestSegSeg, clamp, EPS } from './vec2.js';

export const SLOP = 0.005;      // allowed overlap, metres
const SPECULATIVE = 0.02;       // build contacts slightly before touching
const PARALLEL_EPS = 0.08;      // |sin| between axes below which we clip

function push(out, px, py, nx, ny, sep, id) {
  out.push({
    px, py, nx, ny, sep, id,
    Pn: 0, Pt: 0, massN: 0, massT: 0, bias: 0,
    rax: 0, ray: 0, rbx: 0, rby: 0,
    impulse: 0,
  });
}

/** Half-plane `pl` (normal points into free space) versus capsule `cap`. */
function planeCapsule(pl, cap, out) {
  const nx = pl.normal.x, ny = pl.normal.y;
  const [e0, e1] = cap.endpoints();
  const ends = cap.halfLen > EPS ? [e0, e1] : [e0];
  for (let i = 0; i < ends.length; i++) {
    const e = ends[i];
    const sep = e.x * nx + e.y * ny - pl.offset - cap.radius;
    if (sep < SPECULATIVE) {
      push(out, e.x - nx * cap.radius, e.y - ny * cap.radius, nx, ny, sep, i);
    }
  }
  return out.length > 0;
}

/** Capsule versus capsule. Normal points from `a` towards `b`. */
function capsuleCapsule(a, b, out) {
  const [a0, a1] = a.endpoints();
  const [b0, b1] = b.endpoints();
  const r = a.radius + b.radius;

  const cp = closestSegSeg(a0, a1, b0, b1);
  let dx = cp.c2.x - cp.c1.x, dy = cp.c2.y - cp.c1.y;
  let d = Math.hypot(dx, dy);

  if (d - r > SPECULATIVE) return false;

  let nx, ny;
  if (d > EPS) {
    nx = dx / d; ny = dy / d;
  } else {
    // Fully coincident centres: push along the perpendicular of a's axis,
    // or straight up if a is a disc.
    const ax = a1.x - a0.x, ay = a1.y - a0.y;
    const al = Math.hypot(ax, ay);
    if (al > EPS) { nx = -ay / al; ny = ax / al; } else { nx = 0; ny = 1; }
    d = 0;
  }

  // Near-parallel segments get a clipped two point manifold.
  const ax = a1.x - a0.x, ay = a1.y - a0.y;
  const bx = b1.x - b0.x, by = b1.y - b0.y;
  const aLen = Math.hypot(ax, ay), bLen = Math.hypot(bx, by);
  if (aLen > EPS && bLen > EPS) {
    const ux = ax / aLen, uy = ay / aLen;
    const vx = bx / bLen, vy = by / bLen;
    if (Math.abs(ux * vy - uy * vx) < PARALLEL_EPS) {
      // Project b's endpoints onto a's segment parameter space.
      const t0 = ((b0.x - a0.x) * ax + (b0.y - a0.y) * ay) / (aLen * aLen);
      const t1 = ((b1.x - a0.x) * ax + (b1.y - a0.y) * ay) / (aLen * aLen);
      const lo = clamp(Math.min(t0, t1), 0, 1);
      const hi = clamp(Math.max(t0, t1), 0, 1);
      if (hi - lo > 0.15) {
        for (let i = 0; i < 2; i++) {
          const u = i === 0 ? lo : hi;
          const px = a0.x + ax * u, py = a0.y + ay * u;
          // Closest point on b to this sample.
          const s = clamp(((px - b0.x) * bx + (py - b0.y) * by) / (bLen * bLen), 0, 1);
          const qx = b0.x + bx * s, qy = b0.y + by * s;
          const sep = (qx - px) * nx + (qy - py) * ny - r;
          if (sep < SPECULATIVE) {
            push(out, px + nx * (a.radius + sep * 0.5), py + ny * (a.radius + sep * 0.5),
                 nx, ny, sep, i);
          }
        }
        if (out.length > 0) return true;
      }
    }
  }

  const sep = d - r;
  push(out, cp.c1.x + nx * (a.radius + sep * 0.5), cp.c1.y + ny * (a.radius + sep * 0.5),
       nx, ny, sep, 2);
  return true;
}

export function collide(a, b, out) {
  if (a.type === 'plane') return planeCapsule(a, b, out);
  return capsuleCapsule(a, b, out);
}
