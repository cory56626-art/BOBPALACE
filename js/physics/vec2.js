// Minimal 2D vector maths. Objects are plain {x, y} literals so they stay
// monomorphic for the JIT; the solver inlines its own arithmetic in the hot
// loops and only uses these helpers during setup.

export const EPS = 1e-9;
export const TAU = Math.PI * 2;

export const vec = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const len2 = (a) => a.x * a.x + a.y * a.y;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const perp = (a) => ({ x: -a.y, y: a.x });
export const mid = (a, b) => ({ x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 });
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : 1);

export function norm(a) {
  const l = Math.hypot(a.x, a.y);
  return l > EPS ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function rot(a, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Rotate `a` by -ang (i.e. world -> local for a frame rotated by ang). */
export function invRot(a, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c + a.y * s, y: -a.x * s + a.y * c };
}

/** Wrap an angle into (-pi, pi]. */
export function wrap(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/**
 * Closest points between segments p1-q1 and p2-q2 (Ericson, RTCD 5.1.9).
 * Returns the parameters plus the two witness points.
 */
export function closestSegSeg(p1, q1, p2, q2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y;
  const d2x = q2.x - p2.x, d2y = q2.y - p2.y;
  const rx = p1.x - p2.x, ry = p1.y - p2.y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  let s, t;

  if (a <= EPS && e <= EPS) {
    s = 0; t = 0;
  } else if (a <= EPS) {
    s = 0; t = clamp(f / e, 0, 1);
  } else {
    const c = d1x * rx + d1y * ry;
    if (e <= EPS) {
      t = 0; s = clamp(-c / a, 0, 1);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;
      s = denom > EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  return {
    s, t,
    c1: { x: p1.x + d1x * s, y: p1.y + d1y * s },
    c2: { x: p2.x + d2x * t, y: p2.y + d2y * t },
  };
}

/** Deterministic-ish PRNG so a seeded battle replays the same way. */
export function makeRng(seed = 1) {
  // Scramble and warm up. Raw xorshift32 seeded with a small integer emits a
  // run of near-zero values first, which made every low seed behave the same.
  let s = (Math.imul(seed >>> 0 || 1, 2654435761) ^ 0x9e3779b9) >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}
