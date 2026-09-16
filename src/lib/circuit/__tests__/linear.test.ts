import { expect, it } from "vitest";
import { solveMatrix } from "../linear";

it("pivots and solves independently known simultaneous equations", () => {
  expect(
    solveMatrix([
      [0, 2, 4],
      [3, 4, 11],
    ]),
  ).toEqual([1, 2]);
  expect(
    solveMatrix([
      [1e-15, 0, 2e-15],
      [0, 1e15, 3e15],
    ]),
  ).toEqual([2, 3]);
});

it("rejects inconsistent, underdetermined, malformed, and nonfinite matrices", () => {
  for (const matrix of [
    [
      [1, 1, 1],
      [2, 2, 3],
    ],
    [
      [1, 1, 1],
      [2, 2, 2],
    ],
    [[1]],
    [[Infinity, 1]],
    [[1, NaN]],
  ])
    expect(() => solveMatrix(matrix)).toThrow();
});
