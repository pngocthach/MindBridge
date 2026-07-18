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
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/teacher")({
	component: TeacherPage,
});

const fieldClassName =
	"h-9 w-full border border-input bg-background px-3 text-sm";

function TeacherPage() {
	const { session } = Route.useRouteContext();
	const isTeacher = session.data?.user.role === "teacher";
	const classrooms = useQuery(
		orpc.teacher.listClassrooms.queryOptions({
			enabled: isTeacher,
			input: {},
		}),
	);
	const courseOptions = useQuery(
		orpc.teacher.listCourseOptions.queryOptions({ enabled: isTeacher }),
	);
	const [selectedClassroomId, setSelectedClassroomId] = useState<string>();

	if (!isTeacher) {
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
	if (classrooms.isPending || courseOptions.isPending) {
		return <Loader />;
	}
	if (classrooms.isError || courseOptions.isError) {
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
					Quản lý lớp, học viên và giao học liệu đã xuất bản.
				</p>
			</header>
			<CreateClassroomForm courseOptions={courseOptions.data} />
			{classrooms.data.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>Chưa có lớp phụ trách</EmptyTitle>
						<EmptyDescription>
							Tạo lớp đầu tiên bằng biểu mẫu phía trên.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{activeClassroom ? (
				<>
					<div className="flex flex-wrap gap-2" role="tablist">
						{classrooms.data.map((classroom) => (
							<Button
								aria-selected={classroom.id === activeClassroom.id}
								key={classroom.id}
								onClick={() => setSelectedClassroomId(classroom.id)}
								role="tab"
								type="button"
								variant={
									classroom.id === activeClassroom.id ? "default" : "outline"
								}
							>
								{classroom.name}
							</Button>
						))}
					</div>
					<ClassroomCard
						classroom={activeClassroom}
						courseOptions={courseOptions.data}
						key={activeClassroom.id}
					/>
				</>
			) : null}
		</section>
	);
}

type Classroom = Awaited<
	ReturnType<typeof orpc.teacher.listClassrooms.call>
>[number];
type CourseOption = Awaited<
	ReturnType<typeof orpc.teacher.listCourseOptions.call>
>[number];
type Enrollment = Awaited<
	ReturnType<typeof orpc.teacher.listEnrollments.call>
>[number];
type ClassroomGroup = Awaited<
	ReturnType<typeof orpc.teacher.listGroups.call>
>[number];
function CreateClassroomForm({
	courseOptions,
}: {
	courseOptions: CourseOption[];
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [courseId, setCourseId] = useState("");
	const createClassroom = useMutation({
		...orpc.teacher.createClassroom.mutationOptions(),
		onSuccess: async () => {
			setName("");
			setCourseId("");
			await queryClient.invalidateQueries({
				queryKey: orpc.teacher.listClassrooms.key(),
			});
			toast.success("Đã tạo lớp học");
		},
	});
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim() || !courseId) return;
		createClassroom.mutate({ courseId, name });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Tạo lớp học</CardTitle>
				<CardDescription>
					Chọn khóa học làm nội dung nền cho lớp.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
					onSubmit={handleSubmit}
				>
					<div>
						<label className="text-sm" htmlFor="new-classroom-name">
							Tên lớp
						</label>
						<input
							className={fieldClassName}
							id="new-classroom-name"
							maxLength={120}
							onChange={(event) => setName(event.target.value)}
							required
							value={name}
						/>
					</div>
					<div>
						<label className="text-sm" htmlFor="new-classroom-course">
							Khóa học
						</label>
						<select
							className={fieldClassName}
							id="new-classroom-course"
							onChange={(event) => setCourseId(event.target.value)}
							required
							value={courseId}
						>
							<option value="">Chọn khóa học</option>
							{courseOptions.map((option) => (
								<option key={option.id} value={option.id}>
									{option.title}
								</option>
							))}
						</select>
					</div>
					<Button
						className="self-end"
						disabled={createClassroom.isPending || courseOptions.length === 0}
						type="submit"
					>
						{createClassroom.isPending ? "Đang tạo…" : "Tạo lớp"}
					</Button>
				</form>
				{courseOptions.length === 0 ? (
					<p className="mt-2 text-muted-foreground text-xs">
						Chưa có khóa học để tạo lớp.
					</p>
				) : null}
				{createClassroom.isError ? (
					<p className="mt-2 text-destructive text-xs" role="alert">
						Không thể tạo lớp. Hãy kiểm tra thông tin và thử lại.
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

function ClassroomCard({
	classroom,
	courseOptions,
}: {
	classroom: Classroom;
	courseOptions: CourseOption[];
}) {
	const queryClient = useQueryClient();
	const [contentVersionId, setContentVersionId] = useState("");
	const [learnerEmail, setLearnerEmail] = useState("");
	const [name, setName] = useState(classroom.name);
	const [courseId, setCourseId] = useState(classroom.courseId);
	const [isEditing, setIsEditing] = useState(false);
	const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);
	const enrollments = useQuery(
		orpc.teacher.listEnrollments.queryOptions({
			input: { classroomId: classroom.id },
		}),
	);
	const assignableContent = useQuery(
		orpc.teacher.listAssignableContent.queryOptions({
			input: { classroomId: classroom.id },
		}),
	);
	const invalidateClassroomData = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.teacher.listClassrooms.key(),
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.teacher.listEnrollments.key(),
			}),
		]);
	};
	const assignment = useMutation({
		...orpc.teacher.assignContent.mutationOptions(),
		onSuccess: async () => {
			await invalidateClassroomData();
			toast.success("Đã giao học liệu cho lớp");
		},
	});
	const addEnrollment = useMutation({
		...orpc.teacher.addEnrollment.mutationOptions(),
		onSuccess: async () => {
			setLearnerEmail("");
			await invalidateClassroomData();
			toast.success("Đã thêm học viên vào lớp");
		},
	});
	const deactivateEnrollment = useMutation({
		...orpc.teacher.deactivateEnrollment.mutationOptions(),
		onSuccess: async () => {
			await invalidateClassroomData();
			toast.success("Đã ngừng ghi danh học viên");
		},
	});
	const updateClassroom = useMutation({
		...orpc.teacher.updateClassroom.mutationOptions(),
		onSuccess: async () => {
			setContentVersionId("");
			setIsEditing(false);
			await invalidateClassroomData();
			await queryClient.invalidateQueries({
				queryKey: orpc.teacher.listAssignableContent.key(),
			});
			toast.success("Đã cập nhật lớp học");
		},
	});
	const archiveClassroom = useMutation({
		...orpc.teacher.archiveClassroom.mutationOptions(),
		onSuccess: async () => {
			await invalidateClassroomData();
			toast.success("Đã lưu trữ lớp học");
		},
	});

	const handleAssign = () => {
		if (!contentVersionId) return;
		assignment.mutate({ classroomId: classroom.id, contentVersionId });
	};
	const handleEnrollment = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!learnerEmail.trim()) return;
		addEnrollment.mutate({ classroomId: classroom.id, email: learnerEmail });
	};
	const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim() || !courseId) return;
		updateClassroom.mutate({ classroomId: classroom.id, courseId, name });
	};
	const gapsByLearnerId = new Map(
		classroom.learners.map((learner) => [learner.learnerId, learner.gaps]),
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<CardTitle>{classroom.name}</CardTitle>
							<CardDescription>
								{classroom.courseTitle} · {classroom.learners.length} học viên
								đang học
							</CardDescription>
						</div>
						<div className="flex gap-2">
							<Button
								onClick={() => setIsEditing((current) => !current)}
								type="button"
								variant="outline"
							>
								{isEditing ? "Hủy sửa" : "Chỉnh sửa"}
							</Button>
							<Button
								disabled={archiveClassroom.isPending}
								onClick={() => {
									if (isConfirmingArchive) {
										archiveClassroom.mutate({ classroomId: classroom.id });
										return;
									}
									setIsConfirmingArchive(true);
								}}
								type="button"
								variant="destructive"
							>
								{archiveClassroom.isPending
									? "Đang lưu trữ…"
									: isConfirmingArchive
										? "Xác nhận lưu trữ"
										: "Lưu trữ"}
							</Button>
						</div>
					</div>
				</CardHeader>
				{isEditing ? (
					<CardContent>
						<form
							className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
							onSubmit={handleUpdate}
						>
							<div>
								<label
									className="text-sm"
									htmlFor={`classroom-name-${classroom.id}`}
								>
									Tên lớp
								</label>
								<input
									className={fieldClassName}
									id={`classroom-name-${classroom.id}`}
									maxLength={120}
									onChange={(event) => setName(event.target.value)}
									required
									value={name}
								/>
							</div>
							<div>
								<label
									className="text-sm"
									htmlFor={`classroom-course-${classroom.id}`}
								>
									Khóa học
								</label>
								<select
									className={fieldClassName}
									id={`classroom-course-${classroom.id}`}
									onChange={(event) => setCourseId(event.target.value)}
									value={courseId}
								>
									{courseOptions.map((option) => (
										<option key={option.id} value={option.id}>
											{option.title}
										</option>
									))}
								</select>
							</div>
							<Button
								className="self-end"
								disabled={updateClassroom.isPending}
								type="submit"
							>
								{updateClassroom.isPending ? "Đang lưu…" : "Lưu thay đổi"}
							</Button>
						</form>
						{updateClassroom.isError ? (
							<p className="mt-2 text-destructive text-xs" role="alert">
								Không thể cập nhật lớp.
							</p>
						) : null}
					</CardContent>
				) : null}
				{archiveClassroom.isError ? (
					<CardContent>
						<p className="text-destructive text-xs" role="alert">
							Không thể lưu trữ lớp.
						</p>
					</CardContent>
				) : null}
			</Card>

			<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
				<Card>
					<CardHeader>
						<CardTitle>Học viên</CardTitle>
						<CardDescription>
							Thêm học viên bằng email tài khoản.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<form className="flex gap-2" onSubmit={handleEnrollment}>
							<div className="flex-1">
								<label
									className="sr-only"
									htmlFor={`learner-email-${classroom.id}`}
								>
									Email học viên
								</label>
								<input
									className={fieldClassName}
									id={`learner-email-${classroom.id}`}
									onChange={(event) => setLearnerEmail(event.target.value)}
									placeholder="hocvien@example.com"
									required
									type="email"
									value={learnerEmail}
								/>
							</div>
							<Button disabled={addEnrollment.isPending} type="submit">
								{addEnrollment.isPending ? "Đang thêm…" : "Thêm"}
							</Button>
						</form>
						{addEnrollment.isError ? (
							<p className="text-destructive text-xs" role="alert">
								Không tìm thấy tài khoản học viên hoặc không thể ghi danh.
							</p>
						) : null}
						{enrollments.isPending ? (
							<p className="text-muted-foreground text-sm">
								Đang tải học viên…
							</p>
						) : null}
						{enrollments.isError ? (
							<p className="text-destructive text-xs" role="alert">
								Không thể tải danh sách học viên.
							</p>
						) : null}
						{enrollments.data?.length === 0 ? (
							<p className="text-muted-foreground">Lớp chưa có học viên.</p>
						) : null}
						{enrollments.data?.length ? (
							<ul className="space-y-3">
								{enrollments.data.map((enrollment) => {
									const gaps = gapsByLearnerId.get(enrollment.learnerId) ?? [];
									return (
										<li
											className="border-b pb-3 last:border-0"
											key={enrollment.learnerId}
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="font-medium">
														{enrollment.learnerName}
													</p>
													<p className="text-muted-foreground text-xs">
														{enrollment.email}
													</p>
													<p className="mt-1 text-muted-foreground text-xs">
														{enrollment.status !== "active"
															? "Đã ngừng ghi danh"
															: gaps.length > 0
																? `Cần hỗ trợ: ${gaps.map(({ skillName }) => skillName).join(", ")}`
																: "Chưa ghi nhận lỗ hổng kỹ năng"}
													</p>
												</div>
												{enrollment.status === "active" ? (
													<Button
														disabled={deactivateEnrollment.isPending}
														onClick={() =>
															deactivateEnrollment.mutate({
																classroomId: classroom.id,
																email: enrollment.email,
															})
														}
														size="sm"
														type="button"
														variant="outline"
													>
														Ngừng ghi danh
													</Button>
												) : null}
											</div>
										</li>
									);
								})}
							</ul>
						) : null}
						{deactivateEnrollment.isError ? (
							<p className="text-destructive text-xs" role="alert">
								Không thể ngừng ghi danh học viên.
							</p>
						) : null}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Giao học liệu</CardTitle>
						<CardDescription>
							Chỉ hiển thị nội dung đã xuất bản.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{assignableContent.isPending ? (
							<p className="text-muted-foreground">Đang tải học liệu…</p>
						) : null}
						{assignableContent.isError ? (
							<p className="text-destructive text-sm" role="alert">
								Không thể tải học liệu của khóa học này.
							</p>
						) : null}
						{assignableContent.data?.length === 0 ? (
							<p className="text-muted-foreground">
								Khóa học này chưa có học liệu đã xuất bản trong chương trình.
							</p>
						) : null}
						{assignableContent.data && assignableContent.data.length > 0 ? (
							<>
								<label className="sr-only" htmlFor="published-content">
									Chọn học liệu
								</label>
								<select
									className={fieldClassName}
									id="published-content"
									onChange={(event) => setContentVersionId(event.target.value)}
									value={contentVersionId}
								>
									<option value="">Chọn học liệu</option>
									{assignableContent.data.map((version) => (
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
										{assignment.error.message}
									</p>
								) : null}
							</>
						) : null}
					</CardContent>
				</Card>
			</div>
			<GroupManager
				classroomId={classroom.id}
				enrollments={enrollments.data ?? []}
			/>
		</div>
	);
}

function GroupManager({
	classroomId,
	enrollments,
}: {
	classroomId: string;
	enrollments: Enrollment[];
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const groups = useQuery(
		orpc.teacher.listGroups.queryOptions({ input: { classroomId } }),
	);
	const createGroup = useMutation({
		...orpc.teacher.createGroup.mutationOptions(),
		onSuccess: async () => {
			setName("");
			await queryClient.invalidateQueries({
				queryKey: orpc.teacher.listGroups.key(),
			});
			toast.success("Đã tạo nhóm");
		},
	});
	const handleCreate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) return;
		createGroup.mutate({ classroomId, name });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Nhóm học viên</CardTitle>
				<CardDescription>
					Tạo nhóm và phân công các học viên đang ghi danh trong lớp.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form className="flex gap-2" onSubmit={handleCreate}>
					<div className="flex-1">
						<label className="sr-only" htmlFor={`new-group-${classroomId}`}>
							Tên nhóm
						</label>
						<input
							className={fieldClassName}
							id={`new-group-${classroomId}`}
							maxLength={120}
							onChange={(event) => setName(event.target.value)}
							placeholder="Tên nhóm"
							required
							value={name}
						/>
					</div>
					<Button disabled={createGroup.isPending} type="submit">
						{createGroup.isPending ? "Đang tạo…" : "Tạo nhóm"}
					</Button>
				</form>
				{createGroup.isError ? (
					<p className="text-destructive text-xs" role="alert">
						Không thể tạo nhóm. Tên nhóm có thể đã được sử dụng.
					</p>
				) : null}
				{groups.isPending ? (
					<p className="text-muted-foreground text-sm">Đang tải nhóm…</p>
				) : null}
				{groups.isError ? (
					<p className="text-destructive text-xs" role="alert">
						Không thể tải danh sách nhóm.
					</p>
				) : null}
				{groups.data?.length === 0 ? (
					<p className="text-muted-foreground text-sm">Lớp chưa có nhóm.</p>
				) : null}
				{groups.data?.map((group) => (
					<GroupCard enrollments={enrollments} group={group} key={group.id} />
				))}
			</CardContent>
		</Card>
	);
}

function GroupCard({
	group,
	enrollments,
}: {
	group: ClassroomGroup;
	enrollments: Enrollment[];
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(group.name);
	const [learnerId, setLearnerId] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const invalidateGroups = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.teacher.listGroups.key(),
		});
	};
	const updateGroup = useMutation({
		...orpc.teacher.updateGroup.mutationOptions(),
		onSuccess: async () => {
			setIsEditing(false);
			await invalidateGroups();
			toast.success("Đã đổi tên nhóm");
		},
	});
	const deleteGroup = useMutation({
		...orpc.teacher.deleteGroup.mutationOptions(),
		onSuccess: async () => {
			await invalidateGroups();
			toast.success("Đã xóa nhóm");
		},
	});
	const addMember = useMutation({
		...orpc.teacher.addGroupMember.mutationOptions(),
		onSuccess: async () => {
			setLearnerId("");
			await invalidateGroups();
			toast.success("Đã thêm học viên vào nhóm");
		},
	});
	const removeMember = useMutation({
		...orpc.teacher.removeGroupMember.mutationOptions(),
		onSuccess: async () => {
			await invalidateGroups();
			toast.success("Đã xóa học viên khỏi nhóm");
		},
	});
	const memberIds = new Set(group.members.map((member) => member.learnerId));
	const availableEnrollments = enrollments.filter(
		(enrollment) =>
			enrollment.status === "active" && !memberIds.has(enrollment.learnerId),
	);
	const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) return;
		updateGroup.mutate({ groupId: group.id, name });
	};
	const handleAddMember = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!learnerId) return;
		addMember.mutate({ groupId: group.id, learnerId });
	};
	const hasError =
		updateGroup.isError ||
		deleteGroup.isError ||
		addMember.isError ||
		removeMember.isError;

	return (
		<section
			className="space-y-3 border p-4"
			aria-labelledby={`group-${group.id}`}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="font-medium" id={`group-${group.id}`}>
					{group.name} · {group.members.length} học viên
				</h3>
				<div className="flex gap-2">
					<Button
						onClick={() => setIsEditing((current) => !current)}
						size="sm"
						type="button"
						variant="outline"
					>
						{isEditing ? "Hủy sửa" : "Đổi tên"}
					</Button>
					<Button
						disabled={deleteGroup.isPending}
						onClick={() => {
							if (isConfirmingDelete) {
								deleteGroup.mutate({ groupId: group.id });
								return;
							}
							setIsConfirmingDelete(true);
						}}
						size="sm"
						type="button"
						variant="destructive"
					>
						{deleteGroup.isPending
							? "Đang xóa…"
							: isConfirmingDelete
								? "Xác nhận xóa"
								: "Xóa"}
					</Button>
				</div>
			</div>
			{isEditing ? (
				<form className="flex gap-2" onSubmit={handleUpdate}>
					<label className="sr-only" htmlFor={`group-name-${group.id}`}>
						Tên nhóm
					</label>
					<input
						className={fieldClassName}
						id={`group-name-${group.id}`}
						maxLength={120}
						onChange={(event) => setName(event.target.value)}
						required
						value={name}
					/>
					<Button disabled={updateGroup.isPending} size="sm" type="submit">
						Lưu
					</Button>
				</form>
			) : null}
			<form className="flex gap-2" onSubmit={handleAddMember}>
				<label className="sr-only" htmlFor={`group-learner-${group.id}`}>
					Chọn học viên
				</label>
				<select
					className={fieldClassName}
					disabled={availableEnrollments.length === 0}
					id={`group-learner-${group.id}`}
					onChange={(event) => setLearnerId(event.target.value)}
					value={learnerId}
				>
					<option value="">Chọn học viên đang ghi danh</option>
					{availableEnrollments.map((enrollment) => (
						<option key={enrollment.learnerId} value={enrollment.learnerId}>
							{enrollment.learnerName} ({enrollment.email})
						</option>
					))}
				</select>
				<Button
					disabled={!learnerId || addMember.isPending}
					size="sm"
					type="submit"
				>
					Thêm vào nhóm
				</Button>
			</form>
			{group.members.length === 0 ? (
				<p className="text-muted-foreground text-sm">Nhóm chưa có học viên.</p>
			) : (
				<ul className="space-y-2">
					{group.members.map((member) => (
						<li
							className="flex items-center justify-between gap-3"
							key={member.learnerId}
						>
							<span className="text-sm">
								{member.learnerName} · {member.email}
							</span>
							<Button
								disabled={removeMember.isPending}
								onClick={() =>
									removeMember.mutate({
										groupId: group.id,
										learnerId: member.learnerId,
									})
								}
								size="sm"
								type="button"
								variant="outline"
							>
								Xóa khỏi nhóm
							</Button>
						</li>
					))}
				</ul>
			)}
			{hasError ? (
				<p className="text-destructive text-xs" role="alert">
					Không thể cập nhật nhóm. Hãy kiểm tra thông tin và thử lại.
				</p>
			) : null}
		</section>
	);
}
