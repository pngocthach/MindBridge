import { Button } from "@MindBridge/ui/components/button";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/teacher")({
	component: TeacherPage,
});

function TeacherPage() {
	const { session } = Route.useRouteContext();
	const classrooms = useQuery(
		orpc.teacher.listClassrooms.queryOptions({
			enabled: session.data?.user.role === "teacher",
			input: {},
		}),
	);
	const published = useQuery(
		orpc.contentWorkflow.listPublished.queryOptions({
			enabled: session.data?.user.role === "teacher",
		}),
	);
	const [selectedClassroomId, setSelectedClassroomId] = useState<string>();

	if (session.data?.user.role !== "teacher") {
		return (
			<section
				className="border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không có quyền truy cập</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Chỉ giáo viên mới xem được tiến độ lớp và giao học liệu.
				</p>
			</section>
		);
	}
	if (classrooms.isPending || published.isPending) {
		return <Loader />;
	}
	if (classrooms.isError || published.isError) {
		return (
			<section
				className="border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không thể tải dữ liệu lớp</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Hãy thử lại sau ít phút.
				</p>
			</section>
		);
	}
	if (classrooms.data.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>Chưa có lớp phụ trách</EmptyTitle>
					<EmptyDescription>
						Lớp được phân công sẽ hiển thị tại đây.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const activeClassroom =
		classrooms.data.find(({ id }) => id === selectedClassroomId) ??
		classrooms.data[0];
	return (
		<section aria-labelledby="teacher-title" className="space-y-6">
			<header>
				<h1 className="font-semibold text-2xl" id="teacher-title">
					Lớp của tôi
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Theo dõi lỗ hổng kỹ năng và giao học liệu đã xuất bản.
				</p>
			</header>
			<div className="flex flex-wrap gap-2" role="tablist">
				{classrooms.data.map((classroom) => (
					<Button
						aria-selected={classroom.id === activeClassroom.id}
						key={classroom.id}
						onClick={() => setSelectedClassroomId(classroom.id)}
						type="button"
						variant={
							classroom.id === activeClassroom.id ? "default" : "outline"
						}
					>
						{classroom.name}
					</Button>
				))}
			</div>
			<ClassroomCard classroom={activeClassroom} published={published.data} />
		</section>
	);
}

type Classroom = Awaited<
	ReturnType<typeof orpc.teacher.listClassrooms.call>
>[number];
type PublishedVersion = Awaited<
	ReturnType<typeof orpc.contentWorkflow.listPublished.call>
>[number];

function ClassroomCard({
	classroom,
	published,
}: {
	classroom: Classroom;
	published: PublishedVersion[];
}) {
	const queryClient = useQueryClient();
	const [contentVersionId, setContentVersionId] = useState("");
	const assignment = useMutation({
		...orpc.teacher.assignContent.mutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.teacher.listClassrooms.key(),
			});
			toast.success("Đã giao học liệu cho lớp");
		},
	});
	const handleAssign = () => {
		if (!contentVersionId) return;
		assignment.mutate({ classroomId: classroom.id, contentVersionId });
	};

	return (
		<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
			<Card>
				<CardHeader>
					<CardTitle>{classroom.name}</CardTitle>
					<CardDescription>
						{classroom.learners.length} học viên
					</CardDescription>
				</CardHeader>
				<CardContent>
					{classroom.learners.length === 0 ? (
						<p className="text-muted-foreground">Lớp chưa có học viên.</p>
					) : (
						<ul className="space-y-3">
							{classroom.learners.map((learner) => (
								<li
									className="border-b pb-3 last:border-0"
									key={learner.learnerId}
								>
									<p className="font-medium">{learner.learnerName}</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{learner.gaps.length > 0
											? `Cần hỗ trợ: ${learner.gaps.map(({ skillName }) => skillName).join(", ")}`
											: "Chưa ghi nhận lỗ hổng kỹ năng"}
									</p>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Giao học liệu</CardTitle>
					<CardDescription>Chỉ hiển thị nội dung đã xuất bản.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{published.length === 0 ? (
						<p className="text-muted-foreground">Chưa có học liệu published.</p>
					) : null}
					{published.length > 0 ? (
						<>
							<label className="sr-only" htmlFor="published-content">
								Chọn học liệu
							</label>
							<select
								className="h-8 w-full border border-input bg-background px-2 text-xs"
								id="published-content"
								onChange={(event) => setContentVersionId(event.target.value)}
								value={contentVersionId}
							>
								<option value="">Chọn học liệu</option>
								{published.map((version) => (
									<option key={version.id} value={version.id}>
										{version.title}
									</option>
								))}
							</select>
							<Button
								disabled={!contentVersionId || assignment.isPending}
								onClick={handleAssign}
								type="button"
							>
								{assignment.isPending ? "Đang giao…" : "Giao cho cả lớp"}
							</Button>
							{assignment.isError ? (
								<p className="text-destructive text-xs" role="alert">
									Không thể giao học liệu. Hãy thử lại.
								</p>
							) : null}
						</>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
