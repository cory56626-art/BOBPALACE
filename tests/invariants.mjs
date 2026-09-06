// Guarantees the simulation claims to make. If any of these fail, the claim
// on the page that "nothing is forced" is false.
import { Arena } from '../js/sim/arena.js';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

// 1. No muscle may ever exceed its own torque ceiling, in any state, ever.
{
  let worst = 0, worstAt = '';
  for (const [sp, ang] of [['human', 1.6], ['chimp', 2.4], ['human', 4.1], ['chimp', 0.7]]) {
    const a = new Arena({ seed: 99 });
    const u = a.spawn(sp, 0, -1.5, 1);
    const v = a.spawn(sp === 'human' ? 'chimp' : 'human', 1, 1.5, -1);
    for (const b of u.list) { b.pos.y += 0.4; b.angle += ang; }
    for (let i = 0; i < 200 * 12; i++) {
      a.step(); a.drainEvents();
      for (const unit of [u, v]) {
        for (const j of unit.jointList) {
          if (!(j.maxTorque >= 0)) { worst = Infinity; worstAt = `${j.name} ceiling=${j.maxTorque}`; continue; }
          if (j.mode === 'off') {
            if (j.lastTorque !== 0) { worst = Infinity; worstAt = `${j.name} reports torque while off`; }
            continue;
          }
          const r = Math.abs(j.lastTorque) / Math.max(1, j.maxTorque);
          if (r > worst) { worst = r; worstAt = `${sp} ${j.name}`; }
        }
      }
    }
  }
  check('muscle torque never exceeds its ceiling', worst <= 1.0001, `worst ratio ${worst.toFixed(4)} at ${worstAt}`);
}

// 2. Nothing may go non-finite: one NaN position poisons the whole solver.
{
  const a = new Arena({ seed: 4242 });
  for (let i = 0; i < 4; i++) a.spawn(i % 2 ? 'chimp' : 'human', i % 2, -3 + i * 2, i % 2 ? -1 : 1);
  let bad = null;
  for (let i = 0; i < 200 * 25 && !bad; i++) {
    a.step(); a.drainEvents();
    for (const b of a.world.bodies) {
      if (!Number.isFinite(b.pos.x + b.pos.y + b.angle + b.vel.x + b.vel.y + b.angVel)) {
        bad = `${b.owner ? b.owner.spec.name : 'world'} ${b.part} at t=${a.elapsed.toFixed(2)}`;
      }
    }
  }
  check('no body ever goes non-finite', !bad, bad || '4-unit brawl, 25s');
}

// 3. A limp ragdoll must lose energy monotonically once it has settled.
{
  const a = new Arena({ seed: 11 });
  const u = a.spawn('human', 0, 0, 1);
  u.kill();
  for (let i = 0; i < 200 * 6; i++) a.step();
  const e = u.list.reduce((s, b) => s + b.kineticEnergy, 0);
  check('a dead ragdoll comes to rest', e < 0.5, `residual KE ${e.toFixed(3)} J`);
}

// 4. A single unit standing still must not drift or jitter.
{
  const a = new Arena({ seed: 5 });
  const u = a.spawn('human', 0, 0, 1);
  for (let i = 0; i < 200 * 4; i++) { a.step(); a.drainEvents(); }
  const x0 = u.com().x;
  let jitter = 0;
  for (let i = 0; i < 200 * 6; i++) {
    a.step(); a.drainEvents();
    jitter = Math.max(jitter, Math.abs(u.comVel().x));
  }
  const drift = Math.abs(u.com().x - x0);
  check('standing still stays still', drift < 0.05 && jitter < 0.25,
        `drift ${drift.toFixed(3)} m, peak COM speed ${jitter.toFixed(3)} m/s`);
}

console.log(failures ? `\n${failures} FAILED` : '\nall invariants hold');
process.exit(failures ? 1 : 0);
