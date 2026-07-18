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

import MarkdownContent from "@/components/markdown-content";
import { getLessonMarkdown } from "@/utils/content-markdown";
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

type SourceReferenceGroup = {
	claim: string;
	label: string;
	referenceIds: string[];
};

const getSourceReferenceGroups = (
	draft: Record<string, unknown>,
): SourceReferenceGroup[] => {
	const groups: SourceReferenceGroup[] = [
		{
			claim: asString(draft.summary),
			label: "Tóm tắt",
			referenceIds: asStrings(draft.summary_source_chunk_ids),
		},
	];

	for (const [index, objective] of asRecords(draft.objectives).entries()) {
		groups.push({
			claim: asString(objective.text),
			label: `Mục tiêu ${index + 1}`,
			referenceIds: asStrings(objective.source_chunk_ids),
		});
	}
	for (const [index, question] of asRecords(draft.quiz_questions).entries()) {
		groups.push({
			claim: asString(question.question),
			label: `Câu hỏi ${index + 1}`,
			referenceIds: asStrings(question.source_chunk_ids),
		});
	}
	for (const [index, exercise] of asRecords(draft.exercises).entries()) {
		groups.push({
			claim: asString(exercise.prompt),
			label: `Bài tập ${index + 1}`,
			referenceIds: asStrings(exercise.source_chunk_ids),
		});
	}

	return groups.filter((group) => group.claim || group.referenceIds.length > 0);
};

function SourceReferenceReview({ draft }: { draft: Record<string, unknown> }) {
	const groups = getSourceReferenceGroups(draft);
	const supportedCount = groups.filter(
		(group) => group.referenceIds.length > 0,
	).length;
	const uniqueReferenceCount = new Set(
		groups.flatMap((group) => group.referenceIds),
	).size;

	return (
		<details className="group overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
			<summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20">
				<span>Nguồn kiểm chứng</span>
				<span className="font-medium text-muted-foreground text-xs">
					{supportedCount}/{groups.length} mục có nguồn · {uniqueReferenceCount}{" "}
					đoạn được dùng
				</span>
			</summary>
			<div className="border-t px-5 py-4">
				<p className="mb-3 text-muted-foreground text-xs/relaxed">
					Đối chiếu từng phần của bản nháp với các đoạn tài liệu nguồn trước khi
					gửi duyệt.
				</p>
				<ul className="space-y-2">
					{groups.map((group, index) => (
						<li
							className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[minmax(7rem,0.25fr)_minmax(0,1fr)]"
							key={`${group.label}-${index}`}
						>
							<div>
								<p className="font-semibold text-xs">{group.label}</p>
								<div className="mt-1 flex flex-wrap gap-1">
									{group.referenceIds.length > 0 ? (
										group.referenceIds.map((referenceId) => (
											<span
												className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-[10px] text-emerald-700"
												key={referenceId}
											>
												{referenceId}
											</span>
										))
									) : (
										<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-[10px] text-amber-700">
											Chưa có nguồn
										</span>
									)}
								</div>
							</div>
							<p className="line-clamp-3 text-muted-foreground text-xs/relaxed">
								{group.claim || "Nội dung đang được AI hoàn thiện…"}
							</p>
						</li>
					))}
				</ul>
			</div>
		</details>
	);
}

function LessonDraftPreview({ draft }: { draft: Record<string, unknown> }) {
	const objectives = asRecords(draft.objectives);
	const quizQuestions = asRecords(draft.quiz_questions);
	const exercises = asRecords(draft.exercises);
	const title = asString(draft.title);

	return (
		<div className="space-y-4">
			<section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
				<div className="mb-4 flex items-center justify-between gap-3">
					<div className="p-5 pb-0">
						<p className="font-bold text-primary text-xs uppercase tracking-widest">
							Bản xem trước học viên
						</p>
						<h2 className="mt-2 font-extrabold text-2xl">
							{title || "Đang tạo tiêu đề bài học…"}
						</h2>
					</div>
					<span className="rounded-full bg-primary/10 px-3 py-1 text-primary text-xs">
						Draft
					</span>
				</div>
				<div className="border-t px-5 py-4">
					<MarkdownContent content={getLessonMarkdown(draft)} />
				</div>
			</section>
			<div className="grid grid-cols-3 gap-3">
				{[
					{ label: "Mục tiêu", value: objectives.length },
					{ label: "Câu hỏi", value: quizQuestions.length },
					{ label: "Bài tập", value: exercises.length },
				].map((metric) => (
					<div
						className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center"
						key={metric.label}
					>
						<p className="font-extrabold text-primary text-xl">
							{metric.value}
						</p>
						<p className="text-muted-foreground text-xs">{metric.label}</p>
					</div>
				))}
			</div>
			<SourceReferenceReview draft={draft} />
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
	const [isGenerating, setIsGenerating] = useState(false);
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
	const canGenerate = Boolean(
		source && selectedCourse && !isGenerating && !isSavingSource,
	);

	const createDraft = async (): Promise<void> => {
		if (!source || !selectedCourse) {
			return;
		}

		setDraft(null);
		setIsGenerating(true);
		setGenerationError("");
		setGenerationStatus("Đang kết nối với AI…");
		try {
			let receivedTerminalEvent = false;
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
					receivedTerminalEvent = true;
					setGenerationStatus("Bản nháp đã sẵn sàng để review.");
				}
				if (event.type === "failed") {
					receivedTerminalEvent = true;
					setGenerationError(event.message);
					setGenerationStatus("");
				}
			}
			if (!receivedTerminalEvent) {
				setGenerationError(
					"Luồng tạo bản nháp đã kết thúc sớm. Bạn có thể thử tạo lại.",
				);
				setGenerationStatus("");
			}
		} catch (error) {
			setGenerationError(
				error instanceof Error ? error.message : "Không thể tạo bản nháp.",
			);
			setGenerationStatus("");
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<section className="space-y-5" aria-labelledby="studio-title">
			<header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50/60 p-5 shadow-sm">
				<div>
					<p className="font-medium text-primary text-xs uppercase tracking-widest">
						AI authoring workspace
					</p>
					<h1 className="mt-1 font-semibold text-2xl" id="studio-title">
						Tạo bài học từ tài liệu
					</h1>
				</div>
				<p className="max-w-xl text-muted-foreground text-sm">
					Tải tài liệu, chọn khóa học và để AI tạo bản nháp. Các thiết lập nâng
					cao là tùy chọn.
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Bắt đầu với tài liệu của bạn</CardTitle>
					<CardDescription>
						Chỉ cần hoàn thành hai trường bên dưới để tạo bài học.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="grid gap-5 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="source-file">1. Tài liệu nguồn</Label>
							<Input
								accept=".md,.markdown,.pdf,text/markdown,application/pdf"
								disabled={isSavingSource}
								id="source-file"
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file) {
										upload.mutate({ file });
									}
								}}
								type="file"
							/>
							<p className="text-muted-foreground text-xs">
								Chấp nhận Markdown hoặc PDF có thể trích xuất văn bản.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="course-search">2. Khóa học nhận bài học</Label>
							<Input
								aria-autocomplete="list"
								aria-controls="course-options"
								aria-expanded={isCourseListOpen}
								autoComplete="off"
								disabled={isGenerating}
								id="course-search"
								onChange={(event) => {
									setCourseSearch(event.target.value);
									setSelectedCourse(null);
									setIsCourseListOpen(true);
								}}
								onFocus={() => setIsCourseListOpen(true)}
								placeholder="Tìm và chọn khóa học…"
								role="combobox"
								value={selectedCourse?.title ?? courseSearch}
							/>
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
										<div
											className="flex items-center justify-between gap-2 p-3 text-destructive text-sm"
											role="alert"
										>
											<span>Không thể tải danh sách khóa học.</span>
											<Button
												onClick={() => void courses.refetch()}
												size="sm"
												type="button"
												variant="outline"
											>
												Thử lại
											</Button>
										</div>
									)}
									{courses.data?.map((course) => (
										<button
											aria-selected={selectedCourse?.id === course.id}
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
							{selectedCourse && (
								<p className="text-muted-foreground text-xs">
									Đã chọn: {selectedCourse.title} · Khối{" "}
									{selectedCourse.gradeLevel}
								</p>
							)}
						</div>
					</div>

					{sourceRequestError && (
						<p className="text-destructive text-sm" role="alert">
							{sourceRequestError}
						</p>
					)}
					{source && (
						<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
							<p className="font-medium text-emerald-800">
								Tài liệu đã sẵn sàng · {source.chunkCount} đoạn nguồn đã trích
								xuất
							</p>
							<p className="mt-1 line-clamp-2 whitespace-pre-wrap text-emerald-700">
								{source.preview}
							</p>
						</div>
					)}

					<details className="rounded-xl border px-4 py-3">
						<summary className="cursor-pointer font-medium text-sm">
							Tùy chỉnh bài học (không bắt buộc)
						</summary>
						<div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
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
							<div className="space-y-2 sm:col-span-2">
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
									variant="outline"
								>
									Dùng nội dung đã dán
								</Button>
							</div>
						</div>
					</details>

					<Button
						className="w-full sm:w-auto"
						disabled={!canGenerate}
						onClick={createDraft}
						type="button"
					>
						{isGenerating ? "Đang tạo bản nháp…" : "Tạo bài học với AI"}
					</Button>
					{!canGenerate && !isGenerating && (
						<p className="text-muted-foreground text-sm">
							{source
								? "Chọn khóa học để tạo bài học."
								: "Tải tài liệu để tiếp tục."}
						</p>
					)}
				</CardContent>
			</Card>

			{(isGenerating || generationStatus || generationError || draft) && (
				<section aria-labelledby="draft-heading">
					<Card aria-busy={isGenerating} className="min-h-[20rem]">
						<CardHeader>
							<CardTitle id="draft-heading">Bản nháp AI</CardTitle>
							<CardDescription>
								AI chỉ tạo Draft; nội dung chưa được xuất bản cho học viên.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{generationStatus && (
								<p aria-live="polite" className="text-sm text-muted-foreground">
									{generationStatus}
								</p>
							)}
							{generationError && (
								<div className="space-y-3">
									<p className="text-destructive text-sm" role="alert">
										{generationError}
									</p>
									<Button
										disabled={!canGenerate}
										onClick={createDraft}
										type="button"
									>
										Thử tạo lại
									</Button>
								</div>
							)}
							{draft ? (
								<LessonDraftPreview draft={draft} />
							) : !generationError ? (
								<p className="text-muted-foreground text-sm">
									Bản nháp có cấu trúc sẽ xuất hiện trong khi AI tạo bài học.
								</p>
							) : null}
						</CardContent>
					</Card>
				</section>
			)}
		</section>
	);
}
