import {
  errors,
  flow,
  pan,
  path,
  point,
  solution,
  wireLabel,
  format,
  partValue,
  componentName,
  components,
  wires,
  isJunction,
  looseTerminals,
} from "~/state/circuit/formulas";
import {
  allowDrop,
  bindCanvas,
  cancelDrag,
  canvas,
  choose,
  clear,
  clearHover,
  clickPin,
  drop,
  endDrag,
  example,
  move,
  previewPart,
  redo,
  resetZoom,
  scroll,
  startDrag,
  startPin,
  startTerminal,
  selectWire,
  toggleLabels,
  undo,
  zoomIn,
  zoomOut,
} from "~/state/circuit/actions";
import {
  future,
  history,
  labels,
  parts,
  pending,
  preview,
  selected,
  tool,
  zoom,
} from "~/state/circuit/data";
import { For, Show } from "solid-js";
import Symbol from "./symbol";

const Editor = () => {
  return (
    <section class="editor">
      <div class="toolbar">
        <div class="circuit-title">
          <span class="circuit-dot" /> Untitled circuit
        </div>
        <div class="toolbar-actions">
          <button
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!history().length}
            onClick={undo}
          >
            ↶
          </button>
          <button
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!future().length}
            onClick={redo}
          >
            ↷
          </button>
          <span class="separator" />
          <button class={labels() ? "toggled" : ""} onClick={toggleLabels}>
            Readings
          </button>
          <button disabled={!parts().length} onClick={clear}>
            Clear
          </button>
        </div>
      </div>
      <div class={`canvas-wrap ${tool() !== "select" ? "placing" : ""}`}>
        <div class="canvas-caption">
          <span class="eyebrow">WORKSPACE</span>
          <span>
            {components(parts()).length} components · {wires(parts()).length}{" "}
            wires
          </span>
        </div>
        <svg
          ref={bindCanvas}
          on:wheel={scroll}
          class="circuit-canvas"
          aria-label="Circuit canvas"
          onClick={canvas}
          onDragOver={allowDrop}
          onDrop={drop}
          onPointerMove={move}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
        >
          <defs>
            <pattern
              id="grid"
              x={pan().x}
              y={pan().y}
              width={20 * zoom()}
              height={20 * zoom()}
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.8" fill="#cdd2d2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <g transform={`translate(${pan().x} ${pan().y}) scale(${zoom()})`}>
            <Show when={pending() && preview()}>
              <path
                class="wire-preview"
                d={`M ${point(pending()!).x} ${point(pending()!).y} L ${preview()!.x} ${preview()!.y}`}
              />
            </Show>
            <For each={wires(parts())}>
              {(p) => (
                <g
                  data-part={p.id}
                  class={`wire ${flow(p).status} ${selected() === p.id ? "selected" : ""}`}
                  onPointerDown={(event) => selectWire(event, p.id)}
                  onPointerEnter={(event) => previewPart(event, p.id)}
                  onPointerLeave={clearHover}
                >
                  <path class="wire-hit" d={path(p)} />
                  <Show when={selected() === p.id}>
                    <path class="wire-selection" d={path(p)} />
                  </Show>
                  <title>
                    {flow(p).status === "unknown"
                      ? "Current unknown"
                      : `${format(Math.abs(solution().readings[p.id]?.current ?? 0), "A")} · ${flow(p).status === "idle" ? "No current" : flow(p).reverse ? "B → A" : "A → B"}`}
                  </title>
                  <path class="wire-line" d={path(p)} />
                  <Show when={flow(p).status === "active"}>
                    <path
                      class="wire-flow"
                      d={path(p)}
                      style={{
                        "animation-duration": `${flow(p).duration}s`,
                        "animation-direction": flow(p).reverse
                          ? "reverse"
                          : "normal",
                      }}
                    />
                  </Show>
                  <Show when={labels() && solution().readings[p.id]}>
                    <text
                      class="wire-reading"
                      x={wireLabel(p).x + 8 * wireLabel(p).labelSide}
                      text-anchor={wireLabel(p).labelSide < 0 ? "end" : "start"}
                      y={wireLabel(p).y - 8}
                    >
                      {format(solution().readings[p.id]?.current, "A")}
                    </text>
                  </Show>
                </g>
              )}
            </For>
            <For each={looseTerminals()}>
              {(terminal) => (
                <g
                  data-pin={terminal.node}
                  class="pin loose-terminal"
                  transform={`translate(${terminal.x} ${terminal.y})`}
                  onPointerDown={(event) => startTerminal(event, terminal.node)}
                  onClick={clickPin}
                >
                  <title>Drag to move or reconnect terminal</title>
                  <circle class="pin-hit" r="12" />
                  <circle r="5" />
                </g>
              )}
            </For>
            <For each={components(parts())}>
              {(p) => (
                <g
                  data-part={p.id}
                  transform={`translate(${p.x} ${p.y})`}
                  class={`circuit-part ${selected() === p.id ? "selected" : ""} ${errors(p).length ? "has-error" : ""}`}
                  onPointerDown={(e) => startDrag(e, p)}
                  onPointerEnter={(e) => previewPart(e, p.id)}

                  onPointerLeave={clearHover}
                >
                  <rect
                    class="part-bg"
                    x="-57"
                    y="-33"
                    width="114"
                    height="66"
                    rx="7"
                  />
                  <text class="part-id" x="0" y="-43">
                    {p.id}
                  </text>
                  <Show when={p.terminalOffset}>
                    <path
                      class="terminal-lead"
                      d={`M ${-p.terminalOffset!} 0 H -48 M 48 0 H ${p.terminalOffset!}`}
                    />
                  </Show>
                  <Symbol
                    kind={p.kind}
                    closed={p.closed}
                    lit={
                      (p.kind === "led" || p.kind === "lamp") &&
                      !errors(p).length &&
                      (solution().readings[p.id]?.power ?? 0) > 0.001
                    }
                  />
                  <Show when={errors(p).length}>
                    <g
                      class="error-indicator"
                      role="img"
                      aria-label={`${p.id}: ${errors(p).join(" ")}`}
                    >
                      <title>{errors(p).join("\n")}</title>
                      <circle cx="46" cy="-27" r="10" />
                      <text x="46" y="-23">
                        !
                      </text>
                    </g>
                  </Show>
                  <text class="part-value" x="0" y="52">
                    {partValue(p)}
                  </text>
                  <Show when={labels() && solution().readings[p.id]}>
                    <text class="part-reading" x="0" y="70">
                      {format(solution().readings[p.id]?.voltage, "V")} ·{" "}
                      {format(solution().readings[p.id]?.current, "A")}
                    </text>
                  </Show>
                  <For each={["a", "b"] as const}>
                    {(side) => (
                      <g
                        data-pin={p[side]}
                        class={`pin ${pending() === p[side] ? "pending" : ""}`}
                        onPointerDown={(e) => startPin(e, p[side])}
                        onClick={clickPin}
                      >
                        <circle
                          class="pin-hit"
                          cx={
                            (side === "a" ? -1 : 1) * (p.terminalOffset ?? 48)
                          }
                          r="12"
                        />
                        <circle
                          cx={
                            (side === "a" ? -1 : 1) * (p.terminalOffset ?? 48)
                          }
                          r="4"
                          class={isJunction(parts(), p[side]) ? "junction" : ""}
                        />
                        <text
                          x={(side === "a" ? -1 : 1) * (p.terminalOffset ?? 48)}
                          y="-13"
                        >
                          {side.toUpperCase()}
                        </text>
                      </g>
                    )}
                  </For>
                </g>
              )}
            </For>
          </g>
        </svg>
        <Show when={!parts().length && tool() === "select"}>
          <div class="empty-canvas">
            <h1>New circuit</h1>
            <button class="primary" onClick={() => choose("source")}>
              + Add source
            </button>
            <button class="text-button" onClick={() => example("series")}>
              Load series example <span>↗</span>
            </button>
          </div>
        </Show>
        <Show when={parts().length}>
          <div class="flow-legend">
            <span class="flow-swatch" /> Current
            <span class="idle-swatch" /> Dashed = unknown
          </div>
        </Show>
        <div class="canvas-bottom">
          <div class="mode-pill">
            <span class="accent-text">{tool() === "select" ? "↖" : "+"}</span>
            {pending()
              ? "Click a terminal to finish the wire"
              : tool() === "select"
                ? "Select"
                : tool() === "wire"
                  ? "Click two terminals to connect"
                  : `Click canvas to place ${componentName(tool())?.toLowerCase()}`}
            <Show when={tool() !== "select"}>
              <button onClick={() => choose("select")}>Esc</button>
            </Show>
          </div>
          <div class="zoom">
            <button
              aria-label="Zoom out"
              disabled={zoom() <= 0.5}
              onClick={zoomOut}
            >
              −
            </button>
            <button title="Reset zoom" onClick={resetZoom}>
              {Math.round(zoom() * 100)}%
            </button>
            <button
              aria-label="Zoom in"
              disabled={zoom() >= 1.5}
              onClick={zoomIn}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Editor;
