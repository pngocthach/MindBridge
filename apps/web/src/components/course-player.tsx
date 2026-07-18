import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@MindBridge/ui/components/empty";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	CheckCircle2,
	Clock3,
	GraduationCap,
	Send,
	ShieldAlert,
	Sparkles,
	X,
} from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import MarkdownContent from "@/components/markdown-content";
import {
	contentValueToText,
	getLessonMarkdown,
} from "@/utils/content-markdown";
import { orpc } from "@/utils/orpc";

type TutorReply = {
	followUpQuestion: string;
	introduction: string;
	steps: { content: string; title: string }[];
};

type ChatMessage =
	| { content: string; id: number; role: "learner" }
	| { content: TutorReply; id: number; role: "tutor" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const getMetadataNumber = (
	metadata: unknown,
	key: string,
): number | undefined => {
	if (!isRecord(metadata)) {
		return undefined;
	}
	const value = metadata[key];
	return typeof value === "number" ? value : undefined;
};

const getMetadataStrings = (metadata: unknown, key: string): string[] => {
	if (!isRecord(metadata) || !Array.isArray(metadata[key])) {
		return [];
	}
	return metadata[key].filter(
		(value): value is string => typeof value === "string",
	);
};

const getSkillLevel = (
	metadata: unknown,
): "advanced" | "beginner" | "intermediate" => {
	if (!isRecord(metadata)) {
		return "beginner";
	}
	const difficulty = metadata.difficulty;
	return difficulty === "advanced" || difficulty === "intermediate"
		? difficulty
		: "beginner";
};

export function CoursePlayer({
	classroomId,
	initialContentId,
}: {
	classroomId: string;
	initialContentId: string | undefined;
}) {
	const queryClient = useQueryClient();
	const course = useQuery(
		orpc.learner.getCourse.queryOptions({ input: { classroomId } }),
	);
	const [selectedContentId, setSelectedContentId] = useState<
		string | undefined
	>(initialContentId);
	const [isMiloOpen, setIsMiloOpen] = useState(false);
	const completeLesson = useMutation(
		orpc.learner.completeLesson.mutationOptions({
			onError: () => toast.error("Không thể cập nhật tiến độ. Hãy thử lại."),
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: orpc.learner.getCourse.key({ input: { classroomId } }),
					}),
					queryClient.invalidateQueries({
						queryKey: orpc.learner.listCourses.key(),
					}),
				]);
				toast.success("Đã lưu tiến độ bài học.");
			},
		}),
	);

	if (course.isPending) {
		return <Loader />;
	}

	if (course.isError) {
		return (
			<div
				className="border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<p className="font-medium">Không thể mở khóa học này.</p>
			</div>
		);
	}

	const courseData = course.data;
	if (!courseData || courseData.content.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyTitle>Khóa học chưa có bài đã xuất bản</EmptyTitle>
					<EmptyDescription>
						Bạn sẽ có thể bắt đầu khi giáo viên xuất bản nội dung.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const currentContentId =
		selectedContentId ??
		courseData.resumeContentId ??
		courseData.content[0].contentId;
	const currentIndex = Math.max(
		0,
		courseData.content.findIndex((item) => item.contentId === currentContentId),
	);
	const currentLesson = courseData.content[currentIndex];
	const previousLesson = courseData.content[currentIndex - 1];
	const nextLesson = courseData.content[currentIndex + 1];
	const progressPercent =
		courseData.totalCount === 0
			? 0
			: Math.round((courseData.completedCount / courseData.totalCount) * 100);

	const handleComplete = () => {
		if (!(currentLesson.isCompleted || completeLesson.isPending)) {
			completeLesson.mutate({
				classroomId,
				contentId: currentLesson.contentId,
			});
		}
	};

	return (
		<div className="min-w-0 space-y-6">
			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<CardTitle>{courseData.courseTitle}</CardTitle>
							<CardDescription className="mt-1">
								{courseData.classroomName}
								{courseData.courseDescription
									? ` · ${courseData.courseDescription}`
									: ""}
							</CardDescription>
						</div>
						<p className="text-muted-foreground text-xs">
							{courseData.completedCount}/{courseData.totalCount} bài
						</p>
					</div>
					<div
						aria-label={`Tiến độ ${courseData.courseTitle}`}
						aria-valuemax={100}
						aria-valuemin={0}
						aria-valuenow={progressPercent}
						className="h-2 overflow-hidden rounded-full bg-muted"
						role="progressbar"
					>
						<div
							className="h-full rounded-full bg-primary"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
				</CardHeader>
				<CardContent>
					<ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{courseData.content.map((item, index) => (
							<li key={item.contentId}>
								<button
									aria-current={
										item.contentId === currentLesson.contentId
											? "step"
											: undefined
									}
									className={`flex h-full w-full items-start gap-2 border p-3 text-left text-xs ${
										item.contentId === currentLesson.contentId
											? "border-primary bg-primary/5"
											: "hover:border-primary/50"
									}`}
									onClick={() => setSelectedContentId(item.contentId)}
									type="button"
								>
									<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
										{item.isCompleted ? (
											<Check aria-label="Đã hoàn thành" className="size-3" />
										) : (
											index + 1
										)}
									</span>
									<span>{item.title}</span>
								</button>
							</li>
						))}
					</ol>
				</CardContent>
			</Card>

			<div>
				<LessonCard
					contentVersionId={currentLesson.contentVersionId}
					currentIndex={currentIndex}
					isCompleting={completeLesson.isPending}
					lesson={currentLesson}
					nextTitle={nextLesson?.title}
					onComplete={handleComplete}
					onNext={
						nextLesson
							? () => setSelectedContentId(nextLesson.contentId)
							: undefined
					}
					onPrevious={
						previousLesson
							? () => setSelectedContentId(previousLesson.contentId)
							: undefined
					}
					onQuizSubmitted={() =>
						completeLesson.mutate({
							classroomId,
							contentId: currentLesson.contentId,
						})
					}
					previousTitle={previousLesson?.title}
					totalCount={courseData.totalCount}
				/>
			</div>

			<button
				aria-controls="milo-assistant"
				aria-expanded={isMiloOpen}
				aria-label="Mở trợ giảng AI Milo"
				className="group fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-full border border-primary/20 bg-primary px-4 py-3 text-primary-foreground shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
				onClick={() => setIsMiloOpen(true)}
				type="button"
			>
				<span className="relative flex size-12 items-center justify-center overflow-hidden rounded-full bg-white">
					<span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
					<img
						alt=""
						aria-hidden="true"
						className="relative mt-3 w-10 scale-125"
						height="1536"
						src="/images/milo-mascot.png"
						width="1024"
					/>
				</span>
				<span className="hidden text-left sm:block">
					<span className="block font-semibold text-sm">Milo AI</span>
					<span className="block text-primary-foreground/80 text-xs">
						Hỏi trợ giảng
					</span>
				</span>
			</button>

			{isMiloOpen ? (
				<div
					aria-labelledby="milo-title"
					aria-modal="true"
					className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
					id="milo-assistant"
					role="dialog"
				>
					<div className="absolute inset-3 sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(720px,calc(100vh-2.5rem))] sm:w-[min(430px,calc(100vw-2.5rem))]">
						<Button
							aria-label="Đóng trợ giảng Milo"
							className="absolute top-3 right-3 z-10"
							onClick={() => setIsMiloOpen(false)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<X aria-hidden="true" />
						</Button>
						<MiloChat
							key={currentLesson.contentId}
							lesson={{
								content:
									contentValueToText(currentLesson.body) || currentLesson.title,
								id: currentLesson.contentVersionId,
								title: currentLesson.title,
							}}
							skillProfile={{
								level: getSkillLevel(currentLesson.metadata),
								needsSupport: getMetadataStrings(
									currentLesson.metadata,
									"targetSkills",
								),
								strengths: [],
							}}
						/>
					</div>
				</div>
			) : null}
		</div>
	);
}

type LessonCardProps = {
	contentVersionId: string;
	currentIndex: number;
	isCompleting: boolean;
	lesson: {
		body: unknown;
		isCompleted: boolean;
		kind: "lesson" | "practice" | "quiz";
		metadata: unknown;
		title: string;
	};
	nextTitle?: string;
	onComplete: () => void;
	onNext?: () => void;
	onPrevious?: () => void;
	onQuizSubmitted: () => void;
	previousTitle?: string;
	totalCount: number;
};

const contentKindLabels = {
	lesson: "Bài học",
	practice: "Thực hành",
	quiz: "Bài kiểm tra",
} as const;

function LessonCard({
	contentVersionId,
	currentIndex,
	isCompleting,
	lesson,
	nextTitle,
	onComplete,
	onNext,
	onPrevious,
	onQuizSubmitted,
	previousTitle,
	totalCount,
}: LessonCardProps) {
	const bodyHasQuiz =
		isRecord(lesson.body) &&
		Array.isArray(lesson.body.quiz_questions) &&
		lesson.body.quiz_questions.length > 0;
	const isQuiz = lesson.kind === "quiz" || bodyHasQuiz;
	const lessonMarkdown = getLessonMarkdown(lesson.body, {
		includeQuiz: !bodyHasQuiz,
	});
	const durationMinutes = getMetadataNumber(lesson.metadata, "durationMinutes");

	return (
		<Card className="overflow-hidden">
			<div className="bg-primary px-6 py-7 text-primary-foreground">
				<p className="text-primary-foreground/75 text-xs uppercase tracking-widest">
					{contentKindLabels[lesson.kind]} {currentIndex + 1} / {totalCount}
				</p>
				<h2 className="mt-2 font-semibold text-2xl">{lesson.title}</h2>
				{durationMinutes ? (
					<p className="mt-2 flex items-center gap-1 text-primary-foreground/80 text-xs">
						<Clock3 aria-hidden="true" className="size-3" />
						Khoảng {durationMinutes} phút
					</p>
				) : null}
			</div>
			<CardHeader>
				<CardTitle>Nội dung</CardTitle>
				<CardDescription>
					Đọc bài theo thứ tự, sau đó đánh dấu hoàn thành để lưu tiến độ.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{lessonMarkdown ? (
					<MarkdownContent content={lessonMarkdown} />
				) : isQuiz ? null : (
					<p className="text-muted-foreground text-sm">
						Bài học này chưa có nội dung hiển thị.
					</p>
				)}
				{isQuiz ? (
					<div className={lessonMarkdown ? "mt-6 border-t pt-6" : undefined}>
						<QuizRunner
							contentVersionId={contentVersionId}
							isCompleted={lesson.isCompleted}
							onSubmitted={onQuizSubmitted}
						/>
					</div>
				) : (
					<div className="mt-8 border-t pt-6">
						<Button
							disabled={lesson.isCompleted || isCompleting}
							onClick={onComplete}
							type="button"
							variant={lesson.isCompleted ? "outline" : "default"}
						>
							<CheckCircle2 aria-hidden="true" data-icon="inline-start" />
							{lesson.isCompleted
								? "Đã hoàn thành"
								: isCompleting
									? "Đang lưu…"
									: "Đánh dấu hoàn thành"}
						</Button>
					</div>
				)}
			</CardContent>
			<CardFooter className="flex justify-between gap-3 border-t">
				<Button
					aria-label={
						previousTitle ? `Bài trước: ${previousTitle}` : "Không có bài trước"
					}
					disabled={!onPrevious}
					onClick={onPrevious}
					type="button"
					variant="outline"
				>
					<ArrowLeft aria-hidden="true" data-icon="inline-start" />
					Bài trước
				</Button>
				<Button
					aria-label={
						nextTitle ? `Bài tiếp: ${nextTitle}` : "Không có bài tiếp"
					}
					disabled={!onNext}
					onClick={onNext}
					type="button"
					variant="outline"
				>
					Bài tiếp
					<ArrowRight aria-hidden="true" data-icon="inline-end" />
				</Button>
			</CardFooter>
		</Card>
	);
}

function QuizRunner({
	contentVersionId,
	isCompleted,
	onSubmitted,
}: {
	contentVersionId: string;
	isCompleted: boolean;
	onSubmitted: () => void;
}) {
	const quiz = useQuery(
		orpc.mastery.quiz.queryOptions({ input: { contentVersionId } }),
	);
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [scorePercent, setScorePercent] = useState<number | null>(null);
	const [resultByItem, setResultByItem] = useState<Map<
		string,
		{ correctOptionId: string | null; selectedOptionId: string }
	> | null>(null);
	const startedAt = useRef(Date.now());
	const submit = useMutation(
		orpc.mastery.submitAttempt.mutationOptions({
			onError: () => toast.error("Không thể nộp bài kiểm tra. Hãy thử lại."),
			onSuccess: (data) => {
				setScorePercent(Math.round((data.attempt.score ?? 0) * 100));
				setResultByItem(
					new Map(
						data.results.map((result) => [
							result.assessmentItemId,
							{
								correctOptionId: result.correctOptionId,
								selectedOptionId: result.selectedOptionId,
							},
						]),
					),
				);
				onSubmitted();
				toast.success("Đã nộp bài kiểm tra.");
			},
		}),
	);

	if (quiz.isPending) {
		return <Loader />;
	}
	if (quiz.isError) {
		return (
			<p className="text-destructive text-sm" role="alert">
				Không thể tải bài kiểm tra.
			</p>
		);
	}

	const items = quiz.data?.items ?? [];
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Bài kiểm tra này chưa có câu hỏi.
			</p>
		);
	}

	const isSubmitted = scorePercent !== null;
	const allAnswered = items.every((item) => answers[item.id]);
	const handleSubmit = () => {
		if (!allAnswered || submit.isPending || isSubmitted) {
			return;
		}
		const durationSeconds = Math.max(
			1,
			Math.round((Date.now() - startedAt.current) / 1000),
		);
		submit.mutate({
			contentVersionId,
			durationSeconds,
			responses: items.map((item) => ({
				assessmentItemId: item.id,
				attemptNumber: 1,
				selectedOptionId: answers[item.id] as string,
			})),
		});
	};

	return (
		<div className="space-y-5">
			{items.map((item, index) => {
				const itemResult = resultByItem?.get(item.id);
				return (
					<fieldset
						className="space-y-2"
						disabled={submit.isPending || isSubmitted}
						key={item.id}
					>
						<legend className="font-medium text-sm">
							{index + 1}. {item.prompt}
						</legend>
						{item.options.map((option) => {
							const isCorrectOption =
								itemResult && option.id === itemResult.correctOptionId;
							const isWrongChoice =
								itemResult &&
								option.id === itemResult.selectedOptionId &&
								option.id !== itemResult.correctOptionId;
							const stateClass = isCorrectOption
								? "border-emerald-500 bg-emerald-50 text-emerald-900"
								: isWrongChoice
									? "border-destructive bg-destructive/10 text-destructive"
									: "has-[:checked]:border-primary has-[:checked]:bg-primary/5";
							return (
								<label
									className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${stateClass}`}
									key={option.id}
								>
									<input
										checked={answers[item.id] === option.id}
										className="mt-0.5"
										name={item.id}
										onChange={() =>
											setAnswers((current) => ({
												...current,
												[item.id]: option.id,
											}))
										}
										type="radio"
									/>
									<span>{option.text}</span>
									{isCorrectOption ? (
										<CheckCircle2
											aria-hidden="true"
											className="ml-auto size-4 shrink-0 text-emerald-600"
										/>
									) : null}
								</label>
							);
						})}
					</fieldset>
				);
			})}
			{isSubmitted ? (
				<div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">
					<CheckCircle2 aria-hidden="true" className="size-4" />
					Đã nộp · Kết quả: {scorePercent}% đúng
				</div>
			) : (
				<Button
					disabled={!allAnswered || submit.isPending}
					onClick={handleSubmit}
					type="button"
				>
					<CheckCircle2 aria-hidden="true" data-icon="inline-start" />
					{submit.isPending ? "Đang nộp…" : "Nộp bài kiểm tra"}
				</Button>
			)}
			{isCompleted && !isSubmitted ? (
				<p className="text-muted-foreground text-xs">
					Bạn đã hoàn thành bài kiểm tra này. Làm lại để cập nhật kết quả.
				</p>
			) : null}
		</div>
	);
}

type MiloChatProps = {
	lesson: { content: string; id: string; title: string };
	skillProfile: {
		level: "advanced" | "beginner" | "intermediate";
		needsSupport: string[];
		strengths: string[];
	};
};

function MiloChat({ lesson, skillProfile }: MiloChatProps) {
	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const tutor = useMutation(orpc.tutor.ask.mutationOptions());

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedQuestion = question.trim();
		if (!trimmedQuestion || tutor.isPending) {
			return;
		}

		const messageId = Date.now();
		setMessages((currentMessages) => [
			...currentMessages,
			{ content: trimmedQuestion, id: messageId, role: "learner" },
		]);
		setQuestion("");

		try {
			const reply = await tutor.mutateAsync({
				lessonContext: lesson,
				question: trimmedQuestion,
				skillProfile,
			});
			setMessages((currentMessages) => [
				...currentMessages,
				{ content: reply, id: messageId + 1, role: "tutor" },
			]);
		} catch {
			// Mutation state renders the error while preserving the learner's message.
		}
	};

	return (
		<Card className="flex h-full min-h-0 flex-col overflow-hidden shadow-2xl">
			<CardHeader className="border-b pb-4">
				<div className="flex items-center gap-2">
					<Sparkles aria-hidden="true" className="size-4" />
					<CardTitle id="milo-title">Milo · Trợ giảng AI</CardTitle>
				</div>
				<CardDescription className="line-clamp-1">
					Đang hỗ trợ: <strong>{lesson.title}</strong>
				</CardDescription>
				<div
					className="mt-2 flex gap-2 border border-amber-500/40 bg-amber-500/10 p-3 text-amber-950 text-xs dark:text-amber-100"
					role="note"
				>
					<ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<p>
						Không chia sẻ dữ liệu cá nhân. AI có thể sai; hãy kiểm tra lại thông
						tin với giáo viên và tài liệu bài học.
					</p>
				</div>
			</CardHeader>

			<CardContent className="min-h-0 flex-1 overflow-y-auto pt-4">
				<div aria-live="polite" className="space-y-4" role="log">
					{messages.length === 0 ? (
						<div className="border border-dashed p-4 text-muted-foreground">
							<p className="flex items-center gap-2 font-medium text-foreground text-sm">
								<GraduationCap aria-hidden="true" className="size-4" />
								Milo đã đọc bài đang mở
							</p>
							<p className="mt-1 text-xs">
								Hãy hỏi về khái niệm hoặc bước bạn đang vướng.
							</p>
						</div>
					) : null}
					{messages.map((message) =>
						message.role === "learner" ? (
							<div className="flex justify-end" key={message.id}>
								<div className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground text-sm">
									<p>{message.content}</p>
								</div>
							</div>
						) : (
							<div className="flex gap-2" key={message.id}>
								<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
									<Sparkles aria-hidden="true" className="size-4" />
								</div>
								<div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-3 text-sm">
									<p className="font-medium text-xs">Milo</p>
									<p className="mt-2 leading-6">
										{message.content.introduction}
									</p>
									<ol className="mt-3 space-y-3">
										{message.content.steps.map((step) => (
											<li key={step.title}>
												<p className="font-medium">{step.title}</p>
												<p className="mt-1 text-muted-foreground text-xs leading-5">
													{step.content}
												</p>
											</li>
										))}
									</ol>
									<p className="mt-3 border-t pt-3 font-medium text-xs">
										{message.content.followUpQuestion}
									</p>
								</div>
							</div>
						),
					)}
					{tutor.isPending ? (
						<p className="text-muted-foreground">Milo đang chuẩn bị gợi ý…</p>
					) : null}
					{tutor.isError ? (
						<p className="text-destructive" role="alert">
							Không thể nhận gợi ý lúc này. Hãy thử gửi lại câu hỏi.
						</p>
					) : null}
				</div>
			</CardContent>

			<CardFooter className="border-t bg-background pt-4">
				<form className="flex w-full items-end gap-2" onSubmit={handleSubmit}>
					<div className="flex-1">
						<label className="sr-only" htmlFor="milo-question">
							Câu hỏi của bạn
						</label>
						<Textarea
							disabled={tutor.isPending}
							id="milo-question"
							maxLength={2000}
							onChange={(event) => setQuestion(event.target.value)}
							placeholder="Hỏi Milo về bài đang mở…"
							required
							value={question}
						/>
					</div>
					<Button disabled={!question.trim() || tutor.isPending} type="submit">
						<Send aria-hidden="true" data-icon="inline-start" />
						Gửi
					</Button>
				</form>
			</CardFooter>
		</Card>
	);
}
