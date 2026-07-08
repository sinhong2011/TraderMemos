import { lingui } from "@lingui/vite-plugin";
import tailwind from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		globals: true,
		// Playwright specs live in e2e/ and must not run under vitest
		exclude: ["e2e/**", "node_modules/**"],
	},
});
