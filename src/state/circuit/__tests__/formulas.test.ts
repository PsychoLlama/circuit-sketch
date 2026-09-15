import { describe, expect, it } from "vitest";
import { currentFlow, constrainOffset } from "../formulas";

const bounds = { left: 100, right: 500, top: 80, bottom: 280 };
const viewport = { width: 800, height: 600 };

describe("canvas scroll limits", () => {
  it("preserves 30% of the canvas on each axis at both extremes", () => {
    expect(
      constrainOffset({ x: -10000, y: -10000 }, bounds, 1, viewport),
    ).toEqual({ x: -260, y: -100 });
    expect(
      constrainOffset({ x: 10000, y: 10000 }, bounds, 1, viewport),
    ).toEqual({ x: 460, y: 340 });
  });

  it("accounts for zoom and viewport resizing", () => {
    expect(
      constrainOffset({ x: -10000, y: -10000 }, bounds, 0.5, viewport),
    ).toEqual({ x: -50, y: -40 });
    expect(
      constrainOffset({ x: 460, y: 340 }, bounds, 1, {
        width: 400,
        height: 300,
      }),
    ).toEqual({ x: 180, y: 130 });
  });

  it("keeps oversized circuits scrollable using viewport overlap", () => {
    const large = { left: 0, right: 10000, top: 0, bottom: 10000 };
    expect(constrainOffset({ x: 10000, y: 10000 }, large, 1, viewport)).toEqual(
      { x: 560, y: 420 },
    );
    expect(
      constrainOffset({ x: -10000, y: -10000 }, large, 1, viewport),
    ).toEqual({ x: -9760, y: -9820 });
  });

  it("keeps small circuits fully visible on each axis", () => {
    const small = { left: 100, right: 180, top: 100, bottom: 140 };
    expect(
      constrainOffset({ x: -10000, y: -10000 }, small, 1, viewport),
    ).toEqual({ x: -100, y: -100 });
    expect(constrainOffset({ x: 10000, y: 10000 }, small, 1, viewport)).toEqual(
      { x: 620, y: 460 },
    );
  });

  it("keeps an empty canvas at the origin", () => {
    expect(constrainOffset({ x: 100, y: 100 }, undefined, 1, viewport)).toEqual(
      { x: 0, y: 0 },
    );
  });
});

describe("current visualization", () => {
  it("distinguishes zero current from unavailable readings", () => {
    expect(currentFlow(0, 0).status).toBe("idle");
    expect(currentFlow(1e-15, 1).status).toBe("idle");
    expect(currentFlow(undefined, 0).status).toBe("unknown");
    expect(currentFlow(NaN, 0).status).toBe("unknown");
  });

  it("reverses negative current and preserves branch speed ratios", () => {
    expect(currentFlow(-0.009, 0.0135).reverse).toBe(true);
    expect(currentFlow(0.009, 0.0135).reverse).toBe(false);
    expect(currentFlow(0.0045, 0.0135).duration).toBeCloseTo(
      2 * currentFlow(0.009, 0.0135).duration,
    );
  });
});
