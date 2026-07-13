import { lingui } from "@lingui/vite-plugin";
import tailwind from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
	fmt: {},
	lint: {
		ignorePatterns: [
			"dist/**",
			"src/routeTree.gen.ts",
			"src/i18n/locales/**",
		],
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
		react({
			babel: {
				plugins: ["@lingui/babel-plugin-lingui-macro"],
			},
		}),
		tailwind(),
		lingui(),
	]),
	server: { port: 5173, proxy: { "/api": "http://localhost:8080" } },
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		globals: true,
		// Playwright specs live in e2e/ and must not run under vitest
		exclude: ["e2e/**", "node_modules/**"],
	},
});
