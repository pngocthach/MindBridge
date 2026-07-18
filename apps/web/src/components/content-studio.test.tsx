import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ContentStudio, { StructuredGenerationProgress } from "./content-studio";

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
		teacher: {
			listClassrooms: {
				queryOptions: vi.fn(),
			},
			publishAndAssignGeneratedLesson: {
				mutationOptions: vi.fn(),
			},
		},
		sourceDocuments: {
			detail: {
				queryOptions: vi.fn(),
			},
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

	it("shows each lesson section as it arrives from the stream", () => {
		const markup = renderToStaticMarkup(
			<StructuredGenerationProgress
				draft={{
					objectives: [{ text: "Phân tích tài liệu" }],
					exercises: [
						{
							expected_answer: "Đáp án bài tập",
							explanation: "Giải thích bài tập",
							prompt: "Bài tập có nguồn",
							source_chunk_ids: ["source-2"],
						},
					],
					quiz_questions: [
						{
							options: ["Đáp án một", "Đáp án hai"],
							correct_answer: "Đáp án hai",
							explanation: "Giải thích câu hỏi",
							question: "Câu hỏi kiểm tra",
							source_chunk_ids: ["source-1"],
						},
					],
					summary: "Tóm tắt bài học",
					title: "Bài học mẫu",
				}}
				isComplete={false}
				sourceChunks={[
					{
						id: "source-1",
						ordinal: 0,
						pageFrom: null,
						pageTo: null,
						text: "Đoạn nguồn kiểm chứng cho câu hỏi.",
					},
					{
						id: "source-2",
						ordinal: 1,
						pageFrom: null,
						pageTo: null,
						text: "Đoạn nguồn kiểm chứng cho bài tập.",
					},
				]}
			/>,
		);

		expect(markup).toContain("Khung bài học");
		expect(markup).toContain("Bài học mẫu");
		expect(markup).toContain("Tóm tắt bài học");
		expect(markup).toContain("Phân tích tài liệu");
		expect(markup).toContain("Câu hỏi kiểm tra");
		expect(markup).toContain("Câu 1. Câu hỏi kiểm tra");
		expect(markup).toContain("Bài tập có nguồn");
		expect(markup).toContain("Bài tập 1. Bài tập có nguồn");
		expect(markup).toContain("Đáp án tham khảo: Đáp án bài tập");
		expect(markup).toContain("Giải thích: Giải thích bài tập");
		expect(markup).not.toContain("Đang tải nguồn");
		expect(markup).toContain("A. Đáp án một");
		expect(markup).toContain("B. Đáp án hai");
		expect(markup).toContain("Đáp án: Đáp án hai");
		expect(markup).toContain("Giải thích: Giải thích câu hỏi");
		expect(markup).toContain("Đã tạo 1 bài tập");
		expect(markup).toContain("Đã tạo 1 mục tiêu");
		expect(markup).toContain("Đã tạo 1 câu hỏi");
	});
});
