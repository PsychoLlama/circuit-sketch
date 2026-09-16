import { describe, expect, it } from "vitest";
import { transient } from "../transient";
import { toComponent, type Branch } from "../solver";

const rc = (initialVoltage = 0, source = 9): Branch[] => [
  { id: "V", kind: "source", a: "s", b: "g", value: source },
  { id: "R", kind: "resistor", a: "s", b: "c", value: 1000 },
  { id: "C", kind: "capacitor", a: "c", b: "g", value: 1e-6, initialVoltage },
];
const query = (branches: Branch[], t: number) =>
  transient(branches.map(toComponent), t, "g");

describe("capacitor initial-value queries", () => {
  it.each([0, 0.00001, 0.001, 0.005, 0.02])(
    "matches RC charging at %s seconds and conserves power",
    (t) => {
      const result = query(rc(), t);
      expect(result.diagnostics).toEqual([]);
      const c = result.components.C.branches.main;
      expect(c.voltage).toBeCloseTo(9 * (1 - Math.exp(-t / 0.001)), 6);
      expect(c.current).toBeCloseTo(0.009 * Math.exp(-t / 0.001), 8);
      expect(
        Object.values(result.components).reduce(
          (sum, o) => sum + o.branches.main.power,
          0,
        ),
      ).toBeCloseTo(0, 12);
    },
  );
  it("discharges with correct current and energy signs", () => {
    const c = query(rc(5, 0), 0.001).components.C.branches.main;
    expect(c.voltage).toBeCloseTo(5 / Math.E, 6);
    expect(c.current).toBeCloseTo(-0.005 / Math.E, 8);
    expect(c.power).toBeLessThan(0);
  });
  it("is independent of query order", () => {
    const expected = query(rc(), 0.001);
    query(rc(), 0.01);
    query(rc(), 0);
    expect(query(rc(), 0.001)).toEqual(expected);
  });
  it("retains charge on an isolated capacitor", () => {
    const c = query([rc(5)[2]], 100).components.C.branches.main;
    expect(c.voltage).toBe(5);
    expect(c.current).toBe(0);
  });
  it("solves coupled capacitors", () => {
    const circuit = [
      ...rc(),
      { id: "R2", kind: "resistor" as const, a: "c", b: "d", value: 1000 },
      { id: "C2", kind: "capacitor" as const, a: "d", b: "g", value: 1e-6 },
    ];
    const result = query(circuit, 0.001);
    expect(result.diagnostics).toEqual([]);
    const c = result.components.C.branches.main;
    const c2 = result.components.C2.branches.main;
    const slow = (3 - Math.sqrt(5)) / 2;
    const fast = (3 + Math.sqrt(5)) / 2;
    expect(c.voltage).toBeCloseTo(
      9 *
        (1 -
          ((fast - 1) * Math.exp(-slow) + (1 - slow) * Math.exp(-fast)) /
            (fast - slow)),
      6,
    );
    expect(c2.voltage).toBeCloseTo(
      9 *
        (1 - (fast * Math.exp(-slow) - slow * Math.exp(-fast)) / (fast - slow)),
      6,
    );
    expect(c.voltage).toBeGreaterThan(c2.voltage);
    expect(c2.voltage).toBeGreaterThan(0);
    expect(result.components.R.branches.main.current).toBeCloseTo(
      c.current + c2.current,
      12,
    );
  });
  it("integrates the existing nonlinear diode model with a capacitor", () => {
    const circuit = rc();
    circuit[1] = { ...circuit[1], a: "d" };
    circuit.push({ id: "D", kind: "diode", a: "s", b: "d", value: 0.7 });
    const result = query(circuit, 0.001);
    expect(result.diagnostics).toEqual([]);
    expect(result.components.C.branches.main.voltage).toBeCloseTo(
      (9 - 0.7 * (1 - 1e-8)) * (1 - Math.exp(-0.001 / 0.00101)),
      6,
    );
  });

  it("rejects impulses and invalid conditions without stale readings", () => {
    for (const result of [
      query(rc(NaN), 1),
      query(rc(), -1),
      query([rc()[0], { ...rc()[2], a: "s" }], 1),
    ]) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.components).toEqual({});
    }
  });
});
