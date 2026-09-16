import { createComputed, createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createResettableSignal, __resetSignals } from "../signals";

describe("resettable signals", () => {
  it("restores primitives and undefined through the same accessors and setters", () => {
    const [count, setCount] = createResettableSignal(() => 2);
    const [selection, setSelection] = createResettableSignal<
      string | undefined
    >(() => undefined);

    setCount((value) => value + 5);
    setSelection("R1");
    expect(count()).toBe(7);
    __resetSignals();
    expect(count()).toBe(2);
    expect(selection()).toBeUndefined();
    setCount(9);
    __resetSignals();
    expect(count()).toBe(2);
  });

  it("recreates nested mutable defaults on every reset", () => {
    const [value] = createResettableSignal(() => ({ items: [{ value: 1 }] }));
    const first = value();

    first.items[0].value = 9;
    __resetSignals();
    expect(value()).toEqual({ items: [{ value: 1 }] });
    expect(value()).not.toBe(first);

    const second = value();

    second.items.push({ value: 2 });
    __resetSignals();
    expect(value()).toEqual({ items: [{ value: 1 }] });
    expect(value()).not.toBe(second);
  });

  it("restores function values without invoking them as updater functions", () => {
    const original = vi.fn(() => 42);
    const [callback, setCallback] = createResettableSignal<() => number>(
      () => original,
    );

    setCallback(() => () => 99);
    __resetSignals();
    expect(callback()).toBe(original);
    expect(original).not.toHaveBeenCalled();
  });

  it("batches resets and keeps existing reactive subscriptions alive", () => {
    const [left, setLeft] = createResettableSignal(() => 1);
    const [right, setRight] = createResettableSignal(() => 2);
    const observed: number[][] = [];
    const dispose = createRoot((dispose) => {
      createComputed(() => observed.push([left(), right()]));
      return dispose;
    });

    try {
      setLeft(10);
      setRight(20);
      observed.length = 0;
      __resetSignals();
      expect(observed).toEqual([[1, 2]]);
      setLeft(3);
      expect(observed).toEqual([
        [1, 2],
        [3, 2],
      ]);
    } finally {
      dispose();
    }
  });

  it("forwards Solid signal options", () => {
    const [value, setValue] = createResettableSignal(() => 1, {
      equals: false,
    });

    const observe = vi.fn();
    const dispose = createRoot((dispose) => {
      createComputed(() => observe(value()));
      return dispose;
    });

    try {
      setValue(1);
      __resetSignals();
      expect(observe).toHaveBeenCalledTimes(3);
    } finally {
      dispose();
    }
  });
});
