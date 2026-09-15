import { For, Show } from "solid-js";
import type { Lab } from "~/state/circuit/actions";
import { componentCatalog, componentName } from "~/state/circuit/formulas";
import type { Kind } from "~/lib/circuit/solver";
import Symbol from "./Symbol";
import Measurements from "./Measurements";

const Inspector = (props: { lab: Lab }) => {
  const lab = props.lab;

  return (
    <aside class="inspector">
      <div class="panel-heading">
        INSPECTOR{" "}
        <span>
          {lab.selected() ? "Selected · Esc to dismiss" : "Hover preview"}
        </span>
      </div>
      <Show
        when={lab.inspectedPart()}
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
                <span>{componentName(p().kind)}</span>
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
                    <For each={componentCatalog}>
                      {(c) => <option value={c.kind}>{c.name}</option>}
                    </For>
                  </select>
                </label>
              </Show>
              <Show when={p().kind !== "switch"}>
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
            <Show when={p().kind === "switch"}>
              <div class="panel-section">
                <span class="eyebrow">CONTROLS</span>
                <label>
                  Switch position
                  <select
                    aria-label="Switch position"
                    value={p().closed ? "closed" : "open"}
                    onChange={(e) =>
                      lab.update(p().id, {
                        closed: e.currentTarget.value === "closed",
                      })
                    }
                  >
                    <option value="closed">Closed</option>
                    <option value="open">Open</option>
                  </select>
                </label>
              </div>
            </Show>
            <div class="panel-section">
              <span class="eyebrow">ELECTRICAL STATE</span>
              <Measurements lab={lab} part={p()} />
              <p class="fine">
                Signed readings follow A → B. Negative current flows B → A.
                Voltages use the source’s negative terminal as 0 V.
              </p>
            </div>
            <div class="panel-section">
              <span class="eyebrow">INTERNAL STATE</span>
              <dl class="measurements">
                <div>
                  <dt>Terminal A node</dt>
                  <dd>{p().a}</dd>
                </div>
                <div>
                  <dt>Terminal B node</dt>
                  <dd>{p().b}</dd>
                </div>
                <Show when={p().kind === "switch"}>
                  <div>
                    <dt>Position</dt>
                    <dd>{p().closed ? "Closed" : "Open"}</dd>
                  </div>
                </Show>
                <Show when={p().kind === "capacitor"}>
                  <div>
                    <dt>State</dt>
                    <dd>DC equilibrium</dd>
                  </div>
                </Show>
              </dl>
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
                  <For each={componentCatalog}>
                    {(c) => (
                      <button onClick={() => lab.insert(c.kind, p().id)}>
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
              <button class="danger wide" onClick={() => lab.remove(p().id)}>
                Remove {p().kind === "wire" ? "wire" : "component"}{" "}
                <span>⌫</span>
              </button>
            </div>
          </>
        )}
      </Show>
      <Show when={lab.solution().error}>
        <div class="notice" role="status">
          {lab.solution().error}
        </div>
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
};

export default Inspector;
