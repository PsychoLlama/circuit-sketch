import { analyze } from "./engine";
import type { Analysis, Component, Snapshot } from "./model";

/** Disconnected circuits have independent voltage references. A failed island
 * must not erase readings from the other circuits in the workspace.
 */
export const analyzeIslands = (
  components: readonly Component[],
  analysis: Analysis = { mode: "dc" },
  reference?: string,
): Snapshot => {
  if (
    new Set(components.map((component) => component.id)).size !==
    components.length
  )
    return analyze(components, analysis, reference);

  const remaining = new Set(components);
  const result: Snapshot = {
    analysis,
    reference,
    nodes: {},
    components: {},
    diagnostics: [],
  };

  while (remaining.size) {
    const group = [remaining.values().next().value!];
    const nodes = new Set(Object.values(group[0].pins));

    remaining.delete(group[0]);
    for (let i = 0; i < group.length; i++) {
      for (const component of remaining) {
        if (!Object.values(component.pins).some((node) => nodes.has(node)))
          continue;
        group.push(component);
        remaining.delete(component);
        Object.values(component.pins).forEach((node) => nodes.add(node));
      }
    }

    const snapshot = analyze(
      group,
      analysis,
      reference && nodes.has(reference) ? reference : undefined,
    );

    Object.assign(result.nodes, snapshot.nodes);
    Object.assign(result.components, snapshot.components);
    result.diagnostics.push(
      ...snapshot.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        message: `${group.map((component) => component.id).join(", ")}: ${diagnostic.message}`,
      })),
    );
  }

  return result;
};
