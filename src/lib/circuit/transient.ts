import { analyze } from "./engine";
import { potential } from "./devices";
import type { Component, Snapshot } from "./model";

/** Deterministic initial-value query. Capacitor voltages are local integration
 * variables, never retained between calls. Each stage enforces KCL/KVL and
 * obtains dV/dt = I/C from a simultaneous network solve.
 */
export const transient = (
  components: readonly Component[],
  time: number,
  reference?: string,
): Snapshot => {
  const analysis = { mode: "snapshot" as const, time };
  const fail = (message: string): Snapshot => ({
    analysis,
    nodes: {},
    components: {},
    diagnostics: [{ code: "numerical", message }],
  });
  const capacitors = components.filter((c) => c.capacitor);

  if (!Number.isFinite(time) || time < 0)
    return fail("Time must be finite and nonnegative.");
  if (
    capacitors.some(
      (c) =>
        !Number.isFinite(c.capacitor!.capacitance) ||
        c.capacitor!.capacitance <= 0 ||
        !Number.isFinite(c.capacitor!.initialVoltage),
    )
  )
    return fail(
      "Capacitance must be finite and positive; initial voltage must be finite.",
    );
  if (!capacitors.length) return analyze(components, analysis, reference);

  const evaluate = (voltages: number[], t: number) => {
    const snapshot = analyze(
      components.map((c) => {
        const index = capacitors.indexOf(c);

        return index < 0
          ? c
          : {
              ...c,
              validate: () => c.validate({ mode: "dc" }),
              equations: () => [potential(voltages[index])],
            };
      }),
      { mode: "snapshot", time: t },
      reference,
    );

    if (snapshot.diagnostics.length)
      throw new Error(
        snapshot.diagnostics.map((d) => d.message).join(" ") +
          " Transient analysis requires independent, consistent capacitor initial voltages and uniquely determined currents; ideal voltage-source/capacitor loops are unsupported. Add physical series resistance.",
      );

    return {
      snapshot,
      derivative: capacitors.map(
        (c) =>
          snapshot.components[c.id].branches.main.current /
          c.capacitor!.capacitance,
      ),
    };
  };
  const step = (v: number[], t: number, h: number) => {
    const k1 = evaluate(v, t).derivative;
    const k2 = evaluate(
      v.map((x, i) => x + (h * k1[i]) / 2),
      t + h / 2,
    ).derivative;
    const k3 = evaluate(
      v.map((x, i) => x + (h * k2[i]) / 2),
      t + h / 2,
    ).derivative;
    const k4 = evaluate(
      v.map((x, i) => x + h * k3[i]),
      t + h,
    ).derivative;

    return v.map(
      (x, i) => x + (h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) / 6,
    );
  };

  try {
    let v = capacitors.map((c) => c.capacitor!.initialVoltage);
    let t = 0;
    let h = time / 16;

    evaluate(v, 0);
    for (let attempts = 0; t < time; attempts++) {
      if (attempts >= 10000 || t + h === t)
        return fail(
          "Transient integration exceeded its numerical resolution or work limit. Reduce the requested time or circuit time-scale range.",
        );
      h = Math.min(h, time - t);
      const full = step(v, t, h);
      const half = step(step(v, t, h / 2), t + h / 2, h / 2);
      const error = Math.max(
        ...half.map(
          (x, i) =>
            Math.abs(x - full[i]) /
            (15 * (1e-11 + 1e-9 * Math.max(Math.abs(v[i]), Math.abs(x)))),
        ),
      );

      if (!Number.isFinite(error))
        return fail("Transient numerical range exceeded.");
      if (error <= 1) {
        v = half;
        t += h;
      }
      h *= Math.max(0.1, Math.min(2, error === 0 ? 2 : 0.9 * error ** -0.2));
    }

    return evaluate(v, time).snapshot;
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
};
