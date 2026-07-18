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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@MindBridge/ui/components/tooltip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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

type SourceChunk = {
	id: string;
	ordinal: number;
	pageFrom: number | null;
	pageTo: number | null;
	text: string;
};

const EMPTY_DOCUMENT_ID = "00000000-0000-0000-0000-000000000000";

type CourseOption = {
	gradeLevel: number | null;
	id: string;
	title: string;
};

type ClassroomOption = {
	courseId: string;
	courseTitle: string;
	id: string;
	name: string;
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

function SourceReferenceReview({
	draft,
	sourceChunks,
}: {
	draft: Record<string, unknown>;
	sourceChunks: SourceChunk[];
}) {
	const groups = getSourceReferenceGroups(draft);
	const supportedCount = groups.filter(
		(group) => group.referenceIds.length > 0,
	).length;
	const uniqueReferenceCount = new Set(
		groups.flatMap((group) => group.referenceIds),
	).size;
	const sourceChunkById = new Map(
		sourceChunks.map((sourceChunk) => [sourceChunk.id, sourceChunk]),
	);

	return (
		<TooltipProvider>
			<details className="group overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
				<summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20">
					<span>Nguồn kiểm chứng</span>
					<span className="font-medium text-muted-foreground text-xs">
						{supportedCount}/{groups.length} mục có nguồn ·{" "}
						{uniqueReferenceCount} đoạn được dùng
					</span>
				</summary>
				<div className="border-t px-5 py-4">
					<p className="mb-3 text-muted-foreground text-xs/relaxed">
						Hover hoặc focus vào một nguồn để xem đoạn tài liệu AI đã dùng.
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
										{group.referenceIds.map((referenceId) => {
											const sourceChunk = sourceChunkById.get(referenceId);
											if (!sourceChunk) {
												return null;
											}
											const sourceLabel = String(sourceChunk.ordinal + 1);
											const pageLabel =
												sourceChunk.pageFrom && sourceChunk.pageTo
													? `Trang ${sourceChunk.pageFrom}–${sourceChunk.pageTo}`
													: sourceChunk.pageFrom
														? `Trang ${sourceChunk.pageFrom}`
														: null;
											return (
												<Tooltip key={referenceId}>
													<TooltipTrigger
														className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-[10px] text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														render={<button type="button" />}
													>
														{sourceLabel}
													</TooltipTrigger>
													<TooltipContent className="max-w-md items-start text-left text-xs/relaxed">
														<div>
															<p className="font-semibold">
																Đoạn nguồn {sourceLabel}
																{pageLabel ? ` · ${pageLabel}` : ""}
															</p>
															<p className="mt-1 line-clamp-6">
																{sourceChunk.text}
															</p>
														</div>
													</TooltipContent>
												</Tooltip>
											);
										})}
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
		</TooltipProvider>
	);
}

function LessonDraftPreview({
	draft,
	sourceChunks,
}: {
	draft: Record<string, unknown>;
	sourceChunks: SourceChunk[];
}) {
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
						Bản nháp
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
			<SourceReferenceReview draft={draft} sourceChunks={sourceChunks} />
		</div>
	);
}

type GenerationContent = {
	referenceIds: string[];
	text: string;
};

type GenerationStage = {
	content: GenerationContent[];
	description: string;
	id: string;
	isReady: boolean;
	label: string;
	readyLabel: string;
};

export function StructuredGenerationProgress({
	draft,
	isComplete,
	sourceChunks = [],
}: {
	draft: Record<string, unknown> | null;
	isComplete: boolean;
	sourceChunks?: SourceChunk[];
}) {
	const objectives = asRecords(draft?.objectives);
	const quizQuestions = asRecords(draft?.quiz_questions);
	const exercises = asRecords(draft?.exercises);
	const sourceChunkById = new Map(
		sourceChunks.map((sourceChunk) => [sourceChunk.id, sourceChunk]),
	);
	const stages: GenerationStage[] = [
		{
			content: [
				{ referenceIds: [], text: asString(draft?.title) },
				{
					referenceIds: asStrings(draft?.summary_source_chunk_ids),
					text: asString(draft?.summary),
				},
			].filter((content) => content.text),
			description: asString(draft?.title)
				? "Khung bài học đã có tiêu đề và tóm tắt."
				: "Đang xác định chủ đề và nội dung trọng tâm.",
			id: "outline",
			isReady: Boolean(asString(draft?.title) && asString(draft?.summary)),
			label: "Khung bài học",
			readyLabel: "Đã tạo khung bài học",
		},
		{
			content: objectives
				.map((objective) => ({
					referenceIds: asStrings(objective.source_chunk_ids),
					text: asString(objective.text),
				}))
				.filter((content) => content.text),
			description:
				objectives.length > 0
					? `Đã tạo ${objectives.length} mục tiêu học tập.`
					: "Đang xác định kết quả học tập.",
			id: "objectives",
			isReady: objectives.length > 0,
			label: "Mục tiêu học tập",
			readyLabel: `Đã tạo ${objectives.length} mục tiêu`,
		},
		{
			content: quizQuestions
				.map((question) => {
					const options = asStrings(question.options).map(
						(option, optionIndex) =>
							`${String.fromCharCode(65 + optionIndex)}. ${option}`,
					);
					return {
						referenceIds: asStrings(question.source_chunk_ids),
						text: [
							asString(question.question),
							...options,
							question.correct_answer
								? `Đáp án: ${asString(question.correct_answer)}`
								: "",
							question.explanation
								? `Giải thích: ${asString(question.explanation)}`
								: "",
						]
							.filter(Boolean)
							.join("\n"),
					};
				})
				.filter((content) => content.text),
			description:
				quizQuestions.length > 0
					? `Đã tạo ${quizQuestions.length} câu hỏi kiểm tra.`
					: "Đang soạn câu hỏi để kiểm tra kiến thức.",
			id: "quiz",
			isReady: quizQuestions.length > 0,
			label: "Câu hỏi kiểm tra",
			readyLabel: `Đã tạo ${quizQuestions.length} câu hỏi`,
		},
		{
			content: exercises
				.map((exercise) => ({
					referenceIds: asStrings(exercise.source_chunk_ids),
					text: [
						asString(exercise.prompt),
						exercise.expected_answer
							? `Đáp án tham khảo: ${asString(exercise.expected_answer)}`
							: "",
						exercise.explanation
							? `Giải thích: ${asString(exercise.explanation)}`
							: "",
					]
						.filter(Boolean)
						.join("\n"),
				}))
				.filter((content) => content.text),
			description:
				exercises.length > 0
					? `Đã tạo ${exercises.length} bài tập vận dụng.`
					: "Đang thiết kế bài tập vận dụng.",
			id: "exercises",
			isReady: exercises.length > 0,
			label: "Bài tập vận dụng",
			readyLabel: `Đã tạo ${exercises.length} bài tập`,
		},
	];
	const activeStageIndex = isComplete
		? -1
		: stages.findIndex((stage) => !stage.isReady);

	return (
		<TooltipProvider>
			<ol
				aria-label="Tiến trình tạo bài học"
				className="grid gap-3 sm:grid-cols-2"
			>
				{stages.map((stage, index) => {
					const isActive = index === activeStageIndex;
					const isReady = isComplete || stage.isReady;
					return (
						<li
							className={`rounded-xl border p-4 transition ${
								isReady
									? "border-emerald-200 bg-emerald-50"
									: isActive
										? "border-primary/30 bg-primary/5"
										: "border-border bg-muted/20"
							}`}
							key={stage.id}
						>
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<span
										className={`flex size-6 items-center justify-center rounded-full font-bold text-xs ${
											isReady
												? "bg-emerald-600 text-white"
												: isActive
													? "animate-pulse bg-primary text-primary-foreground"
													: "bg-muted text-muted-foreground"
										}`}
									>
										{isReady ? "✓" : index + 1}
									</span>
									<p className="font-semibold text-sm">{stage.label}</p>
								</div>
								<span className="text-muted-foreground text-xs">
									{isReady
										? stage.readyLabel
										: isActive
											? "Đang tạo"
											: "Đang chờ"}
								</span>
							</div>
							{stage.content.length > 0 ? (
								<ul className="mt-3 space-y-1 border-primary/10 border-t pt-3 text-xs/relaxed">
									{stage.content.map((content, contentIndex) => (
										<li key={`${stage.id}-${contentIndex}`}>
											<div className="flex flex-wrap items-start gap-2">
												<p className="whitespace-pre-line text-foreground">
													{stage.id === "outline"
														? content.text
														: stage.id === "quiz"
															? `Câu ${contentIndex + 1}. ${content.text}`
															: stage.id === "exercises"
																? `Bài tập ${contentIndex + 1}. ${content.text}`
																: `• ${content.text}`}
												</p>
												{stage.id === "quiz" || stage.id === "exercises"
													? content.referenceIds.map((referenceId) => {
															const sourceChunk =
																sourceChunkById.get(referenceId);
															if (!sourceChunk) {
																return null;
															}
															const sourceLabel = String(
																sourceChunk.ordinal + 1,
															);
															return (
																<Tooltip key={referenceId}>
																	<TooltipTrigger
																		className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-[10px] text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																		render={<button type="button" />}
																	>
																		{sourceLabel}
																	</TooltipTrigger>
																	<TooltipContent className="max-w-md items-start text-left text-xs/relaxed">
																		<div>
																			<p className="font-semibold">
																				Đoạn nguồn {sourceLabel}
																			</p>
																			<p className="mt-1 line-clamp-6">
																				{sourceChunk.text}
																			</p>
																		</div>
																	</TooltipContent>
																</Tooltip>
															);
														})
													: null}
											</div>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-2 text-muted-foreground text-xs/relaxed">
									{stage.description}
								</p>
							)}
						</li>
					);
				})}
			</ol>
		</TooltipProvider>
	);
}

export default function ContentStudio({
	canAssign = false,
}: {
	canAssign?: boolean;
}) {
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
	const [customInstructions, setCustomInstructions] = useState("");
	const [pastedText, setPastedText] = useState("");
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [sourceError, setSourceError] = useState("");
	const [source, setSource] = useState<SourceDocument | null>(null);
	const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
	const [generatedContent, setGeneratedContent] = useState<{
		contentVersionId: string;
	} | null>(null);
	const [selectedClassroomId, setSelectedClassroomId] = useState("");
	const [assignmentDueAt, setAssignmentDueAt] = useState("");
	const [assignmentError, setAssignmentError] = useState("");
	const [assignmentStatus, setAssignmentStatus] = useState("");
	const [attachError, setAttachError] = useState("");
	const [attachStatus, setAttachStatus] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [editSummary, setEditSummary] = useState("");
	const [editObjectives, setEditObjectives] = useState<string[]>([]);
	const [editError, setEditError] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [isGenerationComplete, setIsGenerationComplete] = useState(false);
	const [generationStatus, setGenerationStatus] = useState("");
	const [generationError, setGenerationError] = useState("");

	const upload = useMutation(
		orpc.sourceDocuments.upload.mutationOptions({
			onSuccess: (result) => {
				setSource(result);
				setSourceError("");
				setPendingFile(null);
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

	const classrooms = useQuery(
		orpc.teacher.listClassrooms.queryOptions({
			enabled: canAssign,
			input: {},
		}),
	);

	const publishAndAssign = useMutation(
		orpc.teacher.publishAndAssignGeneratedLesson.mutationOptions({
			onSuccess: () => {
				setAssignmentError("");
				setAssignmentStatus(
					"Đã xuất bản, thêm vào khóa học và giao bài cho lớp.",
				);
			},
			onError: (error) => {
				setAssignmentError(error.message);
			},
		}),
	);

	const addToCourse = useMutation(
		orpc.contentWorkflow.addGeneratedToCourse.mutationOptions({
			onError: (error) => setAttachError(error.message),
			onSuccess: () => {
				setAttachError("");
				setAttachStatus("Đã xuất bản và thêm vào khóa học.");
			},
		}),
	);
	const editDraft = useMutation(
		orpc.contentWorkflow.editGeneratedDraft.mutationOptions({
			onError: (error) => setEditError(error.message),
		}),
	);

	const startEditing = (): void => {
		if (!draft) {
			return;
		}
		setEditError("");
		setEditTitle(asString(draft.title));
		setEditSummary(asString(draft.summary));
		setEditObjectives(
			asRecords(draft.objectives).map((objective) => asString(objective.text)),
		);
		setIsEditing(true);
	};

	const saveEdits = async (): Promise<void> => {
		if (!(draft && generatedContent)) {
			return;
		}
		const trimmedTitle = editTitle.trim();
		if (!trimmedTitle) {
			setEditError("Tiêu đề không được để trống.");
			return;
		}
		const nextBody = {
			...draft,
			objectives: asRecords(draft.objectives).map((objective, index) => ({
				...objective,
				text: editObjectives[index] ?? asString(objective.text),
			})),
			summary: editSummary,
			title: trimmedTitle,
		};
		setEditError("");
		try {
			await editDraft.mutateAsync({
				body: nextBody,
				contentVersionId: generatedContent.contentVersionId,
				title: trimmedTitle,
			});
			setDraft(nextBody);
			setIsEditing(false);
		} catch {
			// editError is set by the mutation onError handler.
		}
	};

	const sourceDetail = useQuery(
		orpc.sourceDocuments.detail.queryOptions({
			enabled: Boolean(source && isGenerationComplete),
			input: { documentId: source?.documentId ?? EMPTY_DOCUMENT_ID },
		}),
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
		setGeneratedContent(null);
		setSelectedClassroomId("");
		setAssignmentError("");
		setAssignmentStatus("");
		setAttachError("");
		setAttachStatus("");
		setIsEditing(false);
		setEditError("");
		setIsGenerationComplete(false);
		setIsGenerating(true);
		setGenerationError("");
		setGenerationStatus("Đang kết nối với AI…");
		try {
			let receivedTerminalEvent = false;
			const stream = await client.contentGeneration.generateLessonDraft({
				courseId: selectedCourse.id,
				customInstructions: customInstructions.trim() || undefined,
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
					setGenerationStatus("Đang cập nhật cấu trúc bài học…");
				}
				if (event.type === "completed") {
					receivedTerminalEvent = true;
					setDraft(event.draft);
					setGeneratedContent({
						contentVersionId: event.contentVersionId,
					});
					setGenerationStatus("Bản nháp đã sẵn sàng để review.");
					setIsGenerationComplete(true);
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
						Khu vực soạn bài với AI
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
							<Label htmlFor="source-file">
								1. Tài liệu nguồn{" "}
								<span aria-hidden="true" className="text-destructive">
									*
								</span>
								<span className="sr-only"> bắt buộc</span>
							</Label>
							<Input
								accept=".md,.markdown,.pdf,text/markdown,application/pdf"
								disabled={isSavingSource}
								id="source-file"
								onChange={(event) => {
									const file = event.target.files?.[0] ?? null;
									setPendingFile(file);
									setSource(null);
									setSourceError("");
								}}
								type="file"
							/>
							<p className="text-muted-foreground text-xs">
								Chấp nhận Markdown hoặc PDF có thể trích xuất văn bản.
							</p>
							{pendingFile ? (
								<Button
									className="w-full sm:w-auto"
									disabled={isSavingSource}
									onClick={() => upload.mutate({ file: pendingFile })}
									type="button"
									variant="outline"
								>
									{upload.isPending ? (
										<>
											<Loader2
												aria-hidden="true"
												className="animate-spin"
												data-icon="inline-start"
											/>
											Đang xử lý tài liệu…
										</>
									) : (
										"Xử lý tài liệu"
									)}
								</Button>
							) : null}
							{isSavingSource ? (
								<div
									aria-live="polite"
									className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-primary text-sm"
									role="status"
								>
									<Loader2 aria-hidden="true" className="size-4 animate-spin" />
									<span>
										AI đang đọc và trích xuất nội dung tài liệu, vui lòng đợi…
									</span>
								</div>
							) : null}
						</div>
						<div className="space-y-2">
							<Label htmlFor="course-search">
								2. Khóa học nhận bài học{" "}
								<span aria-hidden="true" className="text-destructive">
									*
								</span>
								<span className="sr-only"> bắt buộc</span>
							</Label>
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
												setSelectedClassroomId("");
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
									Đã chọn: {selectedCourse.title}
									{selectedCourse.gradeLevel
										? ` · Khối ${selectedCourse.gradeLevel}`
										: ""}
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
									Mã kỹ năng liên quan (phân tách bằng dấu phẩy)
								</Label>
								<Input
									id="skills"
									onChange={(event) => setSkillIds(event.target.value)}
									placeholder="Để trống nếu chưa gắn kỹ năng"
									value={skillIds}
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label htmlFor="custom-instructions">
									Yêu cầu riêng cho AI (không bắt buộc)
								</Label>
								<Textarea
									id="custom-instructions"
									maxLength={2000}
									onChange={(event) =>
										setCustomInstructions(event.target.value)
									}
									placeholder="Ví dụ: Tập trung vào ví dụ thực tế, giọng văn thân thiện, thêm nhiều câu hỏi vận dụng…"
									value={customInstructions}
								/>
								<p className="text-muted-foreground text-xs">
									AI vẫn chỉ dùng dữ kiện trong tài liệu nguồn.
								</p>
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
									{paste.isPending ? (
										<>
											<Loader2
												aria-hidden="true"
												className="animate-spin"
												data-icon="inline-start"
											/>
											Đang xử lý…
										</>
									) : (
										"Dùng nội dung đã dán"
									)}
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
						{isGenerating ? (
							<>
								<Loader2
									aria-hidden="true"
									className="animate-spin"
									data-icon="inline-start"
								/>
								Đang tạo bản nháp…
							</>
						) : (
							"Tạo bài học với AI"
						)}
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
							<CardTitle id="draft-heading">
								{isGenerationComplete
									? "Bản nháp AI"
									: "AI đang xây dựng bài học"}
							</CardTitle>
							<CardDescription>
								AI tạo từng phần của bài học theo cấu trúc trước khi lưu bản
								nháp.
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
							{!generationError && (
								<StructuredGenerationProgress
									draft={draft}
									isComplete={isGenerationComplete}
									sourceChunks={sourceDetail.data?.chunks ?? []}
								/>
							)}
							{isGenerationComplete && draft ? (
								isEditing ? (
									<div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
										<h3 className="font-semibold">Chỉnh sửa nội dung</h3>
										<div className="space-y-2">
											<Label htmlFor="edit-title">Tiêu đề</Label>
											<Input
												disabled={editDraft.isPending}
												id="edit-title"
												onChange={(event) => setEditTitle(event.target.value)}
												value={editTitle}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="edit-summary">Tóm tắt</Label>
											<Textarea
												disabled={editDraft.isPending}
												id="edit-summary"
												onChange={(event) => setEditSummary(event.target.value)}
												value={editSummary}
											/>
										</div>
										{editObjectives.length > 0 ? (
											<div className="space-y-2">
												<Label>Mục tiêu học tập</Label>
												{editObjectives.map((objective, index) => (
													<Input
														disabled={editDraft.isPending}
														key={`edit-objective-${index}`}
														onChange={(event) =>
															setEditObjectives((current) =>
																current.map((item, itemIndex) =>
																	itemIndex === index
																		? event.target.value
																		: item,
																),
															)
														}
														value={objective}
													/>
												))}
											</div>
										) : null}
										{editError ? (
											<p className="text-destructive text-sm" role="alert">
												{editError}
											</p>
										) : null}
										<div className="flex flex-wrap gap-3">
											<Button
												disabled={editDraft.isPending}
												onClick={saveEdits}
												type="button"
											>
												{editDraft.isPending ? "Đang lưu…" : "Lưu thay đổi"}
											</Button>
											<Button
												disabled={editDraft.isPending}
												onClick={() => setIsEditing(false)}
												type="button"
												variant="outline"
											>
												Hủy
											</Button>
										</div>
										<p className="text-muted-foreground text-xs">
											Lưu ý: câu hỏi kiểm tra tương tác được tạo lúc sinh bài;
											sửa ở đây chỉ đổi nội dung hiển thị.
										</p>
									</div>
								) : (
									<LessonDraftPreview
										draft={draft}
										sourceChunks={sourceDetail.data?.chunks ?? []}
									/>
								)
							) : !generationError ? (
								<p className="text-muted-foreground text-sm">
									Bản xem trước sẽ mở khi AI hoàn tất cấu trúc bài học.
								</p>
							) : null}
							{isGenerationComplete && generatedContent && draft ? (
								<div className="space-y-3 border-t pt-4">
									<div className="flex flex-wrap gap-3">
										<Button
											disabled={
												isEditing ||
												addToCourse.isPending ||
												publishAndAssign.isPending ||
												Boolean(attachStatus) ||
												Boolean(assignmentStatus)
											}
											onClick={() => {
												setAttachError("");
												addToCourse.mutate({
													contentVersionId: generatedContent.contentVersionId,
												});
											}}
											type="button"
										>
											{addToCourse.isPending ? "Đang gắn…" : "Gắn vào khóa học"}
										</Button>
										<Button
											disabled={
												isEditing ||
												Boolean(attachStatus) ||
												Boolean(assignmentStatus)
											}
											onClick={startEditing}
											type="button"
											variant="outline"
										>
											Chỉnh sửa nội dung
										</Button>
										<Button
											disabled={
												isEditing ||
												!canGenerate ||
												Boolean(attachStatus) ||
												Boolean(assignmentStatus)
											}
											onClick={createDraft}
											type="button"
											variant="outline"
										>
											Tạo lại bản nháp
										</Button>
									</div>
									{attachError ? (
										<p className="text-destructive text-sm" role="alert">
											{attachError}
										</p>
									) : null}
									{attachStatus ? (
										<p className="text-emerald-700 text-sm" role="status">
											{attachStatus}
										</p>
									) : null}
								</div>
							) : null}
							{canAssign &&
							isGenerationComplete &&
							generatedContent &&
							draft ? (
								<section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
									<div>
										<h3 className="font-semibold">Giao ngay cho lớp</h3>
										<p className="mt-1 text-muted-foreground text-sm">
											Xác nhận lớp và hạn nộp. Hệ thống sẽ tự xuất bản bài học,
											thêm vào khóa học và giao cho học viên.
										</p>
									</div>
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="assignment-classroom">Lớp học</Label>
											<select
												className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
												disabled={publishAndAssign.isPending}
												id="assignment-classroom"
												onChange={(event) =>
													setSelectedClassroomId(event.target.value)
												}
												value={selectedClassroomId}
											>
												<option value="">Chọn lớp để giao…</option>
												{classrooms.data
													?.filter(
														(classroom: ClassroomOption) =>
															classroom.courseId === selectedCourse?.id,
													)
													.map((classroom: ClassroomOption) => (
														<option key={classroom.id} value={classroom.id}>
															{classroom.name} · {classroom.courseTitle}
														</option>
													))}
											</select>
											{classrooms.isError ? (
												<p className="text-destructive text-sm" role="alert">
													Không thể tải lớp học của bạn.
												</p>
											) : null}
											{!classrooms.isPending &&
											selectedCourse &&
											(classrooms.data?.filter(
												(classroom: ClassroomOption) =>
													classroom.courseId === selectedCourse.id,
											).length ?? 0) === 0 ? (
												<p className="text-muted-foreground text-sm">
													Bạn chưa có lớp nào cho khóa học này.
												</p>
											) : null}
										</div>
										<div className="space-y-2">
											<Label htmlFor="assignment-due-date">
												Hạn nộp (không bắt buộc)
											</Label>
											<Input
												disabled={publishAndAssign.isPending}
												id="assignment-due-date"
												onChange={(event) =>
													setAssignmentDueAt(event.target.value)
												}
												type="date"
												value={assignmentDueAt}
											/>
										</div>
									</div>
									{assignmentError ? (
										<p className="text-destructive text-sm" role="alert">
											{assignmentError}
										</p>
									) : null}
									{assignmentStatus ? (
										<p className="text-emerald-700 text-sm" role="status">
											{assignmentStatus}
										</p>
									) : null}
									<Button
										disabled={
											!selectedClassroomId ||
											publishAndAssign.isPending ||
											Boolean(assignmentStatus) ||
											Boolean(attachStatus)
										}
										onClick={() => {
											setAssignmentError("");
											publishAndAssign.mutate({
												classroomId: selectedClassroomId,
												contentVersionId: generatedContent.contentVersionId,
												dueAt: assignmentDueAt
													? new Date(`${assignmentDueAt}T23:59:59`)
													: undefined,
											});
										}}
										type="button"
									>
										{publishAndAssign.isPending
											? "Đang giao bài…"
											: "Xuất bản và giao cho lớp"}
									</Button>
								</section>
							) : null}
						</CardContent>
					</Card>
				</section>
			)}
		</section>
	);
}
