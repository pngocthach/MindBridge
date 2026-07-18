import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@MindBridge/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import LearnerProfilePanel from "@/components/learner-profile-panel";
import Loader from "@/components/loader";
import { MiloAssistant } from "@/components/milo-assistant";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: Dashboard,
});

type CourseSummary = {
	classroomId: string;
	classroomName: string;
	completedCount: number;
	courseDescription: string | null;
	courseGradeLevel: number | null;
	courseId: string;
	courseLanguage: string;
	courseTitle: string;
	progressPercent: number;
	totalCount: number;
};

type LearnerAssignment = Awaited<
	ReturnType<typeof orpc.assignments.listInbox.call>
>[number];

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
	const courses = useQuery(orpc.learner.listCourses.queryOptions());
	const assignments = useQuery(orpc.assignments.listInbox.queryOptions());

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
				<CourseList courses={courseList} />
			)}
			{profile.data ? (
				<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
					<AssignmentInbox
						assignments={assignments.data ?? []}
						isError={assignments.isError}
					/>
					<LearnerProfilePanel
						learnerName={learnerName}
						profile={profile.data}
					/>
				</div>
			) : (
				<AssignmentInbox
					assignments={assignments.data ?? []}
					isError={assignments.isError}
				/>
			)}
			<MiloAssistant
				dialogKey="dashboard"
				lesson={{
					content: `${
						courseList.length > 0
							? `Học viên đang tham gia các khóa: ${courseList
									.map((course) => course.courseTitle)
									.join(", ")}. `
							: "Học viên chưa tham gia khóa học nào. "
					}${
						profile.data?.learningGoal
							? `Mục tiêu học tập: ${profile.data.learningGoal}.`
							: "Chưa đặt mục tiêu học tập."
					}`,
					id: "dashboard",
					title: "Tổng quan học tập",
				}}
				skillProfile={{
					level:
						profile.data?.proficiencyLevel === "advanced" ||
						profile.data?.proficiencyLevel === "intermediate"
							? profile.data.proficiencyLevel
							: "beginner",
					needsSupport: [],
					strengths: [],
				}}
			/>
		</section>
	);
}

function AssignmentInbox({
	assignments,
	isError,
}: {
	assignments: LearnerAssignment[];
	isError: boolean;
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
										<Link
											className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium text-sm transition-colors hover:bg-muted"
											params={{ classroomId }}
											search={{ contentId: assignment.contentId }}
											to="/course/$classroomId"
										>
											Mở khóa học
											<ArrowRight aria-hidden="true" className="size-3.5" />
										</Link>
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

function CourseList({ courses }: { courses: CourseSummary[] }) {
	const coursePalettes = [
		"border-blue-200/80 bg-blue-50/90",
		"border-emerald-200/80 bg-emerald-100/75",
		"border-indigo-200/80 bg-indigo-50/90",
		"border-sky-200/80 bg-sky-100/75",
	] as const;
	return (
		<section
			aria-label="Khóa học được giao"
			className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm"
		>
			<div className="px-1 pb-3">
				<h2 className="font-bold text-base">Khóa học của bạn</h2>
				<p className="mt-1 text-muted-foreground text-xs">
					Chọn khóa học để tiếp tục
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{courses.map((courseItem, index) => (
					<Link
						className={`group block rounded-3xl border p-4 text-left shadow-[inset_0_2px_0_oklch(1_0_0/65%),0_10px_18px_oklch(0.45_0.08_300/12%)] transition-all hover:-translate-y-1 hover:shadow-[inset_0_2px_0_oklch(1_0_0/75%),0_14px_22px_oklch(0.45_0.08_300/18%)] ${
							coursePalettes[index % coursePalettes.length]
						}`}
						key={courseItem.classroomId}
						params={{ classroomId: courseItem.classroomId }}
						to="/course/$classroomId"
					>
						<div className="flex items-start justify-between gap-2">
							<p className="font-medium text-sm">{courseItem.courseTitle}</p>
							<ArrowRight
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
							/>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							{courseItem.classroomName}
							{courseItem.courseGradeLevel
								? ` · Lớp ${courseItem.courseGradeLevel}`
								: ""}
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
					</Link>
				))}
			</div>
		</section>
	);
}
