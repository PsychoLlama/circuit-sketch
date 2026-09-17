import { describe, expect, it, vi } from "vitest";
import * as effects from "../effects";
import { changeSpeed, seekTime, togglePlayback } from "../actions";
import { playback, setFrameTime, setParts } from "../data";
import { simulationTime, solution, timeAt } from "../formulas";

const clock = () => vi.spyOn(effects, "timestamp");

describe("timestamp-anchored playback", () => {
  it("derives time directly even after a long gap between frames", () => {
    expect(
      timeAt(
        { running: true, speed: 0.1, wallAnchor: 100, timeAnchor: 2 },
        10100,
        0,
      ),
    ).toBe(3);
    expect(
      timeAt(
        { running: false, speed: 10, wallAnchor: 100, timeAnchor: 2 },
        10100,
        4,
      ),
    ).toBe(4);
  });
  it("keeps time continuous across speed changes, pause, resume, and seek", () => {
    const now = clock().mockReturnValue(1000);
    expect(playback().running).toBe(true);
    seekTime(0);
    setFrameTime(2000);
    expect(simulationTime()).toBeCloseTo(0.001);
    now.mockReturnValue(2000);
    changeSpeed(0.01);
    expect(simulationTime()).toBeCloseTo(0.001);
    setFrameTime(3000);
    expect(simulationTime()).toBeCloseTo(0.011);
    now.mockReturnValue(3000);
    togglePlayback();
    setFrameTime(10000);
    expect(simulationTime()).toBeCloseTo(0.011);
    now.mockReturnValue(10000);
    togglePlayback();
    setFrameTime(11000);
    expect(simulationTime()).toBeCloseTo(0.021);
    now.mockReturnValue(11000);
    seekTime(0.002);
    expect(simulationTime()).toBeCloseTo(0.002);
    now.mockRestore();
  });
  it("recomputes capacitor readings when seeking backward, without charge mutation", () => {
    const now = clock().mockReturnValue(0);
    setParts([
      { id: "R", kind: "resistor", a: "a", b: "g", value: 1000, x: 0, y: 0 },
      {
        id: "C",
        kind: "capacitor",
        a: "a",
        b: "g",
        value: 1e-6,
        initialVoltage: 5,
        x: 0,
        y: 0,
      },
    ]);
    seekTime(0.001);
    expect(solution().readings.C.voltage).toBeCloseTo(5 / Math.E, 6);
    seekTime(0);
    expect(solution().readings.C.voltage).toBe(5);
    seekTime(0.001);
    expect(solution().readings.C.voltage).toBeCloseTo(5 / Math.E, 6);
    now.mockRestore();
  });
});
