type ContentBlock = { text: string; title?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const contentValueToText = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map(contentValueToText).filter(Boolean).join("\n");
	}
	if (isRecord(value)) {
		return Object.values(value)
			.map(contentValueToText)
			.filter(Boolean)
			.join("\n");
	}
	return "";
};

const getContentBlocks = (body: unknown): ContentBlock[] => {
	if (!isRecord(body)) {
		const text = contentValueToText(body);
		return text ? [{ text }] : [];
	}

	const sections = body.sections;
	if (Array.isArray(sections)) {
		const sectionBlocks = sections.flatMap((section) => {
			if (!isRecord(section)) {
				const text = contentValueToText(section);
				return text ? [{ text }] : [];
			}
			const text = contentValueToText(section.content ?? section.text);
			return text
				? [
						{
							text,
							title:
								typeof section.title === "string" ? section.title : undefined,
						},
					]
				: [];
		});
		if (sectionBlocks.length > 0) {
			return sectionBlocks;
		}
	}

	const fieldLabels: Record<string, string> = {
		instructions: "Hướng dẫn",
		successCriteria: "Tiêu chí hoàn thành",
	};
	const blocks: ContentBlock[] = [];
	for (const [key, value] of Object.entries(body)) {
		const text = contentValueToText(value);
		if (text) {
			blocks.push({ text, title: fieldLabels[key] });
		}
	}
	return blocks;
};

export const getLessonMarkdown = (body: unknown): string => {
	if (!isRecord(body)) {
		return contentValueToText(body);
	}

	const sections: string[] = [];
	const summary = typeof body.summary === "string" ? body.summary.trim() : "";
	if (summary) {
		sections.push(`## Tóm tắt\n\n${summary}`);
	}

	const objectives = Array.isArray(body.objectives)
		? body.objectives.filter(isRecord)
		: [];
	if (objectives.length > 0) {
		sections.push(
			`## Mục tiêu học tập\n\n${objectives
				.map((objective) => `- ${contentValueToText(objective.text)}`)
				.join("\n")}`,
		);
	}

	const exercises = Array.isArray(body.exercises)
		? body.exercises.filter(isRecord)
		: [];
	if (exercises.length > 0) {
		sections.push(
			`## Bài tập\n\n${exercises
				.map((exercise, index) => {
					const difficulty =
						contentValueToText(exercise.difficulty) === "EASY" ? "Dễ" : "Chuẩn";
					const prompt = contentValueToText(exercise.prompt);
					const expectedAnswer = contentValueToText(exercise.expected_answer);
					const explanation = contentValueToText(exercise.explanation);
					return `### ${index + 1}. Bài tập ${difficulty}\n\n${prompt}${
						expectedAnswer ? `\n\n**Đáp án tham khảo:** ${expectedAnswer}` : ""
					}${explanation ? `\n\n**Giải thích:** ${explanation}` : ""}`;
				})
				.join("\n\n")}`,
		);
	}

	const quizQuestions = Array.isArray(body.quiz_questions)
		? body.quiz_questions.filter(isRecord)
		: [];
	if (quizQuestions.length > 0) {
		sections.push(
			`## Kiểm tra kiến thức\n\n${quizQuestions
				.map((question, index) => {
					const options = Array.isArray(question.options)
						? question.options
								.map((option) => `- ${contentValueToText(option)}`)
								.join("\n")
						: "";
					return `### Câu ${index + 1}. ${contentValueToText(question.question)}\n\n${options}${
						question.correct_answer
							? `\n\n**Đáp án:** ${contentValueToText(question.correct_answer)}`
							: ""
					}${
						question.explanation
							? `\n\n**Giải thích:** ${contentValueToText(question.explanation)}`
							: ""
					}`;
				})
				.join("\n\n")}`,
		);
	}

	if (sections.length > 0) {
		return sections.join("\n\n---\n\n");
	}

	return getContentBlocks(body)
		.map((block) =>
			block.title ? `## ${block.title}\n\n${block.text}` : block.text,
		)
		.join("\n\n---\n\n");
};
