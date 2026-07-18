import { describe, expect, it } from "vitest";

import { getLessonMarkdown } from "./content-markdown";

describe("getLessonMarkdown", () => {
	it("labels multiple-choice options with letters", () => {
		const markdown = getLessonMarkdown({
			quiz_questions: [
				{
					correct_answer: "B",
					options: ["Phương án một", "Phương án hai", "Phương án ba"],
					question: "Câu hỏi mẫu",
				},
			],
		});

		expect(markdown).toContain("A. Phương án một");
		expect(markdown).toContain("A. Phương án một  \nB. Phương án hai");
		expect(markdown).toContain("B. Phương án hai");
		expect(markdown).toContain("C. Phương án ba");
		expect(markdown).not.toContain("- Phương án một");
	});
});
