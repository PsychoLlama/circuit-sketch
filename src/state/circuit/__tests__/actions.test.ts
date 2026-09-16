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

describe("canvas scrolling", () => {
  const wheel = (deltaX: number, deltaY: number, options = {}) =>
    ({
      deltaX,
      deltaY,
      deltaMode: 0,
      preventDefault: vi.fn(),
      ...options,
    }) as unknown as WheelEvent;

  it("scrolls both axes without changing the circuit or undo history", () => {
    const lab = createLab();
    lab.example("series");
    lab.setViewport({ width: 800, height: 600 });
    const initial = lab.parts();
    const history = lab.history();
    lab.scroll(wheel(30, 40));
    expect(lab.pan()).toEqual({ x: -30, y: -40 });
    lab.scroll(wheel(0, 20, { shiftKey: true }));
    expect(lab.pan()).toEqual({ x: -50, y: -40 });
    expect(lab.parts()).toBe(initial);
    expect(lab.history()).toBe(history);
  });

  it("reverses immediately after reaching a scroll limit", () => {
    const lab = createLab();
    lab.example("series");
    lab.setViewport({ width: 800, height: 600 });
    lab.scroll(wheel(10000, 10000));
    const limit = lab.pan();
    lab.scroll(wheel(-10, -10));
    expect(lab.pan()).toEqual({ x: limit.x + 10, y: limit.y + 10 });
  });

  it("places components under the pointer after scrolling and zooming", () => {
    const lab = createLab();
    lab.example("series");
    lab.setViewport({ width: 800, height: 600 });
    lab.setZoom(0.5);
    lab.scroll(wheel(40, 50));
    lab.drop({
      clientX: 200,
      clientY: 150,
      currentTarget: {
        closest: () => ({
          getBoundingClientRect: () => ({ left: 100, top: 50 }),
        }),
      },
      dataTransfer: { getData: () => "resistor" },
      preventDefault: vi.fn(),
    } as unknown as DragEvent);
    expect(lab.parts().at(-1)).toMatchObject({ x: 280, y: 300 });
  });

  it("resets scrolling when loading an experiment or clearing", () => {
    const lab = createLab();
    lab.example("series");
    lab.setViewport({ width: 800, height: 600 });
    lab.scroll(wheel(40, 50));
    lab.example("parallel");
    expect(lab.pan()).toEqual({ x: 0, y: 0 });
    lab.scroll(wheel(40, 50));
    lab.clear();
    expect(lab.pan()).toEqual({ x: 0, y: 0 });
  });
});

describe("experiment flow", () => {
  it("shows total current on the shared rails and branch current after the split", () => {
    const lab = createLab();
    lab.example("parallel");
    const [source, upper, lower] = lab.parts();
    const result = solve(lab.parts());
    const wires = lab.parts().filter((p) => p.kind === "wire");

    wires.forEach((wire, i) =>
      expect(Math.abs(result.readings[wire.id].current)).toBeCloseTo(
        i < 2 ? 0.0135 : 0.0045,
      ),
    );
    expect(wires.some((w) => w.a === upper.a && w.b === lower.a)).toBe(true);
    expect(source.x).toBe(upper.x);
    expect(upper.x).toBe(lower.x);
    expect(new Set(wires.map(lab.path)).size).toBe(4);
  });

  it("stops current throughout a series loop when the switch opens", () => {
    const lab = createLab();
    lab.example("series");
    const sw = lab.parts().find((p) => p.kind === "switch")!;
    lab.update(sw.id, { closed: false });
    const result = solve(lab.parts());

    expect(result.error).toBeUndefined();
    for (const reading of Object.values(result.readings))
      expect(reading.current).toBeCloseTo(0);
  });
});

describe("replacement and reconnection", () => {
  it("replaces an edited circuit with an example in one undo step", () => {
    const lab = createLab();
    lab.example("series");
    lab.update(lab.parts()[1].id, { value: 3300 });
    const before = lab.parts();
    lab.example("parallel");
    const replacement = lab.parts();
    lab.undo();
    expect(lab.parts()).toEqual(before);
    lab.redo();
    expect(lab.parts()).toEqual(replacement);
  });

  it("joins wires across a removed component and preserves their resistance", () => {
    const lab = createLab();
    lab.example("series");
    const resistor = lab.parts()[1];
    const attached = lab
      .parts()
      .filter(
        (p) =>
          p.kind === "wire" &&
          [p.a, p.b].some((node) => node === resistor.a || node === resistor.b),
      );
    lab.update(attached[0].id, { value: 20 });
    lab.update(attached[1].id, { value: 30 });
    const before = lab.parts();
    lab.remove(resistor.id);
    expect(lab.parts()).toHaveLength(4);
    expect(lab.parts().find((p) => p.id === attached[0].id)?.value).toBe(50);
    const result = solve(lab.parts());
    expect(result.error).toBeUndefined();
    expect(Math.abs(result.readings[lab.parts()[0].id].current)).toBeCloseTo(
      9 / 50,
    );
    lab.undo();
    expect(lab.parts()).toEqual(before);
    lab.redo();
    expect(lab.parts()).toHaveLength(4);
  });

  it("reverses inserting a component into a resistive wire by deleting it", () => {
    const lab = createLab();
    lab.example("series");
    const wire = lab.parts().find((p) => p.kind === "wire")!;
    lab.update(wire.id, { value: 12 });
    lab.insert("resistor", wire.id);
    lab.remove();
    expect(lab.parts().find((p) => p.id === wire.id)).toEqual({
      ...wire,
      value: 12,
    });
    expect(lab.parts()).toHaveLength(6);
  });
});

describe("saved circuits", () => {
  it("restores edits, avoids duplicate IDs, and persists undo and clear", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    try {
      const first = createLab();
      first.example("series");
      first.update(first.parts()[1].id, { value: 4700 });
      const second = createLab();
      second.restore();
      expect(second.parts()).toEqual(first.parts());
      second.insert(
        "resistor",
        second.parts().find((p) => p.kind === "wire")!.id,
      );
      expect(new Set(second.parts().map((p) => p.id)).size).toBe(
        second.parts().length,
      );
      second.undo();
      const third = createLab();
      third.restore();
      expect(third.parts()).toEqual(first.parts());
      third.clear();
      const fourth = createLab();
      fourth.restore();
      expect(fourth.parts()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores malformed saved data and unavailable storage", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => '{"version":1,"parts":[{}]}',
        setItem: () => {
          throw new Error("Storage disabled");
        },
      },
    });
    try {
      const lab = createLab();
      lab.restore();
      expect(lab.parts()).toEqual([]);
      expect(() => lab.example("series")).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("breadboard editing", () => {
  it("loads a safe LED circuit", () => {
    const lab = createLab();
    lab.example("led");
    const led = lab.parts().find((p) => p.kind === "led")!;
    expect(led).toBeDefined();
    expect(lab.errors(led)).toEqual([]);
    expect(solve(lab.parts()).readings[led.id].current).toBeGreaterThan(0.001);
  });

  it("disconnects a wire with undo support", () => {
    const lab = createLab();
    lab.example("led");
    const before = lab.parts();
    const wire = before.find((p) => p.kind === "wire")!;
    lab.remove(wire.id);
    expect(lab.parts()).toHaveLength(before.length - 1);
    lab.undo();
    expect(lab.parts()).toEqual(before);
  });

  it("resets values when changing a component type", () => {
    const lab = createLab();
    lab.example("series");
    const part = lab.parts().find((p) => p.kind === "resistor")!;
    lab.changeKind(part.id, "led");
    expect(lab.parts().find((p) => p.id === part.id)).toMatchObject({
      kind: "led",
      value: 2,
    });
  });

  it("retains invalid finite edits for visible validation and recovers after correction", () => {
    const lab = createLab();
    lab.example("series");
    const resistor = () => lab.parts().find((p) => p.kind === "resistor")!;
    lab.setValue(resistor().id, -1);
    expect(lab.errors(resistor()).join(" ")).toContain("greater than zero");
    lab.setValue(resistor().id, 1000);
    expect(lab.errors(resistor())).toEqual([]);
  });
});
