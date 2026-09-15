import { createSignal } from "solid-js";
import type { Branch, Kind } from "~/lib/circuit/solver";

export type Part = Branch & { x: number; y: number };

export type Hover = { id: string; x: number; y: number };

export const createData = () => {
  const [parts, setParts] = createSignal<Part[]>([]);
  const [selected, setSelected] = createSignal<string>();
  const [pending, setPending] = createSignal<string>();
  const [tool, setTool] = createSignal<Kind | "select">("select");
  const [hover, setHover] = createSignal<Hover>();
  const [labels, setLabels] = createSignal(true);
  const [zoom, setZoom] = createSignal(1);
  const [history, setHistory] = createSignal<Part[][]>([]);
  const [future, setFuture] = createSignal<Part[][]>([]);
  const [drag, setDrag] = createSignal<{
    id: string;
    x: number;
    y: number;
    px: number;
    py: number;
    before: Part[];
  }>();

  return {
    parts,
    setParts,
    selected,
    setSelected,
    pending,
    setPending,
    tool,
    setTool,
    hover,
    setHover,
    labels,
    setLabels,
    zoom,
    setZoom,
    history,
    setHistory,
    future,
    setFuture,
    drag,
    setDrag,
  };
};
