import { describe, expect, it } from "vitest";

import { hasPermission, isUserRole, permissions } from "./permissions";

describe("application roles", () => {
	it("grants every permission to admins", () => {
		for (const permission of permissions) {
			expect(hasPermission("admin", permission)).toBe(true);
		}
	});

	it("allows teachers to upload sources without content workflow access", () => {
		expect(hasPermission("teacher", "source:upload")).toBe(true);
		expect(hasPermission("teacher", "content:update")).toBe(false);
		expect(hasPermission("teacher", "content:publish")).toBe(false);
	});

	it("allows editors to prepare drafts without publishing them", () => {
		expect(hasPermission("editor", "content:create")).toBe(true);
		expect(hasPermission("editor", "content:submit-review")).toBe(true);
		expect(hasPermission("editor", "content:publish")).toBe(false);
	});

	it("accepts only configured role values", () => {
		expect(isUserRole("learner")).toBe(true);
		expect(isUserRole("reviewer")).toBe(false);
	});
});
