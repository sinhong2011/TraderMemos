import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setToken, setUnauthorizedHandler } from "./client";

afterEach(() => vi.restoreAllMocks());

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
