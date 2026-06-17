import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { lingui } from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    // tanstackRouter must come before react()
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react({
      babel: {
        plugins: ["@lingui/babel-plugin-lingui-macro"],
      },
    }),
    tailwind(),
    lingui(),
  ],
  server: { port: 5173, proxy: { "/api": "http://localhost:8080" } },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
