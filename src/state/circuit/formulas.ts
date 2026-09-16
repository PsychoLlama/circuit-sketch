import { createMemo, createRoot } from "solid-js";
import {
  solve,
  parameterErrors,
  isDiode,
  type Kind,
  type Solution,
  type Reading,
} from "~/lib/circuit/solver";
import {
  parts,
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
    description: "Open circuit at DC equilibrium",
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

// This memo shares the browser editor's module lifetime. Server renders only
// read the initial empty state; restoration and editing happen on the client.
export const solution = createRoot(() => createMemo(() => solve(parts())));
export const selectedPart = () => parts().find((p) => p.id === selected());
export const hovered = () => parts().find((p) => p.id === hover()?.id);
export const point = (node: string): { x: number; y: number } => {
  for (const p of parts())
    if (p.kind !== "wire") {
      if (p.a === node) return { x: p.x - (p.terminalOffset ?? 48), y: p.y };

      if (p.b === node) return { x: p.x + (p.terminalOffset ?? 48), y: p.y };
    }

  return { x: 0, y: 0 };
};

export const route = (p: Part) => {
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

export const inspectedPart = () => {
  const part = selectedPart() ?? hovered();

  return part?.kind === "wire" ? undefined : part;
};

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
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          (p.closed === undefined || typeof p.closed === "boolean") &&
          (p.terminalOffset === undefined || Number.isFinite(p.terminalOffset))
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

export const removePart = (parts: Part[], part: Part) => {
  if (part.kind === "wire") return parts.filter((p) => p.id !== part.id);

  const attached = (node: string) =>
    parts.filter((p) => p.kind === "wire" && (p.a === node || p.b === node));

  const left = attached(part.a);
  const right = attached(part.b);
  const remaining = parts.filter(
    (p) => p.id !== part.id && !left.includes(p) && !right.includes(p),
  );

  if (left.length === 1 && right.length === 1 && left[0] !== right[0]) {
    const a = left[0].a === part.a ? left[0].b : left[0].a;
    const b = right[0].a === part.b ? right[0].b : right[0].a;

    if (a !== b)
      remaining.push({
        ...left[0],
        a,
        b,
        value: left[0].value + right[0].value,
      });
  }

  return remaining;
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

export const ratingDescription = (part: Part) => {
  const limit = ratings[part.kind];

  return [
    Number.isFinite(limit.power)
      ? `${format(limit.power, "W")} maximum power`
      : "",
    Number.isFinite(limit.current)
      ? `${format(limit.current, "A")} maximum current`
      : "",
    Number.isFinite(limit.voltage)
      ? `${format(limit.voltage, "V")} maximum voltage`
      : "",
    Number.isFinite(limit.reverse)
      ? `${format(limit.reverse, "V")} maximum reverse voltage`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

export const connections = (parts: Part[], part: Part) =>
  wires(parts).filter(
    (w) => [part.a, part.b].includes(w.a) || [part.a, part.b].includes(w.b),
  );

export const valueLabel = (part: Part) =>
  part.kind === "source"
    ? "Voltage (V)"
    : isDiode(part)
      ? "Forward voltage (V)"
      : part.kind === "capacitor"
        ? "Capacitance (F)"
        : "Resistance (Ω)";
