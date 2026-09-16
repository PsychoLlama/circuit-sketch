import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { createCircuitGraph, createComponentControl } from "../graph";
import { voltageSource } from "../devices";
import { analyze } from "../engine";
import { toComponent } from "../solver";
import type { Analysis } from "../model";

const source = voltageSource("V", "p", "g", () => 12, 12);
const resistor = toComponent({
  id: "R",
  kind: "resistor",
  a: "p",
  b: "m",
  value: 1000,
});

describe("reactive circuit graph", () => {
  it("updates all observations atomically when a switch is manipulated", () =>
    createRoot((dispose) => {
      const control = createComponentControl(false, (closed) =>
        toComponent({
          id: "S",
          kind: "switch",
          a: "m",
          b: "g",
          value: 0,
          closed,
        }),
      );
      const graph = createCircuitGraph(
        () => [source, resistor, control.component()],
        undefined,
        () => "g",
      );
      const middle = graph.node("m");
      const pin = graph.pin("S", "a");
      const reading = graph.component("R");

      expect(middle()).toBeCloseTo(12, 12);
      expect(pin()?.current).toBe(0);
      control.setParameters(true);
      expect(middle()).toBe(0);
      expect(pin()?.current).toBeCloseTo(0.012, 12);
      expect(reading()?.branches.main.current).toBeCloseTo(0.012, 12);
      expect(graph.snapshot().diagnostics).toEqual([]);
      dispose();
    }));

  it("invalidates removed nodes and failed snapshots", () =>
    createRoot((dispose) => {
      const [components, setComponents] = createSignal([source, resistor]);
      const graph = createCircuitGraph(components);
      const middle = graph.node("m");

      expect(middle()).toBeDefined();
      setComponents([resistor]);
      expect(middle()).toBeDefined();
      setComponents([]);
      expect(middle()).toBeUndefined();
      expect(graph.component("R")()).toBeUndefined();
      expect(graph.pin("R", "a")()).toBeUndefined();
      expect(graph.node("toString")()).toBeUndefined();
      expect(graph.component("toString")()).toBeUndefined();
      setComponents([source, source]);
      expect(graph.snapshot().diagnostics.length).toBeGreaterThan(0);
      expect(graph.node("p")()).toBeUndefined();
      dispose();
    }));

  it("blinks an LED at declarative times and supports backward/random access", () =>
    createRoot((dispose) => {
      const [time, setTime] = createSignal(0);
      const pulse = voltageSource("pulse", "p", "g", (t) =>
        t % 1 < 0.5 ? 5 : 0,
      );
      const led = toComponent({
        id: "L",
        kind: "led",
        a: "m",
        b: "g",
        value: 2,
      });
      const graph = createCircuitGraph(
        () => [pulse, resistor, led],
        () => ({ mode: "snapshot", time: time() }),
        () => "g",
      );
      const current = () => graph.component("L")()?.branches.main.current;
      const initial = graph.snapshot();

      expect(current()).toBeCloseTo(3 / 1010, 8);
      setTime(0.75);
      expect(current()).toBeCloseTo(0, 12);
      setTime(1000.25);
      expect(current()).toBeCloseTo(3 / 1010, 8);
      setTime(0);
      expect(graph.snapshot()).toEqual(initial);
      dispose();
    }));

  it("rejects transient capacitor queries instead of inventing stored charge", () => {
    const capacitor = toComponent({
      id: "C",
      kind: "capacitor",
      a: "m",
      b: "g",
      value: 1e-6,
    });
    const result = analyze(
      [source, resistor, capacitor],
      { mode: "snapshot", time: 1 },
      "g",
    );

    expect(result.diagnostics[0].component).toBe("C");
    expect(result.diagnostics[0].message).toContain("initial conditions");
    expect(result.nodes).toEqual({});
    expect(
      analyze([source, resistor, capacitor], { mode: "dc" }, "g").components.C
        .branches.main.voltage,
    ).toBeCloseTo(12, 12);
  });

  it("rejects invalid time and nonfinite waveforms", () => {
    for (const time of [-1, NaN, Infinity])
      expect(
        analyze([source], { mode: "snapshot", time }).diagnostics[0].code,
      ).toBe("invalid");
    expect(
      analyze([source], { mode: "transient" } as unknown as Analysis)
        .diagnostics[0].code,
    ).toBe("invalid");
    expect(
      analyze([voltageSource("V", "p", "g", () => NaN)], {
        mode: "snapshot",
        time: 0,
      }).diagnostics[0].code,
    ).toBe("numerical");
  });
});
