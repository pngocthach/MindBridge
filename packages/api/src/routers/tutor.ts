import { z } from "zod";

import { protectedProcedure } from "../index";

const tutorInputSchema = z.object({
	lessonContext: z.object({
		content: z.string().trim().min(1).max(20_000),
		id: z.string().trim().min(1).max(100),
		title: z.string().trim().min(1).max(200),
	}),
	question: z.string().trim().min(1).max(2_000),
	skillProfile: z.object({
		level: z.enum(["beginner", "intermediate", "advanced"]),
		needsSupport: z.array(z.string().trim().min(1).max(100)).max(10),
		strengths: z.array(z.string().trim().min(1).max(100)).max(10),
	}),
});

export type TutorInput = z.infer<typeof tutorInputSchema>;

export type TutorStep = {
	content: string;
	title: string;
};

export type TutorAnswer = {
	followUpQuestion: string;
	introduction: string;
	steps: TutorStep[];
};

export interface TutorService {
	ask(input: TutorInput): Promise<TutorAnswer>;
}

const levelGuidance = {
	advanced:
		"Hãy tự nêu giả định, so sánh ít nhất hai cách tiếp cận và kiểm tra trường hợp ngoại lệ.",
	beginner:
		"Hãy bắt đầu từ các từ khóa chính, diễn đạt lại bằng lời của bạn rồi mới áp dụng.",
	intermediate:
		"Hãy nối khái niệm với kiến thức bạn đã biết và giải thích vì sao từng bước hợp lý.",
} as const;

const summarizeLesson = (content: string): string => {
	const normalizedContent = content.replace(/\s+/g, " ").trim();
	const summaryLength = 320;

	return normalizedContent.length > summaryLength
		? `${normalizedContent.slice(0, summaryLength).trimEnd()}…`
		: normalizedContent;
};

export class RuleBasedTutorService implements TutorService {
	async ask(input: TutorInput): Promise<TutorAnswer> {
		const lessonSummary = summarizeLesson(input.lessonContext.content);
		const supportFocus = input.skillProfile.needsSupport.at(0);
		const strength = input.skillProfile.strengths.at(0);

		return {
			followUpQuestion:
				"Theo bạn, chi tiết nào trong bài học liên quan trực tiếp nhất đến câu hỏi này, và vì sao?",
			introduction: `Mình sẽ cùng bạn gỡ câu hỏi “${input.question}” dựa trên bài “${input.lessonContext.title}”, nhưng chưa đưa đáp án ngay.`,
			steps: [
				{
					content: `Ý cốt lõi từ bài đang mở là: ${lessonSummary}`,
					title: "Bước 1 — Tìm dữ kiện trong bài",
				},
				{
					content: levelGuidance[input.skillProfile.level],
					title: "Bước 2 — Chọn cách suy luận phù hợp",
				},
				{
					content: supportFocus
						? `Bạn đang cần hỗ trợ thêm về “${supportFocus}”. Hãy khoanh đúng một ý trong phần bài học trên có thể giúp bạn xử lý điểm này.`
						: "Hãy khoanh đúng một ý trong phần bài học trên có thể dùng để trả lời câu hỏi.",
					title: "Bước 3 — Thu hẹp điểm còn vướng",
				},
				{
					content: strength
						? `Tận dụng điểm mạnh “${strength}”: hãy thử trình bày lời giải thích trong 2–3 câu, kèm một ví dụ của riêng bạn.`
						: "Hãy thử trình bày lời giải thích trong 2–3 câu, kèm một ví dụ của riêng bạn.",
					title: "Bước 4 — Tự hình thành câu trả lời",
				},
			],
		};
	}
}

const tutorService: TutorService = new RuleBasedTutorService();

export const tutorRouter = {
	ask: protectedProcedure
		.input(tutorInputSchema)
		.handler(async ({ input }) => tutorService.ask(input)),
};
