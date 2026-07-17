const MAX_CHUNK_CHARACTERS = 1_800;

export interface SourceTextChunk {
	charEnd: number;
	charStart: number;
	ordinal: number;
	text: string;
}

export const splitSourceText = (sourceText: string): SourceTextChunk[] => {
	const chunks: SourceTextChunk[] = [];
	let charStart = 0;
	let ordinal = 1;

	while (charStart < sourceText.length) {
		let charEnd = Math.min(charStart + MAX_CHUNK_CHARACTERS, sourceText.length);
		const paragraphBoundary = sourceText.lastIndexOf("\n\n", charEnd - 2);

		if (paragraphBoundary > charStart) {
			charEnd = paragraphBoundary + 2;
		}

		chunks.push({
			charEnd,
			charStart,
			ordinal,
			text: sourceText.slice(charStart, charEnd),
		});
		charStart = charEnd;
		ordinal += 1;
	}

	return chunks;
};
