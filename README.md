# Ragdoll Arena

A 2D rigid-body ragdoll simulator written from scratch — physics engine,
balance controller, renderer — with a chimpanzee and a human in it.

**Live:** https://cory56626-art.github.io/BOBPALACE/

There is no animation and no knockback code. Every pose you see is the
solver's output, and every body that goes flying does so because the
constraint solver moved that much momentum.

---

## The one design decision

Each joint carries a spring–damper on its angle, solved implicitly inside the
same velocity iteration as the contacts, with its accumulated impulse clamped
to `maxTorque × dt`.

That clamp is the whole thing. A human shoulder gets 105 N·m; a chimpanzee
shoulder gets 250 N·m on two thirds of the body mass. Nothing the controller
wants can exceed its budget, so a hard enough impact simply overpowers the
muscle and the unit goes wherever the impulse sent it — flailing, because its
controller is still trying and still losing.

Solving that spring *implicitly* rather than as an explicit PD is what makes
the ceiling usable at all. An explicit controller stiff enough to hold up a
standing body pumps energy on every landing and pogo-sticks the ragdoll into
the air; that failure is in the git history.

## What's in here

```
js/physics/   vec2, body, capsule collision, joints, solver
js/sim/       anatomy tables, unit assembly, controller, arena rules
js/render.js  canvas renderer, camera, particles
js/main.js    fixed-step loop, controls, mouse joint
```

**Collision.** Every dynamic shape is a capsule, so one routine — closest
point between two segments — resolves every pair. Manifolds carry up to two
points, which is the difference between a limb resting on the floor and a limb
shivering on it forever.

**Solver.** Sequential impulses at 200 Hz with warm-started contacts,
Baumgarte position feedback, speculative contacts, and block-solved revolute
joints with anatomical angular limits.

**Balance.** Standing is an ankle law whose proportional gain has to beat
gravity's own gain of exactly 1 — below that, the equilibrium point sits
outside the foot and the unit topples no matter how hard it pushes. Walking is
controlled falling: the balance setpoint is biased forward and a capture-point
reflex places the swing foot by two-link IK where the body can be caught. The
torso is held upright by torque routed through whichever hip is load-bearing,
SIMBICON-style, because the ground is the only thing a standing body can
actually push against.

**Damage.** No hitboxes. After each step the arena reads the normal impulses
the solver applied and scales them by closing speed, with a speed threshold
below which nothing is injured — that threshold is what separates a footfall
from a faceplant, since both carry a large impulse and only one arrives fast.

**Getting up.** A downed unit aims every limb at the floor *beneath its own
centre of mass* and its torso at the sky. One pose, no stages, no clock.

Both details earn their place. World-frame aiming means "point your shin at
the ground" still means something from inside a tangle, where a joint-relative
"flex the hip 1.8 rad" points the leg wherever the pelvis happens to be lying.
Aiming inwards rather than straight down gathers the limbs under the load
before pressing — straight down makes a splayed body push at its extremities
and lever itself onto its head. And having no stages at all is what stops the
controller flickering between contradictory poses, which is what a seizure is.

Chimpanzees recover from ~90% of knockdowns, humans from ~60%; long legs and a
high centre of mass are a genuine handicap. The **get-up strength** slider
raises the torque ceiling while a unit is down — the only assist in the
project, a multiplier on muscle rather than an external force. At 1× you can
watch an unassisted human fail most of the time.

## Tests

```sh
node tests/invariants.mjs   # guarantees: torque ceilings, finiteness, rest
node tests/metrics.mjs      # behaviour: recovery, walking, fight outcomes
```

`invariants.mjs` is the one that matters. It asserts that no muscle ever
exceeds its own torque ceiling in any state — the claim the whole simulation
rests on. It caught a real bug: a `NaN` reaching the ceiling silently removed
it altogether, because clamping against `NaN` bounds is a no-op.

## Running it

Static files, no build step, ES modules. Any static server:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Controls

| | |
|---|---|
| drag | grab a limb and throw it (soft mouse joint, force-limited) |
| scroll | zoom; double-click returns to auto-framing |
| space | pause |
| R | restart |
