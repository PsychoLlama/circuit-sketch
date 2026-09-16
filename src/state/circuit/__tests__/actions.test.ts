import { createRoot } from "solid-js";
import * as effects from "../effects";
import {
  bindCanvas,
  make,
  selectPart,
  centerCircuit,
  changeZoom,
  resetZoom,
  mountLab,
  cancelDrag,
  canvas,
  changeKind,
  clear,
  drop,
  endDrag,
  example,
  insert,
  key,
  pin,
  redo,
  remove,
  restore,
  scroll,
  setValue,
  startDrag,
  startTerminal,
  move,
  undo,
  update,
} from "../actions";
import {
  errors,
  pan,
  path,
  point,
  solution,
  inspectedPart,
  joinTerminal,
  circuitBounds,
  parseCircuit,
} from "../formulas";
import {
  drag,
  history,
  hover,
  parts,
  pending,
  selected,
  setDrag,
  setHover,
  setParts,
  setSelected,
  setViewport,
  setZoom,
} from "../data";
import { describe, it, expect, vi } from "vitest";
import { __resetSignals } from "~/lib/signals";
import { solve } from "~/lib/circuit/solver";

describe("circuit editing", () => {
  it("creates four physically consistent experiments", () => {
    for (const name of ["series", "divider", "parallel", "capacitor"]) {
      example(name);

      const result = solve(parts());

      expect(result.error).toBeUndefined();

      const source = parts().find((p) => p.kind === "source")!;

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
    example("series");

    const initial = parts();

    clear();
    expect(parts()).toHaveLength(0);
    undo();
    expect(parts()).toEqual(initial);
    redo();
    expect(parts()).toHaveLength(0);
  });

  it("makes a new wire from two pins and cancels self-connections", () => {
    pin("a");
    pin("a");
    expect(parts()).toHaveLength(0);
    pin("a");
    pin("b");
    expect(parts()[0]).toMatchObject({
      kind: "wire",
      a: "a",
      b: "b",
      value: 0,
    });
  });

  it("records value edits without modifying the previous graph", () => {
    example("series");

    const r = parts().find((p) => p.kind === "resistor")!;

    update(r.id, { value: 2000 });
    expect(solve(parts()).readings[r.id].current).toBeCloseTo(0.0045);
    undo();
    expect(solve(parts()).readings[r.id].current).toBeCloseTo(0.009);
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
    example("series");

    const initial = parts();

    key(keyboard("z", { ctrlKey: true }));
    expect(parts()).toHaveLength(0);
    key(keyboard("Z", { ctrlKey: true, shiftKey: true }));
    expect(parts()).toEqual(initial);
  });

  it("dismisses inspection with Escape even from a form field", () => {
    example("series");
    setHover({ id: parts()[0].id, x: 0, y: 0 });
    pin("a");
    key(keyboard("Escape", { target: { closest: () => ({}) } }));
    expect(selected()).toBeUndefined();
    expect(hover()).toBeUndefined();
    expect(pending()).toBeUndefined();
  });

  it("deletes a selected component but preserves its wires with Backspace, with undo", () => {
    example("series");

    const initial = parts();
    const source = initial[0];

    setSelected(source.id);
    key(keyboard("Backspace"));
    expect(parts().some((p) => p.id === source.id)).toBe(false);
    expect(parts().filter((p) => p.kind === "wire")).toHaveLength(3);
    expect(point(source.a)).toEqual({ x: source.x - 48, y: source.y });

    undo();
    expect(parts()).toEqual(initial);
  });

  it("keeps Backspace inside form fields", () => {
    example("series");

    const initial = parts();

    key(keyboard("Backspace", { target: { closest: () => ({}) } }));
    expect(parts()).toEqual(initial);
  });

  it("does not clear selection on the canvas click after a component pointer release", () => {
    example("series");

    const part = parts()[0];
    const svg = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: vi.fn(),
    };

    startDrag(
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

    endDrag();
    canvas({ target: { closest: () => null } } as unknown as MouseEvent);
    expect(selected()).toBe(part.id);
    canvas({ target: { closest: () => null } } as unknown as MouseEvent);
    expect(selected()).toBeUndefined();
  });
});

describe("pointer placement", () => {
  it("drops onto an occupied canvas at zoom-adjusted, snapped coordinates", () => {
    example("series");
    setZoom(0.5);
    drop({
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

    expect(parts().at(-1)).toMatchObject({
      kind: "capacitor",
      x: 300,
      y: 200,
    });

    undo();
    expect(parts()).toHaveLength(6);
  });

  it("restores a cancelled component drag without adding history", () => {
    example("series");

    const before = parts();
    const count = history().length;
    const part = before[0];

    setDrag({
      id: part.id,
      x: part.x,
      y: part.y,
      px: part.x,
      py: part.y,
      before,
    });

    setParts(before.map((p) => ({ ...p, x: p.x + 100 })));
    cancelDrag();
    expect(parts()).toEqual(before);
    expect(history()).toHaveLength(count);
    expect(drag()).toBeUndefined();
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

  it("keeps the circuit centered through zoom and resets a panned view", () => {
    setViewport({ width: 800, height: 600 });
    example("series");
    const bounds = circuitBounds(parts())!;

    changeZoom(1.5);
    expect(pan().x + ((bounds.left + bounds.right) / 2) * 1.5).toBe(400);
    expect(pan().y + ((bounds.top + bounds.bottom) / 2) * 1.5).toBe(300);
    scroll(wheel(80, 80));
    resetZoom();
    expect(pan().x + (bounds.left + bounds.right) / 2).toBe(400);
    expect(pan().y + (bounds.top + bounds.bottom) / 2).toBe(300);
  });

  it("allows placement beyond the old top-left coordinate boundary", () => {
    setViewport({ width: 800, height: 600 });
    drop({
      clientX: -100,
      clientY: -80,
      currentTarget: {
        closest: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
      },
      dataTransfer: { getData: () => "resistor" },
      preventDefault: vi.fn(),
    } as unknown as DragEvent);
    expect(parts()[0]).toMatchObject({ x: -100, y: -80 });
  });

  it("scrolls both axes without changing the circuit or undo history", () => {
    example("series");
    setViewport({ width: 800, height: 600 });

    const initial = parts();
    const previousHistory = history();

    scroll(wheel(30, 40));
    expect(pan()).toEqual({ x: -30, y: -40 });
    scroll(wheel(0, 20, { shiftKey: true }));
    expect(pan()).toEqual({ x: -50, y: -40 });
    expect(parts()).toBe(initial);
    expect(history()).toBe(previousHistory);
  });

  it("reverses immediately after reaching a scroll limit", () => {
    example("series");
    setViewport({ width: 800, height: 600 });
    scroll(wheel(10000, 10000));

    const limit = pan();

    scroll(wheel(-10, -10));
    expect(pan()).toEqual({ x: limit.x + 10, y: limit.y + 10 });
  });

  it("places components under the pointer after scrolling and zooming", () => {
    example("series");
    setViewport({ width: 800, height: 600 });
    setZoom(0.5);
    scroll(wheel(40, 50));
    drop({
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

    expect(parts().at(-1)).toMatchObject({ x: 280, y: 300 });
  });

  it("resets scrolling when loading an experiment or clearing", () => {
    example("series");
    setViewport({ width: 800, height: 600 });
    scroll(wheel(40, 50));
    example("parallel");
    expect(pan()).toEqual({ x: 100, y: 12 });
    scroll(wheel(40, 50));
    clear();
    expect(pan()).toEqual({ x: 0, y: 0 });
  });
});

describe("experiment flow", () => {
  it("shows total current on the shared rails and branch current after the split", () => {
    example("parallel");

    const [source, upper, lower] = parts();
    const result = solve(parts());
    const wires = parts().filter((p) => p.kind === "wire");

    wires.forEach((wire, i) =>
      expect(Math.abs(result.readings[wire.id].current)).toBeCloseTo(
        i < 2 ? 0.0135 : 0.0045,
      ),
    );

    expect(wires.some((w) => w.a === upper.a && w.b === lower.a)).toBe(true);
    expect(source.x).toBe(upper.x);
    expect(upper.x).toBe(lower.x);
    expect(new Set(wires.map(path)).size).toBe(4);
  });

  it("stops current throughout a series loop when the switch opens", () => {
    example("series");

    const sw = parts().find((p) => p.kind === "switch")!;

    update(sw.id, { closed: false });

    const result = solve(parts());

    expect(result.error).toBeUndefined();
    for (const reading of Object.values(result.readings))
      expect(reading.current).toBeCloseTo(0);
  });
});

describe("replacement and reconnection", () => {
  it("replaces an edited circuit with an example in one undo step", () => {
    example("series");
    update(parts()[1].id, { value: 3300 });

    const before = parts();

    example("parallel");

    const replacement = parts();

    undo();
    expect(parts()).toEqual(before);
    redo();
    expect(parts()).toEqual(replacement);
  });

  it("leaves an open gap and preserves wire geometry when deleting a component", () => {
    example("series");
    const resistor = parts()[1];
    const before = parts();
    const paths = before.filter((p) => p.kind === "wire").map(path);

    remove(resistor.id);
    expect(parts()).toHaveLength(5);
    expect(
      parts()
        .filter((p) => p.kind === "wire")
        .map(path),
    ).toEqual(paths);
    expect(solve(parts()).readings[parts()[0].id].current).toBeCloseTo(0);
    undo();
    expect(parts()).toEqual(before);
    redo();
    expect(parts()).toHaveLength(5);
  });

  it("merges loose ends into a single wire with summed resistance", () => {
    example("series");
    const resistor = parts()[1];
    remove(resistor.id);
    const attached = parts().filter(
      (p) =>
        p.kind === "wire" &&
        [p.a, p.b].some((n) => n === resistor.a || n === resistor.b),
    );
    update(attached[0].id, { value: 20 });
    update(attached[1].id, { value: 30 });
    setParts(joinTerminal(parts(), resistor.a, resistor.b));
    expect(parts()).toHaveLength(4);
    expect(parts().find((p) => p.id === attached[0].id)?.value).toBe(50);
    expect(
      Math.abs(solve(parts()).readings[parts()[0].id].current),
    ).toBeCloseTo(9 / 50);
  });

  it("preserves branches when reconnecting to an occupied component pin", () => {
    example("parallel");
    const [source, upper, lower] = parts();
    remove(lower.id);
    setParts(joinTerminal(parts(), lower.a, source.a));
    expect(parts().filter((p) => p.kind === "wire")).toHaveLength(4);
    expect(
      parts().some(
        (p) => p.kind === "wire" && p.a === source.a && p.b === upper.a,
      ),
    ).toBe(true);
  });

  it("moves loose terminals with undo, cancellation, and persistence", () => {
    example("series");
    const resistor = parts()[1];
    remove(resistor.id);
    const before = parts();
    const svg = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: vi.fn(),
    };
    const event = (x: number, y: number) =>
      ({
        button: 0,
        clientX: x,
        clientY: y,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: { closest: () => svg },
      }) as unknown as PointerEvent;

    startTerminal(event(112, 160), resistor.a);
    move(event(200, 240));
    expect(point(resistor.a)).toEqual({ x: 200, y: 240 });
    cancelDrag();
    expect(parts()).toEqual(before);
    startTerminal(event(112, 160), resistor.a);
    move(event(200, 240));
    const hit = vi.spyOn(effects, "pinAt").mockReturnValue(undefined);

    try {
      endDrag(event(200, 240));
      expect(
        parseCircuit(JSON.stringify({ version: 1, parts: parts() })),
      ).toEqual(parts());
      undo();
      expect(parts()).toEqual(before);
      redo();
      expect(point(resistor.a)).toEqual({ x: 200, y: 240 });
    } finally {
      hit.mockRestore();
    }
  });

  it("selects and inspects wires without disconnecting them", () => {
    example("series");
    expect(selected()).toBeUndefined();
    const before = parts();
    const wire = before.find((p) => p.kind === "wire")!;
    selectPart(wire.id);
    expect(inspectedPart()).toBe(wire);
    expect(parts()).toBe(before);
    key(keyboard("Delete"));
    expect(parts()).toHaveLength(before.length - 1);
    undo();
    expect(parts()).toEqual(before);
  });

  it("keeps existing readings and connections when adding an isolated LED", () => {
    example("series");
    const before = parts();
    const current = solution().readings[before[0].id].current;
    setParts([...parts(), make("led", 600, 400)]);
    expect(parts().slice(0, before.length)).toEqual(before);
    expect(solution().error).toBeUndefined();
    expect(solution().readings[before[0].id].current).toBeCloseTo(current);
  });

  it("centers the loaded circuit without selecting a component", () => {
    setViewport({ width: 800, height: 600 });
    example("series");
    centerCircuit();
    expect(pan()).toEqual({ x: 120, y: 22 });
    expect(selected()).toBeUndefined();
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
      __resetSignals();
      example("series");
      update(parts()[1].id, { value: 4700 });

      const saved = parts();

      __resetSignals();
      restore();
      expect(parts()).toEqual(saved);
      insert("resistor", parts().find((p) => p.kind === "wire")!.id);
      expect(new Set(parts().map((p) => p.id)).size).toBe(parts().length);
      undo();
      __resetSignals();
      restore();
      expect(parts()).toEqual(saved);
      clear();
      __resetSignals();
      restore();
      expect(parts()).toEqual([]);
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
      restore();
      expect(parts()).toEqual([]);
      expect(() => example("series")).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("breadboard editing", () => {
  it("loads a safe LED circuit", () => {
    example("led");

    const led = parts().find((p) => p.kind === "led")!;

    expect(led).toBeDefined();
    expect(errors(led)).toEqual([]);
    expect(solve(parts()).readings[led.id].current).toBeGreaterThan(0.001);
  });

  it("disconnects a wire with undo support", () => {
    example("led");

    const before = parts();
    const wire = before.find((p) => p.kind === "wire")!;

    remove(wire.id);
    expect(parts()).toHaveLength(before.length - 1);
    undo();
    expect(parts()).toEqual(before);
  });

  it("resets values when changing a component type", () => {
    example("series");

    const part = parts().find((p) => p.kind === "resistor")!;

    changeKind(part.id, "led");
    expect(parts().find((p) => p.id === part.id)).toMatchObject({
      kind: "led",
      value: 2,
    });
  });

  it("retains invalid finite edits for visible validation and recovers after correction", () => {
    example("series");

    const resistor = () => parts().find((p) => p.kind === "resistor")!;

    setValue(resistor().id, -1);
    expect(errors(resistor()).join(" ")).toContain("greater than zero");
    setValue(resistor().id, 1000);
    expect(errors(resistor())).toEqual([]);
  });
});

describe("editor lifecycle", () => {
  it("restores on mount and cleans up keyboard and resize listeners", async () => {
    const stopKeys = vi.fn();
    const stopResize = vi.fn();
    const listen = vi.spyOn(effects, "listenForKeys").mockReturnValue(stopKeys);
    const observe = vi
      .spyOn(effects, "observeCanvas")
      .mockReturnValue(stopResize);

    const read = vi.spyOn(effects, "readCircuit").mockReturnValue(null);
    const canvasElement = {} as SVGSVGElement;
    const dispose = createRoot((dispose) => {
      mountLab();
      bindCanvas(canvasElement);
      return dispose;
    });

    try {
      await Promise.resolve();
      expect(read).toHaveBeenCalledTimes(1);
      expect(listen).toHaveBeenCalledExactlyOnceWith(key);
      expect(observe).toHaveBeenCalledExactlyOnceWith(
        canvasElement,
        expect.any(Function),
      );

      example("series");
      const resize = observe.mock.calls[0][1];
      resize({ width: 800, height: 600 });
      const before = pan();
      resize({ width: 1000, height: 800 });
      expect(pan()).toEqual({ x: before.x + 100, y: before.y + 100 });

      expect(stopKeys).not.toHaveBeenCalled();
      expect(stopResize).not.toHaveBeenCalled();
      dispose();
      expect(stopKeys).toHaveBeenCalledTimes(1);
      expect(stopResize).toHaveBeenCalledTimes(1);
    } finally {
      dispose();
      vi.restoreAllMocks();
    }
  });
});
