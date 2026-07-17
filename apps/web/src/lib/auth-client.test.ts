import { describe, expect, it, vi } from "vitest";

vi.mock("@MindBridge/env/web", () => ({
	env: {
		VITE_SERVER_URL: "http://localhost:3000",
	},
}));

describe("authClient", () => {
	it("loads during SSR", async () => {
		// Dynamic loading verifies the SSR module-evaluation boundary.
		const { authClient } = await import("./auth-client");

		expect(authClient).toBeDefined();
	});
});
