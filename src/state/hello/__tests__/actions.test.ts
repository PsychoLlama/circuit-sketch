import { describe, expect, it } from "vitest";
import { createHelloActions } from "../actions";

describe("hello actions", () => {
  it("greets without changing another feature instance", () => {
    const first = createHelloActions();
    const second = createHelloActions();

    first.greet();

    expect(first.message()).toBe("Hello from SolidStart!");
    expect(second.message()).toBe("Your first spark starts here.");
  });
});
