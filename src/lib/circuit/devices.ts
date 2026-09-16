import type { Branch, Kind } from "./solver";
import type { Component, Context, Equation } from "./model";

export const admittance = (conductance: number, offset = 0): Equation => ({
  id: "main",
  a: "a",
  b: "b",
  voltage: { a: -conductance, b: conductance },
  current: 1,
  rhs: offset,
});

export const potential = (voltage: number): Equation => ({
  id: "main",
  a: "a",
  b: "b",
  voltage: { a: 1, b: -1 },
  current: 0,
  rhs: voltage,
});

const resistance = (branch: Branch) => ({
  ...admittance(0),
  voltage: { a: -1, b: 1 },
  current: branch.value,
});

/** Explicit continuous piecewise-linear model, not a physical semiconductor model.
 * Reverse/off conductance = 1 nS; forward slope = 0.1 S (10 ohms).
 * No breakdown, temperature, charge storage, or optical model.
 */
const diode = (branch: Branch, context: Context) =>
  context.voltage("a") - context.voltage("b") > branch.value
    ? admittance(0.1, -branch.value * (0.1 - 1e-9))
    : admittance(1e-9);

export const models: Record<
  Kind,
  (branch: Branch, context: Context) => Equation
> = {
  source: (branch) => potential(branch.value),
  resistor: resistance,
  rheostat: resistance,
  lamp: resistance,
  wire: (branch) => (branch.value === 0 ? potential(0) : resistance(branch)),
  switch: (branch) => (branch.closed ? potential(0) : admittance(0)),
  capacitor: () => admittance(0),
  diode,
  led: diode,
};

/** A prescribed voltage waveform. Snapshot analysis is exact for memoryless networks.
 * The caller provides a pure function of seconds; no wall clock or interval is used.
 */
export const voltageSource = (
  id: string,
  a: string,
  b: string,
  waveform: (time: number) => number,
  dc = 0,
): Component => ({
  id,
  pins: { a, b },
  validate: () => (Number.isFinite(dc) ? [] : ["DC voltage must be finite."]),
  equations: ({ analysis }) => [
    potential(analysis.mode === "dc" ? dc : waveform(analysis.time)),
  ],
});
