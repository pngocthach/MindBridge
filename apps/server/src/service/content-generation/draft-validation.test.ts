import { describe, expect, it } from "vitest";

import { ExerciseDifficulty, type LessonDraft } from "../../../baml_client";
import {
	assertValidDraft,
	InvalidGeneratedLessonError,
} from "./draft-validation";

const sourceChunkIds = new Set(["chunk-1", "chunk-2"]);

const createDraft = (): LessonDraft => ({
	exercises: [
		{
			difficulty: ExerciseDifficulty.EASY,
			expected_answer: "Đáp án dễ",
			explanation: "Giải thích dễ",
			prompt: "Bài tập dễ",
			source_chunk_ids: ["chunk-1"],
		},
		{
			difficulty: ExerciseDifficulty.STANDARD,
			expected_answer: "Đáp án chuẩn",
			explanation: "Giải thích chuẩn",
			prompt: "Bài tập chuẩn",
			source_chunk_ids: ["chunk-2"],
		},
	],
	objectives: [{ source_chunk_ids: ["chunk-1"], text: "Mục tiêu" }],
	quiz_questions: Array.from({ length: 5 }, (_, index) => ({
		correct_answer: "A",
		explanation: `Giải thích ${index + 1}`,
		options: ["A", "B", "C", "D"],
		question: `Câu hỏi ${index + 1}`,
		source_chunk_ids: ["chunk-1"],
	})),
	summary: "Tóm tắt",
	summary_source_chunk_ids: ["chunk-1"],
	title: "Bài học",
});

describe("assertValidDraft", () => {
	it("accepts a draft with five quiz questions, both difficulties, and valid references", () => {
		expect(() => assertValidDraft(createDraft(), sourceChunkIds)).not.toThrow();
	});

	it("rejects a draft with fewer than five quiz questions", () => {
		const draft = createDraft();
		draft.quiz_questions.pop();

		expect(() => assertValidDraft(draft, sourceChunkIds)).toThrow(
			InvalidGeneratedLessonError,
		);
	});

	it("rejects a draft without both exercise difficulties", () => {
		const draft = createDraft();
		draft.exercises = draft.exercises.filter(
			({ difficulty }) => difficulty === ExerciseDifficulty.EASY,
		);

		expect(() => assertValidDraft(draft, sourceChunkIds)).toThrow(
			InvalidGeneratedLessonError,
		);
	});

	it("rejects references outside the selected source chunks", () => {
		const draft = createDraft();
		draft.summary_source_chunk_ids = ["unknown-chunk"];

		expect(() => assertValidDraft(draft, sourceChunkIds)).toThrow(
			InvalidGeneratedLessonError,
		);
	});
});
