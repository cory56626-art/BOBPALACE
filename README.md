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

## Known weakness

Getting up off the floor is hard and this controller is not good at it. A
downed unit sits up, rolls towards all fours and scrambles, and often fails;
humans fail more than chimpanzees, whose proportions suit the manoeuvre. The
**get-up strength** slider multiplies the torque ceiling while a unit is down.
It is the only assist in the project, it is a multiplier on muscle rather than
an external force, and setting it to 1× shows you the unassisted truth.

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
