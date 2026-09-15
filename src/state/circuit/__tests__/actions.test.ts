import { describe, it, expect, vi } from "vitest";
import { createLab } from "../actions";
import { solve } from "../../../lib/circuit/solver";

describe("circuit editing", () => {
  it("creates four physically consistent experiments", () => {
    for (const name of ["series", "divider", "parallel", "capacitor"]) {
      const lab = createLab();
      lab.example(name);

      const result = solve(lab.parts());
      expect(result.error).toBeUndefined();

      const source = lab.parts().find((p) => p.kind === "source")!;
      expect(result.readings[source.id].current).toBeCloseTo(
        name === "series"
          ? -0.009
          : name === "divider"
            ? -0.0045
            : name === "parallel"
              ? -0.0135
              : 0,
      );
    }
  });

  it("restores circuits through undo and redo", () => {
    const lab = createLab();
    lab.example("series");

    const initial = lab.parts();
    lab.clear();
    expect(lab.parts()).toHaveLength(0);
    lab.undo();
    expect(lab.parts()).toEqual(initial);
    lab.redo();
    expect(lab.parts()).toHaveLength(0);
  });

  it("makes a new wire from two pins and cancels self-connections", () => {
    const lab = createLab();
    lab.pin("a");
    lab.pin("a");
    expect(lab.parts()).toHaveLength(0);
    lab.pin("a");
    lab.pin("b");
    expect(lab.parts()[0]).toMatchObject({
      kind: "wire",
      a: "a",
      b: "b",
      value: 0,
    });
  });

  it("records value edits without modifying the previous graph", () => {
    const lab = createLab();
    lab.example("series");

    const r = lab.parts().find((p) => p.kind === "resistor")!;
    lab.update(r.id, { value: 2000 });
    expect(solve(lab.parts()).readings[r.id].current).toBeCloseTo(0.0045);
    lab.undo();
    expect(solve(lab.parts()).readings[r.id].current).toBeCloseTo(0.009);
  });
});

const keyboard = (key: string, options = {}) =>
  ({
    key,
    target: { closest: () => null },
    preventDefault: vi.fn(),
    ...options,
  }) as unknown as KeyboardEvent;

describe("editor shortcuts", () => {
  it("redoes with the uppercase Z produced by Ctrl+Shift+Z", () => {
    const lab = createLab();
    lab.example("series");
    const initial = lab.parts();
    lab.key(keyboard("z", { ctrlKey: true }));
    expect(lab.parts()).toHaveLength(0);
    lab.key(keyboard("Z", { ctrlKey: true, shiftKey: true }));
    expect(lab.parts()).toEqual(initial);
  });

  it("dismisses inspection with Escape even from a form field", () => {
    const lab = createLab();
    lab.example("series");
    lab.setHover({ id: lab.parts()[0].id, x: 0, y: 0 });
    lab.pin("a");
    lab.key(keyboard("Escape", { target: { closest: () => ({}) } }));
    expect(lab.selected()).toBeUndefined();
    expect(lab.hover()).toBeUndefined();
    expect(lab.pending()).toBeUndefined();
  });

  it("deletes a selected component and its wires with Backspace, with undo", () => {
    const lab = createLab();
    lab.example("series");
    const initial = lab.parts();
    const source = initial[0];
    lab.setSelected(source.id);
    lab.key(keyboard("Backspace"));
    expect(
      lab
        .parts()
        .some(
          (p) => p.id === source.id || p.a === source.a || p.b === source.b,
        ),
    ).toBe(false);
    lab.undo();
    expect(lab.parts()).toEqual(initial);
  });

  it("keeps Backspace inside form fields", () => {
    const lab = createLab();
    lab.example("series");
    const initial = lab.parts();
    lab.key(keyboard("Backspace", { target: { closest: () => ({}) } }));
    expect(lab.parts()).toEqual(initial);
  });

  it("does not clear selection on the canvas click after a component pointer release", () => {
    const lab = createLab();
    lab.example("series");
    const part = lab.parts()[0];
    const svg = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: vi.fn(),
    };
    lab.startDrag(
      {
        button: 0,
        clientX: part.x,
        clientY: part.y,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: { closest: () => svg },
      } as unknown as PointerEvent,
      part,
    );
    lab.endDrag();
    lab.canvas({ target: { closest: () => null } } as unknown as MouseEvent);
    expect(lab.selected()).toBe(part.id);
    lab.canvas({ target: { closest: () => null } } as unknown as MouseEvent);
    expect(lab.selected()).toBeUndefined();
  });
});

describe("pointer placement", () => {
  it("drops onto an occupied canvas at zoom-adjusted, snapped coordinates", () => {
    const lab = createLab();
    lab.example("series");
    lab.setZoom(0.5);
    lab.drop({
      clientX: 251,
      clientY: 151,
      currentTarget: {
        closest: () => ({
          getBoundingClientRect: () => ({ left: 100, top: 50 }),
        }),
      },
      target: { closest: () => ({}) },
      dataTransfer: { getData: () => "capacitor" },
      preventDefault: vi.fn(),
    } as unknown as DragEvent);
    expect(lab.parts().at(-1)).toMatchObject({
      kind: "capacitor",
      x: 300,
      y: 200,
    });
    lab.undo();
    expect(lab.parts()).toHaveLength(6);
  });

  it("restores a cancelled component drag without adding history", () => {
    const lab = createLab();
    lab.example("series");
    const before = lab.parts();
    const count = lab.history().length;
    const part = before[0];
    lab.setDrag({
      id: part.id,
      x: part.x,
      y: part.y,
      px: part.x,
      py: part.y,
      before,
    });
    lab.setParts(before.map((p) => ({ ...p, x: p.x + 100 })));
    lab.cancelDrag();
    expect(lab.parts()).toEqual(before);
    expect(lab.history()).toHaveLength(count);
    expect(lab.drag()).toBeUndefined();
  });
});
