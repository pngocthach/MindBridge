import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ContentStudio from "./content-studio";

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		error: null,
		isPending: false,
		mutate: vi.fn(),
	}),
	useQuery: () => ({
		data: [],
		isError: false,
		isPending: false,
	}),
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		contentGeneration: {
			generateLessonDraft: vi.fn(),
		},
	},
	orpc: {
		courses: {
			search: {
				queryOptions: vi.fn(),
			},
		},
		sourceDocuments: {
			paste: {
				mutationOptions: vi.fn(),
			},
			upload: {
				mutationOptions: vi.fn(),
			},
		},
	},
}));

describe("ContentStudio", () => {
	it("keeps the upload-to-course flow focused until optional settings are opened", () => {
		const markup = renderToStaticMarkup(<ContentStudio />);

		expect(markup).toContain("1. Tài liệu nguồn");
		expect(markup).toContain("2. Khóa học nhận bài học");
		expect(markup).toContain("Tùy chỉnh bài học (không bắt buộc)");
		expect(markup).toContain("Tạo bài học với AI");
		expect(markup).not.toContain("Nguồn học liệu");
		expect(markup).not.toContain("Preview &amp; review");
	});
});
