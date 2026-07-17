import { env } from "@MindBridge/env/server";
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

const tutorAnswerSchema = z.object({
	followUpQuestion: z.string().trim().min(1),
	introduction: z.string().trim().min(1),
	steps: z
		.array(
			z.object({
				content: z.string().trim().min(1),
				title: z.string().trim().min(1),
			}),
		)
		.min(1)
		.max(6),
});

const buildTutorMessages = (input: TutorInput) => {
	const systemPrompt = [
		"Bạn là trợ giảng AI cho học sinh Việt Nam. Luôn trả lời bằng tiếng Việt tự nhiên, phù hợp lứa tuổi.",
		"Dẫn dắt học sinh TỪNG BƯỚC để tự tìm ra câu trả lời; TUYỆT ĐỐI không đưa đáp án cuối cùng.",
		"Chỉ dựa trên ngữ cảnh bài học được cung cấp và mức độ kỹ năng của học sinh.",
		'Chỉ trả về một JSON hợp lệ đúng dạng {"introduction": string, "steps": [{"title": string, "content": string}], "followUpQuestion": string}. Không thêm chữ nào ngoài JSON, không dùng markdown.',
	].join(" ");

	const userPrompt = [
		`Câu hỏi của học sinh: ${input.question}`,
		`Bài học: ${input.lessonContext.title}`,
		`Nội dung bài học: ${input.lessonContext.content}`,
		`Trình độ: ${input.skillProfile.level}`,
		`Cần hỗ trợ: ${input.skillProfile.needsSupport.join(", ") || "không rõ"}`,
		`Điểm mạnh: ${input.skillProfile.strengths.join(", ") || "không rõ"}`,
	].join("\n");

	return [
		{ content: systemPrompt, role: "system" as const },
		{ content: userPrompt, role: "user" as const },
	];
};

const extractJson = (raw: string): unknown => {
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		throw new Error("Tutor LLM response did not contain JSON.");
	}
	return JSON.parse(raw.slice(start, end + 1));
};

class LlmTutorService implements TutorService {
	constructor(
		private readonly baseUrl: string,
		private readonly model: string,
		private readonly apiKey?: string,
	) {}

	async ask(input: TutorInput): Promise<TutorAnswer> {
		const response = await fetch(
			`${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
			{
				body: JSON.stringify({
					messages: buildTutorMessages(input),
					model: this.model,
					temperature: 0.3,
				}),
				headers: {
					"content-type": "application/json",
					...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
				},
				method: "POST",
			},
		);

		if (!response.ok) {
			throw new Error(`Tutor LLM request failed with ${response.status}.`);
		}

		const payload = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const content = payload.choices?.at(0)?.message?.content;
		if (!content) {
			throw new Error("Tutor LLM response was empty.");
		}

		return tutorAnswerSchema.parse(extractJson(content));
	}
}

class TutorServiceWithFallback implements TutorService {
	constructor(
		private readonly primary: TutorService,
		private readonly fallback: TutorService,
	) {}

	async ask(input: TutorInput): Promise<TutorAnswer> {
		try {
			return await this.primary.ask(input);
		} catch {
			return this.fallback.ask(input);
		}
	}
}

const createTutorService = (): TutorService => {
	const ruleBased = new RuleBasedTutorService();
	if (!(env.TUTOR_LLM_MODEL && env.TUTOR_LLM_BASE_URL)) {
		return ruleBased;
	}
	return new TutorServiceWithFallback(
		new LlmTutorService(
			env.TUTOR_LLM_BASE_URL,
			env.TUTOR_LLM_MODEL,
			env.TUTOR_LLM_API_KEY,
		),
		ruleBased,
	);
};

const tutorService: TutorService = createTutorService();

export const tutorRouter = {
	ask: protectedProcedure
		.input(tutorInputSchema)
		.handler(async ({ input }) => tutorService.ask(input)),
};
