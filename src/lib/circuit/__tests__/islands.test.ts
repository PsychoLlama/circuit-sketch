import { describe, expect, it } from "vitest";
import { analyzeIslands } from "../islands";
import { toComponent, toSolution, type Branch } from "../solver";

const loop: Branch[] = [
  { id: "V", kind: "source", a: "high", b: "ground", value: 9 },
  { id: "R", kind: "resistor", a: "high", b: "ground", value: 1000 },
];

const run = (branches: Branch[]) =>
  toSolution(analyzeIslands(branches.map(toComponent), undefined, "ground"));

describe("independent circuit islands", () => {
  it("solves an isolated nonlinear device without disturbing the powered loop", () => {
    const result = run([
      ...loop,
      { id: "L", kind: "led", a: "la", b: "lb", value: 2 },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.readings.R.current).toBeCloseTo(0.009);
    expect(result.readings.L.current).toBeCloseTo(0);
    expect(result.readings.L.voltage).toBeCloseTo(0);
  });

  it("uses independent voltage references for separate powered circuits", () => {
    const result = run([
      ...loop,
      { id: "V2", kind: "source", a: "a2", b: "b2", value: 12 },
      { id: "R2", kind: "resistor", a: "a2", b: "b2", value: 2000 },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.readings.R.current).toBeCloseTo(0.009);
    expect(result.readings.R2.current).toBeCloseTo(0.006);
    expect(result.nodes.ground).toBe(0);
  });

  it("retains good readings when an unrelated island cannot be solved", () => {
    const result = run([
      ...loop,
      { id: "C", kind: "capacitor", a: "ca", b: "cb", value: 1e-6 },
    ]);

    expect(result.error).toContain("C:");
    expect(result.readings.C).toBeUndefined();
    expect(result.readings.R.current).toBeCloseTo(0.009);
  });

  it("groups transitive connections regardless of input ordering", () => {
    const result = run([
      { id: "R", kind: "resistor", a: "x", b: "ground", value: 1000 },
      { id: "V", kind: "source", a: "high", b: "ground", value: 9 },
      { id: "W", kind: "wire", a: "high", b: "x", value: 0 },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.readings.R.current).toBeCloseTo(0.009);
  });

  it("rejects duplicate IDs across separate islands", () => {
    const result = run([
      ...loop,
      { id: "R", kind: "resistor", a: "ra", b: "rb", value: 1000 },
    ]);

    expect(result.error).toContain("duplicate");
    expect(result.readings).toEqual({});
  });
});
