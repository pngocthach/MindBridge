import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LocalPythonDocumentConverter } from "./converter";

const fixtureDirectory = fileURLToPath(
	new URL("../../../../ingestion-worker/tests/fixtures/", import.meta.url),
);
const supportedFixtureNames = [
	"sample.pdf",
	"sample.docx",
	"sample.pptx",
	"sample.xlsx",
	"sample.html",
	"sample.epub",
] as const;

describe("LocalPythonDocumentConverter", () => {
	it("converts an uploaded Markdown document through the local Python worker", async () => {
		const converter = new LocalPythonDocumentConverter();

		const result = await converter.convert({
			content: new TextEncoder().encode(
				"# Nguồn học liệu\n\nNội dung đã chuyển đổi.",
			),
			fileName: "lesson.md",
		});

		expect(result).toEqual({
			markdown: "# Nguồn học liệu\n\nNội dung đã chuyển đổi.",
			metadata: { detectedMimeType: "text/markdown" },
		});
	});

	it("converts supported document fixtures through the TypeScript interface", async () => {
		const converter = new LocalPythonDocumentConverter();

		for (const fileName of supportedFixtureNames) {
			const result = await converter.convert({
				content: await readFile(join(fixtureDirectory, fileName)),
				fileName,
			});

			expect(result.markdown).not.toBe("");
			expect(result.metadata.detectedMimeType).not.toBeNull();
		}
	});
});
