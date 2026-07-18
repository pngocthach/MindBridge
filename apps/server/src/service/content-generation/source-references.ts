import type { LessonDraft } from "../../../baml_client";

export const resolveSourceReferences = (
	draft: LessonDraft,
	sourceChunkIdByReference: ReadonlyMap<string, string>,
): LessonDraft => {
	const resolve = (references: readonly (string | number)[]): string[] =>
		references.map((reference) => {
			const sourceChunkId = sourceChunkIdByReference.get(String(reference));
			return sourceChunkId ?? String(reference);
		});

	return {
		...draft,
		exercises: draft.exercises.map((exercise) => ({
			...exercise,
			source_chunk_ids: resolve(exercise.source_chunk_ids),
		})),
		objectives: draft.objectives.map((objective) => ({
			...objective,
			source_chunk_ids: resolve(objective.source_chunk_ids),
		})),
		quiz_questions: draft.quiz_questions.map((question) => ({
			...question,
			source_chunk_ids: resolve(question.source_chunk_ids),
		})),
		summary_source_chunk_ids: resolve(draft.summary_source_chunk_ids),
	};
};
