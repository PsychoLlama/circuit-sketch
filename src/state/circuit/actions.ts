import { createMemo } from "solid-js";
import { solve, type Kind } from "../../lib/circuit/solver";
import { createData, type Part } from "./data";
export const catalog: {
  kind: Kind;
  name: string;
  key: string;
  description: string;
}[] = [
  {
    kind: "source",
    name: "DC source",
    key: "V",
    description: "A fixed voltage difference",
  },
  {
    kind: "resistor",
    name: "Resistor",
    key: "R",
    description: "Limit current, divide voltage",
  },
  {
    kind: "switch",
    name: "Switch",
    key: "S",
    description: "Open or close a path",
  },
  {
    kind: "capacitor",
    name: "Capacitor",
    key: "C",
    description: "Open circuit at DC equilibrium",
  },
  {
    kind: "wire",
    name: "Wire",
    key: "W",
    description: "Connect two terminals",
  },
];
const defaults: Record<Kind, number> = {
  source: 9,
  resistor: 1000,
  switch: 0,
  capacitor: 0.000001,
  wire: 0,
};
export function format(value: number | undefined, unit: string) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const v = Math.abs(value) < 1e-12 ? 0 : value,
    a = Math.abs(v);
  const [scale, prefix] =
    a >= 1e6
      ? [1e6, "M"]
      : a >= 1e3
        ? [1e3, "k"]
        : a > 0 && a < 1e-6
          ? [1e-9, "n"]
          : a > 0 && a < 1e-3
            ? [1e-6, "µ"]
            : a > 0 && a < 1
              ? [1e-3, "m"]
              : [1, ""];
  return `${Number((v / (scale as number)).toPrecision(4))} ${prefix}${unit}`;
}
export function partValue(p: Part) {
  return p.kind === "switch"
    ? p.closed
      ? "Closed"
      : "Open"
    : format(
        p.value,
        p.kind === "source" ? "V" : p.kind === "capacitor" ? "F" : "Ω",
      );
}
export function createLab() {
  const d = createData();
  let serial = 0;
  const solution = createMemo(() => solve(d.parts()));
  const selected = createMemo(() =>
    d.parts().find((p) => p.id === d.selected()),
  );
  const hovered = createMemo(() =>
    d.parts().find((p) => p.id === d.hover()?.id),
  );
  function change(parts: Part[]) {
    d.setHistory((h) => [...h.slice(-49), d.parts()]);
    d.setFuture([]);
    d.setParts(parts);
  }
  function make(kind: Kind, x: number, y: number): Part {
    const id = `${catalog.find((c) => c.kind === kind)!.key}${++serial}`;
    return {
      id,
      kind,
      a: `${id}.a`,
      b: `${id}.b`,
      value: defaults[kind],
      closed: true,
      x,
      y,
    };
  }
  function update(id: string, patch: Partial<Part>) {
    change(d.parts().map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function choose(kind: Kind | "select") {
    d.setTool(kind);
    d.setPending(undefined);
  }
  function pin(node: string) {
    if (!d.pending()) {
      d.setPending(node);
      d.setTool("wire");
      return;
    }
    if (d.pending() !== node) {
      const p = make("wire", 0, 0);
      change([...d.parts(), { ...p, a: d.pending()!, b: node }]);
    }
    d.setPending(undefined);
    d.setTool("select");
  }
  function point(node: string): { x: number; y: number } {
    for (const p of d.parts())
      if (p.kind !== "wire") {
        if (p.a === node) return { x: p.x - 48, y: p.y };
        if (p.b === node) return { x: p.x + 48, y: p.y };
      }
    return { x: 0, y: 0 };
  }
  function path(p: Part) {
    const a = point(p.a),
      b = point(p.b);
    const offset = (node: string) =>
      d.parts().some((p) => p.kind !== "wire" && p.a === node) ? -24 : 24;
    const ax = a.x + offset(p.a),
      bx = b.x + offset(p.b),
      mid = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} H ${ax} V ${mid} H ${bx} V ${b.y} H ${b.x}`;
  }
  function coords(e: PointerEvent | MouseEvent) {
    const svg = (e.currentTarget as Element).closest("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / d.zoom(),
      y: (e.clientY - rect.top) / d.zoom(),
    };
  }
  function canvas(e: MouseEvent) {
    if ((e.target as Element).closest("[data-part], [data-pin]")) return;
    const kind = d.tool();
    if (kind !== "select" && kind !== "wire") {
      const pos = coords(e);
      if (!pos) return;
      const p = make(
        kind,
        Math.round(pos.x / 20) * 20,
        Math.round(pos.y / 20) * 20,
      );
      change([...d.parts(), p]);
      d.setSelected(p.id);
      choose("select");
    } else {
      d.setSelected(undefined);
      d.setPending(undefined);
    }
  }
  function startDrag(e: PointerEvent, p: Part) {
    if (e.button !== 0) return;
    e.stopPropagation();
    d.setSelected(p.id);
    if (p.kind === "wire") return;
    const pos = coords(e);
    if (!pos) return;
    d.setDrag({
      id: p.id,
      x: p.x,
      y: p.y,
      px: pos.x,
      py: pos.y,
      before: d.parts(),
    });
    (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    const drag = d.drag();
    if (!drag) return;
    const pos = coords(e);
    if (!pos) return;
    d.setParts((ps) =>
      ps.map((p) =>
        p.id === drag.id
          ? {
              ...p,
              x: Math.max(60, Math.round((drag.x + pos.x - drag.px) / 20) * 20),
              y: Math.max(60, Math.round((drag.y + pos.y - drag.py) / 20) * 20),
            }
          : p,
      ),
    );
    d.setHover(undefined);
  }
  function endDrag() {
    const drag = d.drag();
    if (
      drag &&
      drag.before.some(
        (p, i) => p.x !== d.parts()[i]?.x || p.y !== d.parts()[i]?.y,
      )
    ) {
      d.setHistory((h) => [...h.slice(-49), drag.before]);
      d.setFuture([]);
    }
    d.setDrag(undefined);
  }
  function remove() {
    const p = selected();
    if (!p) return;
    change(
      d
        .parts()
        .filter(
          (v) =>
            v.id !== p.id &&
            (p.kind === "wire" ||
              v.kind !== "wire" ||
              (![p.a, p.b].includes(v.a) && ![p.a, p.b].includes(v.b))),
        ),
    );
    d.setSelected(undefined);
  }
  function insert(kind: Kind) {
    const w = selected();
    if (!w || w.kind !== "wire") return;
    const a = point(w.a),
      b = point(w.b);
    const p = make(kind, (a.x + b.x) / 2, (a.y + b.y) / 2);
    const tail = make("wire", 0, 0);
    change([
      ...d
        .parts()
        .map((v) => (v.id === w.id ? { ...v, b: p.a, value: v.value / 2 } : v)),
      p,
      { ...tail, a: p.b, b: w.b, value: w.value / 2 },
    ]);
    d.setSelected(p.id);
  }
  function example(which: string) {
    const v = make("source", 170, 260),
      r = make("resistor", 410, 160),
      s = make(
        which === "capacitor"
          ? "capacitor"
          : which === "divider"
            ? "resistor"
            : "switch",
        410,
        360,
      );
    const wire = (a: string, b: string): Part => ({
      ...make("wire", 0, 0),
      a,
      b,
    });
    const ps = [v, r, s, wire(v.a, r.a), wire(r.b, s.b), wire(s.a, v.b)];
    if (which === "parallel") {
      s.kind = "resistor";
      s.value = 2000;
      ps.splice(
        3,
        3,
        wire(v.a, r.a),
        wire(r.b, v.b),
        wire(v.a, s.a),
        wire(s.b, v.b),
      );
    }
    change(ps);
    d.setSelected(r.id);
    choose("select");
    d.setZoom(1);
  }
  function undo() {
    const h = d.history();
    if (!h.length) return;
    d.setFuture((f) => [...f, d.parts()]);
    d.setParts(h[h.length - 1]);
    d.setHistory(h.slice(0, -1));
    d.setSelected(undefined);
    d.setPending(undefined);
  }
  function redo() {
    const f = d.future();
    if (!f.length) return;
    d.setHistory((h) => [...h, d.parts()]);
    d.setParts(f[f.length - 1]);
    d.setFuture(f.slice(0, -1));
  }
  function key(e: KeyboardEvent) {
    if ((e.target as Element).closest("input,select,textarea")) return;
    if (e.key === "Escape") {
      choose("select");
      d.setSelected(undefined);
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
    if (!e.ctrlKey && !e.metaKey) {
      const c = catalog.find(
        (c) => c.key.toLowerCase() === e.key.toLowerCase(),
      );
      if (c) choose(c.kind);
    }
  }
  return {
    ...d,
    solution,
    selectedPart: selected,
    hovered,
    choose,
    pin,
    point,
    path,
    canvas,
    startDrag,
    move,
    endDrag,
    update,
    remove,
    insert,
    example,
    undo,
    redo,
    key,
    clear: () => {
      change([]);
      d.setSelected(undefined);
      choose("select");
    },
  };
}
export type Lab = ReturnType<typeof createLab>;
