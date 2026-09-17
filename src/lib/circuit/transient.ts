import { analyze } from "./engine";
import { potential } from "./devices";
import type { Component, Snapshot } from "./model";

type Checkpoint = { t: number; v: number[]; h: number; attempts: number };

const workLimit = 10000;
const initialStep = 1e-9;

/** Deterministic initial-value simulation. Capacitor voltages are integration
 * variables derived only from the initial conditions. Each stage enforces
 * KCL/KVL and obtains dV/dt = I/C from a simultaneous network solve.
 *
 * Step sizes never depend on a query time, so the accepted steps form one
 * fixed sequence. A query finishes from the latest step at or before its time.
 * Only that step and its successor are retained: playback reuses them, while
 * a backward seek restarts from t = 0. Results depend only on circuit and time.
 */
export const createTransient = (
  components: readonly Component[],
  reference?: string,
): ((time: number) => Snapshot) => {
  const capacitors = components.filter((c) => c.capacitor);
  const invalid = capacitors.some(
    (c) =>
      !Number.isFinite(c.capacitor!.capacitance) ||
      c.capacitor!.capacitance <= 0 ||
      !Number.isFinite(c.capacitor!.initialVoltage),
  );

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

  // Advance until `time`. Unclamped steps stay independent of the requested
  // time; clamped runs only finish a query and are never retained.
  const integrate = (from: Checkpoint, time: number, clamp: boolean) => {
    let { t, v, h, attempts } = from;

    while (t < time) {
      if (attempts >= workLimit || t + h === t)
        throw new Error(
          "Transient integration exceeded its numerical resolution or work limit. Reduce the requested time or circuit time-scale range.",
        );
      attempts++;

      const size = clamp ? Math.min(h, time - t) : h;
      const full = step(v, t, size);
      const half = step(step(v, t, size / 2), t + size / 2, size / 2);
      const error = Math.max(
        ...half.map(
          (x, i) =>
            Math.abs(x - full[i]) /
            (15 * (1e-11 + 1e-9 * Math.max(Math.abs(v[i]), Math.abs(x)))),
        ),
      );

      if (!Number.isFinite(error))
        throw new Error("Transient numerical range exceeded.");
      h =
        size *
        Math.max(0.1, Math.min(2, error === 0 ? 2 : 0.9 * error ** -0.2));
      if (error <= 1) {
        v = half;
        t += size;
        if (!clamp) break;
      }
    }

    return { t, v, h, attempts };
  };

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  let initial: Checkpoint | undefined;
  let failure: { time: number; message: string } | undefined;

  if (!invalid && capacitors.length) {
    const v = capacitors.map((c) => c.capacitor!.initialVoltage);

    try {
      evaluate(v, 0);
      initial = { t: 0, v, h: initialStep, attempts: 0 };
    } catch (error) {
      failure = { time: -1, message: message(error) };
    }
  }

  let current = initial;
  let next: Checkpoint | undefined;

  // Move `current` to the latest unclamped step at or before `time`.
  const seek = (time: number) => {
    if (current!.t > time) {
      current = initial;
      next = undefined;
    }

    while (current!.t < time) {
      try {
        next ??= integrate(current!, Infinity, false);
      } catch (error) {
        failure = { time: current!.t, message: message(error) };
        return;
      }
      if (next.t > time) return;
      current = next;
      next = undefined;
    }
  };

  return (time) => {
    const analysis = { mode: "snapshot" as const, time };
    const fail = (message: string): Snapshot => ({
      analysis,
      nodes: {},
      components: {},
      diagnostics: [{ code: "numerical", message }],
    });

    if (!Number.isFinite(time) || time < 0)
      return fail("Time must be finite and nonnegative.");
    if (invalid)
      return fail(
        "Capacitance must be finite and positive; initial voltage must be finite.",
      );
    if (!capacitors.length) return analyze(components, analysis, reference);

    if (failure && failure.time < time) return fail(failure.message);
    seek(time);
    if (failure && failure.time < time) return fail(failure.message);

    try {
      const { v } = integrate(current!, time, true);

      return evaluate(v, time).snapshot;
    } catch (error) {
      return fail(message(error));
    }
  };
};

/** One-off query. Prefer `createTransient` when querying repeatedly. */
export const transient = (
  components: readonly Component[],
  time: number,
  reference?: string,
): Snapshot => createTransient(components, reference)(time);
