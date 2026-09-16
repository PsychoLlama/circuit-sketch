import { createMemo, createRoot } from "solid-js";
import { analyzeIslands } from "~/lib/circuit/islands";
import {
  toComponent,
  toSolution,
  parameterErrors,
  isDiode,
  type Kind,
  type Solution,
  type Reading,
} from "~/lib/circuit/solver";
import {
  parts,
  analysisMode,
  requestedTime,
  playback,
  frameTime,
  offset,
  zoom,
  viewport,
  selected,
  hover,
  type Part,
} from "./data";

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
    description: "Stores charge · explore charging and discharge",
  },
  {
    kind: "led",
    name: "LED",
    key: "L",
    description: "Light-emitting diode · use a series resistor",
  },
  {
    kind: "diode",
    name: "Diode",
    key: "D",
    description: "Conducts from anode A to cathode B",
  },
  {
    kind: "rheostat",
    name: "Rheostat",
    key: "P",
    description: "Two-terminal variable resistance",
  },
  {
    kind: "lamp",
    name: "Lamp",
    key: "B",
    description: "Resistive lamp · fixed resistance DC model",
  },
  {
    kind: "wire",
    name: "Wire",
    key: "W",
    description: "Connect two terminals",
  },
];

export const descriptions: Record<Kind, string> = {
  source:
    "Maintains a fixed voltage difference between its terminals, supplying or absorbing electrical energy.",
  resistor: "Opposes current flow and converts electrical energy into heat.",
  switch:
    "Completes the electrical path when closed and interrupts it when open.",
  capacitor:
    "Stores energy in an electric field. At DC equilibrium, no current flows through it.",
  led: "Emits light when forward current flows from its anode to its cathode.",
  diode:
    "Conducts primarily from its anode to its cathode and opposes reverse current.",
  rheostat: "Provides adjustable resistance to vary current flow.",
  lamp: "Converts electrical energy into light and heat in a resistive filament.",
  wire: "Connects terminals to provide a path for current.",
};

export const defaults: Record<Kind, number> = {
  led: 2,
  diode: 0.7,
  rheostat: 1000,
  lamp: 100,
  source: 9,
  resistor: 1000,
  switch: 0,
  capacitor: 0.000001,
  wire: 0,
};

export const format = (value: number | undefined, unit: string) => {
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
};

export const partValue = (p: Part) => {
  return p.kind === "switch"
    ? p.closed
      ? "Closed"
      : "Open"
    : format(
        p.value,
        p.kind === "source" || isDiode(p)
          ? "V"
          : p.kind === "capacitor"
            ? "F"
            : "Ω",
      );
};

export const components = (parts: Part[]) =>
  parts.filter((p) => p.kind !== "wire");

export const wires = (parts: Part[]) => parts.filter((p) => p.kind === "wire");

export const componentCatalog = catalog.filter((c) => c.kind !== "wire");

export const componentName = (kind: Kind | "select") =>
  catalog.find((c) => c.kind === kind)?.name;

export const readingFor = (solution: Solution, id: string) =>
  solution.readings[id];

export const storedEnergy = (part: Part, reading: Reading | undefined) =>
  reading ? 0.5 * part.value * reading.voltage ** 2 : undefined;

export const nodeCount = (solution: Solution) =>
  Object.keys(solution.nodes).length;

export const powerBalance = (solution: Solution) =>
  format(
    Object.values(solution.readings).reduce(
      (total, reading) => total + reading.power,
      0,
    ),
    "W",
  );

export const pan = () =>
  constrainOffset(offset(), circuitBounds(parts()), zoom(), viewport());

export const timeAt = (
  anchor: {
    running: boolean;
    speed: number;
    wallAnchor: number;
    timeAnchor: number;
  },
  now: number,
  pausedTime: number,
) =>
  anchor.running
    ? anchor.timeAnchor +
      (Math.max(0, now - anchor.wallAnchor) * anchor.speed) / 1000
    : pausedTime;

export const simulationTime = () =>
  timeAt(playback(), frameTime(), requestedTime());

// This memo shares the browser editor's module lifetime. Server renders only
// read the initial empty state; restoration and editing happen on the client.
export const circuitGraph = createRoot(() => ({
  snapshot: createMemo(() =>
    analyzeIslands(
      parts().map(toComponent),
      analysisMode() === "dc"
        ? { mode: "dc" }
        : { mode: "snapshot", time: simulationTime() },
      parts().find((part) => part.kind === "source")?.b,
      analysisMode() === "transient" ? simulationTime() : undefined,
    ),
  ),
}));
export const solution = createRoot(() =>
  createMemo(() => toSolution(circuitGraph.snapshot())),
);
export const selectedPart = () => parts().find((p) => p.id === selected());
export const hovered = () => parts().find((p) => p.id === hover()?.id);
export const pointFor = (
  items: Part[],
  node: string,
): { x: number; y: number } => {
  for (const p of items)
    if (p.kind !== "wire") {
      if (p.a === node) return { x: p.x - (p.terminalOffset ?? 48), y: p.y };

      if (p.b === node) return { x: p.x + (p.terminalOffset ?? 48), y: p.y };
    }

  for (const p of wires(items)) {
    if (p.a === node && p.ends?.a) return p.ends.a;
    if (p.b === node && p.ends?.b) return p.ends.b;
  }

  return { x: 0, y: 0 };
};

export const point = (node: string) => pointFor(parts(), node);

export const routeFor = (items: Part[], p: Part) => {
  const a = pointFor(items, p.a),
    b = pointFor(items, p.b);

  if (p.via) return [a, ...p.via, b];

  const side = (node: string) =>
    items.some((part) => part.kind !== "wire" && part.a === node) ? -1 : 1;

  const sa = side(p.a),
    sb = side(p.b);

  if (sa === sb) {
    const x =
      a.x === b.x
        ? a.x
        : sa < 0
          ? Math.min(a.x, b.x) - 24
          : Math.max(a.x, b.x) + 24;

    return [a, { x, y: a.y }, { x, y: b.y }, b];
  }

  if (a.y === b.y && (b.x - a.x) * sa > 0) return [a, b];

  const ax = a.x + sa * 24,
    bx = b.x + sb * 24;

  const mid = (a.y + b.y) / 2;

  return [
    a,
    { x: ax, y: a.y },
    { x: ax, y: mid },
    { x: bx, y: mid },
    { x: bx, y: b.y },
    b,
  ];
};

export const route = (p: Part) => routeFor(parts(), p);

export const path = (p: Part) =>
  route(p)
    .map((v, i) => `${i ? "L" : "M"} ${v.x} ${v.y}`)
    .join(" ");

export const wireLabel = (p: Part) => {
  const labelSide = [p.a, p.b].every((node) =>
    parts().some((part) => part.kind !== "wire" && part.a === node),
  )
    ? -1
    : 1;

  const points = route(p);
  const lengths = points
    .slice(1)
    .map((v, i) => Math.hypot(v.x - points[i].x, v.y - points[i].y));

  let remaining = lengths.reduce((a, b) => a + b, 0) / 2;

  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 0 && remaining <= lengths[i]) {
      const ratio = remaining / lengths[i];

      return {
        labelSide,
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
        angle:
          (Math.atan2(
            points[i + 1].y - points[i].y,
            points[i + 1].x - points[i].x,
          ) *
            180) /
          Math.PI,
      };
    }

    remaining -= lengths[i];
  }

  return { ...points[0], angle: 0, labelSide };
};

export const flow = (p: Part) =>
  currentFlow(
    solution().readings[p.id]?.current,
    Math.max(
      0,
      ...wires(parts()).map((w) =>
        Math.abs(solution().readings[w.id]?.current ?? 0),
      ),
    ),
  );

export const inspectedPart = () => selectedPart() ?? hovered();

export const errors = (part: Part) =>
  componentErrors(part, parts(), solution());

export const currentFlow = (current: number | undefined, maximum: number) => {
  if (current === undefined || !Number.isFinite(current))
    return { status: "unknown", duration: 0, reverse: false };

  if (Math.abs(current) < 1e-12)
    return { status: "idle", duration: 0, reverse: false };

  return {
    status: "active",
    duration: (0.45 * maximum) / Math.abs(current),
    reverse: current < 0,
  };
};

// Include terminal routing (24 units beyond the pins) and component labels.
export const circuitBounds = (parts: Part[]) => {
  const items = components(parts);
  const points = wires(parts).flatMap((part) => routeFor(parts, part));

  if (!items.length && !points.length) return undefined;

  return {
    left: Math.min(
      ...items.map((p) => p.x - (p.terminalOffset ?? 48) - 24),
      ...points.map((p) => p.x - 12),
    ),
    right: Math.max(
      ...items.map((p) => p.x + (p.terminalOffset ?? 48) + 24),
      ...points.map((p) => p.x + 12),
    ),
    top: Math.min(
      ...items.map((p) => p.y - 60),
      ...points.map((p) => p.y - 12),
    ),
    bottom: Math.max(
      ...items.map((p) => p.y + 76),
      ...points.map((p) => p.y + 12),
    ),
  };
};

export const constrainOffset = (
  offset: { x: number; y: number },
  bounds: ReturnType<typeof circuitBounds>,
  zoom: number,
  viewport: { width: number; height: number },
) => {
  if (!bounds || !viewport.width || !viewport.height) return { x: 0, y: 0 };

  const axis = (value: number, start: number, end: number, size: number) => {
    // Keep 30% of the canvas covered, or the entire circuit if it is smaller.
    const overlap = Math.min((end - start) * zoom, size * 0.3);

    return Math.max(
      overlap - end * zoom,
      Math.min(size - overlap - start * zoom, value),
    );
  };

  return {
    x: axis(offset.x, bounds.left, bounds.right, viewport.width),
    y: axis(offset.y, bounds.top, bounds.bottom, viewport.height),
  };
};

export const isJunction = (parts: Part[], node: string) =>
  wires(parts).filter((wire) => wire.a === node || wire.b === node).length > 1;

export const parseCircuit = (raw: string | null): Part[] | undefined => {
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    if (saved.version !== 1 || !Array.isArray(saved.parts)) return;

    const parts: unknown[] = saved.parts;

    if (
      !parts.every((value): value is Part => {
        if (!value || typeof value !== "object") return false;

        const p = value as Part;

        return (
          typeof p.id === "string" &&
          p.id.length > 0 &&
          typeof p.a === "string" &&
          typeof p.b === "string" &&
          catalog.some((c) => c.kind === p.kind) &&
          Number.isFinite(p.value) &&
          (p.initialVoltage === undefined ||
            Number.isFinite(p.initialVoltage)) &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          (p.closed === undefined || typeof p.closed === "boolean") &&
          (p.terminalOffset === undefined ||
            Number.isFinite(p.terminalOffset)) &&
          (p.ends === undefined ||
            (p.ends !== null &&
              typeof p.ends === "object" &&
              Object.entries(p.ends).every(
                ([side, end]) =>
                  ["a", "b"].includes(side) &&
                  end &&
                  Number.isFinite(end.x) &&
                  Number.isFinite(end.y),
              ))) &&
          (p.via === undefined ||
            (Array.isArray(p.via) &&
              p.via.every(
                (pos) =>
                  pos && Number.isFinite(pos.x) && Number.isFinite(pos.y),
              )))
        );
      })
    )
      return;

    if (new Set(parts.map((p) => p.id)).size !== parts.length) return;
    return parts;
  } catch {
    return;
  }
};

export const removePart = (items: Part[], part: Part) =>
  items
    .filter((p) => p.id !== part.id)
    .map((p) => {
      if (
        part.kind === "wire" ||
        p.kind !== "wire" ||
        ![p.a, p.b].some((node) => node === part.a || node === part.b)
      )
        return p;

      const ends = { ...p.ends };

      for (const side of ["a", "b"] as const) {
        if (p[side] === part.a)
          ends[side] = { x: part.x - (part.terminalOffset ?? 48), y: part.y };
        if (p[side] === part.b)
          ends[side] = { x: part.x + (part.terminalOffset ?? 48), y: part.y };
      }

      return { ...p, ends, via: routeFor(items, p).slice(1, -1) };
    });

export const looseTerminals = () => {
  const nodes = new Map<string, { x: number; y: number }>();
  const attached = new Set(components(parts()).flatMap((p) => [p.a, p.b]));

  for (const p of wires(parts())) {
    for (const side of ["a", "b"] as const) {
      if (!attached.has(p[side]) && p.ends?.[side])
        nodes.set(p[side], p.ends[side]!);
    }
  }

  return [...nodes].map(([node, position]) => ({ node, ...position }));
};

export const circuitPower = (solution: Solution, supplied: boolean) =>
  solution.error
    ? undefined
    : Object.values(solution.readings).reduce(
        (total, reading) =>
          total + Math.max(0, supplied ? -reading.power : reading.power),
        0,
      );

// Educational component ratings, not specifications for a particular physical part.
export const ratings = {
  source: { power: 5, current: 1, voltage: Infinity, reverse: Infinity },
  resistor: {
    power: 0.25,
    current: Infinity,
    voltage: Infinity,
    reverse: Infinity,
  },
  rheostat: {
    power: 0.25,
    current: Infinity,
    voltage: Infinity,
    reverse: Infinity,
  },
  lamp: { power: 1, current: Infinity, voltage: Infinity, reverse: Infinity },
  led: { power: 0.06, current: 0.02, voltage: Infinity, reverse: 5 },
  diode: { power: 1, current: 1, voltage: Infinity, reverse: 50 },
  capacitor: {
    power: Infinity,
    current: Infinity,
    voltage: 16,
    reverse: Infinity,
  },
  switch: { power: Infinity, current: 0.5, voltage: 30, reverse: Infinity },
  wire: { power: Infinity, current: 1, voltage: Infinity, reverse: Infinity },
};

export const componentErrors = (
  part: Part,
  parts: Part[],
  solution: Solution,
) => {
  const errors = parameterErrors(part);

  for (const [side, node] of [
    ["A", part.a],
    ["B", part.b],
  ]) {
    if (!parts.some((p) => p.id !== part.id && (p.a === node || p.b === node)))
      errors.push(
        `Terminal ${side} is disconnected. Connect it to the circuit.`,
      );
  }

  const reading = solution.readings[part.id];

  if (reading) {
    const limit = ratings[part.kind];

    if (Math.abs(reading.power) > limit.power * (1 + 1e-9))
      errors.push(
        `Power ${format(Math.abs(reading.power), "W")} exceeds the ${format(limit.power, "W")} rating.${part.kind === "led" ? " Add or increase the series resistor." : ""}`,
      );

    if (Math.abs(reading.current) > limit.current * (1 + 1e-9))
      errors.push(
        `Current ${format(Math.abs(reading.current), "A")} exceeds the ${format(limit.current, "A")} rating.`,
      );

    if (Math.abs(reading.voltage) > limit.voltage * (1 + 1e-9))
      errors.push(`Voltage exceeds the ${format(limit.voltage, "V")} rating.`);

    if (-reading.voltage > limit.reverse)
      errors.push(
        `Reverse voltage exceeds ${format(limit.reverse, "V")}. Check polarity: A is the anode, B is the cathode.`,
      );
  } else if (solution.error && !errors.length) {
    errors.push(`Electrical state unavailable: ${solution.error}`);
  }

  return errors;
};

export const specifications = (
  part: Part,
): { label: string; value: string }[] => {
  const limit = ratings[part.kind];
  const rows = [
    { label: "Maximum power", value: limit.power, unit: "W" },
    { label: "Maximum current", value: limit.current, unit: "A" },
    { label: "Maximum voltage", value: limit.voltage, unit: "V" },
    { label: "Maximum reverse voltage", value: limit.reverse, unit: "V" },
  ]
    .filter((row) => Number.isFinite(row.value))
    .map((row) => ({ label: row.label, value: format(row.value, row.unit) }));

  if (isDiode(part))
    rows.push(
      { label: "Model", value: "Piecewise-linear DC" },
      { label: "Terminal A", value: "Anode (+)" },
      { label: "Terminal B", value: "Cathode (−)" },
      { label: "Forward resistance", value: "10 Ω" },
      { label: "Reverse resistance", value: "1 GΩ" },
    );
  if (part.kind === "lamp")
    rows.push(
      { label: "Model", value: "Fixed resistance" },
      { label: "Filament heating", value: "Not simulated" },
    );
  return rows;
};

export const connections = (parts: Part[], part: Part) =>
  parts.filter(
    (w) =>
      w.id !== part.id &&
      ([part.a, part.b].includes(w.a) || [part.a, part.b].includes(w.b)),
  );

export const valueLabel = (part: Part) =>
  part.kind === "source"
    ? "Voltage (V)"
    : isDiode(part)
      ? "Forward voltage (V)"
      : part.kind === "capacitor"
        ? "Capacitance (F)"
        : "Resistance (Ω)";

/** Reattach an endpoint, then collapse a two-wire junction without changing resistance.
 * Junctions with a component pin or more than two wires remain explicit branches.
 */
export const joinTerminal = (
  items: Part[],
  node: string,
  target: string,
): Part[] => {
  if (node === target) return items;
  const position = pointFor(items, target);
  const paths = new Map(
    items
      .filter((p) => p.kind === "wire")
      .map((p) => [p.id, routeFor(items, p)]),
  );
  const next = items.map((p) =>
    p.kind !== "wire"
      ? p
      : {
          ...p,
          a: p.a === node ? target : p.a,
          b: p.b === node ? target : p.b,
          ends: {
            ...p.ends,
            ...(p.a === node ? { a: position } : {}),
            ...(p.b === node ? { b: position } : {}),
          },
        },
  );

  if (next.some((p) => p.kind !== "wire" && (p.a === target || p.b === target)))
    return next;

  const attached = next.filter(
    (p) => p.kind === "wire" && (p.a === target || p.b === target),
  );

  if (attached.length !== 2 || attached.some((p) => p.a === p.b)) return next;

  const [first, second] = attached;
  const a = first.a === target ? first.b : first.a;
  const b = second.a === target ? second.b : second.a;

  if (a === b) return next;

  const firstPath = paths.get(first.id)!;
  const secondPath = paths.get(second.id)!;
  const from = first.a === target ? [...firstPath].reverse() : firstPath;
  const to = second.b === target ? [...secondPath].reverse() : secondPath;
  const merged: Part = {
    ...first,
    a,
    b,
    value: first.value + second.value,
    ends: {
      a: first.ends?.[first.a === target ? "b" : "a"],
      b: second.ends?.[second.a === target ? "b" : "a"],
    },
    via: [...from.slice(1, -1), position, ...to.slice(1, -1)],
  };

  return next
    .filter((p) => p.id !== second.id)
    .map((p) => (p.id === first.id ? merged : p));
};

export const analysisLabel = () =>
  analysisMode() === "dc"
    ? "DC equilibrium"
    : `Transient · t = ${format(simulationTime(), "s")}`;
