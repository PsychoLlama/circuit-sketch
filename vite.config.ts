import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  define: { "import.meta.env.VITEST": "false" },
  plugins: [
    tailwindcss(),
    solidStart({
      // Suppresses the dev toolbar overlay pinned to every dev page. Uncaught
      // errors still surface via the plain error boundary and console.
      devOverlay: false,
    }),
    nitro(),
  ],
});
