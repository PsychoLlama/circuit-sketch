/** DC modified nodal analysis. Passive sign convention: I flows a → b, P = (Va−Vb)I.
 * Reference: https://lpsa.swarthmore.edu/Systems/Electrical/mna/MNA3.html
 * Capacitors are open at DC equilibrium. Diodes use a piecewise-linear DC approximation; no transients.
 */
export type Kind =
  | "source"
  | "resistor"
  | "switch"
  | "capacitor"
  | "wire"
  | "led"
  | "diode"
  | "rheostat"
  | "lamp";

export type Branch = {
  id: string;
  kind: Kind;
  a: string;
  b: string;
  value: number;
  closed?: boolean;
};

export type Reading = {
  a: number;
  b: number;
  voltage: number;
  current: number;
  power: number;
};

export type Solution = {
  readings: Record<string, Reading>;
  nodes: Record<string, number>;
  error?: string;
  reference?: string;
};

export const isDiode = (b: Branch) => b.kind === "led" || b.kind === "diode";

export const parameterErrors = (b: Branch): string[] => {
  const errors: string[] = [];

  if (!Number.isFinite(b.value)) errors.push("Value must be finite.");
  else if (
    ["resistor", "rheostat", "lamp", "capacitor", "led", "diode"].includes(
      b.kind,
    ) &&
    b.value <= 0
  )
    errors.push("Value must be greater than zero.");
  else if (b.kind === "wire" && b.value < 0)
    errors.push("Wire resistance cannot be negative.");

  if (!b.a || !b.b) errors.push("Both terminals need a node.");
  if (b.a === b.b)
    errors.push("Both terminals are connected to the same node.");

  return errors;
};

export const solve = (branches: Branch[], reference?: string): Solution => {
  let conducting = new Set<string>();

  for (let iteration = 0; iteration < 100; iteration++) {
    const result = solveLinear(branches, reference, conducting);

    if (result.error) return result;

    const next = new Set(
      branches
        .filter((b) => isDiode(b) && result.readings[b.id].voltage > b.value)
        .map((b) => b.id),
    );

    if (
      next.size === conducting.size &&
      [...next].every((id) => conducting.has(id))
    )
      return result;

    conducting = next;
  }

  return {
    readings: {},
    nodes: {},
    error:
      "Diode model did not converge. Check the circuit connections and values.",
  };
};

const solveLinear = (
  branches: Branch[],
  reference: string | undefined,
  conducting: Set<string>,
): Solution => {
  const fail = (error: string): Solution => ({
    readings: {},
    nodes: {},
    error,
  });

  if (!branches.length) return { readings: {}, nodes: {} };

  if (new Set(branches.map((b) => b.id)).size !== branches.length)
    return fail("Duplicate component identifiers.");

  if (branches.some((b) => parameterErrors(b).length))
    return fail(
      "Invalid component parameters. Select a component to inspect its errors.",
    );

  const conductance = (b: Branch) =>
    isDiode(b) ? (conducting.has(b.id) ? 0.1 : 1e-9) : 1 / b.value;

  const bias = (b: Branch) =>
    isDiode(b) && conducting.has(b.id) ? b.value * (0.1 - 1e-9) : 0;

  const nodes = [...new Set(branches.flatMap((b) => [b.a, b.b]))];
  const ground =
    reference ?? branches.find((b) => b.kind === "source")?.b ?? nodes[0];

  if (!nodes.includes(ground)) return fail("Reference node is missing.");

  const active = branches.filter(
    (b) => b.kind !== "capacitor" && !(b.kind === "switch" && !b.closed),
  );

  const reached = new Set([ground]);

  for (let i = 0; i < nodes.length; i++)
    for (const b of active) {
      if (reached.has(b.a)) reached.add(b.b);

      if (reached.has(b.b)) reached.add(b.a);
    }

  if (nodes.some((n) => !reached.has(n)))
    return fail(
      "Floating nodes: connect every terminal to the reference through a DC path. Voltage is undefined on isolated nodes.",
    );

  const unknowns = nodes.filter((n) => n !== ground);
  const ideal = active.filter(
    (b) =>
      b.kind === "source" ||
      b.kind === "switch" ||
      (b.kind === "wire" && b.value === 0),
  );

  const n = unknowns.length,
    size = n + ideal.length;

  const matrix = Array.from(
    { length: size },
    () => Array(size + 1).fill(0) as number[],
  );

  const index = (node: string) => unknowns.indexOf(node);

  for (const b of active) {
    const a = index(b.a),
      z = index(b.b),
      k = ideal.indexOf(b);

    if (k >= 0) {
      if (a >= 0) {
        matrix[a][n + k] += 1;
        matrix[n + k][a] += 1;
      }

      if (z >= 0) {
        matrix[z][n + k] -= 1;
        matrix[n + k][z] -= 1;
      }

      matrix[n + k][size] = b.kind === "source" ? b.value : 0;
    } else {
      const g = conductance(b);

      if (a >= 0) matrix[a][size] += bias(b);
      if (z >= 0) matrix[z][size] -= bias(b);

      if (a >= 0) matrix[a][a] += g;

      if (z >= 0) matrix[z][z] += g;

      if (a >= 0 && z >= 0) {
        matrix[a][z] -= g;
        matrix[z][a] -= g;
      }
    }
  }

  // Scaled partial pivoting avoids treating small conductances as zero.
  for (let c = 0; c < size; c++) {
    let pivot = c,
      best = 0;

    for (let r = c; r < size; r++) {
      const scale = Math.max(...matrix[r].slice(c, size).map(Math.abs));
      const score = scale ? Math.abs(matrix[r][c]) / scale : 0;

      if (score > best) {
        best = score;
        pivot = r;
      }
    }

    if (best < 1e-12)
      return fail(
        "Conflicting ideal sources or an ideal-wire loop. Add resistance or remove a redundant path; a unique current cannot be determined.",
      );

    [matrix[c], matrix[pivot]] = [matrix[pivot], matrix[c]];

    const div = matrix[c][c];

    for (let j = c; j <= size; j++) matrix[c][j] /= div;

    for (let r = 0; r < size; r++)
      if (r !== c) {
        const factor = matrix[r][c];

        for (let j = c; j <= size; j++) matrix[r][j] -= factor * matrix[c][j];
      }
  }

  const volts: Record<string, number> = { [ground]: 0 };

  unknowns.forEach((node, i) => (volts[node] = matrix[i][size]));

  const readings: Record<string, Reading> = {};

  for (const b of branches) {
    const voltage = volts[b.a] - volts[b.b],
      k = ideal.indexOf(b);

    const current = !active.includes(b)
      ? 0
      : k >= 0
        ? matrix[n + k][size]
        : voltage * conductance(b) - bias(b);

    if (![voltage, current].every(Number.isFinite))
      return fail("Numerical range exceeded.");

    readings[b.id] = {
      a: volts[b.a],
      b: volts[b.b],
      voltage,
      current,
      power: voltage * current,
    };
  }

  return { readings, nodes: volts, reference: ground };
};
