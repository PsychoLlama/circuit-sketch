# Circuit model

The editor and persisted `Branch` format use `solver.ts` as a compatibility adapter.
New devices implement `Component` in `model.ts`; they do not extend the editor's
`Kind` union or modify `engine.ts`. The core has no UI or Solid dependency.
`graph.ts` provides an optional Solid adapter, used by the editor.

## Electrical contract

All quantities use SI units. Every component declares named pins connected to graph
nodes, validates the requested analysis, and supplies branch equations. A branch has
an oriented current from pin `a` to pin `b` and obeys:

```text
sum(coefficient[pin] * voltage[pin]) + currentCoefficient * branchCurrent = rhs
```

Voltage coefficients must sum to zero: all voltage relationships are differences
between explicit pins. Multiple branches and arbitrary pin counts allow subcircuits,
controlled sources, and future IC models. Pins may share a node. Internal nodes can
use private, globally unique names supplied by the component builder. Current at a
pin is positive entering the device. A branch absorbs power `(Va - Vb) * I`; negative
power means it supplies energy. A control-only pin draws zero current unless the
model explicitly declares an input branch.

The engine simultaneously solves node voltages and **all branch currents**, imposing
KCL at every nonreference node. KVL follows from the shared node potentials. This
is an augmented nodal formulation (branch equations plus KCL); keeping every current
as an unknown makes open circuits, ideal sources, and observation use the same
contract. See the [Qucs nodal-analysis reference](https://qucs.sourceforge.net/tech/node14.html).
Electrical feedback requires a simultaneous solve, not propagation through a DAG.

For example, a resistor returns coefficients `{ a: -1, b: 1 }`, current coefficient
`R`, and rhs `0`. A voltage source returns `{ a: 1, b: -1 }`, current coefficient
`0`, and rhs equal to its voltage. An independent current source returns no voltage
coefficients, current coefficient `1`, and rhs equal to its current. A controlled
source adds coefficients for its input pins; see the multiport tests.

Models must be pure, deterministic, and keep branch IDs/endpoints/order stable
within an analysis. For nonlinear models, `context.voltage(pin)` provides the
current estimate for local linearization. The engine reevaluates equations at the
candidate solution and checks the residual before exposing readings. A model must
supply a linearization whose residual is its actual constitutive-law residual, not
merely an arbitrary fixed-point update. Models are responsible for documenting
physical assumptions and rejecting unsupported operating modes. Convergence to a
root does not prove global uniqueness for arbitrary nonlinear extension models.

## Errors and numerical limits

Failures return structured diagnostics and empty observations, never stale or partial
readings. These include invalid parameters, unknown editor kinds, malformed device
models, floating nodes, conflicting or redundant ideal constraints, numeric range
failures, and nonlinear nonconvergence (100 iterations). Singular systems intentionally
produce an error even if some voltages are determined: their complete electrical
state is not unique. No shunt conductance is silently added to make a circuit solve.

The dense solver uses scaled partial pivoting (pivot threshold `1e-12`) and an
independent row residual check (`1e-12 + 1e-9 * sum(abs(terms))`, including rhs).
These are floating-point numerical solutions, not symbolic proofs. Ill-conditioned
or extreme-range circuits may be rejected. Matrix size is nodes minus one plus all
branches; dense elimination is cubic, appropriate for the current small editor.
A sparse backend can replace `linear.ts` without changing component models.

## Built-in assumptions

- Sources, switches, and zero-ohm wires are ideal. An open switch has exactly zero
  current. A resistive wire, resistor, rheostat, or lamp obeys Ohm's law.
- Lamps have fixed resistance; temperature and filament dynamics are not modeled.
- Capacitors are open **only at DC equilibrium**. An isolated capacitor's voltage
  cannot be recovered from capacitance alone and produces an error.
- Diodes/LEDs retain the editor's explicitly approximate, continuous piecewise-linear
  law: `I = 1e-9 V` below the threshold, and
  `I = 0.1 V - threshold * (0.1 - 1e-9)` above it. This includes an explicit 1 GΩ
  leakage model and 10 Ω forward slope. It is not a Shockley/breakdown/thermal or
  optical model. The inspector describes these assumptions and applies separate
  educational ratings.

## Reactive inspection and manipulation

Create a graph inside a Solid owner. Pass accessors for component models, analysis,
and reference. `snapshot()` exposes diagnostics and the full graph; `node(id)`,
`component(id)`, and `pin(id, name)` return accessors. A failed or removed observation
returns `undefined`. All inspection shares one memoized simultaneous solution.

`createComponentControl(parameters, buildModel)` supplies a parameter signal and
memoized model. For example, a switch can use a boolean parameter and construct an
editor-compatible model via `toComponent`. Calling `setParameters(true)` closes it
and recomputes all dependent readings. The editor retains its existing immutable
editing/history actions and passes `parts().map(toComponent)` to the graph.

## Declarative time and capacitor dynamics

`analyze(components, { mode: "snapshot", time: T }, reference)` evaluates memoryless
networks at a finite, nonnegative time in seconds. `voltageSource` accepts a pure
waveform function; an ideal square-wave source driving a resistor and LED is tested
at forward, backward, and widely separated times. These queries do not depend on
query order, timers, or previous calls. DC analysis uses the source's separate DC
value (default zero), not an arbitrary sample of the waveform.

**Snapshot analysis is not transient integration.** `transient(components, T,
reference)` computes capacitor state from initial voltages at t = 0. The editor
uses this through the island adapter and retains an explicit DC equilibrium mode.
Capacitors default to zero initial voltage; signed initial voltage is A minus B.
At every integration stage, capacitor voltages constrain a simultaneous network
solve. Its currents give `dV/dt = I/C`. Charge on A is `CV`, energy is `½CV²`, and
negative capacitor power means stored energy is being returned to the circuit.
The RC tests use the analytical solution `V(t) = Vs + (V0 − Vs) exp(−t/RC)`;
see [OpenStax RC circuits](https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits).

Integration uses adaptive RK4 step doubling with local voltage error scaling
`1e-11 V + 1e-9 × max(|Vold|, |Vnew|)`. This is a numerical approximation, not
an exact exponential solver or a guarantee of global error. Step sizes never
depend on the requested time, so accepted steps form one fixed sequence and a
query returns the same result as a fresh query from the initial conditions, in
any order. `createTransient` retains only the latest accepted step at or before
the last query and its successor, so memory is constant; forward playback
resumes from them and backward seeks restart from t = 0.
There is a 10,000-attempt work limit; stiff or extreme-duration queries can fail
with an explicit diagnostic. Failed islands expose no partial transient readings.

The current initial-value formulation requires independent capacitor voltage
constraints and uniquely solvable branch currents. Ideal capacitor loops,
including parallel ideal capacitors or capacitors directly across ideal voltage
sources, are rejected rather than assigning arbitrary currents or hiding impulses.
Use finite physical series resistance. Isolated charged capacitors retain their
voltage; DC equilibrium cannot infer that voltage from capacitance alone.
The capacitor metadata contract uses pins `a`, `b` and branch `main`.
Waveforms must be smooth enough for numerical sampling; scheduled discontinuities
and switching histories are not supported by this transient API.

The editor applies sources and switch positions from t = 0. Editing defines a
new experiment and recomputes the requested time from the initial conditions;
clicking a switch does not splice a switching event into an ongoing history.
Playback time is `timeAnchor + (timestamp − wallAnchor) × speed`. Animation frames
only supply a clock timestamp, never capacitor charge, voltage, or accumulated
simulation steps. Pause, seek, and speed changes re-anchor time continuously.
The default speed is 0.001× so the default 1 ms RC time constant is visible.

Sequential ICs and oscillators with stored state need their own dynamic model;
they are not yet implemented. A voltage-controlled ideal source is supported as
an extension example, but is not presented as a realistic powered IC.
