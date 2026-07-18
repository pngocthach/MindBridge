import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import { Input } from "@MindBridge/ui/components/input";
import { Label } from "@MindBridge/ui/components/label";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { client, orpc } from "@/utils/orpc";

const splitLines = (value: string): string[] =>
	value
		.split("\n")
		.map((item) => item.trim())
		.filter(Boolean);

const splitCommaSeparated = (value: string): string[] =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

type SourceDocument = {
	chunkCount: number;
	documentId: string;
	preview: string;
};

type CourseOption = {
	gradeLevel: number;
	id: string;
	title: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: null;

const asRecords = (value: unknown): Record<string, unknown>[] =>
	Array.isArray(value)
		? value
				.map(asRecord)
				.filter((item): item is Record<string, unknown> => item !== null)
		: [];

const asString = (value: unknown): string =>
	typeof value === "string" ? value : "";

const asStrings = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];

const draftToMarkdown = (draft: Record<string, unknown>): string => {
	const sections: string[] = [];
	const summary = asString(draft.summary).trim();
	if (summary) sections.push(`## Tóm tắt\n\n${summary}`);
	const objectives = asRecords(draft.objectives);
	if (objectives.length > 0) {
		sections.push(
			`## Mục tiêu học tập\n\n${objectives.map((item) => `- ${asString(item.text)}`).join("\n")}`,
		);
	}
	const exercises = asRecords(draft.exercises);
	if (exercises.length > 0) {
		sections.push(
			`## Bài tập\n\n${exercises
				.map(
					(item, index) =>
						`### ${index + 1}. Bài tập ${asString(item.difficulty) === "EASY" ? "Dễ" : "Chuẩn"}\n\n${asString(item.prompt)}\n\n**Đáp án tham khảo:** ${asString(item.expected_answer)}\n\n**Giải thích:** ${asString(item.explanation)}`,
				)
				.join("\n\n")}`,
		);
	}
	const questions = asRecords(draft.quiz_questions);
	if (questions.length > 0) {
		sections.push(
			`## Kiểm tra kiến thức\n\n${questions
				.map(
					(item, index) =>
						`### Câu ${index + 1}. ${asString(item.question)}\n\n${asStrings(
							item.options,
						)
							.map((option) => `- ${option}`)
							.join(
								"\n",
							)}\n\n**Đáp án:** ${asString(item.correct_answer)}\n\n**Giải thích:** ${asString(item.explanation)}`,
				)
				.join("\n\n")}`,
		);
	}
	return sections.join("\n\n---\n\n");
};

function SourceReferences({ ids }: { ids: string[] }) {
	if (ids.length === 0) {
		return null;
	}

	return (
		<p className="mt-3 text-muted-foreground text-xs">
			Nguồn: {ids.length} đoạn tài liệu
		</p>
	);
}

function LessonDraftPreview({ draft }: { draft: Record<string, unknown> }) {
	const objectives = asRecords(draft.objectives);
	const quizQuestions = asRecords(draft.quiz_questions);
	const exercises = asRecords(draft.exercises);
	const title = asString(draft.title);
	const summary = asString(draft.summary);

	return (
		<div className="space-y-6">
			<section className="rounded-xl border bg-background p-5 shadow-sm">
				<div className="mb-4 flex items-center justify-between gap-3">
					<h2 className="font-semibold text-lg">Xem như học viên</h2>
					<span className="rounded-full bg-primary/10 px-3 py-1 text-primary text-xs">
						Bản xem trước
					</span>
				</div>
				<article className="max-w-none text-sm leading-7">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>
						{draftToMarkdown(draft)}
					</ReactMarkdown>
				</article>
			</section>
			<section>
				<h2 className="font-semibold text-xl">
					{title || "Đang tạo tiêu đề bài học…"}
				</h2>
				{summary ? (
					<p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm">
						{summary}
					</p>
				) : (
					<p className="mt-2 text-muted-foreground text-sm">
						Đang tạo tóm tắt…
					</p>
				)}
				<SourceReferences ids={asStrings(draft.summary_source_chunk_ids)} />
			</section>

			<section>
				<h3 className="font-semibold">Mục tiêu học tập</h3>
				{objectives.length > 0 ? (
					<ul className="mt-3 space-y-2">
						{objectives.map((objective, index) => (
							<li
								className="rounded-md border bg-muted/30 p-3 text-sm"
								key={`${asString(objective.text)}-${index}`}
							>
								{asString(objective.text)}
								<SourceReferences ids={asStrings(objective.source_chunk_ids)} />
							</li>
						))}
					</ul>
				) : (
					<p className="mt-2 text-muted-foreground text-sm">
						Đang tạo mục tiêu…
					</p>
				)}
			</section>

			<section>
				<h3 className="font-semibold">Quiz ({quizQuestions.length}/5)</h3>
				<div className="mt-3 space-y-3">
					{quizQuestions.map((question, index) => {
						const answer = asString(question.correct_answer);
						return (
							<article
								className="rounded-md border p-4"
								key={`${asString(question.question)}-${index}`}
							>
								<p className="font-medium text-sm">
									Câu {index + 1}. {asString(question.question)}
								</p>
								<ul className="mt-3 grid gap-2 sm:grid-cols-2">
									{asStrings(question.options).map((option) => (
										<li
											className="rounded bg-muted px-3 py-2 text-sm"
											key={option}
										>
											{option}
										</li>
									))}
								</ul>
								{answer && (
									<p className="mt-3 font-medium text-sm text-primary">
										Đáp án: {answer}
									</p>
								)}
								{asString(question.explanation) && (
									<p className="mt-1 text-muted-foreground text-sm">
										{asString(question.explanation)}
									</p>
								)}
								<SourceReferences ids={asStrings(question.source_chunk_ids)} />
							</article>
						);
					})}
				</div>
			</section>

			<section>
				<h3 className="font-semibold">Bài tập</h3>
				<div className="mt-3 space-y-3">
					{exercises.map((exercise, index) => (
						<article
							className="rounded-md border p-4"
							key={`${asString(exercise.prompt)}-${index}`}
						>
							<p className="font-medium text-sm">
								{asString(exercise.difficulty) === "EASY" ? "Dễ" : "Chuẩn"}
							</p>
							<p className="mt-2 whitespace-pre-wrap text-sm">
								{asString(exercise.prompt)}
							</p>
							{asString(exercise.expected_answer) && (
								<p className="mt-3 text-muted-foreground text-sm">
									Gợi ý đáp án: {asString(exercise.expected_answer)}
								</p>
							)}
							{asString(exercise.explanation) && (
								<p className="mt-1 text-muted-foreground text-sm">
									{asString(exercise.explanation)}
								</p>
							)}
							<SourceReferences ids={asStrings(exercise.source_chunk_ids)} />
						</article>
					))}
				</div>
			</section>
		</div>
	);
}

export default function ContentStudio() {
	const [courseSearch, setCourseSearch] = useState("");
	const [isCourseListOpen, setIsCourseListOpen] = useState(false);
	const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(
		null,
	);
	const [difficulty, setDifficulty] = useState("Chuẩn");
	const [durationMinutes, setDurationMinutes] = useState("45");
	const [gradeLevel, setGradeLevel] = useState("10");
	const [learningObjectives, setLearningObjectives] = useState("");
	const [prerequisites, setPrerequisites] = useState("");
	const [skillIds, setSkillIds] = useState("");
	const [pastedText, setPastedText] = useState("");
	const [sourceError, setSourceError] = useState("");
	const [source, setSource] = useState<SourceDocument | null>(null);
	const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
	const [generationStatus, setGenerationStatus] = useState("");
	const [generationError, setGenerationError] = useState("");

	const upload = useMutation(
		orpc.sourceDocuments.upload.mutationOptions({
			onSuccess: (result) => {
				setSource(result);
				setSourceError("");
			},
		}),
	);
	const paste = useMutation(
		orpc.sourceDocuments.paste.mutationOptions({
			onSuccess: (result) => {
				if (result.type === "success") {
					setSource(result);
					setSourceError("");
					return;
				}
				setSourceError(result.message);
			},
		}),
	);

	const courses = useQuery(
		orpc.courses.search.queryOptions({ input: { query: courseSearch } }),
	);

	const isSavingSource = upload.isPending || paste.isPending;
	const sourceRequestError =
		sourceError || upload.error?.message || paste.error?.message;
	const canGenerate = Boolean(source && selectedCourse && !generationStatus);

	const createDraft = async (): Promise<void> => {
		if (!source || !selectedCourse) {
			return;
		}

		setDraft(null);
		setGenerationError("");
		setGenerationStatus("Đang kết nối với AI…");
		try {
			const stream = await client.contentGeneration.generateLessonDraft({
				courseId: selectedCourse.id,
				documentId: source.documentId,
				metadata: {
					difficulty,
					durationMinutes: Number(durationMinutes),
					gradeLevel: Number(gradeLevel),
					learningObjectives: splitLines(learningObjectives),
					prerequisites: splitLines(prerequisites),
					skillIds: splitCommaSeparated(skillIds),
				},
			});
			for await (const event of stream) {
				if (event.type === "started") {
					setGenerationStatus("Đang tạo bản nháp…");
				}
				if (event.type === "partial") {
					setDraft(event.draft);
					setGenerationStatus("Đang hoàn thiện bài học…");
				}
				if (event.type === "completed") {
					setGenerationStatus("Bản nháp đã sẵn sàng để review.");
				}
				if (event.type === "failed") {
					setGenerationError(event.message);
					setGenerationStatus("");
				}
			}
		} catch (error) {
			setGenerationError(
				error instanceof Error ? error.message : "Không thể tạo bản nháp.",
			);
			setGenerationStatus("");
		}
	};

	return (
		<section className="space-y-4" aria-labelledby="studio-title">
			<header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
				<div>
					<p className="font-medium text-primary text-xs uppercase tracking-widest">
						AI authoring workspace
					</p>
					<h1 className="mt-1 font-semibold text-2xl" id="studio-title">
						Content Studio
					</h1>
				</div>
				<p className="max-w-xl text-muted-foreground text-sm">
					Biến tài liệu nguồn thành học liệu có cấu trúc, kiểm chứng nguồn và
					sẵn sàng cho quy trình review.
				</p>
			</header>
			<div className="grid items-start gap-4 xl:grid-cols-[minmax(24rem,0.8fr)_minmax(0,1.2fr)]">
				<section className="space-y-4" aria-labelledby="source-heading">
					<Card>
						<CardHeader>
							<CardTitle id="source-heading">Nguồn học liệu</CardTitle>
							<CardDescription>
								Tải Markdown hoặc PDF có text, hoặc dán nội dung nguồn.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="source-file">Tệp tài liệu</Label>
								<Input
									accept=".md,.markdown,.pdf,text/markdown,application/pdf"
									disabled={isSavingSource}
									id="source-file"
									onChange={(event) => {
										const file = event.target.files?.[0];
										if (file) upload.mutate({ file });
									}}
									type="file"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="pasted-source">Hoặc dán nội dung</Label>
								<Textarea
									disabled={isSavingSource}
									id="pasted-source"
									onChange={(event) => setPastedText(event.target.value)}
									placeholder="Dán nội dung Markdown hoặc văn bản đã trích xuất…"
									value={pastedText}
								/>
								<Button
									disabled={isSavingSource || !pastedText.trim()}
									onClick={() => paste.mutate({ text: pastedText })}
									type="button"
								>
									Dùng nội dung đã dán
								</Button>
							</div>
							{sourceRequestError && (
								<p className="text-destructive text-sm" role="alert">
									{sourceRequestError}
								</p>
							)}
							{source && (
								<div className="rounded-md border bg-muted/40 p-3 text-sm">
									<p className="font-medium">
										Đã trích xuất {source.chunkCount} đoạn nguồn
									</p>
									<p className="mt-2 whitespace-pre-wrap text-muted-foreground">
										{source.preview}
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Metadata</CardTitle>
							<CardDescription>
								Được lưu cùng bản nháp để phục vụ gợi ý sau này.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="course-search">Khóa học</Label>
								<Input
									aria-autocomplete="list"
									aria-controls="course-options"
									aria-expanded={isCourseListOpen}
									autoComplete="off"
									id="course-search"
									onChange={(event) => {
										setCourseSearch(event.target.value);
										setSelectedCourse(null);
										setIsCourseListOpen(true);
									}}
									onFocus={() => setIsCourseListOpen(true)}
									placeholder="Tìm theo tên khóa học…"
									role="combobox"
									value={selectedCourse?.title ?? courseSearch}
								/>
								{selectedCourse && (
									<p className="text-muted-foreground text-sm">
										Đã chọn: {selectedCourse.title} · Khối{" "}
										{selectedCourse.gradeLevel}
									</p>
								)}
								{isCourseListOpen && (
									<div
										className="max-h-52 overflow-auto rounded-md border bg-background"
										id="course-options"
										role="listbox"
									>
										{courses.isPending && (
											<p
												className="p-3 text-muted-foreground text-sm"
												role="status"
											>
												Đang tải khóa học…
											</p>
										)}
										{courses.isError && (
											<p className="p-3 text-destructive text-sm" role="alert">
												Không thể tải danh sách khóa học.
											</p>
										)}
										{courses.data?.map((course) => (
											<button
												className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
												key={course.id}
												onClick={() => {
													setCourseSearch(course.title);
													setGradeLevel(String(course.gradeLevel));
													setIsCourseListOpen(false);
													setSelectedCourse(course);
												}}
												role="option"
												type="button"
											>
												<span className="font-medium">{course.title}</span>
												<span className="text-muted-foreground">
													Khối {course.gradeLevel}
												</span>
											</button>
										))}
										{courses.data?.length === 0 && !courses.isPending && (
											<p className="p-3 text-muted-foreground text-sm">
												Không tìm thấy khóa học phù hợp.
											</p>
										)}
									</div>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="grade">Khối lớp</Label>
								<Input
									id="grade"
									min="1"
									onChange={(event) => setGradeLevel(event.target.value)}
									type="number"
									value={gradeLevel}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="duration">Thời lượng (phút)</Label>
								<Input
									id="duration"
									min="1"
									onChange={(event) => setDurationMinutes(event.target.value)}
									type="number"
									value={durationMinutes}
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="difficulty">Độ khó</Label>
								<Input
									id="difficulty"
									onChange={(event) => setDifficulty(event.target.value)}
									value={difficulty}
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="objectives">Mục tiêu (mỗi dòng một mục)</Label>
								<Textarea
									id="objectives"
									onChange={(event) =>
										setLearningObjectives(event.target.value)
									}
									value={learningObjectives}
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="prerequisites">
									Kiến thức tiền đề (mỗi dòng một mục)
								</Label>
								<Textarea
									id="prerequisites"
									onChange={(event) => setPrerequisites(event.target.value)}
									value={prerequisites}
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="skills">
									Skill IDs (phân tách bằng dấu phẩy)
								</Label>
								<Input
									id="skills"
									onChange={(event) => setSkillIds(event.target.value)}
									value={skillIds}
								/>
							</div>
						</CardContent>
					</Card>
				</section>

				<section
					aria-labelledby="draft-heading"
					className="xl:sticky xl:top-20"
				>
					<Card className="min-h-[calc(100svh-7rem)]">
						<CardHeader>
							<CardTitle id="draft-heading">Bản nháp AI</CardTitle>
							<CardDescription>
								AI chỉ tạo Draft; nội dung chưa được xuất bản cho học viên.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Button
								disabled={!canGenerate}
								onClick={createDraft}
								type="button"
							>
								Tạo bản nháp
							</Button>
							{generationStatus && (
								<p aria-live="polite" className="text-sm text-muted-foreground">
									{generationStatus}
								</p>
							)}
							{generationError && (
								<p className="text-destructive text-sm" role="alert">
									{generationError}
								</p>
							)}
							{draft ? (
								<LessonDraftPreview draft={draft} />
							) : (
								<p className="text-muted-foreground text-sm">
									Bản nháp có cấu trúc sẽ xuất hiện trong khi AI tạo bài học.
								</p>
							)}
						</CardContent>
					</Card>
				</section>
			</div>
		</section>
	);
}
