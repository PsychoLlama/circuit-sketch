/** Scaled partial pivoting, followed by an independent residual check. */
export const solveMatrix = (input: number[][]): number[] => {
  const matrix = input.map((row) => [...row]);
  const size = matrix.length;

  if (
    matrix.some(
      (row) => row.length !== size + 1 || row.some((v) => !Number.isFinite(v)),
    )
  )
    throw new Error("Numerical range exceeded or malformed equations.");

  for (let c = 0; c < size; c++) {
    let pivot = c;
    let best = 0;

    for (let r = c; r < size; r++) {
      const scale = Math.max(...matrix[r].slice(c, size).map(Math.abs));
      const score = scale ? Math.abs(matrix[r][c]) / scale : 0;

      if (score > best) {
        best = score;
        pivot = r;
      }
    }

    if (best < 1e-12)
      throw new Error(
        "Floating nodes, conflicting ideal sources, or redundant ideal paths: no unique electrical state.",
      );

    [matrix[c], matrix[pivot]] = [matrix[pivot], matrix[c]];
    const divisor = matrix[c][c];

    for (let j = c; j <= size; j++) matrix[c][j] /= divisor;

    for (let r = 0; r < size; r++) {
      if (r === c) continue;
      const factor = matrix[r][c];

      for (let j = c; j <= size; j++) matrix[r][j] -= factor * matrix[c][j];
    }
  }

  const result = matrix.map((row) => row[size]);

  if (result.some((v) => !Number.isFinite(v)) || !satisfies(input, result))
    throw new Error("Numerical range or residual tolerance exceeded.");

  return result;
};

export const satisfies = (matrix: number[][], values: number[]) =>
  matrix.every((row) => {
    const terms = values.map((value, i) => value * row[i]);
    const rhs = row[values.length];
    const residual = terms.reduce((sum, value) => sum + value, -rhs);
    const scale = terms.reduce(
      (sum, value) => sum + Math.abs(value),
      Math.abs(rhs),
    );

    return (
      Number.isFinite(residual) &&
      Number.isFinite(scale) &&
      Math.abs(residual) <= 1e-12 + 1e-9 * scale
    );
  });
