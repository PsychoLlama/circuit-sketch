import { createResettableSignal } from "~/lib/signals";
import type { Branch, Kind } from "~/lib/circuit/solver";

export type Part = Branch & {
  x: number;
  y: number;
  terminalOffset?: number;
  ends?: Partial<Record<"a" | "b", { x: number; y: number }>>;
  via?: { x: number; y: number }[];
};

export type Hover = { id: string; x: number; y: number };

export const [parts, setParts] = createResettableSignal<Part[]>(() => []);
export const [selected, setSelected] = createResettableSignal<
  string | undefined
>(() => undefined);

export const [pending, setPending] = createResettableSignal<string | undefined>(
  () => undefined,
);

export const [tool, setTool] = createResettableSignal<Kind | "select">(
  () => "select",
);

export const [hover, setHover] = createResettableSignal<Hover | undefined>(
  () => undefined,
);

export const [suppressClick, setSuppressClick] = createResettableSignal(
  () => false,
);

export const [pinDrag, setPinDrag] = createResettableSignal<string | undefined>(
  () => undefined,
);

export const [preview, setPreview] = createResettableSignal<
  { x: number; y: number } | undefined
>(() => undefined);

export const [labels, setLabels] = createResettableSignal(() => true);
export const [offset, setOffset] = createResettableSignal(() => ({
  x: 0,
  y: 0,
}));

export const [viewport, setViewport] = createResettableSignal(() => ({
  width: 0,
  height: 0,
}));

export const [zoom, setZoom] = createResettableSignal(() => 1);
export const [history, setHistory] = createResettableSignal<Part[][]>(() => []);
export const [future, setFuture] = createResettableSignal<Part[][]>(() => []);
export const [drag, setDrag] = createResettableSignal<
  | {
      id: string;
      x: number;
      y: number;
      px: number;
      py: number;
      before: Part[];
    }
  | undefined
>(() => undefined);

export const [serial, setSerial] = createResettableSignal(() => 0);

export const [terminalDrag, setTerminalDrag] = createResettableSignal<
  { node: string; before: Part[] } | undefined
>(() => undefined);

export const [analysisMode, setAnalysisMode] = createResettableSignal<
  "dc" | "transient"
>(() => "transient");
export const [requestedTime, setRequestedTime] = createResettableSignal(
  () => 0,
);
export const [playback, setPlayback] = createResettableSignal(() => ({
  running: false,
  speed: 0.001,
  wallAnchor: 0,
  timeAnchor: 0,
}));
export const [frameTime, setFrameTime] = createResettableSignal(() => 0);
