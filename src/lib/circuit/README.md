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

## Declarative time and future dynamics

`analyze(components, { mode: "snapshot", time: T }, reference)` evaluates memoryless
networks at a finite, nonnegative time in seconds. `voltageSource` accepts a pure
waveform function; an ideal square-wave source driving a resistor and LED is tested
at forward, backward, and widely separated times. These queries do not depend on
query order, timers, or previous calls. DC analysis uses the source's separate DC
value (default zero), not an arbitrary sample of the waveform.

**Snapshot analysis is not transient integration.** A capacitor explicitly rejects
snapshot mode. Capacitor transients need `I = dQ/dt`, initial conditions, and the
input history; evaluating only the source voltage at T cannot determine charge.
A future transient analysis can extend the analysis/context contract with initial
conditions and derivative/charge equations, then integrate deterministically from
an immutable initial state to T. Integration history and optional caches belong to
that analysis, not UI intervals or hidden mutable component state. The graph API
can still expose a pure requested-time accessor.

Combinational gates can use multiport branch models with explicit input/output and
supply behavior. Sequential ICs and oscillators with stored state need the same
initial-condition/history treatment as other dynamic devices; they are not yet
implemented. A voltage-controlled ideal source is supported as an extension example,
but is not presented as a realistic powered IC.
