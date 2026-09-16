import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { "import.meta.env.VITEST": "true" },

  // Node otherwise loads Solid's nonreactive server implementation.
  resolve: {
    alias: [
      {
        find: "~",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: /^solid-js$/,
        replacement: fileURLToPath(
          import.meta.resolve("solid-js/dist/solid.js"),
        ),
      },
    ],
  },
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
