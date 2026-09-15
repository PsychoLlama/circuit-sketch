import { describe, it, expect } from "vitest";
import { createLab } from "../actions";
import { solve } from "../../../lib/circuit/solver";

describe("circuit editing", () => {
  it("creates four physically consistent experiments", () => {
    for (const name of ["series", "divider", "parallel", "capacitor"]) {
      const lab = createLab();
      lab.example(name);

      const result = solve(lab.parts());
      expect(result.error).toBeUndefined();

      const source = lab.parts().find((p) => p.kind === "source")!;
      expect(result.readings[source.id].current).toBeCloseTo(
        name === "series"
          ? -0.009
          : name === "divider"
            ? -0.0045
            : name === "parallel"
              ? -0.0135
              : 0,
      );
    }
  });

  it("restores circuits through undo and redo", () => {
    const lab = createLab();
    lab.example("series");

    const initial = lab.parts();
    lab.clear();
    expect(lab.parts()).toHaveLength(0);
    lab.undo();
    expect(lab.parts()).toEqual(initial);
    lab.redo();
    expect(lab.parts()).toHaveLength(0);
  });

  it("makes a new wire from two pins and cancels self-connections", () => {
    const lab = createLab();
    lab.pin("a");
    lab.pin("a");
    expect(lab.parts()).toHaveLength(0);
    lab.pin("a");
    lab.pin("b");
    expect(lab.parts()[0]).toMatchObject({
      kind: "wire",
      a: "a",
      b: "b",
      value: 0,
    });
  });

  it("records value edits without modifying the previous graph", () => {
    const lab = createLab();
    lab.example("series");

    const r = lab.parts().find((p) => p.kind === "resistor")!;
    lab.update(r.id, { value: 2000 });
    expect(solve(lab.parts()).readings[r.id].current).toBeCloseTo(0.0045);
    lab.undo();
    expect(solve(lab.parts()).readings[r.id].current).toBeCloseTo(0.009);
  });
});
