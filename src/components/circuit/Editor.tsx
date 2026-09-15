import { For, Show } from "solid-js";
import type { Lab } from "~/state/circuit/actions";
import {
  format,
  partValue,
  componentName,
  components,
  wires,
  isJunction,
} from "~/state/circuit/formulas";
import Symbol from "./Symbol";

const Editor = (props: { lab: Lab }) => {
  const lab = props.lab;

  return (
    <section class="editor">
      <div class="toolbar">
        <div class="circuit-title">
          <span class="circuit-dot" /> Untitled circuit{" "}
          <span class="tag">DC</span>
        </div>
        <div class="toolbar-actions">
          <button
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!lab.history().length}
            onClick={lab.undo}
          >
            ↶
          </button>
          <button
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!lab.future().length}
            onClick={lab.redo}
          >
            ↷
          </button>
          <span class="separator" />
          <button
            class={lab.labels() ? "toggled" : ""}
            onClick={() => lab.setLabels(!lab.labels())}
          >
            Readings
          </button>
          <button disabled={!lab.parts().length} onClick={lab.clear}>
            Clear
          </button>
        </div>
      </div>
      <div class={`canvas-wrap ${lab.tool() !== "select" ? "placing" : ""}`}>
        <div class="canvas-caption">
          <span class="eyebrow">WORKSPACE</span>
          <span>
            {components(lab.parts()).length} components ·{" "}
            {wires(lab.parts()).length} wires
          </span>
        </div>
        <svg
          ref={lab.bindCanvas}
          on:wheel={lab.scroll}
          class="circuit-canvas"
          aria-label="Circuit canvas"
          onClick={lab.canvas}
          onDragOver={(e) => e.preventDefault()}
          onDrop={lab.drop}
          onPointerMove={lab.move}
          onPointerUp={lab.endDrag}
          onPointerCancel={lab.cancelDrag}
        >
          <defs>
            <pattern
              id="grid"
              x={lab.pan().x}
              y={lab.pan().y}
              width={20 * lab.zoom()}
              height={20 * lab.zoom()}
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.8" fill="#cdd2d2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <g
            transform={`translate(${lab.pan().x} ${lab.pan().y}) scale(${lab.zoom()})`}
          >
            <Show when={lab.pending() && lab.preview()}>
              <path
                class="wire-preview"
                d={`M ${lab.point(lab.pending()!).x} ${lab.point(lab.pending()!).y} L ${lab.preview()!.x} ${lab.preview()!.y}`}
              />
            </Show>
            <For each={wires(lab.parts())}>
              {(p) => (
                <g
                  data-part={p.id}
                  class={`wire ${lab.flow(p).status} ${lab.selected() === p.id ? "selected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    lab.setSelected(p.id);
                  }}
                  onPointerEnter={(e) =>
                    lab.setHover({ id: p.id, x: e.clientX, y: e.clientY })
                  }

                  onPointerLeave={() => lab.setHover(undefined)}
                >
                  <path class="wire-hit" d={lab.path(p)} />
                  <title>
                    {lab.flow(p).status === "unknown"
                      ? "Current unknown"
                      : `${format(Math.abs(lab.solution().readings[p.id]?.current ?? 0), "A")} · ${lab.flow(p).status === "idle" ? "No current" : lab.flow(p).reverse ? "B → A" : "A → B"}`}
                  </title>
                  <path class="wire-line" d={lab.path(p)} />
                  <Show when={lab.flow(p).status === "active"}>
                    <path
                      class="wire-flow"
                      d={lab.path(p)}
                      style={{
                        "animation-duration": `${lab.flow(p).duration}s`,
                        "animation-direction": lab.flow(p).reverse
                          ? "reverse"
                          : "normal",
                      }}
                    />
                    <path
                      class="flow-arrow"
                      d="M -5 -4 L 3 0 L -5 4"
                      transform={`translate(${lab.wireLabel(p).x} ${lab.wireLabel(p).y}) rotate(${lab.wireLabel(p).angle + (lab.flow(p).reverse ? 180 : 0)})`}
                    />
                  </Show>
                  <Show when={lab.labels() && lab.solution().readings[p.id]}>
                    <text
                      class="wire-reading"
                      x={lab.wireLabel(p).x + 8 * lab.wireLabel(p).labelSide}
                      text-anchor={
                        lab.wireLabel(p).labelSide < 0 ? "end" : "start"
                      }
                      y={lab.wireLabel(p).y - 8}
                    >
                      {format(lab.solution().readings[p.id]?.current, "A")}
                    </text>
                  </Show>
                </g>
              )}
            </For>
            <For each={components(lab.parts())}>
              {(p) => (
                <g
                  data-part={p.id}
                  transform={`translate(${p.x} ${p.y})`}
                  class={`circuit-part ${lab.selected() === p.id ? "selected" : ""}`}
                  onPointerDown={(e) => lab.startDrag(e, p)}
                  onPointerEnter={(e) =>
                    lab.setHover({ id: p.id, x: e.clientX, y: e.clientY })
                  }

                  onPointerLeave={() => lab.setHover(undefined)}
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
                  <Symbol kind={p.kind} closed={p.closed} />
                  <text class="part-value" x="0" y="52">
                    {partValue(p)}
                  </text>
                  <Show when={lab.labels() && lab.solution().readings[p.id]}>
                    <text class="part-reading" x="0" y="70">
                      {format(lab.solution().readings[p.id]?.voltage, "V")} ·{" "}
                      {format(lab.solution().readings[p.id]?.current, "A")}
                    </text>
                  </Show>
                  <For each={["a", "b"] as const}>
                    {(side) => (
                      <g
                        data-pin={p[side]}
                        class={`pin ${lab.pending() === p[side] ? "pending" : ""}`}
                        onPointerDown={(e) => lab.startPin(e, p[side])}
                        onClick={(e) => {
                          e.stopPropagation();
                          lab.setSuppressClick(false);
                        }}
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
                          class={
                            isJunction(lab.parts(), p[side]) ? "junction" : ""
                          }
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
        <Show when={!lab.parts().length && lab.tool() === "select"}>
          <div class="empty-canvas">
            <div class="empty-schematic">
              <svg viewBox="0 0 180 90">
                <path d="M20 45H60M120 45H160" />
                <circle cx="20" cy="45" r="4" />
                <circle cx="160" cy="45" r="4" />
                <rect x="60" y="20" width="60" height="50" rx="6" />
                <path d="M80 45h20m-10-10v20" />
              </svg>
            </div>
            <span class="eyebrow">A LITTLE CURIOSITY. A CLOSED LOOP.</span>
            <h1>Make electricity make sense.</h1>
            <p>
              Build a circuit and see what’s happening
              <br />
              at every connection. No breadboard required.
            </p>
            <button class="primary" onClick={() => lab.choose("source")}>
              + Place your first source
            </button>
            <button class="text-button" onClick={() => lab.example("series")}>
              Or explore a working circuit <span>↗</span>
            </button>
          </div>
        </Show>
        <Show when={lab.parts().length}>
          <div class="flow-legend">
            <span class="flow-swatch" /> Conventional current · faster = more
            current
            <span class="idle-swatch" /> Still = no current · dotted = unknown
          </div>
        </Show>
        <div class="canvas-bottom">
          <div class="mode-pill">
            <span class="accent-text">
              {lab.tool() === "select" ? "↖" : "+"}
            </span>
            {lab.pending()
              ? "Click a terminal to finish the wire"
              : lab.tool() === "select"
                ? "Scroll to pan · Shift + scroll for horizontal"
                : lab.tool() === "wire"
                  ? "Click two terminals to connect"
                  : `Click canvas to place ${componentName(lab.tool())?.toLowerCase()}`}
            <Show when={lab.tool() !== "select"}>
              <button onClick={() => lab.choose("select")}>Esc</button>
            </Show>
          </div>
          <div class="zoom">
            <button
              aria-label="Zoom out"
              disabled={lab.zoom() <= 0.5}
              onClick={() => lab.setZoom((z) => Math.max(0.5, z - 0.1))}
            >
              −
            </button>
            <button title="Reset zoom" onClick={() => lab.setZoom(1)}>
              {Math.round(lab.zoom() * 100)}%
            </button>
            <button
              aria-label="Zoom in"
              disabled={lab.zoom() >= 1.5}
              onClick={() => lab.setZoom((z) => Math.min(1.5, z + 0.1))}
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
