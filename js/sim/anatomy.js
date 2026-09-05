// Skeleton definitions.
//
// Both species are authored standing straight up, facing +x, with the origin
// on the ground between the feet. Every capsule is given as a proximal point
// `a` and a distal point `b`, so joint reference angles come out of the pose
// itself and every joint reads zero at rest. Anatomical limits are then
// expressed relative to that.
//
// `flex` maps the intuitive direction (forward swing / bend) onto the sign
// that geometry actually produces, so the controller can say "flex the hip by
// 0.6" without caring which way the capsule happens to point.

export const HUMAN = {
  id: 'human',
  name: 'Human',
  mass: 82,
  hp: 100,
  height: 1.80,
  reach: 0.72,
  palette: {
    skin: '#d9a06b', skinDark: '#a06f45', cloth: '#3f5f8f', clothDark: '#2a4062',
    hair: '#3a2a20', accent: '#e8c9a0',
  },
  stats: { strength: 1.0, agility: 1.0, aggression: 0.80, bite: 0.15, grab: 0.25, strike: 1.0 },
  parts: {
    'foot.l':     { a: [-0.055, 0.038], b: [0.155, 0.038], r: 0.038, depth: -1, d: 1050 },
    'shin.l':     { a: [0, 0.475], b: [0, 0.085], r: 0.055, depth: -1, d: 1050 },
    'thigh.l':    { a: [0, 0.905], b: [0, 0.495], r: 0.077, depth: -1, d: 1050 },
    'foot.r':     { a: [-0.055, 0.038], b: [0.155, 0.038], r: 0.038, depth: 1, d: 1050 },
    'shin.r':     { a: [0, 0.475], b: [0, 0.085], r: 0.055, depth: 1, d: 1050 },
    'thigh.r':    { a: [0, 0.905], b: [0, 0.495], r: 0.077, depth: 1, d: 1050 },
    'pelvis':     { a: [0, 0.90], b: [0, 1.06], r: 0.115, depth: 0, d: 1000 },
    'chest':      { a: [0, 1.10], b: [0, 1.43], r: 0.140, depth: 0, d: 900 },
    'head':       { a: [0, 1.575], b: [0, 1.625], r: 0.108, depth: 0.5, d: 1100 },
    'upperarm.l': { a: [0, 1.40], b: [0, 1.10], r: 0.050, depth: -2, d: 1050 },
    'forearm.l':  { a: [0, 1.07], b: [0, 0.80], r: 0.045, depth: -2, d: 1050 },
    'hand.l':     { a: [0, 0.775], b: [0, 0.715], r: 0.048, depth: -2, d: 1100 },
    'upperarm.r': { a: [0, 1.40], b: [0, 1.10], r: 0.050, depth: 2, d: 1050 },
    'forearm.r':  { a: [0, 1.07], b: [0, 0.80], r: 0.045, depth: 2, d: 1050 },
    'hand.r':     { a: [0, 0.775], b: [0, 0.715], r: 0.048, depth: 2, d: 1100 },
  },
  joints: [
    { n: 'spine',      p: 'pelvis', c: 'chest',      at: [0, 1.075], lo: -0.80, hi: 0.50, tq: 300, flex: -1, w: 17 },
    { n: 'neck',       p: 'chest',  c: 'head',       at: [0, 1.505], lo: -0.75, hi: 0.55, tq: 55,  flex: -1, w: 20 },
    { n: 'shoulder.l', p: 'chest',  c: 'upperarm.l', at: [0, 1.405], lo: -1.45, hi: 3.05, tq: 105, flex: 1, w: 16 },
    { n: 'elbow.l',    p: 'upperarm.l', c: 'forearm.l', at: [0, 1.085], lo: -0.05, hi: 2.65, tq: 68, flex: 1, w: 17 },
    { n: 'wrist.l',    p: 'forearm.l',  c: 'hand.l',    at: [0, 0.787], lo: -0.70, hi: 0.70, tq: 22, flex: 1, w: 22 },
    { n: 'shoulder.r', p: 'chest',  c: 'upperarm.r', at: [0, 1.405], lo: -1.45, hi: 3.05, tq: 105, flex: 1, w: 16 },
    { n: 'elbow.r',    p: 'upperarm.r', c: 'forearm.r', at: [0, 1.085], lo: -0.05, hi: 2.65, tq: 68, flex: 1, w: 17 },
    { n: 'wrist.r',    p: 'forearm.r',  c: 'hand.r',    at: [0, 0.787], lo: -0.70, hi: 0.70, tq: 22, flex: 1, w: 22 },
    { n: 'hip.l',      p: 'pelvis', c: 'thigh.l',    at: [0, 0.902], lo: -0.95, hi: 2.40, tq: 290, flex: 1, w: 15 },
    { n: 'knee.l',     p: 'thigh.l', c: 'shin.l',    at: [0, 0.485], lo: -2.45, hi: 0.02, tq: 230, flex: -1, w: 16 },
    { n: 'ankle.l',    p: 'shin.l', c: 'foot.l',     at: [0, 0.080], lo: -0.90, hi: 0.55, tq: 170, flex: 1, w: 18 },
    { n: 'hip.r',      p: 'pelvis', c: 'thigh.r',    at: [0, 0.902], lo: -0.95, hi: 2.40, tq: 290, flex: 1, w: 15 },
    { n: 'knee.r',     p: 'thigh.r', c: 'shin.r',    at: [0, 0.485], lo: -2.45, hi: 0.02, tq: 230, flex: -1, w: 16 },
    { n: 'ankle.r',    p: 'shin.r', c: 'foot.r',     at: [0, 0.080], lo: -0.90, hi: 0.55, tq: 170, flex: 1, w: 18 },
  ],
  vuln: { head: 2.7, chest: 1.05, pelvis: 0.95, default: 0.45 },
};

// Chimpanzee. Same topology, very different proportions and torque budget:
// legs a third shorter, arms a third longer, a barrel chest, and roughly
// 2.3x the human upper-body torque for two thirds of the body mass. It is
// built straight for the same reason the human is -- the hunched knuckle
// stance is something the controller *asks* for, not something baked in.
export const CHIMP = {
  id: 'chimp',
  name: 'Chimpanzee',
  mass: 61,
  hp: 110,
  height: 1.44,
  reach: 0.92,
  palette: {
    skin: '#544a41', skinDark: '#2f2823', cloth: '#4a4038', clothDark: '#2a231e',
    hair: '#1a1614', accent: '#8a6f5c',
  },
  stats: { strength: 2.35, agility: 1.30, aggression: 1.40, bite: 1.0, grab: 0.85, strike: 1.45 },
  parts: {
    'foot.l':     { a: [-0.062, 0.036], b: [0.196, 0.036], r: 0.040, depth: -1, d: 1050 },
    'shin.l':     { a: [0, 0.400], b: [0, 0.075], r: 0.058, depth: -1, d: 1080 },
    'thigh.l':    { a: [0, 0.720], b: [0, 0.420], r: 0.082, depth: -1, d: 1080 },
    'foot.r':     { a: [-0.062, 0.036], b: [0.196, 0.036], r: 0.040, depth: 1, d: 1050 },
    'shin.r':     { a: [0, 0.400], b: [0, 0.075], r: 0.058, depth: 1, d: 1080 },
    'thigh.r':    { a: [0, 0.720], b: [0, 0.420], r: 0.082, depth: 1, d: 1080 },
    'pelvis':     { a: [0, 0.715], b: [0, 0.860], r: 0.118, depth: 0, d: 1000 },
    'chest':      { a: [0, 0.880], b: [0, 1.215], r: 0.165, depth: 0, d: 950 },
    'head':       { a: [0, 1.320], b: [0, 1.395], r: 0.125, depth: 0.5, d: 1150 },
    'upperarm.l': { a: [0, 1.190], b: [0, 0.830], r: 0.062, depth: -2, d: 1120 },
    'forearm.l':  { a: [0, 0.800], b: [0, 0.440], r: 0.056, depth: -2, d: 1120 },
    'hand.l':     { a: [0, 0.410], b: [0, 0.290], r: 0.060, depth: -2, d: 1150 },
    'upperarm.r': { a: [0, 1.190], b: [0, 0.830], r: 0.062, depth: 2, d: 1120 },
    'forearm.r':  { a: [0, 0.800], b: [0, 0.440], r: 0.056, depth: 2, d: 1120 },
    'hand.r':     { a: [0, 0.410], b: [0, 0.290], r: 0.060, depth: 2, d: 1150 },
  },
  joints: [
    { n: 'spine',      p: 'pelvis', c: 'chest',      at: [0, 0.870], lo: -1.05, hi: 0.45, tq: 380, flex: -1, w: 17 },
    { n: 'neck',       p: 'chest',  c: 'head',       at: [0, 1.262], lo: -0.85, hi: 0.60, tq: 95,  flex: -1, w: 21 },
    { n: 'shoulder.l', p: 'chest',  c: 'upperarm.l', at: [0, 1.195], lo: -1.90, hi: 3.10, tq: 250, flex: 1, w: 17 },
    { n: 'elbow.l',    p: 'upperarm.l', c: 'forearm.l', at: [0, 0.815], lo: -0.05, hi: 2.75, tq: 165, flex: 1, w: 18 },
    { n: 'wrist.l',    p: 'forearm.l',  c: 'hand.l',    at: [0, 0.425], lo: -0.85, hi: 0.85, tq: 70, flex: 1, w: 22 },
    { n: 'shoulder.r', p: 'chest',  c: 'upperarm.r', at: [0, 1.195], lo: -1.90, hi: 3.10, tq: 250, flex: 1, w: 17 },
    { n: 'elbow.r',    p: 'upperarm.r', c: 'forearm.r', at: [0, 0.815], lo: -0.05, hi: 2.75, tq: 165, flex: 1, w: 18 },
    { n: 'wrist.r',    p: 'forearm.r',  c: 'hand.r',    at: [0, 0.425], lo: -0.85, hi: 0.85, tq: 70, flex: 1, w: 22 },
    { n: 'hip.l',      p: 'pelvis', c: 'thigh.l',    at: [0, 0.718], lo: -0.75, hi: 2.35, tq: 330, flex: 1, w: 15 },
    { n: 'knee.l',     p: 'thigh.l', c: 'shin.l',    at: [0, 0.410], lo: -2.55, hi: 0.02, tq: 255, flex: -1, w: 16 },
    { n: 'ankle.l',    p: 'shin.l', c: 'foot.l',     at: [0, 0.078], lo: -0.95, hi: 0.70, tq: 150, flex: 1, w: 18 },
    { n: 'hip.r',      p: 'pelvis', c: 'thigh.r',    at: [0, 0.718], lo: -0.75, hi: 2.35, tq: 330, flex: 1, w: 15 },
    { n: 'knee.r',     p: 'thigh.r', c: 'shin.r',    at: [0, 0.410], lo: -2.55, hi: 0.02, tq: 255, flex: -1, w: 16 },
    { n: 'ankle.r',    p: 'shin.r', c: 'foot.r',     at: [0, 0.078], lo: -0.95, hi: 0.70, tq: 150, flex: 1, w: 18 },
  ],
  vuln: { head: 2.1, chest: 0.85, pelvis: 0.80, default: 0.36 },
};

export const SPECIES = { human: HUMAN, chimp: CHIMP };
