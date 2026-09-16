import type {
  Analysis,
  Component,
  Diagnostic,
  Snapshot,
} from "./model";
import { satisfies, solveMatrix } from "./linear";

export const analyze = (
  components: readonly Component[],
  analysis: Analysis = { mode: "dc" },
  reference?: string,
): Snapshot => {
  const fail = (diagnostics: Diagnostic[]): Snapshot => ({
    analysis,
    nodes: {},
    components: {},
    diagnostics,
  });
  const invalid = (message: string, component?: string): Diagnostic => ({
    code: "invalid",
    message,
    component,
  });

  try {
    if (
      analysis.mode !== "dc" &&
      (analysis.mode !== "snapshot" ||
        !Number.isFinite(analysis.time) ||
        analysis.time < 0)
    )
      return fail([invalid("Snapshot time must be finite and nonnegative.")]);

    const diagnostics: Diagnostic[] = [];
    const ids = new Set<string>();

    for (const component of components) {
      if (!component.id || ids.has(component.id))
        diagnostics.push(
          invalid("Missing or duplicate component identifiers.", component.id),
        );
      ids.add(component.id);
      if (
        !Object.keys(component.pins).length ||
        Object.entries(component.pins).some(
          ([pin, node]) => !pin || typeof node !== "string" || !node,
        )
      )
        diagnostics.push(
          invalid("Every pin needs a nonempty node identifier.", component.id),
        );
      diagnostics.push(
        ...component
          .validate(analysis)
          .map((message) => invalid(message, component.id)),
      );
    }

    if (diagnostics.length) return fail(diagnostics);
    const nodes = [
      ...new Set(
        components.flatMap((component) => Object.values(component.pins)),
      ),
    ];
    const ground = reference ?? nodes[0];

    if (reference !== undefined && !nodes.includes(reference))
      return fail([invalid("Reference node is missing.")]);
    if (!nodes.length)
      return { analysis, nodes: {}, components: {}, diagnostics: [] };

    const unknowns = nodes.filter((node) => node !== ground);
    const indices = new Map(unknowns.map((node, i) => [node, i]));
    let estimate: Record<string, number> = Object.fromEntries(
      nodes.map((node) => [node, 0]),
    );
    let topology: string | undefined;

    const compile = () => {
      const entries = components.flatMap((component) => {
        const equations = component.equations({
          analysis,
          voltage: (pin) => {
            if (!Object.hasOwn(component.pins, pin))
              throw new Error(`Unknown pin ${pin} on ${component.id}.`);
            return estimate[component.pins[pin]];
          },
        });
        const names = new Set<string>();

        return equations.map((equation) => {
          if (!equation.id || names.has(equation.id))
            throw new Error(`Duplicate or missing branch on ${component.id}.`);
          names.add(equation.id);
          for (const pin of [
            equation.a,
            equation.b,
            ...Object.keys(equation.voltage),
          ])
            if (!Object.hasOwn(component.pins, pin))
              throw new Error(`Unknown pin ${pin} on ${component.id}.`);
          return { component, equation };
        });
      });
      const shape = JSON.stringify(
        entries.map(({ component, equation }) => [
          component.id,
          equation.id,
          equation.a,
          equation.b,
        ]),
      );

      if (topology !== undefined && shape !== topology)
        throw new Error(
          "Models must retain branch topology during an analysis.",
        );
      topology = shape;
      const n = unknowns.length;
      const size = n + entries.length;
      const matrix = Array.from({ length: size }, () =>
        Array<number>(size + 1).fill(0),
      );

      entries.forEach(({ component, equation }, k) => {
        const index = (pin: string) => indices.get(component.pins[pin]);
        const a = index(equation.a);
        const b = index(equation.b);

        if (a !== undefined) matrix[a][n + k] += 1;
        if (b !== undefined) matrix[b][n + k] -= 1;
        for (const [pin, coefficient] of Object.entries(equation.voltage)) {
          const i = index(pin);
          if (!Number.isFinite(coefficient))
            throw new Error("Nonfinite model coefficient.");
          if (i !== undefined) matrix[n + k][i] += coefficient;
        }
        matrix[n + k][n + k] = equation.current;
        matrix[n + k][size] = equation.rhs;
      });
      return { entries, matrix };
    };

    for (let iteration = 0; iteration < 100; iteration++) {
      const { entries, matrix } = compile();
      let values: number[];

      try {
        values = solveMatrix(matrix);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return fail([
          {
            code: message.startsWith("Floating") ? "singular" : "numerical",
            message,
          },
        ]);
      }
      estimate = Object.fromEntries(
        nodes.map((node) => [
          node,
          node === ground ? 0 : values[indices.get(node)!],
        ]),
      );
      if (!satisfies(compile().matrix, values)) continue;
      const observations: Snapshot["components"] = Object.fromEntries(
        components.map((component) => [
          component.id,
          {
            pins: Object.fromEntries(
              Object.entries(component.pins).map(([pin, node]) => [
                pin,
                { node, voltage: estimate[node], current: 0 },
              ]),
            ),
            branches: Object.create(null),
          },
        ]),
      );

      for (const [k, { component, equation }] of entries.entries()) {
        const observation = observations[component.id];
        const a = estimate[component.pins[equation.a]];
        const b = estimate[component.pins[equation.b]];
        const voltage = a - b;
        const current = values[unknowns.length + k];
        const power = voltage * current;

        if (![voltage, power].every(Number.isFinite))
          return fail([
            { code: "numerical", message: "Numerical range exceeded." },
          ]);
        observation.pins[equation.a].current += current;
        observation.pins[equation.b].current -= current;
        observation.branches[equation.id] = { a, b, voltage, current, power };
      }
      return {
        analysis,
        reference: ground,
        nodes: estimate,
        components: observations,
        diagnostics: [],
      };
    }
    return fail([
      {
        code: "convergence",
        message:
          "Component equations did not converge; electrical state is unavailable.",
      },
    ]);
  } catch (error) {
    return fail([
      {
        code: "model",
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  }
};
