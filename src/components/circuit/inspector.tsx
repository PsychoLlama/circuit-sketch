import {
  errors,
  hovered,
  inspectedPart,
  solution,
  componentCatalog,
  componentName,
  components,
  wires,
  nodeCount,
  circuitPower,
  format,
  specifications,
  descriptions,
  connections,
  valueLabel,
} from "~/state/circuit/formulas";
import {
  changeKind,
  remove,
  setValue,
  update,
  selectPart,
} from "~/state/circuit/actions";
import { parts, selected } from "~/state/circuit/data";
import { For, Show } from "solid-js";
import type { Kind } from "~/lib/circuit/solver";
import Symbol from "./symbol";
import Measurements from "./measurements";

const Inspector = () => {
  return (
    <aside class="inspector">
      <div class="panel-heading">
        INSPECTOR{" "}
        <span>
          {selected() ? "Selected" : hovered() ? "Preview" : "Circuit"}
        </span>
      </div>
      <Show
        when={inspectedPart()}
        fallback={
          <div class="panel-section">
            <span class="eyebrow">CIRCUIT</span>
            <dl class="measurements">
              <div>
                <dt>Components</dt>
                <dd>{components(parts()).length}</dd>
              </div>
              <div>
                <dt>Wires</dt>
                <dd>{wires(parts()).length}</dd>
              </div>
              <div>
                <dt>Solved nodes</dt>
                <dd>{nodeCount(solution())}</dd>
              </div>
              <div>
                <dt>Power supplied</dt>
                <dd>{format(circuitPower(solution(), true), "W")}</dd>
              </div>
              <div>
                <dt>Power absorbed</dt>
                <dd>{format(circuitPower(solution(), false), "W")}</dd>
              </div>
            </dl>
          </div>
        }
      >
        {(p) => (
          <>
            <div class="selection-summary">
              <div class="selection-title">
                <svg viewBox="-55 -30 110 60">
                  <Symbol kind={p().kind} closed={p().closed} />
                </svg>
                <div>
                  <h2>{p().id}</h2>
                  <span>{componentName(p().kind)}</span>
                </div>
              </div>
              <p class="component-description">{descriptions[p().kind]}</p>
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
                      changeKind(p().id, e.currentTarget.value as Kind)
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
                      setValue(p().id, e.currentTarget.valueAsNumber)
                    }
                  />
                </label>
              </Show>
            </div>
            <div class="panel-section">
              <span class="eyebrow">SPECS</span>
              <dl class="measurements specs">
                <For each={specifications(p())}>
                  {(spec) => (
                    <div>
                      <dt>{spec.label}</dt>
                      <dd>{spec.value}</dd>
                    </div>
                  )}
                </For>
              </dl>
            </div>
            <div class="panel-section">
              <span class="eyebrow">VALIDATION</span>
              <Show
                when={errors(p()).length}
                fallback={<p class="validation-ok">No errors detected.</p>}
              >
                <ul class="validation-errors" role="status">
                  <For each={errors(p())}>{(error) => <li>{error}</li>}</For>
                </ul>
              </Show>
            </div>
            <div class="panel-section">
              <span class="eyebrow">ELECTRICAL STATE</span>
              <Measurements part={p()} />
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
                    <dd>
                      <select
                        class="state-control"
                        aria-label="Switch position"
                        value={p().closed ? "closed" : "open"}
                        onChange={(e) =>
                          update(p().id, {
                            closed: e.currentTarget.value === "closed",
                          })
                        }
                      >
                        <option value="closed">Closed</option>
                        <option value="open">Open</option>
                      </select>
                    </dd>
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
              <div class="connection-list">
                <For
                  each={connections(parts(), p())}
                  fallback={
                    <p>No connections yet. Drag between pins to connect.</p>
                  }
                >
                  {(wire) => (
                    <button
                      class="wide connection-button"
                      onClick={() => selectPart(wire.id)}
                      aria-label={`Select ${wire.id}`}
                    >
                      <svg viewBox="-55 -30 110 60" aria-hidden="true">
                        <Symbol kind={wire.kind} closed={wire.closed} />
                      </svg>
                      <span>
                        {wire.id} · {componentName(wire.kind)}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </div>
            <div class="panel-section">
              <button class="danger wide" onClick={() => remove(p().id)}>
                Remove {p().kind === "wire" ? "wire" : "component"}{" "}
                <span>⌫</span>
              </button>
            </div>
          </>
        )}
      </Show>
      <Show when={solution().error}>
        <div class="notice" role="status">
          {solution().error}
        </div>
      </Show>
      <div class="model-note">
        <span class="status-dot" /> DC steady state{" "}
      </div>
    </aside>
  );
};

export default Inspector;
