import { describe, expect, it } from "vitest";

import { validateReorder } from "./course-curriculum";

describe("course curriculum reorder", () => {
	it("accepts each current content item exactly once", () => {
		expect(
			validateReorder(["lesson-a", "quiz-b"], ["quiz-b", "lesson-a"]),
		).toBe(true);
	});

	it("rejects missing, duplicate, and unknown content items", () => {
		expect(validateReorder(["lesson-a", "quiz-b"], ["lesson-a"])).toBe(false);
		expect(
			validateReorder(["lesson-a", "quiz-b"], ["lesson-a", "lesson-a"]),
		).toBe(false);
		expect(
			validateReorder(["lesson-a", "quiz-b"], ["lesson-a", "quiz-c"]),
		).toBe(false);
	});
});
