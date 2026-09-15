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
        if (p.a === node) return { x: p.x - 48, y: p.y };

        if (p.b === node) return { x: p.x + 48, y: p.y };
      }

    return { x: 0, y: 0 };
  };

  const path = (p: Part) => {
    const a = point(p.a),
      b = point(p.b);

    const offset = (node: string) =>
      parts().some((p) => p.kind !== "wire" && p.a === node) ? -24 : 24;

    const ax = a.x + offset(p.a),
      bx = b.x + offset(p.b),
      mid = (a.y + b.y) / 2;

    return `M ${a.x} ${a.y} H ${ax} V ${mid} H ${bx} V ${b.y} H ${b.x}`;
  };

  return { solution, selectedPart, hovered, point, path };
};

// Include terminal routing (24 units beyond the pins) and component labels.
export const circuitBounds = (parts: Part[]) => {
  const items = components(parts);

  if (!items.length) return undefined;

  return {
    left: Math.min(...items.map((p) => p.x - 72)),
    right: Math.max(...items.map((p) => p.x + 72)),
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
