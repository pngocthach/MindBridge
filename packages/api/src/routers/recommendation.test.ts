import { describe, expect, it } from "vitest";

import { buildPlans, selectContent } from "./recommendation";

const skills = [
	{
		gradeLevel: 6,
		id: "skill-prerequisite",
		name: "Phép tính cơ bản",
		score: 0.2,
		threshold: 0.7,
	},
	{
		gradeLevel: 6,
		id: "skill-target",
		name: "Phân số",
		score: 0.3,
		threshold: 0.7,
	},
];

describe("recommendation contracts", () => {
	it("prioritizes an unmet prerequisite before its target skill", () => {
		const plans = buildPlans(
			[
				{ evidenceCount: 2, score: 0.2, skillId: "skill-prerequisite" },
				{ evidenceCount: 1, score: 0.3, skillId: "skill-target" },
			],
			skills,
			[{ prerequisiteSkillId: "skill-prerequisite", skillId: "skill-target" }],
		);

		expect(plans.map(({ recommendedSkill }) => recommendedSkill.id)).toEqual([
			"skill-prerequisite",
			"skill-target",
		]);
		expect(plans[1]?.blockingSkill?.id).toBe("skill-prerequisite");
	});

	it("selects the closest difficulty and avoids already used content", () => {
		const candidates = [
			{
				contentVersionId: "content-beginner",
				coverage: "primary" as const,
				kind: "lesson" as const,
				metadata: { difficulty: "beginner", gradeLevel: 6 },
				skillId: "skill-prerequisite",
				title: "Phép tính cơ bản",
			},
			{
				contentVersionId: "content-advanced",
				coverage: "primary" as const,
				kind: "lesson" as const,
				metadata: { difficulty: "advanced", gradeLevel: 6 },
				skillId: "skill-prerequisite",
				title: "Phép tính nâng cao",
			},
		];

		const prerequisiteSkill = skills[0];
		if (!prerequisiteSkill) throw new Error("Test skill fixture is missing.");
		const beginner = selectContent(candidates, prerequisiteSkill, new Set());
		const fallback = selectContent(
			candidates,
			prerequisiteSkill,
			new Set(["content-beginner"]),
		);
		const exhausted = selectContent(
			candidates,
			prerequisiteSkill,
			new Set(["content-beginner", "content-advanced"]),
		);

		expect(beginner?.contentVersionId).toBe("content-beginner");
		expect(fallback?.contentVersionId).toBe("content-advanced");
		expect(exhausted).toBeUndefined();
	});
});
