import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/sign-in-form", () => ({ default: () => null }));
vi.mock("@/components/sign-up-form", () => ({ default: () => null }));

import { loginSearchSchema } from "./login";

describe("login route", () => {
	it("defaults to sign-up and accepts the sign-in entry mode", () => {
		expect(loginSearchSchema.parse({})).toEqual({ mode: "sign-up" });
		expect(loginSearchSchema.parse({ mode: "sign-in" })).toEqual({
			mode: "sign-in",
		});
	});
});
