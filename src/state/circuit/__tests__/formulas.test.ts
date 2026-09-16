import { describe, expect, it } from "vitest";
import {
  componentErrors,
  componentCatalog,
  defaults,
  parseCircuit,
  currentFlow,
  constrainOffset,
} from "../formulas";

import { solve, type Kind } from "~/lib/circuit/solver";
import type { Part } from "../data";

const bounds = { left: 100, right: 500, top: 80, bottom: 280 };
const viewport = { width: 800, height: 600 };

describe("canvas scroll limits", () => {
  it("preserves 30% of the canvas on each axis at both extremes", () => {
    expect(
      constrainOffset({ x: -10000, y: -10000 }, bounds, 1, viewport),
    ).toEqual({ x: -260, y: -100 });

    expect(
      constrainOffset({ x: 10000, y: 10000 }, bounds, 1, viewport),
    ).toEqual({ x: 460, y: 340 });
  });

  it("accounts for zoom and viewport resizing", () => {
    expect(
      constrainOffset({ x: -10000, y: -10000 }, bounds, 0.5, viewport),
    ).toEqual({ x: -50, y: -40 });

    expect(
      constrainOffset({ x: 460, y: 340 }, bounds, 1, {
        width: 400,
        height: 300,
      }),
    ).toEqual({ x: 180, y: 130 });
  });

  it("keeps oversized circuits scrollable using viewport overlap", () => {
    const large = { left: 0, right: 10000, top: 0, bottom: 10000 };

    expect(constrainOffset({ x: 10000, y: 10000 }, large, 1, viewport)).toEqual(
      { x: 560, y: 420 },
    );

    expect(
      constrainOffset({ x: -10000, y: -10000 }, large, 1, viewport),
    ).toEqual({ x: -9760, y: -9820 });
  });

  it("keeps small circuits fully visible on each axis", () => {
    const small = { left: 100, right: 180, top: 100, bottom: 140 };

    expect(
      constrainOffset({ x: -10000, y: -10000 }, small, 1, viewport),
    ).toEqual({ x: -100, y: -100 });

    expect(constrainOffset({ x: 10000, y: 10000 }, small, 1, viewport)).toEqual(
      { x: 620, y: 460 },
    );
  });

  it("keeps an empty canvas at the origin", () => {
    expect(constrainOffset({ x: 100, y: 100 }, undefined, 1, viewport)).toEqual(
      { x: 0, y: 0 },
    );
  });
});

describe("current visualization", () => {
  it("distinguishes zero current from unavailable readings", () => {
    expect(currentFlow(0, 0).status).toBe("idle");
    expect(currentFlow(1e-15, 1).status).toBe("idle");
    expect(currentFlow(undefined, 0).status).toBe("unknown");
    expect(currentFlow(NaN, 0).status).toBe("unknown");
  });

  it("reverses negative current and preserves branch speed ratios", () => {
    expect(currentFlow(-0.009, 0.0135).reverse).toBe(true);
    expect(currentFlow(0.009, 0.0135).reverse).toBe(false);
    expect(currentFlow(0.0045, 0.0135).duration).toBeCloseTo(
      2 * currentFlow(0.009, 0.0135).duration,
    );
  });
});

describe("component validation", () => {
  const part = (kind: Kind, value = defaults[kind]): Part => ({
    id: "X",
    kind,
    value,
    a: "p",
    b: "g",
    x: 100,
    y: 100,
    closed: true,
  });

  const source: Part = { ...part("source", 9), id: "V" };

  it("flags LED overcurrent and excess power, and clears after adding resistance", () => {
    const led = part("led");
    const direct = [source, led];
    const errors = componentErrors(led, direct, solve(direct));

    expect(errors.some((e) => e.startsWith("Power"))).toBe(true);
    expect(errors.some((e) => e.startsWith("Current"))).toBe(true);

    const safeLed = { ...led, a: "m" };
    const safe = [
      source,
      { ...part("resistor", 1000), id: "R", b: "m" },
      safeLed,
    ];

    expect(componentErrors(safeLed, safe, solve(safe))).toEqual([]);
  });

  it("reports LED reverse voltage without treating small reverse bias as damage", () => {
    const led = { ...part("led"), a: "g", b: "p" };
    const parts = [source, led];

    expect(componentErrors(led, parts, solve(parts)).join(" ")).toContain(
      "Reverse voltage",
    );

    const safe = [{ ...source, value: 3 }, led];

    expect(componentErrors(led, safe, solve(safe))).toEqual([]);
  });

  it("validates every component and identifies disconnected pins", () => {
    for (const { kind } of componentCatalog) {
      const p = part(kind, NaN);
      const errors = componentErrors(p, [p], solve([p]));

      expect(errors).toContain("Value must be finite.");
      expect(errors.join(" ")).toContain("Terminal A is disconnected");
      expect(errors.join(" ")).toContain("Terminal B is disconnected");
    }
  });

  it("checks resistor, rheostat, lamp, capacitor, diode, switch and source ratings", () => {
    for (const [kind, voltage, current] of [
      ["resistor", 10, 0.1],
      ["rheostat", 10, 0.1],
      ["lamp", 10, 0.2],
      ["capacitor", 20, 0],
      ["diode", 2, 2],
      ["switch", 0, 1],
      ["source", 9, -1],
    ] as const) {
      const p = part(kind);

      expect(
        componentErrors(p, [p, { ...source, id: "other" }], {
          nodes: {},
          readings: {
            X: { a: voltage, b: 0, voltage, current, power: voltage * current },
          },
        }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("explains unsolved states for connected components", () => {
    const p = part("switch");
    const parts = [source, p];

    expect(componentErrors(p, parts, solve(parts)).join(" ")).toContain(
      "Electrical state unavailable",
    );
  });

  it("round-trips every component kind while keeping wires out of the library", () => {
    const parts = componentCatalog.map(({ kind }, i) => ({
      ...part(kind),
      id: String(i),
    }));

    expect(componentCatalog.some((c) => c.kind === "wire")).toBe(false);
    expect(parseCircuit(JSON.stringify({ version: 1, parts }))).toEqual(parts);
  });
});
