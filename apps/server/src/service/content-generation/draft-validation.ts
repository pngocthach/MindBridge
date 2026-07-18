import { ExerciseDifficulty, type LessonDraft } from "../../../baml_client";

const MINIMUM_QUIZ_QUESTIONS = 5;

export class InvalidGeneratedLessonError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidGeneratedLessonError";
	}
}

export interface SourceReference {
	chunkIds: string[];
	referenceKind: string;
}

export const collectReferences = (draft: LessonDraft): SourceReference[] => {
	const references: SourceReference[] = [
		{
			chunkIds: draft.summary_source_chunk_ids.map(String),
			referenceKind: "summary",
		},
	];

	for (const [index, objective] of draft.objectives.entries()) {
		references.push({
			chunkIds: objective.source_chunk_ids.map(String),
			referenceKind: `objective:${index + 1}`,
		});
	}
	for (const [index, question] of draft.quiz_questions.entries()) {
		references.push({
			chunkIds: question.source_chunk_ids.map(String),
			referenceKind: `quiz:${index + 1}`,
		});
	}
	for (const [index, exercise] of draft.exercises.entries()) {
		references.push({
			chunkIds: exercise.source_chunk_ids.map(String),
			referenceKind: `exercise:${index + 1}`,
		});
	}

	return references;
};

export const assertValidDraft = (
	draft: LessonDraft,
	availableChunkIds: ReadonlySet<string>,
): void => {
	if (draft.quiz_questions.length < MINIMUM_QUIZ_QUESTIONS) {
		throw new InvalidGeneratedLessonError(
			`Bản nháp cần ít nhất ${MINIMUM_QUIZ_QUESTIONS} câu quiz.`,
		);
	}

	const hasEasyExercise = draft.exercises.some(
		({ difficulty }) => difficulty === ExerciseDifficulty.EASY,
	);
	const hasStandardExercise = draft.exercises.some(
		({ difficulty }) => difficulty === ExerciseDifficulty.STANDARD,
	);
	if (!hasEasyExercise || !hasStandardExercise) {
		throw new InvalidGeneratedLessonError(
			"Bản nháp cần bài tập mức dễ và chuẩn.",
		);
	}

	for (const reference of collectReferences(draft)) {
		for (const chunkId of reference.chunkIds) {
			if (!availableChunkIds.has(chunkId)) {
				throw new InvalidGeneratedLessonError(
					"Bản nháp chứa source reference không thuộc tài liệu đã chọn.",
				);
			}
		}
	}
};
