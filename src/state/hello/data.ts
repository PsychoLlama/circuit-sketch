import { createSignal } from "solid-js";

export function createHelloData() {
  const [message, setMessage] = createSignal("Your first spark starts here.");
  return { message, setMessage };
}
