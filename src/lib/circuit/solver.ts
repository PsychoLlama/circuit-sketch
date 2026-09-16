/** Compatibility adapter for persisted editor branches. Physics lives in component models. */
import { analyze } from "./engine";
import { models } from "./devices";
import type { Component, Diagnostic } from "./model";

export type Kind =
  | "source"
  | "resistor"
  | "switch"
  | "capacitor"
  | "wire"
  | "led"
  | "diode"
  | "rheostat"
  | "lamp";

export type Branch = {
  id: string;
  kind: Kind;
  a: string;
  b: string;
  value: number;
  closed?: boolean;
};

export type Reading = {
  a: number;
  b: number;
  voltage: number;
  current: number;
  power: number;
};

export type Solution = {
  diagnostics?: Diagnostic[];
  readings: Record<string, Reading>;
  nodes: Record<string, number>;
  error?: string;
  reference?: string;
};

export const isDiode = (b: Branch) => b.kind === "led" || b.kind === "diode";

export const parameterErrors = (b: Branch): string[] => {
  const errors: string[] = [];

  if (!Object.hasOwn(models, b.kind))
    errors.push("Unsupported component kind.");
  if (!b.id) errors.push("Component identifier is required.");
  if (b.closed !== undefined && typeof b.closed !== "boolean")
    errors.push("Switch state must be boolean.");
  if (!Number.isFinite(b.value)) errors.push("Value must be finite.");
  else if (
    ["resistor", "rheostat", "lamp", "capacitor", "led", "diode"].includes(
      b.kind,
    ) &&
    b.value <= 0
  )
    errors.push("Value must be greater than zero.");
  else if (b.kind === "wire" && b.value < 0)
    errors.push("Wire resistance cannot be negative.");

  if (!b.a || !b.b) errors.push("Both terminals need a node.");
  if (b.a === b.b)
    errors.push("Both terminals are connected to the same node.");

  return errors;
};

export const toComponent = (branch: Branch): Component => ({
  id: branch.id,
  pins: { a: branch.a, b: branch.b },
  validate: (analysis) => [
    ...parameterErrors(branch),
    ...(branch.kind === "capacitor" && analysis.mode !== "dc"
      ? [
          "Capacitor time queries require a transient analysis with initial conditions; only DC equilibrium is supported.",
        ]
      : []),
  ],
  equations: (context) => [models[branch.kind](branch, context)],
});

export const solve = (branches: Branch[], reference?: string): Solution => {
  const result = analyze(
    branches.map(toComponent),
    { mode: "dc" },
    reference ?? branches.find((branch) => branch.kind === "source")?.b,
  );
  return {
    readings: Object.fromEntries(
      Object.entries(result.components).map(([id, observation]) => [
        id,
        observation.branches.main,
      ]),
    ),
    nodes: result.nodes,
    reference: result.reference,
    diagnostics: result.diagnostics,
    ...(result.diagnostics.length
      ? {
          error: result.diagnostics
            .map((diagnostic) => diagnostic.message)
            .join(" "),
        }
      : {}),
  };
};
