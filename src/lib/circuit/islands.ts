import { createTransient } from "./transient";
import { analyze } from "./engine";
import type { Analysis, Component, Snapshot } from "./model";

type Island = { group: Component[]; ground?: string };

const partition = (
  components: readonly Component[],
  reference?: string,
): Island[] => {
  const remaining = new Set(components);
  const islands: Island[] = [];

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

    islands.push({
      group,
      ground: reference && nodes.has(reference) ? reference : undefined,
    });
  }

  return islands;
};

const duplicated = (components: readonly Component[]) =>
  new Set(components.map((component) => component.id)).size !==
  components.length;

const merge = (
  analysis: Analysis,
  reference: string | undefined,
  results: { group: Component[]; snapshot: Snapshot }[],
): Snapshot => {
  const result: Snapshot = {
    analysis,
    reference,
    nodes: {},
    components: {},
    diagnostics: [],
  };

  for (const { group, snapshot } of results) {
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

/** Transient simulation per island. Each island caches its own trajectory, so
 * repeated queries (e.g. playback) only integrate newly elapsed time.
 */
export const createTransientIslands = (
  components: readonly Component[],
  reference?: string,
): ((time: number) => Snapshot) => {
  if (duplicated(components))
    return (time) => analyze(components, { mode: "snapshot", time }, reference);

  const islands = partition(components, reference).map((island) => ({
    ...island,
    query: createTransient(island.group, island.ground),
  }));

  return (time) =>
    merge(
      { mode: "snapshot", time },
      reference,
      islands.map(({ group, query }) => ({ group, snapshot: query(time) })),
    );
};

/** Disconnected circuits have independent voltage references. A failed island
 * must not erase readings from the other circuits in the workspace.
 */
export const analyzeIslands = (
  components: readonly Component[],
  analysis: Analysis = { mode: "dc" },
  reference?: string,
  transientTime?: number,
): Snapshot => {
  if (duplicated(components)) return analyze(components, analysis, reference);

  return merge(
    analysis,
    reference,
    partition(components, reference).map(({ group, ground }) => ({
      group,
      snapshot:
        transientTime === undefined
          ? analyze(group, analysis, ground)
          : createTransient(group, ground)(transientTime),
    })),
  );
};
