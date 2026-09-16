import { For, Show } from "solid-js";
import type { Lab } from "~/state/circuit/actions";
import {
  componentCatalog,
  componentName,
  components,
  wires,
  nodeCount,
  circuitPower,
  format,
  ratingDescription,
  connections,
  valueLabel,
} from "~/state/circuit/formulas";
import type { Kind } from "~/lib/circuit/solver";
import Symbol from "./symbol";
import Measurements from "./measurements";

const Inspector = (props: { lab: Lab }) => {
  const lab = props.lab;

  return (
    <aside class="inspector">
      <div class="panel-heading">
        INSPECTOR{" "}
        <span>
          {lab.selected() ? "Selected" : lab.hovered() ? "Preview" : "Circuit"}
        </span>
      </div>
      <Show
        when={lab.inspectedPart()}
        fallback={
          <div class="panel-section">
            <span class="eyebrow">CIRCUIT</span>
            <dl class="measurements">
              <div>
                <dt>Components</dt>
                <dd>{components(lab.parts()).length}</dd>
              </div>
              <div>
                <dt>Wires</dt>
                <dd>{wires(lab.parts()).length}</dd>
              </div>
              <div>
                <dt>Solved nodes</dt>
                <dd>{nodeCount(lab.solution())}</dd>
              </div>
              <div>
                <dt>Power supplied</dt>
                <dd>{format(circuitPower(lab.solution(), true), "W")}</dd>
              </div>
              <div>
                <dt>Power absorbed</dt>
                <dd>{format(circuitPower(lab.solution(), false), "W")}</dd>
              </div>
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
                    onChange={(e) =>
                      lab.changeKind(p().id, e.currentTarget.value as Kind)
                    }
                  >
                    <For each={componentCatalog}>
                      {(c) => <option value={c.kind}>{c.name}</option>}
                    </For>
                  </select>
                </label>
              </Show>
              <Show when={p().kind !== "switch"}>
                <label>
                  {valueLabel(p())}
                  <input
                    aria-label="Component value"
                    type="number"
                    step="any"

                    value={p().value}
                    onInput={(e) =>
                      lab.setValue(p().id, e.currentTarget.valueAsNumber)
                    }
                  />
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
              <span class="eyebrow">VALIDATION</span>
              <Show
                when={lab.errors(p()).length}
                fallback={<p class="validation-ok">No errors detected.</p>}
              >
                <ul class="validation-errors" role="status">
                  <For each={lab.errors(p())}>
                    {(error) => <li>{error}</li>}
                  </For>
                </ul>
              </Show>
              <p class="rating-note">
                Model ratings: {ratingDescription(p())}.
              </p>
              <Show when={p().kind === "led" || p().kind === "diode"}>
                <p class="rating-note">
                  A: anode (+), B: cathode (−). Piecewise-linear DC model with
                  10 Ω forward resistance and 1 GΩ reverse resistance. Use a
                  series resistor for LEDs.
                </p>
              </Show>
              <Show when={p().kind === "lamp"}>
                <p class="rating-note">
                  Fixed resistance model; filament heating is not simulated.
                </p>
              </Show>
              <Show when={p().kind === "rheostat"}>
                <p class="rating-note">
                  Two-terminal variable resistor. Adjust resistance above.
                </p>
              </Show>
              <p class="rating-note">
                Errors clear when corrected; permanent damage is not simulated.
              </p>
            </div>
            <div class="panel-section">
              <span class="eyebrow">ELECTRICAL STATE</span>
              <Measurements lab={lab} part={p()} />
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
            <div class="panel-section">
              <span class="eyebrow">CONNECTIONS</span>
              <For
                each={connections(lab.parts(), p())}
                fallback={
                  <p>No connections yet. Drag between pins to connect.</p>
                }
              >
                {(wire) => (
                  <button
                    class="wide"
                    onClick={() => lab.remove(wire.id)}
                    aria-label={`Disconnect ${wire.a} from ${wire.b}`}
                  >
                    Disconnect {wire.a} ↔ {wire.b}
                  </button>
                )}
              </For>
            </div>
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
      </div>
    </aside>
  );
};

export default Inspector;
