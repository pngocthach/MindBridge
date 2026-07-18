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
import { toast } from "sonner";
import LearnerProfilePanel from "@/components/learner-profile-panel";
import Loader from "@/components/loader";
import MarkdownContent from "@/components/markdown-content";
import {
	contentValueToText,
	getLessonMarkdown,
} from "@/utils/content-markdown";
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

type LearnerAssignment = Awaited<
	ReturnType<typeof orpc.assignments.listInbox.call>
>[number];

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
	const profile = useQuery(orpc.learner.getProfile.queryOptions());
	const hasProfile = profile.data !== undefined && profile.data !== null;
	const courses = useQuery(
		orpc.learner.listCourses.queryOptions({ enabled: hasProfile }),
	);
	const assignments = useQuery(
		orpc.assignments.listInbox.queryOptions({ enabled: hasProfile }),
	);
	const [selectedClassroomId, setSelectedClassroomId] = useState<string>();
	const [selectedContentId, setSelectedContentId] = useState<string>();

	if (profile.isPending) {
		return <Loader />;
	}
	if (profile.isError) {
		return (
			<section
				className="border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không thể tải hồ sơ học tập</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Hãy tải lại trang hoặc thử lại sau ít phút.
				</p>
			</section>
		);
	}
	if (profile.data === null) {
		return <LearnerProfilePanel learnerName={learnerName} profile={null} />;
	}
	if (courses.isPending || assignments.isPending) {
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
	const averageProgress =
		courseList.length === 0
			? 0
			: Math.round(
					courseList.reduce(
						(total, course) => total + course.progressPercent,
						0,
					) / courseList.length,
				);
	const completedCourses = courseList.filter(
		(course) => course.progressPercent >= 100,
	).length;

	return (
		<section
			aria-labelledby="course-dashboard-title"
			className="space-y-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-white to-cyan-50/50 p-3 md:p-5"
		>
			<Card className="relative overflow-hidden border-blue-100 bg-gradient-to-r from-white to-blue-50/80">
				<div className="absolute -right-12 -bottom-24 size-64 rounded-full bg-cyan-200/30 blur-3xl" />
				<CardContent className="relative flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
					<div>
						<div className="flex items-center gap-2 font-bold text-primary text-xs uppercase tracking-widest">
							<BookOpen aria-hidden="true" className="size-4" />
							Không gian học tập
						</div>
						<h1
							className="mt-2 font-extrabold text-3xl tracking-tight md:text-4xl"
							id="course-dashboard-title"
						>
							Xin chào, {learnerName}
						</h1>
						<p className="mt-2 max-w-xl text-muted-foreground text-sm">
							Tiếp tục bài học gần nhất và hỏi Milo bất cứ lúc nào.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
							<p className="font-extrabold text-primary text-2xl">
								{averageProgress}%
							</p>
							<p className="text-muted-foreground text-[11px]">tiến độ chung</p>
						</div>
						<div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
							<p className="font-extrabold text-primary text-2xl">
								{completedCourses}
							</p>
							<p className="text-muted-foreground text-[11px]">đã hoàn thành</p>
						</div>
						<img
							alt=""
							aria-hidden="true"
							className="hidden w-24 drop-shadow-lg sm:block"
							height="1536"
							src="/images/milo-mascot.png"
							width="1024"
						/>
					</div>
				</CardContent>
			</Card>
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
						onSelect={(classroomId) => {
							setSelectedClassroomId(classroomId);
							setSelectedContentId(undefined);
						}}
						selectedClassroomId={activeClassroomId}
					/>
					{activeClassroomId ? (
						<CoursePlayer
							classroomId={activeClassroomId}
							initialContentId={selectedContentId}
							key={`${activeClassroomId}-${selectedContentId ?? "course"}`}
						/>
					) : null}
				</div>
			)}
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
				<AssignmentInbox
					assignments={assignments.data ?? []}
					isError={assignments.isError}
					onOpenAssignment={(classroomId, contentId) => {
						setSelectedClassroomId(classroomId);
						setSelectedContentId(contentId);
					}}
				/>
				<LearnerProfilePanel learnerName={learnerName} profile={profile.data} />
			</div>
		</section>
	);
}

function AssignmentInbox({
	assignments,
	isError,
	onOpenAssignment,
}: {
	assignments: LearnerAssignment[];
	isError: boolean;
	onOpenAssignment: (classroomId: string, contentId: string) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Hộp bài tập</CardTitle>
				<CardDescription>
					Bài tập được giao trực tiếp, theo nhóm hoặc theo lớp.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isError ? (
					<p className="text-destructive text-sm" role="alert">
						Không thể tải hộp bài tập.
					</p>
				) : null}
				{!isError && assignments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						Bạn chưa có bài tập nào được giao.
					</p>
				) : null}
				{assignments.length > 0 ? (
					<ul className="space-y-3">
						{assignments.map((assignment) => {
							const classroomId = assignment.classroomId;
							const isOverdue =
								assignment.status === "pending" &&
								assignment.dueAt !== null &&
								assignment.dueAt < new Date();
							return (
								<li
									className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-3"
									key={assignment.id}
								>
									<div>
										<p className="font-medium text-sm">{assignment.title}</p>
										<p className="text-muted-foreground text-xs">
											{assignment.classroomName ?? "Giao trực tiếp"}
											{assignment.groupName
												? ` · Nhóm ${assignment.groupName}`
												: ""}
											{" · "}
											{assignment.dueAt
												? `Hạn ${assignment.dueAt.toLocaleDateString("vi-VN")}`
												: "Không có hạn nộp"}
										</p>
										<p
											className={`mt-1 text-xs ${
												isOverdue ? "text-destructive" : "text-muted-foreground"
											}`}
										>
											{assignment.status === "completed"
												? "Đã hoàn thành"
												: isOverdue
													? "Quá hạn"
													: "Chưa hoàn thành"}
										</p>
									</div>
									{classroomId ? (
										<Button
											onClick={() =>
												onOpenAssignment(classroomId, assignment.contentId)
											}
											size="sm"
											type="button"
											variant="outline"
										>
											Mở khóa học
										</Button>
									) : null}
								</li>
							);
						})}
					</ul>
				) : null}
			</CardContent>
		</Card>
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
	const coursePalettes = [
		"border-blue-200/80 bg-blue-50/90",
		"border-emerald-200/80 bg-emerald-100/75",
		"border-indigo-200/80 bg-indigo-50/90",
		"border-sky-200/80 bg-sky-100/75",
	] as const;
	return (
		<nav
			aria-label="Khóa học được giao"
			className="space-y-3 rounded-2xl border border-blue-100 bg-white/80 p-3 shadow-sm"
		>
			<div className="px-2 pb-1">
				<h2 className="font-bold text-base">Khóa học của bạn</h2>
				<p className="mt-1 text-muted-foreground text-xs">
					Chọn khóa học để tiếp tục
				</p>
			</div>
			{courses.map((courseItem, index) => {
				const isSelected = courseItem.classroomId === selectedClassroomId;
				return (
					<button
						aria-current={isSelected ? "true" : undefined}
						className={`w-full rounded-3xl border p-4 text-left shadow-[inset_0_2px_0_oklch(1_0_0/65%),0_10px_18px_oklch(0.45_0.08_300/12%)] transition-all hover:-translate-y-1 hover:shadow-[inset_0_2px_0_oklch(1_0_0/75%),0_14px_22px_oklch(0.45_0.08_300/18%)] ${
							isSelected
								? "border-primary bg-primary/15 ring-2 ring-primary/25"
								: coursePalettes[index % coursePalettes.length]
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

function CoursePlayer({
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
					<MarkdownContent content={lessonMarkdown} />
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
