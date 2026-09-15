import { For, Show } from "solid-js";
import {
  catalog,
  createLab,
  format,
  partValue,
  type Lab,
} from "~/state/circuit/actions";
import type { Part } from "~/state/circuit/data";
import type { Kind } from "~/lib/circuit/solver";
function Symbol(props: { kind: Kind; closed?: boolean }) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Show when={props.kind === "resistor"}>
        <path d="M-48 0H-30l5-10 10 20 10-20 10 20 10-20 10 20 5-10H48" />
      </Show>
      <Show when={props.kind === "source"}>
        <path d="M-48 0H-18M18 0H48" />
        <circle r="18" />
        <path d="M-12 0h8m-4-4v8M5 0h8" />
      </Show>
      <Show when={props.kind === "capacitor"}>
        <path d="M-48 0H-6M6 0H48M-6-18v36M6-18v36" />
      </Show>
      <Show when={props.kind === "switch"}>
        <path d={`M-48 0H-20M20 0H48M-18 0L18 ${props.closed ? 0 : -22}`} />
        <circle cx="-20" r="3" />
        <circle cx="20" r="3" />
      </Show>
      <Show when={props.kind === "wire"}>
        <path d="M-45 10H-10V-10H45" />
        <circle cx="-45" cy="10" r="3" />
        <circle cx="45" cy="-10" r="3" />
      </Show>
    </g>
  );
}
function Measurements(props: { lab: Lab; part: Part }) {
  const reading = () => props.lab.solution().readings[props.part.id];
  return (
    <>
      <div class="readout-grid">
        <div>
          <span>Voltage drop · A − B</span>
          <strong>{format(reading()?.voltage, "V")}</strong>
        </div>
        <div>
          <span>Current · A → B</span>
          <strong>{format(reading()?.current, "A")}</strong>
        </div>
      </div>
      <dl class="measurements">
        <div>
          <dt>Terminal A</dt>
          <dd>{format(reading()?.a, "V")}</dd>
        </div>
        <div>
          <dt>Terminal B</dt>
          <dd>{format(reading()?.b, "V")}</dd>
        </div>
        <div>
          <dt>
            {(reading()?.power ?? 0) < 0 ? "Power supplied" : "Power absorbed"}
          </dt>
          <dd>{format(Math.abs(reading()?.power ?? NaN), "W")}</dd>
        </div>
        <Show when={props.part.kind === "capacitor"}>
          <div>
            <dt>Stored energy · ½CV²</dt>
            <dd>
              {format(
                reading()
                  ? 0.5 * props.part.value * reading()!.voltage ** 2
                  : undefined,
                "J",
              )}
            </dd>
          </div>
        </Show>
      </dl>
    </>
  );
}
function Inspector(props: { lab: Lab }) {
  const lab = props.lab;
  return (
    <aside class="inspector">
      <div class="panel-heading">
        INSPECTOR <span>Live measurements</span>
      </div>
      <Show
        when={lab.selectedPart()}
        fallback={
          <div class="inspector-empty">
            <div class="scope-icon">⌖</div>
            <h3>A multimeter, everywhere.</h3>
            <p>
              Hover over any component or wire to take a reading. Select it to
              adjust its properties.
            </p>
            <div class="mini-rule" />
            <span class="eyebrow">THREE THINGS TO WATCH</span>
            <dl class="concepts">
              <dt>
                Voltage <b>V</b>
              </dt>
              <dd>The potential difference between two points.</dd>
              <dt>
                Current <b>A</b>
              </dt>
              <dd>The rate of charge flow through a path.</dd>
              <dt>
                Resistance <b>Ω</b>
              </dt>
              <dd>How much a path opposes current.</dd>
            </dl>
          </div>
        }
      >
        {(p) => (
          <>
            <div class="selection-title">
              <svg viewBox="-55 -30 110 60">
                <Symbol kind={p().kind} closed={p().closed} />
              </svg>
              <div>
                <h2>{p().id}</h2>
                <span>{catalog.find((c) => c.kind === p().kind)?.name}</span>
              </div>
            </div>
            <div class="panel-section">
              <span class="eyebrow">PROPERTIES</span>
              <Show when={p().kind !== "wire"}>
                <label>
                  Component
                  <select
                    aria-label="Component type"
                    value={p().kind}
                    onChange={(e) => {
                      const kind = e.currentTarget.value as Kind;
                      lab.update(p().id, {
                        kind,
                        value:
                          kind === "source"
                            ? 9
                            : kind === "resistor"
                              ? 1000
                              : kind === "capacitor"
                                ? 1e-6
                                : 0,
                      });
                    }}
                  >
                    <For each={catalog.filter((c) => c.kind !== "wire")}>
                      {(c) => <option value={c.kind}>{c.name}</option>}
                    </For>
                  </select>
                </label>
              </Show>
              <Show
                when={p().kind === "switch"}
                fallback={
                  <label>
                    {p().kind === "source"
                      ? "Voltage (V)"
                      : p().kind === "capacitor"
                        ? "Capacitance (F)"
                        : "Resistance (Ω)"}
                    <input
                      aria-label="Component value"
                      type="number"
                      step="any"
                      min={
                        p().kind === "source"
                          ? undefined
                          : p().kind === "resistor"
                            ? "0.000001"
                            : "0"
                      }
                      value={p().value}
                      onInput={(e) => {
                        const n = e.currentTarget.valueAsNumber;
                        if (
                          Number.isFinite(n) &&
                          (p().kind === "source" ||
                            n > 0 ||
                            (p().kind === "wire" && n === 0))
                        )
                          lab.update(p().id, { value: n });
                      }}
                    />
                  </label>
                }
              >
                <button
                  class="wide accent"
                  onClick={() => lab.update(p().id, { closed: !p().closed })}
                >
                  {p().closed
                    ? "● Closed — click to open"
                    : "○ Open — click to close"}
                </button>
              </Show>
              <Show when={p().kind === "wire"}>
                <label>
                  Wire model
                  <select
                    value={p().value === 0 ? "ideal" : "resistive"}
                    onChange={(e) =>
                      lab.update(p().id, {
                        value: e.currentTarget.value === "ideal" ? 0 : 0.1,
                      })
                    }
                  >
                    <option value="ideal">Ideal · 0 Ω</option>
                    <option value="resistive">Resistive · custom Ω</option>
                  </select>
                </label>
              </Show>
            </div>
            <div class="panel-section">
              <span class="eyebrow">ELECTRICAL STATE</span>
              <Measurements lab={lab} part={p()} />
              <p class="fine">
                Signed readings follow A → B. Negative current flows B → A.
                Voltages use the source’s negative terminal as 0 V.
              </p>
            </div>
            <Show when={p().kind === "capacitor"}>
              <div class="notice">
                DC equilibrium: this capacitor is fully settled. Current is
                zero; charging over time is not simulated.
              </div>
            </Show>
            <Show when={p().kind === "wire"}>
              <div class="panel-section">
                <span class="eyebrow">EDIT PATH</span>
                <div class="insert-buttons">
                  <For each={catalog.filter((c) => c.kind !== "wire")}>
                    {(c) => (
                      <button onClick={() => lab.insert(c.kind)}>
                        + Insert {c.name.toLowerCase()}
                      </button>
                    )}
                  </For>
                </div>
                <button class="wide" onClick={() => lab.pin(p().a)}>
                  Branch from terminal A ↗
                </button>
                <p class="fine">
                  Then click another terminal. Crossing wires are only connected
                  at terminals.
                </p>
              </div>
            </Show>
            <div class="panel-section">
              <button class="danger wide" onClick={lab.remove}>
                Remove {p().kind === "wire" ? "wire" : "component"}{" "}
                <span>⌫</span>
              </button>
            </div>
          </>
        )}
      </Show>
      <div class="model-note">
        <span class="status-dot" /> DC steady state{" "}
        <p>
          Ideal, linear components. No heat, breakdown, AC, or charging
          transients.
        </p>
        <a
          href="https://lpsa.swarthmore.edu/Systems/Electrical/mna/MNA3.html"
          target="_blank"
          rel="noreferrer"
        >
          How the circuit is solved ↗
        </a>
      </div>
    </aside>
  );
}
export default function CircuitLab() {
  const lab = createLab();
  return (
    <main class="app-shell" tabIndex={-1} onKeyDown={lab.key}>
      <header>
        <div class="brand">
          <span class="brand-mark">ϟ</span> current
          <span class="brand-divider" />{" "}
          <span class="brand-description">An electricity playground</span>
        </div>
        <div class="header-right">
          <span class="live">
            <span class="status-dot" /> LIVE SOLVER
          </span>
          <span class="version">DC LAB / 01</span>
        </div>
      </header>
      <div class="workspace">
        <aside class="library">
          <div class="panel-heading">
            COMPONENTS <span>05</span>
          </div>
          <div class="library-intro">Pick a part. Place it. Connect it.</div>
          <For each={catalog}>
            {(c) => (
              <button
                class={`part-button ${lab.tool() === c.kind ? "active" : ""}`}
                onClick={() => lab.choose(c.kind)}
              >
                <svg viewBox="-55 -30 110 60">
                  <Symbol kind={c.kind} closed={false} />
                </svg>
                <span>
                  {c.name}
                  <small>{c.description}</small>
                </span>
                <kbd>{c.key}</kbd>
              </button>
            )}
          </For>
          <div class="library-section">
            <span class="eyebrow">START WITH AN EXPERIMENT</span>
            <button class="experiment" onClick={() => lab.example("series")}>
              <span>01</span>
              <div>
                A complete circuit<small>Source → resistor → switch</small>
              </div>
              <b>↗</b>
            </button>
            <button class="experiment" onClick={() => lab.example("divider")}>
              <span>02</span>
              <div>
                Divide the voltage<small>Two resistors, one source</small>
              </div>
              <b>↗</b>
            </button>
            <button class="experiment" onClick={() => lab.example("parallel")}>
              <span>03</span>
              <div>
                Follow the branches<small>Where does current go?</small>
              </div>
              <b>↗</b>
            </button>
            <button class="experiment" onClick={() => lab.example("capacitor")}>
              <span>04</span>
              <div>
                A settled capacitor<small>Voltage without current</small>
              </div>
              <b>↗</b>
            </button>
            <p class="fine">
              Experiments replace the canvas. Undo brings your circuit back.
            </p>
          </div>
          <div class="library-bottom">
            <span class="eyebrow">THE USEFUL EQUATION</span>
            <div class="equation">
              V <span>=</span> I <span>×</span> R
            </div>
            <p>
              Change one thing.
              <br />
              See what happens to the rest.
            </p>
          </div>
        </aside>
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
                title="Redo"
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
          <div
            class={`canvas-wrap ${lab.tool() !== "select" ? "placing" : ""}`}
          >
            <div class="canvas-caption">
              <span class="eyebrow">WORKSPACE</span>
              <span>
                {lab.parts().filter((p) => p.kind !== "wire").length} components
                · {lab.parts().filter((p) => p.kind === "wire").length} wires
              </span>
            </div>
            <svg
              class="circuit-canvas"
              aria-label="Circuit canvas"
              onClick={lab.canvas}
              onPointerMove={lab.move}
              onPointerUp={lab.endDrag}
              onPointerCancel={lab.endDrag}
            >
              <defs>
                <pattern
                  id="grid"
                  width={20 * lab.zoom()}
                  height={20 * lab.zoom()}
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="0.8" fill="#cdd2d2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <g transform={`scale(${lab.zoom()})`}>
                <For each={lab.parts().filter((p) => p.kind === "wire")}>
                  {(p) => (
                    <g
                      data-part={p.id}
                      class={`wire ${lab.selected() === p.id ? "selected" : ""}`}
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
                      <path class="wire-line" d={lab.path(p)} />
                      <Show
                        when={lab.labels() && lab.solution().readings[p.id]}
                      >
                        <text
                          class="wire-reading"
                          x={(lab.point(p.a).x + lab.point(p.b).x) / 2 + 8}
                          y={(lab.point(p.a).y + lab.point(p.b).y) / 2 - 8}
                        >
                          {format(lab.solution().readings[p.id]?.current, "A")}
                        </text>
                      </Show>
                    </g>
                  )}
                </For>
                <For each={lab.parts().filter((p) => p.kind !== "wire")}>
                  {(p) => (
                    <g
                      data-part={p.id}
                      transform={`translate(${p.x} ${p.y})`}
                      class={`circuit-part ${lab.selected() === p.id ? "selected" : ""}`}
                      onPointerDown={(e) => lab.startDrag(e, p)}
                      onDblClick={() => {
                        if (p.kind === "switch")
                          lab.update(p.id, { closed: !p.closed });
                      }}
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
                      <Symbol kind={p.kind} closed={p.closed} />
                      <text class="part-value" x="0" y="52">
                        {partValue(p)}
                      </text>
                      <Show
                        when={lab.labels() && lab.solution().readings[p.id]}
                      >
                        <text class="part-reading" x="0" y="70">
                          {format(lab.solution().readings[p.id]?.voltage, "V")}{" "}
                          ·{" "}
                          {format(lab.solution().readings[p.id]?.current, "A")}
                        </text>
                      </Show>
                      <For each={["a", "b"] as const}>
                        {(side) => (
                          <g
                            data-pin={p[side]}
                            class={`pin ${lab.pending() === p[side] ? "pending" : ""}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              lab.pin(p[side]);
                            }}
                          >
                            <circle
                              class="pin-hit"
                              cx={side === "a" ? -48 : 48}
                              r="12"
                            />
                            <circle cx={side === "a" ? -48 : 48} r="4" />
                            <text x={side === "a" ? -48 : 48} y="-13">
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
                <button
                  class="text-button"
                  onClick={() => lab.example("series")}
                >
                  Or explore a working circuit <span>↗</span>
                </button>
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
                    ? "Select & move"
                    : lab.tool() === "wire"
                      ? "Click two terminals to connect"
                      : `Click canvas to place ${catalog.find((c) => c.kind === lab.tool())?.name.toLowerCase()}`}
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
          <div
            class={`solver-panel ${lab.solution().error ? "has-error" : ""}`}
          >
            <div class="solver-heading">
              <span class="status-dot" />
              <strong>
                {lab.solution().error
                  ? "Circuit needs attention"
                  : lab.parts().length
                    ? "Circuit solved"
                    : "Ready when you are"}
              </strong>
              <span>DC OPERATING POINT</span>
            </div>
            <p>
              {lab.solution().error ??
                (lab.parts().length
                  ? "Every change recalculates terminal voltages and branch currents. Double-click a switch to toggle it."
                  : "Start with a source and a resistor. Connect their terminals into a closed path to let current flow.")}
            </p>
            <div class="solver-facts">
              <span>
                Reference{" "}
                <b>
                  {lab.solution().reference ?? "—"}
                  {lab.solution().reference ? " = 0 V" : ""}
                </b>
              </span>
              <span>
                Nodes <b>{Object.keys(lab.solution().nodes).length}</b>
              </span>
              <span>
                Power balance{" "}
                <b>
                  {lab.solution().error || !lab.parts().length
                    ? "—"
                    : format(
                        Object.values(lab.solution().readings).reduce(
                          (n, r) => n + r.power,
                          0,
                        ),
                        "W",
                      )}
                </b>
              </span>
            </div>
          </div>
        </section>
        <Inspector lab={lab} />
      </div>
      <footer>
        <span>
          <span class="status-dot" /> All changes solve instantly
        </span>
        <span>
          Click terminals to wire <i>·</i> Drag to move <i>·</i> Double-click
          switches to toggle <i>·</i> Esc to cancel
        </span>
        <span>IDEAL COMPONENTS / DC</span>
      </footer>
      <Show when={!lab.drag() && lab.hovered()}>
        {(p) => (
          <div
            class="hover-card"
            style={{
              left: `${Math.min(lab.hover()!.x + 18, typeof window === "undefined" ? 900 : window.innerWidth - 295)}px`,
              top: `${Math.max(10, Math.min(lab.hover()!.y + 20, typeof window === "undefined" ? 500 : window.innerHeight - 250))}px`,
            }}
          >
            <div class="hover-title">
              {p().id}
              <span>{partValue(p())}</span>
            </div>
            <Measurements lab={lab} part={p()} />
            <p class="fine">
              {lab.solution().error
                ? "Readings unavailable: resolve the circuit diagnostic."
                : "Click to inspect · A → B sign convention"}
            </p>
          </div>
        )}
      </Show>
    </main>
  );
}
