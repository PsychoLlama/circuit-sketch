import { describe, expect, it } from "vitest";
import { __resetSignals } from "~/lib/signals";
import * as data from "../data";
import { example, update } from "../actions";
import { hovered, inspectedPart, selectedPart, solution } from "../formulas";

describe("shared editor state", () => {
  it("resets circuit, interaction, history, viewport and identifier state", () => {
    example("series");

    const initial = data.parts();

    data.setHover({ id: initial[0].id, x: 10, y: 20 });
    data.setPending(initial[0].a);
    data.setTool("wire");
    data.setSuppressClick(true);
    data.setPinDrag(initial[0].a);
    data.setPreview({ x: 10, y: 20 });
    data.setLabels(false);
    data.setOffset({ x: 10, y: 20 });
    data.setViewport({ width: 800, height: 600 });
    data.setZoom(0.5);
    data.setFuture([initial]);
    data.setDrag({
      id: initial[0].id,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      before: initial,
    });

    __resetSignals();

    expect(data.parts()).toEqual([]);
    expect(data.selected()).toBeUndefined();
    expect(data.pending()).toBeUndefined();
    expect(data.tool()).toBe("select");
    expect(data.hover()).toBeUndefined();
    expect(data.suppressClick()).toBe(false);
    expect(data.pinDrag()).toBeUndefined();
    expect(data.preview()).toBeUndefined();
    expect(data.labels()).toBe(true);
    expect(data.offset()).toEqual({ x: 0, y: 0 });
    expect(data.viewport()).toEqual({ width: 0, height: 0 });
    expect(data.zoom()).toBe(1);
    expect(data.history()).toEqual([]);
    expect(data.future()).toEqual([]);
    expect(data.drag()).toBeUndefined();
    expect(data.serial()).toBe(0);
    expect(selectedPart()).toBeUndefined();
    expect(hovered()).toBeUndefined();
    expect(inspectedPart()).toBeUndefined();
    expect(solution().readings).toEqual({});

    example("series");
    expect(data.parts()).toEqual(initial);
  });

  it("updates the cached solver across edits and resets without rebuilding queries", () => {
    example("series");

    const resistor = data.parts()[1];
    const initial = solution();

    expect(initial.readings[resistor.id].current).toBeCloseTo(0.009);
    data.setZoom(0.5);
    data.setSelected(undefined);
    expect(solution()).toBe(initial);
    update(resistor.id, { value: 2000 });
    expect(solution()).not.toBe(initial);
    expect(solution().readings[resistor.id].current).toBeCloseTo(0.0045);
    __resetSignals();
    expect(solution().readings).toEqual({});
    example("series");
    expect(solution().readings[resistor.id].current).toBeCloseTo(0.009);
  });
});
