import { describe, expect, it } from "vitest";
import { solve, type Branch } from "../solver";

const source: Branch = { id: "V", kind: "source", a: "p", b: "g", value: 12 };
const r = (id: string, a: string, b: string, value: number): Branch => ({
  id,
  kind: "resistor",
  a,
  b,
  value,
});

describe("DC circuit physics", () => {
  it("starts empty", () => expect(solve([]).readings).toEqual({}));

  it("solves Ohm’s law and delivered power", () => {
    const s = solve([source, r("R", "p", "g", 1000)]);
    expect(s.readings.R.current).toBeCloseTo(0.012);
    expect(s.readings.V.power).toBeCloseTo(-0.144);
  });

  it("solves a voltage divider", () => {
    const s = solve([source, r("R1", "p", "m", 1000), r("R2", "m", "g", 2000)]);
    expect(s.nodes.m).toBeCloseTo(8);
    expect(s.readings.R1.current).toBeCloseTo(0.004);
  });

  it("sums parallel currents and conserves energy", () => {
    const s = solve([source, r("R1", "p", "g", 1000), r("R2", "p", "g", 2000)]);
    expect(s.readings.V.current).toBeCloseTo(-0.018);
    expect(
      Object.values(s.readings).reduce((n, r) => n + r.power, 0),
    ).toBeCloseTo(0);
  });

  it("opens and closes ideal switches", () => {
    const b: Branch[] = [
      source,
      r("R", "p", "m", 1000),
      { id: "S", kind: "switch", a: "m", b: "g", value: 0, closed: false },
    ];
    expect(solve(b).readings.R.current).toBeCloseTo(0);
    expect(
      solve(b.map((x) => ({ ...x, closed: true }))).readings.R.current,
    ).toBeCloseTo(0.012);
  });

  it("treats a capacitor as an open circuit at DC", () => {
    const s = solve([
      source,
      r("R", "p", "m", 1000),
      { id: "C", kind: "capacitor", a: "m", b: "g", value: 1e-6 },
    ]);
    expect(s.readings.C.voltage).toBeCloseTo(12);
    expect(s.readings.C.current).toBe(0);
  });

  it("measures ideal and resistive wire currents", () => {
    for (const value of [0, 2]) {
      const s = solve([
        source,
        { id: "W", kind: "wire", a: "p", b: "m", value },
        r("R", "m", "g", 1000),
      ]);
      expect(s.readings.W.current).toBeCloseTo(12 / (1000 + value));
      expect(s.readings.W.voltage).toBeCloseTo((value * 12) / (1000 + value));
    }
  });

  it("rejects shorted sources and redundant ideal loops", () => {
    expect(
      solve([source, { id: "W", kind: "wire", a: "p", b: "g", value: 0 }])
        .error,
    ).toBeTruthy();
    expect(solve([source, { ...source, id: "V2" }]).error).toBeTruthy();
  });

  it("does not invent voltages on floating nodes", () =>
    expect(solve([source, r("R", "x", "y", 100)]).error).toContain("Floating"));

  it("rejects invalid parameters", () => {
    for (const value of [0, -1, NaN, Infinity])
      expect(solve([source, r("R", "p", "g", value)]).error).toBeTruthy();
  });

  it("handles reversed polarity and arbitrary reference", () => {
    const s = solve([{ ...source, value: -5 }, r("R", "p", "g", 1000)], "p");
    expect(s.nodes.g).toBeCloseTo(5);
    expect(s.readings.R.current).toBeCloseTo(-0.005);
  });

  it("solves a balanced bridge with zero cross current", () => {
    const s = solve([
      source,
      r("a", "p", "x", 100),
      r("b", "x", "g", 100),
      r("c", "p", "y", 100),
      r("d", "y", "g", 100),
      r("e", "x", "y", 100),
    ]);
    expect(s.readings.e.current).toBeCloseTo(0);
  });

  it("retains tiny currents through large resistances", () =>
    expect(
      solve([source, r("R", "p", "g", 1e12)]).readings.R.current,
    ).toBeCloseTo(12e-12, 20));
});

describe("breadboard components", () => {
  const led: Branch = { id: "L", kind: "led", a: "m", b: "g", value: 2 };

  it("limits LED current with a series resistor and conserves power", () => {
    const result = solve([source, r("R", "p", "m", 1000), led]);
    expect(result.error).toBeUndefined();
    expect(result.readings.L.current).toBeCloseTo(10 / 1010, 7);
    expect(
      Object.values(result.readings).reduce((sum, b) => sum + b.power, 0),
    ).toBeCloseTo(0, 10);
  });

  it("blocks reverse bias and conducts above the forward voltage", () => {
    for (const kind of ["led", "diode"] as const) {
      const reverse = solve([
        source,
        r("R", "p", "m", 1000),
        { ...led, kind, a: "g", b: "m" },
      ]);
      expect(reverse.error).toBeUndefined();
      expect(Math.abs(reverse.readings.L.current)).toBeLessThan(1e-6);
      const direct = solve([source, { ...led, kind, a: "p" }]);
      expect(direct.readings.L.current).toBeGreaterThan(0.9);
    }
  });

  it("keeps an LED off below its threshold", () => {
    const result = solve([
      { ...source, value: 1 },
      r("R", "p", "m", 1000),
      led,
    ]);
    expect(result.readings.L.current).toBeLessThan(1e-8);
  });

  it("models lamps and rheostats as resistive DC loads", () => {
    for (const kind of ["lamp", "rheostat"] as const)
      expect(
        solve([source, { ...r("R", "p", "g", 100), kind }]).readings.R.current,
      ).toBeCloseTo(0.12);
  });

  it("rejects invalid values for every new component", () => {
    for (const kind of ["led", "diode", "lamp", "rheostat"] as const)
      for (const value of [0, -1, Infinity, NaN])
        expect(solve([source, { ...led, kind, value }]).error).toBeTruthy();
  });
});
