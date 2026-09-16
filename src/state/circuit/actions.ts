import { onMount, onCleanup } from "solid-js";
import {
  listenForKeys,
  pinAt,
  observeCanvas,
  readCircuit,
  writeCircuit,
} from "./effects";
import {
  catalog,
  componentCatalog,
  componentErrors,
  defaults,
  createFormulas,
  circuitBounds,
  constrainOffset,
  parseCircuit,
  removePart,
} from "./formulas";
import { type Kind } from "../../lib/circuit/solver";
import { createData, type Part } from "./data";

export const createLab = () => {
  const d = createData();
  let serial = 0;
  const pan = () =>
    constrainOffset(
      d.offset(),
      circuitBounds(d.parts()),
      d.zoom(),
      d.viewport(),
    );

  const bindCanvas = (canvas: SVGSVGElement) => {
    onMount(() => onCleanup(observeCanvas(canvas, d.setViewport)));
  };

  const scroll = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (d.drag() || d.pinDrag()) return;

    const scale =
      e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? d.viewport().height : 1;
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    const current = pan();
    d.setOffset(
      constrainOffset(
        { x: current.x - dx * scale, y: current.y - dy * scale },
        circuitBounds(d.parts()),
        d.zoom(),
        d.viewport(),
      ),
    );
    d.setHover(undefined);
    if (d.pending()) d.setPreview(coords(e));
  };
  const {
    solution,
    selectedPart: selected,
    hovered,
    point,
    path,
    wireLabel,
    flow,
  } = createFormulas(d);
  const persist = () =>
    writeCircuit(JSON.stringify({ version: 1, parts: d.parts() }));

  const restore = () => {
    const saved = parseCircuit(readCircuit());
    if (!saved) return;
    d.setParts(saved);
    serial = saved.reduce(
      (max, p) => Math.max(max, Number(p.id.match(/\d+$/)?.[0] ?? 0)),
      0,
    );
  };

  const change = (parts: Part[]) => {
    d.setHistory((h) => [...h.slice(-49), d.parts()]);
    d.setFuture([]);
    d.setParts(parts);
    persist();
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
      x: (e.clientX - rect.left - pan().x) / d.zoom(),
      y: (e.clientY - rect.top - pan().y) / d.zoom(),
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
    if (e.button !== 0 || p.kind === "wire") return;
    e.stopPropagation();
    d.setSuppressClick(true);
    d.setSelected(p.id);

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
      persist();
    }

    d.setDrag(undefined);
  };

  const remove = (id = d.selected()) => {
    const p = d.parts().find((part) => part.id === id);

    if (!p) return;
    change(removePart(d.parts(), p));
    d.setPending(undefined);
    d.setPreview(undefined);
    d.setHover(undefined);
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
    const parallel = which === "parallel";
    const divider = which === "divider";
    const capacitor = which === "capacitor";
    const v = make("source", parallel ? 300 : 280, parallel ? 120 : 380);
    const r = make("resistor", parallel ? 300 : 160, parallel ? 280 : 160);
    const s = make(
      which === "led"
        ? "led"
        : capacitor
          ? "capacitor"
          : divider || parallel
            ? "resistor"
            : "switch",
      parallel ? 300 : 400,
      parallel ? 440 : divider ? 260 : 160,
    );

    const wire = (a: string, b: string): Part => ({
      ...make("wire", 0, 0),
      a,
      b,
    });

    if (parallel) {
      s.value = 2000;
      for (const part of [v, r, s]) part.terminalOffset = 96;
    }

    // Chain the rails at the upper resistor's pins: each segment is drawn once.
    const ps = parallel
      ? [
          v,
          r,
          s,
          wire(v.a, r.a),
          wire(r.b, v.b),
          wire(r.a, s.a),
          wire(s.b, r.b),
        ]
      : [v, r, s, wire(v.a, r.a), wire(r.b, s.a), wire(s.b, v.b)];

    change(ps);
    d.setSelected(r.id);
    choose("select");
    d.setZoom(1);
    d.setOffset({ x: 0, y: 0 });
  };

  const undo = () => {
    const h = d.history();

    if (!h.length) return;
    d.setFuture((f) => [...f, d.parts()]);
    d.setParts(h[h.length - 1]);
    d.setHistory(h.slice(0, -1));
    persist();
    d.setSelected(undefined);
    d.setPending(undefined);
  };

  const redo = () => {
    const f = d.future();

    if (!f.length) return;
    d.setHistory((h) => [...h, d.parts()]);
    d.setParts(f[f.length - 1]);
    d.setFuture(f.slice(0, -1));
    persist();
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
      const c = componentCatalog.find(
        (c) => c.key.toLowerCase() === e.key.toLowerCase(),
      );

      if (c) choose(c.kind);
    }
  };

  onMount(() => {
    restore();
    onCleanup(listenForKeys(key));
  });

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
    restore,
    pan,
    bindCanvas,
    scroll,
    libraryDrag,
    drop,
    startPin,
    cancelDrag,
    inspectedPart: () => {
      const part = selected() ?? hovered();
      return part?.kind === "wire" ? undefined : part;
    },
    errors: (part: Part) => componentErrors(part, d.parts(), solution()),
    changeKind: (id: string, kind: Kind) =>
      update(id, { kind, value: defaults[kind], closed: true }),
    setValue: (id: string, value: number) => {
      if (Number.isFinite(value)) update(id, { value });
    },
    solution,
    selectedPart: selected,
    hovered,
    choose,
    pin,
    point,
    path,
    wireLabel,
    flow,
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
      d.setOffset({ x: 0, y: 0 });
      d.setSelected(undefined);
      choose("select");
    },
  };
};

export type Lab = ReturnType<typeof createLab>;
