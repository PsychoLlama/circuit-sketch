import { createMemo, createSignal, type Accessor } from "solid-js";
import { analyze } from "./engine";
import type { Analysis, Component } from "./model";

/** Call within a Solid owner. Caller-owned signals keep editing/history independent.
 * Nodes and pins share one simultaneous solve: electrical feedback is not a DAG.
 */
export const createCircuitGraph = (
  components: Accessor<readonly Component[]>,
  analysis: Accessor<Analysis> = () => ({ mode: "dc" }),
  reference: Accessor<string | undefined> = () => undefined,
) => {
  const snapshot = createMemo(() =>
    analyze(components(), analysis(), reference()),
  );

  const own = <T>(record: Record<string, T>, key: string) =>
    Object.hasOwn(record, key) ? record[key] : undefined;

  return {
    snapshot,
    node: (id: string) => () => own(snapshot().nodes, id),
    component: (id: string) => () => own(snapshot().components, id),
    pin: (id: string, pin: string) => () =>
      own(snapshot().components, id)?.pins[pin],
  };
};

/** Generic manipulation primitive: immutable replacement is reactive and atomic. */
export const createComponentControl = <Parameters>(
  initial: Parameters,
  model: (parameters: Parameters) => Component,
) => {
  const [parameters, setParameters] = createSignal(initial);
  const component = createMemo(() => model(parameters()));

  return { parameters, setParameters, component };
};
