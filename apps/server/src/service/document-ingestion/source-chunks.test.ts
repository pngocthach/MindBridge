import { describe, expect, it } from "vitest";

import { splitSourceText } from "./source-chunks";

describe("splitSourceText", () => {
	it("preserves source offsets while preferring paragraph boundaries", () => {
		const sourceText = `${"A".repeat(1_000)}\n\n${"B".repeat(1_000)}`;
		const chunks = splitSourceText(sourceText);

		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toEqual({
			charEnd: 1_002,
			charStart: 0,
			ordinal: 1,
			text: `${"A".repeat(1_000)}\n\n`,
		});
		expect(chunks[1]).toEqual({
			charEnd: sourceText.length,
			charStart: 1_002,
			ordinal: 2,
			text: "B".repeat(1_000),
		});
	});
	it("keeps a short leading paragraph with the following text", () => {
		const sourceText = `A\n\n${"B".repeat(2_000)}`;
		const chunks = splitSourceText(sourceText);

		expect(chunks[0]).toEqual({
			charEnd: 1_800,
			charStart: 0,
			ordinal: 1,
			text: sourceText.slice(0, 1_800),
		});
	});
});
