import { createHelloData } from "./data";

export function createHelloActions() {
  const data = createHelloData();

  return {
    message: data.message,
    greet() {
      data.setMessage("Hello from SolidStart!");
    },
  };
}
