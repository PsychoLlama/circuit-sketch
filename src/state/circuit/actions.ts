import { createEffect, onMount, onCleanup } from "solid-js";
import {
  timestamp,
  observeFrames,
  listenForKeys,
  pinAt,
  observeCanvas,
  readCircuit,
  writeCircuit,
} from "./effects";
import {
  timeAt,
  catalog,
  componentCatalog,
  defaults,
  pan,
  point,
  circuitBounds,
  constrainOffset,
  parseCircuit,
  removePart,
  joinTerminal,
  looseTerminals,
} from "./formulas";
import { type Kind } from "~/lib/circuit/solver";
import {
  setRequestedTime,
  playback,
  setPlayback,
  requestedTime,
  setFrameTime,
  drag as activeDrag,
  future,
  history,
  labels,
  parts,
  pending,
  pinDrag,
  selected,
  serial,
  setDrag,
  setFuture,
  setHistory,
  setHover,
  setLabels,
  setOffset,
  setParts,
  setPending,
  setPinDrag,
  setPreview,
  setSelected,
  setSerial,
  setSuppressClick,
  setTool,
  setViewport,
  setZoom,
  suppressClick,
  tool,
  viewport,
  zoom,
  type Part,
  terminalDrag,
  setTerminalDrag,
} from "./data";

export const bindCanvas = (canvas: SVGSVGElement) => {
  onMount(() =>
    onCleanup(
      observeCanvas(canvas, (size) => {
        const previous = viewport();
        const current = pan();
        const initial = !previous.width;

        setViewport(size);
        if (initial) centerCircuit();
        else
          setOffset({
            x: current.x + (size.width - previous.width) / 2,
            y: current.y + (size.height - previous.height) / 2,
          });
      }),
    ),
  );
};

export const scroll = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (activeDrag() || pinDrag() || terminalDrag()) return;

  const scale =
    e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport().height : 1;

  const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
  const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
  const current = pan();

  setOffset(
    constrainOffset(
      { x: current.x - dx * scale, y: current.y - dy * scale },
      circuitBounds(parts()),
      zoom(),
      viewport(),
    ),
  );

  setHover(undefined);
  if (pending()) setPreview(coords(e));
};

export const persist = () =>
  writeCircuit(JSON.stringify({ version: 1, parts: parts() }));

export const restore = () => {
  const saved = parseCircuit(readCircuit());

  if (!saved) return;
  setParts(saved);
  setSelected(undefined);
  centerCircuit();
  setSerial(
    saved.reduce(
      (max, p) => Math.max(max, Number(p.id.match(/\d+$/)?.[0] ?? 0)),
      0,
    ),
  );
};

export const change = (nextParts: Part[]) => {
  setHistory((h) => [...h.slice(-49), parts()]);
  setFuture([]);
  setParts(nextParts);
  persist();
};

export const make = (kind: Kind, x: number, y: number): Part => {
  const id = `${catalog.find((c) => c.kind === kind)!.key}${setSerial(serial() + 1)}`;

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

export const update = (id: string, patch: Partial<Part>) => {
  change(parts().map((p) => (p.id === id ? { ...p, ...patch } : p)));
};

export const choose = (kind: Kind | "select") => {
  setTool(kind);
  setPending(undefined);
  setPreview(undefined);
};

export const pin = (node: string) => {
  if (!pending()) {
    setPending(node);
    setTool("wire");
    return;
  }

  if (
    pending() !== node &&
    looseTerminals().some(
      (terminal) => terminal.node === pending() || terminal.node === node,
    )
  ) {
    const loose = looseTerminals().some(
      (terminal) => terminal.node === pending(),
    )
      ? pending()!
      : node;
    const target = loose === node ? pending()! : node;

    change(joinTerminal(parts(), loose, target));
  } else if (pending() !== node) {
    const p = make("wire", 0, 0);

    change([...parts(), { ...p, a: pending()!, b: node }]);
  }

  setPending(undefined);
  setPreview(undefined);
  setTool("select");
};

export const coords = (e: PointerEvent | MouseEvent) => {
  const svg = (e.currentTarget as Element).closest("svg");

  if (!svg) return;

  const rect = svg.getBoundingClientRect();

  return {
    x: (e.clientX - rect.left - pan().x) / zoom(),
    y: (e.clientY - rect.top - pan().y) / zoom(),
  };
};

export const place = (kind: Kind, e: MouseEvent) => {
  const pos = coords(e);

  if (!pos) return;

  const p = make(
    kind,
    Math.round(pos.x / 20) * 20,
    Math.round(pos.y / 20) * 20,
  );

  change([...parts(), p]);
  setSelected(p.id);
  choose("select");
};

export const canvas = (e: MouseEvent) => {
  if (suppressClick()) {
    setSuppressClick(false);
    return;
  }

  if ((e.target as Element).closest("[data-part], [data-pin]")) return;

  const kind = tool();

  if (kind !== "select" && kind !== "wire") {
    place(kind, e);
  } else {
    setSelected(undefined);
    setHover(undefined);
    setPending(undefined);
    setPreview(undefined);
  }
};

export const startDrag = (e: PointerEvent, p: Part) => {
  if (e.button !== 0 || p.kind === "wire") return;
  e.stopPropagation();
  setSuppressClick(true);
  setSelected(p.id);

  const pos = coords(e);

  if (!pos) return;
  setDrag({
    id: p.id,
    x: p.x,
    y: p.y,
    px: pos.x,
    py: pos.y,
    before: parts(),
  });

  (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
};

export const move = (e: PointerEvent) => {
  if (pending()) setPreview(coords(e));

  const terminal = terminalDrag();

  if (terminal) {
    const pos = coords(e);

    if (pos)
      setParts(
        parts().map((p) =>
          p.kind !== "wire"
            ? p
            : {
                ...p,
                ends: {
                  ...p.ends,
                  ...(p.a === terminal.node ? { a: pos } : {}),
                  ...(p.b === terminal.node ? { b: pos } : {}),
                },
              },
        ),
      );
    return;
  }

  const drag = activeDrag();

  if (!drag) return;

  const pos = coords(e);

  if (!pos) return;
  setParts((ps) =>
    ps.map((p) =>
      p.id === drag.id
        ? {
            ...p,
            x: Math.round((drag.x + pos.x - drag.px) / 20) * 20,
            y: Math.round((drag.y + pos.y - drag.py) / 20) * 20,
          }
        : p,
    ),
  );

  setHover(undefined);
};

export const startPin = (e: PointerEvent, node: string) => {
  if (e.button !== 0) return;
  e.stopPropagation();
  setSuppressClick(true);
  setPinDrag(node);
  if (!pending()) pin(node);
  (e.currentTarget as Element).closest("svg")?.setPointerCapture(e.pointerId);
};

export const cancelDrag = () => {
  if (terminalDrag()) setParts(terminalDrag()!.before);
  setTerminalDrag(undefined);
  if (activeDrag()) setParts(activeDrag()!.before);
  setDrag(undefined);
  setPinDrag(undefined);
  setPreview(undefined);
  choose("select");
};

export const endDrag = (e?: PointerEvent) => {
  const terminal = terminalDrag();

  if (terminal) {
    const target = e ? pinAt(e.clientX, e.clientY, terminal.node) : undefined;
    const next = target
      ? joinTerminal(parts(), terminal.node, target)
      : parts();

    setParts(terminal.before);
    if (JSON.stringify(next) !== JSON.stringify(terminal.before)) change(next);
    else pin(terminal.node);
    setTerminalDrag(undefined);
    return;
  }

  const start = pinDrag();

  if (start && e) {
    const target = pinAt(e.clientX, e.clientY);

    if (target && target !== pending()) pin(target);
    else if (!target) choose("select");

    setPinDrag(undefined);
    setPreview(undefined);
  }

  const drag = activeDrag();

  if (
    drag &&
    drag.before.some((p, i) => p.x !== parts()[i]?.x || p.y !== parts()[i]?.y)
  ) {
    setHistory((h) => [...h.slice(-49), drag.before]);
    setFuture([]);
    persist();
  }

  setDrag(undefined);
};

export const remove = (id = selected()) => {
  const p = parts().find((part) => part.id === id);

  if (!p) return;
  change(removePart(parts(), p));
  setPending(undefined);
  setPreview(undefined);
  setHover(undefined);
  setSelected(undefined);
};

export const insert = (kind: Kind, id = selected()) => {
  const w = parts().find((part) => part.id === id);

  if (!w || w.kind !== "wire") return;

  const a = point(w.a),
    b = point(w.b);

  const p = make(kind, (a.x + b.x) / 2, (a.y + b.y) / 2);
  const tail = make("wire", 0, 0);

  change([
    ...parts().map((v) =>
      v.id === w.id ? { ...v, b: p.a, value: v.value / 2 } : v,
    ),
    p,
    { ...tail, a: p.b, b: w.b, value: w.value / 2 },
  ]);

  setSelected(p.id);
};

export const example = (which: string) => {
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
    ? [v, r, s, wire(v.a, r.a), wire(r.b, v.b), wire(r.a, s.a), wire(s.b, r.b)]
    : [v, r, s, wire(v.a, r.a), wire(r.b, s.a), wire(s.b, v.b)];

  change(ps);
  setSelected(undefined);
  choose("select");
  setZoom(1);
  centerCircuit();
};

export const undo = () => {
  const h = history();

  if (!h.length) return;
  setFuture((f) => [...f, parts()]);
  setParts(h[h.length - 1]);
  setHistory(h.slice(0, -1));
  persist();
  setSelected(undefined);
  setPending(undefined);
};

export const redo = () => {
  const f = future();

  if (!f.length) return;
  setHistory((h) => [...h, parts()]);
  setParts(f[f.length - 1]);
  setFuture(f.slice(0, -1));
  persist();
};

export const key = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    choose("select");
    setSelected(undefined);
    setHover(undefined);
    setPreview(undefined);
    setPinDrag(undefined);
    if (terminalDrag()) setParts(terminalDrag()!.before);
    setTerminalDrag(undefined);
    if (activeDrag()) setParts(activeDrag()!.before);
    setDrag(undefined);
    return;
  }

  if (
    (e.target as Element)?.closest?.("input,select,textarea,[contenteditable]")
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

export const mountLab = () => {
  onMount(() => {
    restore();
    onCleanup(listenForKeys(key));
    createEffect(() => {
      if (playback().running) onCleanup(observeFrames(setFrameTime));
    });
  });
};

export const libraryDrag = (e: DragEvent, kind: Kind) => {
  if (kind === "wire") return;
  e.dataTransfer?.setData("application/x-circuit-part", kind);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
};

export const drop = (e: DragEvent) => {
  e.preventDefault();

  const kind = e.dataTransfer?.getData("application/x-circuit-part") as Kind;

  if (!catalog.some((c) => c.kind === kind && kind !== "wire")) return;
  setSuppressClick(false);
  place(kind, e);
};

export const toggleLabels = () => setLabels((labels) => !labels);
export const allowDrop = (event: DragEvent) => event.preventDefault();
export const previewPart = (event: PointerEvent, id: string) =>
  setHover({ id, x: event.clientX, y: event.clientY });

export const clearHover = () => setHover(undefined);
export const clickPin = (event: MouseEvent) => {
  event.stopPropagation();
  setSuppressClick(false);
};

export const changeZoom = (next: number) => {
  const current = pan();
  const size = viewport();
  const ratio = next / zoom();

  setOffset({
    x: size.width / 2 - (size.width / 2 - current.x) * ratio,
    y: size.height / 2 - (size.height / 2 - current.y) * ratio,
  });
  setZoom(next);
};

export const zoomOut = () => changeZoom(Math.max(0.5, zoom() - 0.1));
export const resetZoom = () => {
  setZoom(1);
  centerCircuit();
};

export const zoomIn = () => changeZoom(Math.min(1.5, zoom() + 0.1));

export const changeKind = (id: string, kind: Kind) =>
  update(id, { kind, value: defaults[kind], closed: true });

export const setValue = (id: string, value: number) => {
  if (Number.isFinite(value)) update(id, { value });
};

export const clear = () => {
  change([]);
  setOffset({ x: 0, y: 0 });
  setSelected(undefined);
  choose("select");
};

export const selectPart = (id: string) => {
  setSelected(id);
  setHover(undefined);
};

export const selectWire = (event: PointerEvent, id: string) => {
  event.stopPropagation();
  setSuppressClick(false);
  selectPart(id);
};

export const centerCircuit = () => {
  const bounds = circuitBounds(parts());
  const size = viewport();

  setOffset(
    bounds && size.width && size.height
      ? {
          x: (size.width - (bounds.left + bounds.right) * zoom()) / 2,
          y: (size.height - (bounds.top + bounds.bottom) * zoom()) / 2,
        }
      : { x: 0, y: 0 },
  );
};

export const startTerminal = (event: PointerEvent, node: string) => {
  if (event.button !== 0) return;
  event.stopPropagation();
  setSuppressClick(true);
  setTerminalDrag({ node, before: parts() });
  (event.currentTarget as Element)
    .closest("svg")
    ?.setPointerCapture(event.pointerId);
};

export const seekTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) return;
  const now = timestamp();

  setRequestedTime(time);
  setFrameTime(now);
  setPlayback((p) => ({ ...p, timeAnchor: time, wallAnchor: now }));
};

export const togglePlayback = () => {
  const now = timestamp();
  const time = timeAt(playback(), now, requestedTime());

  setRequestedTime(time);
  setFrameTime(now);
  setPlayback((p) => ({
    ...p,
    running: !p.running,
    timeAnchor: time,
    wallAnchor: now,
  }));
};

export const changeSpeed = (speed: number) => {
  if (!Number.isFinite(speed) || speed <= 0) return;
  const now = timestamp();
  const time = timeAt(playback(), now, requestedTime());

  setRequestedTime(time);
  setFrameTime(now);
  setPlayback((p) => ({ ...p, speed, timeAnchor: time, wallAnchor: now }));
};

export const setInitialVoltage = (id: string, initialVoltage: number) => {
  if (Number.isFinite(initialVoltage)) update(id, { initialVoltage });
};
