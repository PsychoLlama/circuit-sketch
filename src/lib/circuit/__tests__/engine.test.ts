import { describe, expect, it } from "vitest";
import { analyze } from "../engine";
import { admittance, potential, voltageSource } from "../devices";
import { toComponent, type Branch } from "../solver";
import type { Component, Equation } from "../model";

const resistor = (id: string, a: string, b: string, value = 1000) =>
  toComponent({ id, kind: "resistor", a, b, value });
const supply = voltageSource("V", "p", "g", () => 12, 12);
const expectFailure = (components: Component[]) => {
  const result = analyze(components, { mode: "dc" }, "g");

  expect(result.diagnostics.length).toBeGreaterThan(0);
  expect(result.nodes).toEqual({});
  expect(result.components).toEqual({});
  return result;
};

describe("component equation engine", () => {
  it("supports a new current source without changing the engine", () => {
    const current: Component = {
      id: "I",
      pins: { a: "g", b: "p" },
      validate: () => [],
      equations: () => [admittance(0, 0.01)],
    };
    const result = analyze(
      [current, resistor("R", "p", "g")],
      { mode: "dc" },
      "g",
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.nodes.p).toBeCloseTo(10, 12);
    expect(result.components.I.branches.main.power).toBeCloseTo(-0.1, 12);
    expect(result.components.R.pins.a).toEqual({
      node: "p",
      voltage: 10,
      current: 0.01,
    });
    expect(result.components.R.pins.b.current).toBe(-0.01);
  });

  it("supports multiport controlled sources with zero input current", () => {
    const amplifier: Component = {
      id: "A",
      pins: { input: "p", output: "o", ground: "g" },
      validate: () => [],
      equations: () => [
        {
          id: "output",
          a: "output",
          b: "ground",
          voltage: { output: 1, input: -2, ground: 1 },
          current: 0,
          rhs: 0,
        },
      ],
    };
    const result = analyze(
      [supply, amplifier, resistor("R", "o", "g")],
      { mode: "dc" },
      "g",
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.nodes.o).toBeCloseTo(24, 12);
    expect(result.components.A.pins.input.current).toBe(0);
    expect(result.components.A.pins.output.current).toBeCloseTo(-0.024, 12);
    expect(result.components.A.branches.output.power).toBeCloseTo(-0.576, 12);
  });

  it("composes several branch laws in one component and allows aliased pins", () => {
    const divider: Component = {
      id: "divider",
      pins: { a: "p", m: "m", b: "g", alias: "g" },
      validate: () => [],
      equations: (): Equation[] => [
        {
          id: "top",
          a: "a",
          b: "m",
          voltage: { a: -1, m: 1 },
          current: 1000,
          rhs: 0,
        },
        {
          id: "bottom",
          a: "m",
          b: "alias",
          voltage: { m: -1, alias: 1 },
          current: 2000,
          rhs: 0,
        },
      ],
    };
    const result = analyze([supply, divider], { mode: "dc" }, "g");

    expect(result.diagnostics).toEqual([]);
    expect(result.nodes.m).toBeCloseTo(8, 12);
    expect(result.components.divider.pins.m.current).toBeCloseTo(0, 12);
    expect(result.components.divider.branches.top.current).toBeCloseTo(
      0.004,
      12,
    );
  });

  it("rejects isolated capacitor charge and disconnected current sources", () => {
    expectFailure([
      supply,
      toComponent({ id: "C", kind: "capacitor", a: "x", b: "g", value: 1e-6 }),
    ]);
    expectFailure([
      supply,
      {
        id: "I",
        pins: { a: "x", b: "g" },
        validate: () => [],
        equations: () => [admittance(0, 1)],
      },
    ]);
  });

  it("reports invalid and unknown persisted models", () => {
    for (const branch of [
      { id: "bad", kind: "unknown", a: "p", b: "g", value: 1 },
      { id: "bad", kind: "switch", a: "p", b: "g", value: 0, closed: "false" },
    ]) {
      const result = expectFailure([supply, toComponent(branch as Branch)]);
      expect(result.diagnostics[0].component).toBe("bad");
    }
  });

  it("contains model errors, malformed equations, and numeric overflow", () => {
    const base: Component = {
      id: "bad",
      pins: { a: "p", b: "g" },
      validate: () => [],
      equations: () => [potential(0)],
    };
    for (const equations of [
      () => [{ ...potential(0), a: "missing" }],
      () => [potential(0), potential(1)],
      () => [{ ...potential(0), rhs: Infinity }],
      () => [{ ...potential(0), voltage: { a: NaN } }],
      () => [{ ...potential(0), voltage: { a: 1 } }],
      () => {
        throw new Error("Device cannot support this analysis.");
      },
    ])
      expectFailure([supply, { ...base, equations }]);
    expectFailure([
      voltageSource("huge", "p", "g", () => 1e200, 1e200),
      resistor("R", "p", "g", 1),
    ]);
  });

  it("returns convergence errors rather than inconsistent nonlinear readings", () => {
    const unstable: Component = {
      id: "unstable",
      pins: { a: "p", b: "g" },
      validate: () => [],
      equations: ({ voltage }) => [potential(voltage("a") > 0.5 ? 0 : 1)],
    };
    expect(expectFailure([unstable]).diagnostics[0].code).toBe("convergence");
  });

  it("rejects changing branch topology during iteration", () => {
    const unstable: Component = {
      id: "unstable",
      pins: { a: "p", b: "g" },
      validate: () => [],
      equations: ({ voltage }) => [
        { ...potential(1), id: voltage("a") ? "changed" : "initial" },
      ],
    };
    expect(expectFailure([unstable]).diagnostics[0].message).toContain(
      "topology",
    );
  });

  it("treats prototype-like identifiers as ordinary identifiers", () => {
    const result = analyze(
      [
        voltageSource("__proto__", "constructor", "g", () => 5, 5),
        resistor("constructor", "constructor", "g"),
      ],
      { mode: "dc" },
      "g",
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.components.__proto__.branches.main.current).toBeCloseTo(
      -0.005,
      12,
    );
  });

  it("checks KCL and conservation across generated networks and permutations", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const network = [
        supply,
        resistor("a", "p", "x", seed * 71),
        resistor("b", "x", "g", seed * 137),
        resistor("c", "p", "y", 311),
        resistor("d", "y", "g", 419),
        resistor("e", "x", "y", seed * 59),
      ];
      for (const reference of ["p", "x", "y", "g"]) {
        const result = analyze(
          [...network].reverse(),
          { mode: "dc" },
          reference,
        );
        expect(result.diagnostics).toEqual([]);
        const pins = Object.values(result.components).flatMap((c) =>
          Object.values(c.pins),
        );
        for (const node of Object.keys(result.nodes))
          expect(
            pins
              .filter((pin) => pin.node === node)
              .reduce((sum, pin) => sum + pin.current, 0),
          ).toBeCloseTo(0, 12);
        expect(
          Object.values(result.components)
            .flatMap((c) => Object.values(c.branches))
            .reduce((sum, branch) => sum + branch.power, 0),
        ).toBeCloseTo(0, 12);
      }
    }
  });
});
