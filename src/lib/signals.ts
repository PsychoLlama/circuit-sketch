import { batch, createSignal, type Signal, type SignalOptions } from "solid-js";

const __resets = new Set<() => void>();

/** Reset registered signals without replacing their accessors or setters. */
export const __resetSignals = () => {
  batch(() => {
    for (const reset of __resets) reset();
  });
};

/** Supply an initializer so resets also recreate mutable initial values. */
export const createResettableSignal = <T>(
  initial: () => T,
  options?: SignalOptions<T>,
): Signal<T> => {
  const signal = createSignal(initial(), options);

  if (import.meta.env.VITEST) {
    __resets.add(() => signal[1](() => initial()));
  }

  return signal;
};
