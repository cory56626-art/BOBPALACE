// Wiring: fixed-step simulation, render loop, controls, and the mouse joint
// that lets you pick a ragdoll up and throw it.

import { Arena, FIXED_DT, GAIT } from './sim/arena.js';
import { Renderer } from './render.js';
import { MouseJoint } from './physics/joints.js';
import { clamp } from './physics/vec2.js';

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas);
const arena = new Arena({ seed: (Math.random() * 65535) | 0 });

const state = {
  running: true,
  timeScale: 1,
  specA: 'human', countA: 1,
  specB: 'chimp', countB: 1,
  slowmoUntil: 0,
};

const PRESETS = [
  { label: '1 v 1', a: ['human', 1], b: ['chimp', 1] },
  { label: 'Chimp v 3', a: ['human', 3], b: ['chimp', 1] },
  { label: 'Chimp v 6', a: ['human', 6], b: ['chimp', 1] },
  { label: '4 v 4', a: ['human', 4], b: ['chimp', 4] },
  { label: 'Ape riot', a: ['chimp', 4], b: ['chimp', 4] },
  { label: 'Brawl', a: ['human', 5], b: ['human', 5] },
];

const SLIDERS = [
  { key: 'gravity', label: 'Gravity', min: 0, max: 25, step: 0.1, value: 9.81, unit: ' m/s²',
    apply: (v) => arena.setGravity(-v) },
  { key: 'strength', label: 'Muscle strength', min: 0.2, max: 2.5, step: 0.05, value: 1, unit: '×',
    apply: (v) => { arena.config.strength = v; }, restart: true },
  { key: 'damage', label: 'Damage', min: 0, max: 3, step: 0.05, value: 1, unit: '×',
    apply: (v) => { arena.config.damage = v; } },
  { key: 'getupStrength', label: 'Get-up strength', min: 1, max: 6, step: 0.1, value: 3, unit: '×',
    apply: (v) => {
      arena.config.getupStrength = v;
      for (const u of arena.units) if (u.brain) u.brain.getupStrength = v;
    } },
  { key: 'timeScale', label: 'Time', min: 0.05, max: 2, step: 0.05, value: 1, unit: '×',
    apply: (v) => { state.timeScale = v; } },
];

const TOGGLES = [
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'balance', label: 'Balance' },
  { key: 'strain', label: 'Muscle strain' },
];

// ---- setup ---------------------------------------------------------------

function buildUI() {
  const presets = document.getElementById('presets');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = p.label;
    b.onclick = () => {
      [...presets.children].forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
      state.specA = p.a[0]; state.countA = p.a[1];
      state.specB = p.b[0]; state.countB = p.b[1];
      syncSideInputs();
      restart();
    };
    if (i === 0) b.classList.add('active');
    presets.appendChild(b);
  });

  const sliders = document.getElementById('sliders');
  for (const s of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    wrap.innerHTML = `<div class="row"><b>${s.label}</b><span id="v-${s.key}"></span></div>`;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = s.min; input.max = s.max; input.step = s.step; input.value = s.value;
    const out = () => {
      wrap.querySelector(`#v-${s.key}`).textContent = (+input.value).toFixed(2).replace(/\.?0+$/, '') + s.unit;
    };
    input.oninput = () => { s.apply(+input.value); out(); if (s.restart) restart(); };
    wrap.appendChild(input);
    sliders.appendChild(wrap);
    out(); s.apply(+input.value);
  }

  const toggles = document.getElementById('toggles');
  for (const t of TOGGLES) {
    const b = document.createElement('button');
    b.textContent = t.label;
    b.onclick = () => {
      renderer.debug[t.key] = !renderer.debug[t.key];
      b.classList.toggle('active', renderer.debug[t.key]);
      if (t.key === 'strain' && renderer.debug.strain) {
        renderer.debug.skeleton = true;
        toggles.children[0].classList.add('active');
      }
    };
    toggles.appendChild(b);
  }

  document.getElementById('fight').onclick = restart;
  for (const id of ['specA', 'specB', 'countA', 'countB']) {
    document.getElementById(id).onchange = (e) => {
      state[id] = id.startsWith('count') ? clamp(+e.target.value, 1, 8) : e.target.value;
      restart();
    };
  }
  syncSideInputs();
}

function syncSideInputs() {
  document.getElementById('specA').value = state.specA;
  document.getElementById('specB').value = state.specB;
  document.getElementById('countA').value = state.countA;
  document.getElementById('countB').value = state.countB;
  document.getElementById('name0').textContent = teamName(state.specA, state.countA);
  document.getElementById('name1').textContent = teamName(state.specB, state.countB);
}

function teamName(spec, n) {
  const base = spec === 'chimp' ? 'Chimpanzee' : 'Human';
  return n > 1 ? `${n} ${base}s` : base;
}

function restart() {
  arena.reset();
  const gap = 1.4;
  const spread = (n) => (n - 1) * gap / 2;
  for (let i = 0; i < state.countA; i++) {
    arena.spawn(state.specA, 0, -2.4 - spread(state.countA) + i * gap, 1);
  }
  for (let i = 0; i < state.countB; i++) {
    arena.spawn(state.specB, 1, 2.4 + spread(state.countB) - i * gap, -1);
  }
  renderer.marks.length = 0;
  renderer.particles.list.length = 0;
  renderer.camera.manual = false;
  document.getElementById('verdict').className = 'verdict';
  document.getElementById('verdict').textContent = '';
  syncSideInputs();
  startTeamHp = teamHp();
}

// ---- mouse dragging ------------------------------------------------------

let drag = null;
function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return renderer.camera.toWorld(
    (e.clientX - r.left) * (canvas.width / r.width),
    (e.clientY - r.top) * (canvas.height / r.height),
    canvas.width, canvas.height,
  );
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerPos(e);
  const body = arena.world.queryPoint(p.x, p.y, 0.12);
  if (!body) return;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('grabbing');
  const j = new MouseJoint(body, p, { maxForce: body.mass * 900, frequency: 6, damping: 0.85 });
  arena.world.mouseJoints.push(j);
  drag = j;
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = pointerPos(e);
  drag.target.x = p.x; drag.target.y = p.y;
});
const endDrag = () => {
  if (!drag) return;
  const i = arena.world.mouseJoints.indexOf(drag);
  if (i >= 0) arena.world.mouseJoints.splice(i, 1);
  drag = null;
  canvas.classList.remove('grabbing');
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  renderer.camera.manual = true;
  renderer.camera.tzoom = clamp(renderer.camera.tzoom * (e.deltaY > 0 ? 0.9 : 1.11), 20, 300);
}, { passive: false });
canvas.addEventListener('dblclick', () => { renderer.camera.manual = false; });

addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); state.running = !state.running; }
  if (e.key === 'r' || e.key === 'R') restart();
});

// ---- loop ----------------------------------------------------------------

let acc = 0, last = performance.now(), fps = 60, steps = 0;
let startTeamHp = null;

function teamHp() {
  const t = [{ hp: 0, max: 0, alive: 0, n: 0 }, { hp: 0, max: 0, alive: 0, n: 0 }];
  for (const u of arena.units) {
    const s = t[u.team] || (t[u.team] = { hp: 0, max: 0, alive: 0, n: 0 });
    s.hp += u.hp; s.max += u.maxHp; s.n++;
    if (u.alive) s.alive++;
  }
  return t;
}

function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.92 + (1 / Math.max(raw, 1e-4)) * 0.08;

  let scale = state.timeScale;
  if (arena.bigHit > 0) scale *= 0.35;          // hit-stop on a heavy landing
  if (state.running) {
    acc += raw * scale;
    steps = 0;
    while (acc >= FIXED_DT && steps < 8) {
      arena.step();
      acc -= FIXED_DT;
      steps++;
    }
    if (acc > FIXED_DT * 8) acc = 0;
    renderer.consume(arena.drainEvents(), arena);
  }

  renderer.draw(arena, raw);
  updateHud();
  requestAnimationFrame(frame);
}

function updateHud() {
  const t = teamHp();
  for (const i of [0, 1]) {
    const s = t[i] || { hp: 0, max: 1, alive: 0, n: 0 };
    document.getElementById(`hp${i}`).style.width = `${(100 * s.hp / Math.max(1, s.max)).toFixed(1)}%`;
    document.getElementById(`sub${i}`).textContent =
      `${s.alive}/${s.n} standing · ${Math.round(s.hp)} hp`;
  }
  document.getElementById('clock').textContent = `${arena.elapsed.toFixed(1)}s`;

  const v = document.getElementById('verdict');
  if (arena.over && !v.textContent) {
    const names = [teamName(state.specA, state.countA), teamName(state.specB, state.countB)];
    v.textContent = arena.winner >= 0 ? `${names[arena.winner]} win — ${arena.elapsed.toFixed(1)}s` : 'Mutual destruction';
    v.className = 'verdict win';
  }

  const alive = arena.units.filter((u) => u.alive);
  const strain = alive.length
    ? alive.reduce((a, u) => a + u.jointList.reduce((b, j) => b + j.strain, 0) / u.jointList.length, 0) / alive.length
    : 0;
  const hh = arena.hardest;
  document.getElementById('readout').innerHTML = `
    <dt>Bodies</dt><dd>${arena.world.bodies.length}</dd>
    <dt>Contacts</dt><dd>${arena.world.arbiters.size}</dd>
    <dt>Joints</dt><dd>${arena.world.joints.length}</dd>
    <dt>Muscle load</dt><dd>${(strain * 100).toFixed(0)}%</dd>
    <dt>Solver rate</dt><dd>${Math.round(1 / FIXED_DT)} Hz</dd>
    <dt>Hardest hit</dt><dd>${hh ? `${hh.impulse.toFixed(0)} N·s` : '—'}</dd>
    <dt>… landed on</dt><dd>${hh ? hh.part.replace('.', ' ') : '—'}</dd>
    <dt>Fastest launch</dt><dd>${arena.peakLaunch.toFixed(1)} m/s</dd>`;
  document.getElementById('perf').textContent =
    `${fps.toFixed(0)} fps · ${steps} steps/frame`;
}

addEventListener('resize', () => renderer.resize());
renderer.resize();
buildUI();
restart();
requestAnimationFrame(frame);
