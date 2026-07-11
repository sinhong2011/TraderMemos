import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ApiError,
	apiFetch,
	getRefreshToken,
	setToken,
	setTokens,
	setUnauthorizedHandler,
} from "./client";

afterEach(() => {
	vi.restoreAllMocks();
	setTokens("", "");
	setUnauthorizedHandler(null);
});

describe("apiFetch", () => {
	it("attaches bearer token and parses json", async () => {
		setToken("tok123");
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ ok: true }), { status: 200 }),
			);
		const out = await apiFetch("/trades");
		expect(out).toEqual({ ok: true });
		const req = spy.mock.calls[0][1] as RequestInit;
		expect((req.headers as Record<string, string>).Authorization).toBe(
			"Bearer tok123",
		);
	});

	it("throws ApiError with envelope message on non-2xx", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ error: { code: "bad_request", message: "nope" } }),
				{ status: 400 },
			),
		);
		await expect(apiFetch("/x")).rejects.toMatchObject({
			message: "nope",
			code: "bad_request",
		});
		await expect(apiFetch("/x")).rejects.toBeInstanceOf(ApiError);
	});

	it("invokes unauthorized handler on 401 for protected routes", async () => {
		const onUnauthorized = vi.fn();
		setUnauthorizedHandler(onUnauthorized);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ error: { code: "error", message: "Unauthorized" } }),
				{ status: 401 },
			),
		);
		await expect(apiFetch("/trades")).rejects.toBeInstanceOf(ApiError);
		expect(onUnauthorized).toHaveBeenCalledOnce();
		setUnauthorizedHandler(null);
	});
});

function protected401() {
	return new Response(
		JSON.stringify({ error: { code: "error", message: "Unauthorized" } }),
		{ status: 401 },
	);
}

describe("token refresh", () => {
	it("persists and clears the refresh token", () => {
		setTokens("acc", "ref");
		expect(getRefreshToken()).toBe("ref");
		expect(localStorage.getItem("tm_refresh")).toBe("ref");
		setTokens("", "");
		expect(getRefreshToken()).toBe("");
		expect(localStorage.getItem("tm_refresh")).toBeNull();
	});

	it("silently refreshes and retries once on 401", async () => {
		setTokens("stale", "ref-1");
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (url, init) => {
				if (String(url).endsWith("/auth/refresh")) {
					return new Response(
						JSON.stringify({ access_token: "fresh", refresh_token: "ref-2" }),
						{ status: 200 },
					);
				}
				const auth = (init?.headers as Record<string, string>).Authorization;
				if (auth === "Bearer fresh") {
					return new Response(JSON.stringify({ ok: true }), { status: 200 });
				}
				return protected401();
			});
		const out = await apiFetch("/trades");
		expect(out).toEqual({ ok: true });
		expect(getRefreshToken()).toBe("ref-2");
		const refreshCalls = spy.mock.calls.filter((c) =>
			String(c[0]).endsWith("/auth/refresh"),
		);
		expect(refreshCalls).toHaveLength(1);
	});

	it("shares one refresh across concurrent 401s (single-flight)", async () => {
		setTokens("stale", "ref-1");
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (url, init) => {
				if (String(url).endsWith("/auth/refresh")) {
					await new Promise((r) => setTimeout(r, 10));
					return new Response(
						JSON.stringify({ access_token: "fresh", refresh_token: "ref-2" }),
						{ status: 200 },
					);
				}
				const auth = (init?.headers as Record<string, string>).Authorization;
				if (auth === "Bearer fresh") {
					return new Response(JSON.stringify({ ok: true }), { status: 200 });
				}
				return protected401();
			});
		const [a, b] = await Promise.all([
			apiFetch("/trades"),
			apiFetch("/setups"),
		]);
		expect(a).toEqual({ ok: true });
		expect(b).toEqual({ ok: true });
		const refreshCalls = spy.mock.calls.filter((c) =>
			String(c[0]).endsWith("/auth/refresh"),
		);
		expect(refreshCalls).toHaveLength(1);
	});

	it("falls back to unauthorized handler when refresh fails", async () => {
		setTokens("stale", "bad-ref");
		const onUnauthorized = vi.fn();
		setUnauthorizedHandler(onUnauthorized);
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (String(url).endsWith("/auth/refresh")) return protected401();
			return protected401();
		});
		await expect(apiFetch("/trades")).rejects.toBeInstanceOf(ApiError);
		expect(onUnauthorized).toHaveBeenCalledOnce();
	});
});
