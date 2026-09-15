import { onMount, onCleanup } from "solid-js";
import { listenForKeys, pinAt } from "./effects";
import { catalog, defaults, createFormulas } from "./formulas";
import { type Kind } from "../../lib/circuit/solver";
import { createData, type Part } from "./data";

export const createLab = () => {
  const d = createData();
  let serial = 0;
  const {
    solution,
    selectedPart: selected,
    hovered,
    point,
    path,
  } = createFormulas(d);
  const change = (parts: Part[]) => {
    d.setHistory((h) => [...h.slice(-49), d.parts()]);
    d.setFuture([]);
    d.setParts(parts);
  };

  const make = (kind: Kind, x: number, y: number): Part => {
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
  };

  const update = (id: string, patch: Partial<Part>) => {
    change(d.parts().map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const choose = (kind: Kind | "select") => {
    d.setTool(kind);
    d.setPending(undefined);
    d.setPreview(undefined);
  };

  const pin = (node: string) => {
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
    d.setPreview(undefined);
    d.setTool("select");
  };

  const coords = (e: PointerEvent | MouseEvent) => {
    const svg = (e.currentTarget as Element).closest("svg");

    if (!svg) return;

    const rect = svg.getBoundingClientRect();

    return {
      x: (e.clientX - rect.left) / d.zoom(),
      y: (e.clientY - rect.top) / d.zoom(),
    };
  };

  const place = (kind: Kind, e: MouseEvent) => {
    const pos = coords(e);

    if (!pos) return;

    const p = make(
      kind,
      Math.max(60, Math.round(pos.x / 20) * 20),
      Math.max(60, Math.round(pos.y / 20) * 20),
    );
    change([...d.parts(), p]);
    d.setSelected(p.id);
    choose("select");
  };

  const canvas = (e: MouseEvent) => {
    if (d.suppressClick()) {
      d.setSuppressClick(false);
      return;
    }

    if ((e.target as Element).closest("[data-part], [data-pin]")) return;

    const kind = d.tool();

    if (kind !== "select" && kind !== "wire") {
      place(kind, e);
    } else {
      d.setSelected(undefined);
      d.setHover(undefined);
      d.setPending(undefined);
      d.setPreview(undefined);
    }
  };

  const startDrag = (e: PointerEvent, p: Part) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    d.setSuppressClick(true);
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
  };

  const move = (e: PointerEvent) => {
    if (d.pending()) d.setPreview(coords(e));
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
  };

  const startPin = (e: PointerEvent, node: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    d.setSuppressClick(true);
    d.setPinDrag(node);
    if (!d.pending()) pin(node);
    (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
  };

  const cancelDrag = () => {
    if (d.drag()) d.setParts(d.drag()!.before);
    d.setDrag(undefined);
    d.setPinDrag(undefined);
    d.setPreview(undefined);
    choose("select");
  };

  const endDrag = (e?: PointerEvent) => {
    const start = d.pinDrag();
    if (start && e) {
      const target = pinAt(e.clientX, e.clientY);
      if (target && target !== d.pending()) pin(target);
      else if (!target) choose("select");
      d.setPinDrag(undefined);
      d.setPreview(undefined);
    }
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
  };

  const remove = (id = d.selected()) => {
    const p = d.parts().find((part) => part.id === id);

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
  };

  const insert = (kind: Kind, id = d.selected()) => {
    const w = d.parts().find((part) => part.id === id);

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
  };

  const example = (which: string) => {
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
  };

  const undo = () => {
    const h = d.history();

    if (!h.length) return;
    d.setFuture((f) => [...f, d.parts()]);
    d.setParts(h[h.length - 1]);
    d.setHistory(h.slice(0, -1));
    d.setSelected(undefined);
    d.setPending(undefined);
  };

  const redo = () => {
    const f = d.future();

    if (!f.length) return;
    d.setHistory((h) => [...h, d.parts()]);
    d.setParts(f[f.length - 1]);
    d.setFuture(f.slice(0, -1));
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      choose("select");
      d.setSelected(undefined);
      d.setHover(undefined);
      d.setPreview(undefined);
      d.setPinDrag(undefined);
      if (d.drag()) d.setParts(d.drag()!.before);
      d.setDrag(undefined);
      return;
    }

    if (
      (e.target as Element)?.closest?.(
        "input,select,textarea,[contenteditable]",
      )
    )
      return;

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove();
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }

    if (!e.ctrlKey && !e.metaKey) {
      const c = catalog.find(
        (c) => c.key.toLowerCase() === e.key.toLowerCase(),
      );

      if (c) choose(c.kind);
    }
  };

  onMount(() => onCleanup(listenForKeys(key)));

  const libraryDrag = (e: DragEvent, kind: Kind) => {
    if (kind === "wire") return;
    e.dataTransfer?.setData("application/x-circuit-part", kind);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer?.getData("application/x-circuit-part") as Kind;
    if (!catalog.some((c) => c.kind === kind && kind !== "wire")) return;
    d.setSuppressClick(false);
    place(kind, e);
  };

  return {
    ...d,
    libraryDrag,
    drop,
    startPin,
    cancelDrag,
    inspectedPart: () => selected() ?? hovered(),
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
};

export type Lab = ReturnType<typeof createLab>;
