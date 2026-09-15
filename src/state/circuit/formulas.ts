import { createMemo } from "solid-js";
import {
  solve,
  type Kind,
  type Solution,
  type Reading,
} from "../../lib/circuit/solver";
import type { Part, createData } from "./data";

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

export const defaults: Record<Kind, number> = {
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
        p.kind === "source" ? "V" : p.kind === "capacitor" ? "F" : "Ω",
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

export const createFormulas = (d: ReturnType<typeof createData>) => {
  const parts = d.parts;
  const solution = createMemo(() => solve(parts()));
  const selectedPart = createMemo(() =>
    parts().find((p) => p.id === d.selected()),
  );
  const hovered = createMemo(() => parts().find((p) => p.id === d.hover()?.id));
  const point = (node: string): { x: number; y: number } => {
    for (const p of parts())
      if (p.kind !== "wire") {
        if (p.a === node) return { x: p.x - (p.terminalOffset ?? 48), y: p.y };

        if (p.b === node) return { x: p.x + (p.terminalOffset ?? 48), y: p.y };
      }

    return { x: 0, y: 0 };
  };

  const route = (p: Part) => {
    const a = point(p.a),
      b = point(p.b);
    const side = (node: string) =>
      parts().some((part) => part.kind !== "wire" && part.a === node) ? -1 : 1;
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
  const path = (p: Part) =>
    route(p)
      .map((v, i) => `${i ? "L" : "M"} ${v.x} ${v.y}`)
      .join(" ");
  const wireLabel = (p: Part) => {
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
  const flow = (p: Part) =>
    currentFlow(
      solution().readings[p.id]?.current,
      Math.max(
        0,
        ...wires(parts()).map((w) =>
          Math.abs(solution().readings[w.id]?.current ?? 0),
        ),
      ),
    );

  return { solution, selectedPart, hovered, point, path, wireLabel, flow };
};

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

  if (!items.length) return undefined;

  return {
    left: Math.min(...items.map((p) => p.x - (p.terminalOffset ?? 48) - 24)),
    right: Math.max(...items.map((p) => p.x + (p.terminalOffset ?? 48) + 24)),
    top: Math.min(...items.map((p) => p.y - 60)),
    bottom: Math.max(...items.map((p) => p.y + 76)),
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
