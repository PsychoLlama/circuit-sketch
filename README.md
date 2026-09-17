# Circuit Sketch — an electricity playground

Run `nix develop`, then `pnpm dev` (port 3000). `pnpm check` runs TypeScript, Vitest, formatting, and the production build. No additional packages or dependency build scripts are needed.

## Using the editor

- Start empty or load one of four experiments. Experiments replace the canvas; Undo restores it.
- Choose a component, then click the canvas to place it. Drag its body to move it.
- Click two terminals to connect a wire. Additional wires from a terminal form branches. Wire crossings are not junctions.
- Hover for measurements; select for properties, replacement, or removal. Double-click a switch to toggle it.
- Select a wire to change its resistance, insert a component in series, or branch from its first terminal.
- V / R / S / C / W select tools; Escape cancels; Delete removes; Ctrl/Cmd+Z undoes; Shift+Ctrl/Cmd+Z redoes.
- Circuits are held in memory. Reloading starts a new empty circuit.

## Electrical model

The pure solver uses [modified nodal analysis](https://lpsa.swarthmore.edu/Systems/Electrical/mna/MNA3.html): Kirchhoff’s current law at each terminal, conductance stamps for resistors, and voltage constraints for sources, ideal wires, and closed switches. It solves simultaneous linear equations with scaled partial pivoting. The first source’s B terminal is the 0 V reference; without a source, the first terminal is the reference. Displayed node count counts terminals, including those joined by ideal wires.

All measurements use the passive sign convention: voltage = VA − VB, positive current travels A → B, and power = voltage × current. Negative power means a component supplies energy. Current is conventional current, not electron drift. Wires have a specified total resistance independent of their drawn length; a resistive wire’s endpoint voltages can differ.

This is **DC equilibrium**, not a time-domain simulation. Capacitors are open circuits after settling, with stored energy ½CV². Open switches pass no current; closed switches and ideal wires have exactly zero resistance. Sources are ideal fixed voltages with no current limit. There are no AC, thermal, breakdown, nonlinear, or parasitic models.

Floating terminals, inconsistent voltage constraints, and redundant ideal loops yield diagnostics and no readings. A floating subnetwork can have meaningful internal voltage differences, but this version conservatively declines to report an incomplete solution. An ideal short across a nonzero source is inconsistent, not a finite-current circuit. Add an explicit positive resistance to model a physical path.

The tests cover analytic series/parallel and bridge circuits, source polarity, energy conservation, open/closed switches, capacitor equilibrium, ideal/resistive wires, high resistance, and invalid networks. Editing tests cover examples, connections, live value changes, and undo/redo.

## Structure

`src/lib/circuit` contains the framework-independent electrical model. `src/state/circuit` contains editor state and transitions. `src/components/circuit` renders the editor. The route is a thin wrapper. No simulation state is shared between editor instances.
