import { createSignal } from "solid-js";
import type { Branch, Kind } from "~/lib/circuit/solver";

export type Part = Branch & { x: number; y: number; terminalOffset?: number };

export type Hover = { id: string; x: number; y: number };

export const createData = () => {
  const [parts, setParts] = createSignal<Part[]>([]);
  const [selected, setSelected] = createSignal<string>();
  const [pending, setPending] = createSignal<string>();
  const [tool, setTool] = createSignal<Kind | "select">("select");
  const [hover, setHover] = createSignal<Hover>();
  const [suppressClick, setSuppressClick] = createSignal(false);
  const [pinDrag, setPinDrag] = createSignal<string>();
  const [preview, setPreview] = createSignal<{ x: number; y: number }>();
  const [labels, setLabels] = createSignal(true);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [viewport, setViewport] = createSignal({ width: 0, height: 0 });
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
    suppressClick,
    setSuppressClick,
    pinDrag,
    setPinDrag,
    preview,
    setPreview,
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
    offset,
    setOffset,
    viewport,
    setViewport,
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
