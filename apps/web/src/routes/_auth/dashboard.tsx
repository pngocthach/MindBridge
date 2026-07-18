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
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Bot,
	Check,
	CheckCircle2,
	Clock3,
	GraduationCap,
	Send,
	ShieldAlert,
	Sparkles,
	X,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: Dashboard,
});

type TutorReply = {
	followUpQuestion: string;
	introduction: string;
	steps: { content: string; title: string }[];
};

type ChatMessage =
	| { content: string; id: number; role: "learner" }
	| { content: TutorReply; id: number; role: "tutor" };

type CourseSummary = {
	classroomId: string;
	classroomName: string;
	completedCount: number;
	courseDescription: string;
	courseGradeLevel: number;
	courseId: string;
	courseLanguage: string;
	courseTitle: string;
	progressPercent: number;
	totalCount: number;
};

type ContentBlock = { text: string; title?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const valueToText = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map(valueToText).filter(Boolean).join("\n");
	}
	if (isRecord(value)) {
		return Object.values(value).map(valueToText).filter(Boolean).join("\n");
	}
	return "";
};

const getContentBlocks = (body: unknown): ContentBlock[] => {
	if (!isRecord(body)) {
		const text = valueToText(body);
		return text ? [{ text }] : [];
	}

	const sections = body.sections;
	if (Array.isArray(sections)) {
		const sectionBlocks = sections.flatMap((section) => {
			if (!isRecord(section)) {
				const text = valueToText(section);
				return text ? [{ text }] : [];
			}
			const text = valueToText(section.content ?? section.text);
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
		const text = valueToText(value);
		if (text) {
			blocks.push({ text, title: fieldLabels[key] });
		}
	}
	return blocks;
};

const getLessonMarkdown = (body: unknown): string => {
	if (!isRecord(body)) {
		return valueToText(body);
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
				.map((objective) => `- ${valueToText(objective.text)}`)
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
						valueToText(exercise.difficulty) === "EASY" ? "Dễ" : "Chuẩn";
					const prompt = valueToText(exercise.prompt);
					const expectedAnswer = valueToText(exercise.expected_answer);
					const explanation = valueToText(exercise.explanation);
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
								.map((option) => `- ${valueToText(option)}`)
								.join("\n")
						: "";
					return `### Câu ${index + 1}. ${valueToText(question.question)}\n\n${options}${
						question.correct_answer
							? `\n\n**Đáp án:** ${valueToText(question.correct_answer)}`
							: ""
					}${
						question.explanation
							? `\n\n**Giải thích:** ${valueToText(question.explanation)}`
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

function Dashboard() {
	const { session } = Route.useRouteContext();
	const user = session.data?.user;

	if (user?.role !== "learner") {
		return (
			<section aria-labelledby="dashboard-title" className="space-y-2">
				<h1 className="font-semibold text-2xl" id="dashboard-title">
					Xin chào, {user?.name}
				</h1>
				<p className="text-muted-foreground text-sm">
					Chọn một khu vực trong thanh điều hướng để bắt đầu.
				</p>
			</section>
		);
	}

	return <LearnerDashboard learnerName={user.name} />;
}

function LearnerDashboard({ learnerName }: { learnerName: string }) {
	const courses = useQuery(orpc.learner.listCourses.queryOptions());
	const [selectedClassroomId, setSelectedClassroomId] = useState<string>();

	if (courses.isPending) {
		return <Loader />;
	}

	if (courses.isError) {
		return (
			<section
				className="border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không thể tải khóa học</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Hãy tải lại trang hoặc thử lại sau ít phút.
				</p>
			</section>
		);
	}

	const courseList = courses.data ?? [];
	const activeClassroomId =
		selectedClassroomId ?? courseList.at(0)?.classroomId;

	return (
		<section aria-labelledby="course-dashboard-title" className="space-y-6">
			<header>
				<div className="flex items-center gap-2 font-medium text-primary text-xs uppercase tracking-widest">
					<BookOpen aria-hidden="true" className="size-4" />
					Khóa học được giao
				</div>
				<h1
					className="mt-2 font-semibold text-3xl tracking-tight"
					id="course-dashboard-title"
				>
					Xin chào, {learnerName}
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Tiếp tục bài chưa hoàn thành và hỏi Milo bất cứ lúc nào.
				</p>
			</header>

			{courseList.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>Chưa có khóa học được giao</EmptyTitle>
						<EmptyDescription>
							Khóa học sẽ xuất hiện khi giáo viên thêm bạn vào một lớp đang hoạt
							động.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="grid items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
					<CourseList
						courses={courseList}
						onSelect={setSelectedClassroomId}
						selectedClassroomId={activeClassroomId}
					/>
					{activeClassroomId ? (
						<CoursePlayer
							classroomId={activeClassroomId}
							key={activeClassroomId}
						/>
					) : null}
				</div>
			)}
		</section>
	);
}

function CourseList({
	courses,
	onSelect,
	selectedClassroomId,
}: {
	courses: CourseSummary[];
	onSelect: (classroomId: string) => void;
	selectedClassroomId: string | undefined;
}) {
	return (
		<nav aria-label="Khóa học được giao" className="space-y-3">
			<h2 className="font-semibold text-sm">Khóa học của bạn</h2>
			{courses.map((courseItem) => {
				const isSelected = courseItem.classroomId === selectedClassroomId;
				return (
					<button
						aria-current={isSelected ? "true" : undefined}
						className={`w-full border p-4 text-left transition-colors hover:border-primary/60 ${
							isSelected ? "border-primary bg-primary/5" : "bg-background"
						}`}
						key={courseItem.classroomId}
						onClick={() => onSelect(courseItem.classroomId)}
						type="button"
					>
						<p className="font-medium text-sm">{courseItem.courseTitle}</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{courseItem.classroomName} · Lớp {courseItem.courseGradeLevel}
						</p>
						<div
							aria-label={`Tiến độ ${courseItem.courseTitle}`}
							aria-valuemax={100}
							aria-valuemin={0}
							aria-valuenow={courseItem.progressPercent}
							className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
							role="progressbar"
						>
							<div
								className="h-full rounded-full bg-primary"
								style={{ width: `${courseItem.progressPercent}%` }}
							/>
						</div>
						<p className="mt-2 text-muted-foreground text-xs">
							{courseItem.completedCount}/{courseItem.totalCount} bài hoàn thành
						</p>
					</button>
				);
			})}
		</nav>
	);
}

function CoursePlayer({ classroomId }: { classroomId: string }) {
	const queryClient = useQueryClient();
	const course = useQuery(
		orpc.learner.getCourse.queryOptions({ input: { classroomId } }),
	);
	const [selectedContentId, setSelectedContentId] = useState<string>();
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
								{courseData.classroomName} · {courseData.courseDescription}
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
				<span className="relative flex size-11 items-center justify-center rounded-full bg-white/15">
					<span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
					<Bot aria-hidden="true" className="relative size-6" />
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
								content: valueToText(currentLesson.body) || currentLesson.title,
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
	previousTitle?: string;
	totalCount: number;
};

const contentKindLabels = {
	lesson: "Bài học",
	practice: "Thực hành",
	quiz: "Bài kiểm tra",
} as const;

function LessonCard({
	currentIndex,
	isCompleting,
	lesson,
	nextTitle,
	onComplete,
	onNext,
	onPrevious,
	previousTitle,
	totalCount,
}: LessonCardProps) {
	const lessonMarkdown = getLessonMarkdown(lesson.body);
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
					<article className="mx-auto max-w-3xl text-foreground">
						<ReactMarkdown
							components={{
								a: ({ children, href }) => (
									<a
										className="font-medium text-primary underline underline-offset-4"
										href={href}
										rel="noopener noreferrer"
										target="_blank"
									>
										{children}
									</a>
								),
								blockquote: ({ children }) => (
									<blockquote className="my-5 border-primary border-l-4 bg-primary/5 px-5 py-3 text-muted-foreground italic">
										{children}
									</blockquote>
								),
								code: ({ children }) => (
									<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
										{children}
									</code>
								),
								h1: ({ children }) => (
									<h1 className="mt-8 mb-4 font-bold text-3xl tracking-tight">
										{children}
									</h1>
								),
								h2: ({ children }) => (
									<h2 className="mt-8 mb-3 border-b pb-2 font-semibold text-2xl tracking-tight">
										{children}
									</h2>
								),
								h3: ({ children }) => (
									<h3 className="mt-6 mb-2 font-semibold text-xl">
										{children}
									</h3>
								),
								hr: () => <hr className="my-8 border-border" />,
								li: ({ children }) => <li className="pl-1">{children}</li>,
								ol: ({ children }) => (
									<ol className="my-4 list-decimal space-y-2 pl-6 leading-7">
										{children}
									</ol>
								),
								p: ({ children }) => (
									<p className="my-4 text-[15px] leading-8">{children}</p>
								),
								pre: ({ children }) => (
									<pre className="my-5 overflow-x-auto rounded-lg bg-slate-950 p-4 text-slate-50 text-sm">
										{children}
									</pre>
								),
								table: ({ children }) => (
									<div className="my-5 overflow-x-auto">
										<table className="w-full border-collapse text-sm">
											{children}
										</table>
									</div>
								),
								td: ({ children }) => (
									<td className="border px-3 py-2 align-top">{children}</td>
								),
								th: ({ children }) => (
									<th className="border bg-muted px-3 py-2 text-left font-semibold">
										{children}
									</th>
								),
								ul: ({ children }) => (
									<ul className="my-4 list-disc space-y-2 pl-6 leading-7">
										{children}
									</ul>
								),
							}}
							remarkPlugins={[remarkGfm]}
						>
							{lessonMarkdown}
						</ReactMarkdown>
					</article>
				) : (
					<p className="text-muted-foreground text-sm">
						Bài học này chưa có nội dung hiển thị.
					</p>
				)}
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
