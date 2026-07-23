import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lingui } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
import { serwist } from "@serwist/vite";
import tailwind from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readRepoVersion(): string {
  try {
    return readFileSync(resolve(repoRoot, "VERSION"), "utf8").trim();
  } catch {
    return "dev";
  }
}

const appVersion = process.env.VITE_APP_VERSION?.trim() || readRepoVersion();
const appBuild =
  process.env.VITE_APP_BUILD?.trim() ||
  process.env.GITHUB_SHA?.slice(0, 7) ||
  process.env.VITE_APP_COMMIT?.trim() ||
  "";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD__: JSON.stringify(appBuild),
  },
  fmt: {
    // TanStack Router regenerates this with its own quote/semi style on every
    // `vp dev`; formatting it in pre-commit causes a permanent dirty loop.
    ignorePatterns: ["dist/**", "src/routeTree.gen.ts", "src/i18n/locales/**", "src/sw.ts"],
  },
  lint: {
    ignorePatterns: ["dist/**", "src/routeTree.gen.ts", "src/i18n/locales/**", "src/sw.ts"],
    plugins: ["typescript", "react"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["**/*.{test,spec}.{ts,tsx}"],
        plugins: ["typescript", "vitest"],
      },
    ],
  },
  staged: {
    "*.{js,ts,tsx}": "vp check --fix",
  },
  plugins: lazyPlugins(() => [
    // tanstackRouter must come before react()
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    // React Compiler via Babel (plugin-react v6); Lingui macros after compiler
    babel({
      presets: [reactCompilerPreset()],
      plugins: ["@lingui/babel-plugin-lingui-macro"],
    }),
    tailwind(),
    lingui(),
    serwist({
      swSrc: "src/sw.ts",
      swDest: "sw.js",
      globDirectory: "dist",
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
    }),
  ]),
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/healthz": "http://localhost:8080",
      "/docs": "http://localhost:8080",
      "/openapi.yaml": "http://localhost:8080",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Playwright specs live in e2e/ and must not run under vitest
    exclude: ["e2e/**", "node_modules/**"],
  },
});
