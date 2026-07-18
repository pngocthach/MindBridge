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
import { Input } from "@MindBridge/ui/components/input";
import { Label } from "@MindBridge/ui/components/label";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";
import ConfirmActionDialog from "./confirm-action-dialog";

type Course = Awaited<ReturnType<typeof orpc.courses.list.call>>[number];
type CurriculumItem = Awaited<
	ReturnType<typeof orpc.courseCurriculum.list.call>
>[number];

type CourseFormValues = {
	description: string;
	gradeLevel: string;
	language: string;
	title: string;
};

const emptyCourseForm: CourseFormValues = {
	description: "",
	gradeLevel: "",
	language: "vi",
	title: "",
};

const courseToForm = (course: Course): CourseFormValues => ({
	description: course.description ?? "",
	gradeLevel: course.gradeLevel == null ? "" : String(course.gradeLevel),
	language: course.language,
	title: course.title,
});

export default function CourseCurriculumManager() {
	const queryClient = useQueryClient();
	const [courseSearch, setCourseSearch] = useState("");
	const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
	const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
	const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
	const [courseForm, setCourseForm] =
		useState<CourseFormValues>(emptyCourseForm);
	const [availableContentId, setAvailableContentId] = useState("");

	const courses = useQuery(
		orpc.courses.list.queryOptions({ input: { includeArchived: false } }),
	);
	const selectedCourse = courses.data?.find(
		(course) => course.id === selectedCourseId,
	);
	const curriculum = useQuery(
		orpc.courseCurriculum.list.queryOptions({
			enabled: selectedCourseId !== null,
			input: { courseId: selectedCourseId ?? "" },
		}),
	);
	const availableContent = useQuery(
		orpc.courseCurriculum.listAvailable.queryOptions({
			enabled: selectedCourseId !== null,
			input: { courseId: selectedCourseId ?? "" },
		}),
	);

	const refreshCourses = async () => {
		await queryClient.invalidateQueries({ queryKey: orpc.courses.list.key() });
		await queryClient.invalidateQueries({
			queryKey: orpc.courses.search.key(),
		});
	};
	const refreshCurriculum = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.courseCurriculum.list.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.courseCurriculum.listAvailable.key(),
		});
	};

	const createCourse = useMutation(
		orpc.courses.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (createdCourse) => {
				await refreshCourses();
				setCourseForm(emptyCourseForm);
				setSelectedCourseId(createdCourse.id);
				toast.success("Đã tạo khóa học.");
			},
		}),
	);
	const updateCourse = useMutation(
		orpc.courses.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshCourses();
				setCourseForm(emptyCourseForm);
				setEditingCourseId(null);
				toast.success("Đã cập nhật khóa học.");
			},
		}),
	);
	const archiveCourse = useMutation(
		orpc.courses.archive.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshCourses();
				setSelectedCourseId(null);
				setEditingCourseId(null);
				setCourseForm(emptyCourseForm);
				toast.success("Đã lưu trữ khóa học.");
			},
		}),
	);
	const addContent = useMutation(
		orpc.courseCurriculum.add.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshCurriculum();
				setAvailableContentId("");
				toast.success("Đã thêm học liệu vào chương trình.");
			},
		}),
	);
	const removeContent = useMutation(
		orpc.courseCurriculum.remove.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshCurriculum();
				toast.success("Đã xóa học liệu khỏi chương trình.");
			},
		}),
	);
	const reorderContent = useMutation(
		orpc.courseCurriculum.reorder.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: refreshCurriculum,
		}),
	);

	const submitCourse = () => {
		if (!courseForm.title.trim()) {
			toast.error("Nhập tiêu đề khóa học.");
			return;
		}
		const trimmedGrade = courseForm.gradeLevel.trim();
		const gradeLevel = trimmedGrade === "" ? undefined : Number(trimmedGrade);
		if (
			gradeLevel !== undefined &&
			(!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12)
		) {
			toast.error("Khối lớp phải từ 1 đến 12.");
			return;
		}
		const trimmedDescription = courseForm.description.trim();
		const values = {
			description: trimmedDescription === "" ? undefined : trimmedDescription,
			gradeLevel,
			language: courseForm.language,
			title: courseForm.title,
		};
		if (editingCourseId) {
			updateCourse.mutate({ courseId: editingCourseId, ...values });
			return;
		}
		createCourse.mutate(values);
	};

	const moveItem = (itemIndex: number, direction: -1 | 1) => {
		if (!(selectedCourseId && curriculum.data)) return;
		const targetIndex = itemIndex + direction;
		if (targetIndex < 0 || targetIndex >= curriculum.data.length) return;
		const contentIds = curriculum.data.map((item) => item.contentId);
		const currentId = contentIds[itemIndex];
		const targetId = contentIds[targetIndex];
		if (!(currentId && targetId)) return;
		contentIds[itemIndex] = targetId;
		contentIds[targetIndex] = currentId;
		reorderContent.mutate({ contentIds, courseId: selectedCourseId });
	};

	const isSavingCourse = createCourse.isPending || updateCourse.isPending;
	const normalizedCourseSearch = courseSearch.trim().toLowerCase();
	const filteredCourses = (courses.data ?? []).filter((course) =>
		course.title.toLowerCase().includes(normalizedCourseSearch),
	);

	return (
		<section
			aria-labelledby="course-manager-title"
			className="space-y-5 rounded-2xl bg-gradient-to-br from-blue-50/70 to-white p-5 md:p-6"
		>
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl" id="course-manager-title">
						Khóa học và chương trình
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Tạo khóa học và sắp xếp học liệu đã xuất bản.
					</p>
				</div>
				<div className="rounded-xl border border-blue-100 bg-white px-4 py-2 text-right shadow-sm">
					<p className="font-bold text-primary text-xl">
						{courses.data?.length ?? 0}
					</p>
					<p className="text-muted-foreground text-[11px]">
						khóa học hoạt động
					</p>
				</div>
			</header>

			<div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
				<Card>
					<CardHeader>
						<CardTitle>Khóa học</CardTitle>
						<CardDescription>Chọn một khóa học để quản lý.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Input
							aria-label="Tìm khóa học"
							onChange={(event) => setCourseSearch(event.target.value)}
							placeholder="Tìm khóa học…"
							value={courseSearch}
						/>
						{courses.isPending ? <Loader /> : null}
						{courses.isError ? (
							<div
								className="flex items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm"
								role="alert"
							>
								<span>Không thể tải danh sách khóa học.</span>
								<Button
									onClick={() => void courses.refetch()}
									size="sm"
									type="button"
									variant="outline"
								>
									<RefreshCw aria-hidden="true" />
									Thử lại
								</Button>
							</div>
						) : null}
						{courses.data?.length === 0 ? (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>Chưa có khóa học</EmptyTitle>
									<EmptyDescription>
										Tạo khóa học đầu tiên bên dưới.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : null}
						{filteredCourses.map((course) => (
							<button
								aria-pressed={selectedCourseId === course.id}
								className="w-full rounded-xl border bg-white p-3.5 text-left shadow-sm hover:border-primary/40 hover:bg-blue-50 aria-pressed:border-primary aria-pressed:bg-blue-50 aria-pressed:ring-2 aria-pressed:ring-primary/15"
								key={course.id}
								onClick={() => {
									setSelectedCourseId(course.id);
									setEditingCourseId(null);
									setCourseForm(emptyCourseForm);
									setAvailableContentId("");
								}}
								type="button"
							>
								<span className="block font-medium">{course.title}</span>
								<span className="text-muted-foreground text-xs">
									{course.gradeLevel ? `Khối ${course.gradeLevel} · ` : ""}
									{course.language}
								</span>
							</button>
						))}
						{normalizedCourseSearch && filteredCourses.length === 0 ? (
							<p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm">
								Không tìm thấy khóa học phù hợp.
							</p>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>
							{editingCourseId ? "Sửa khóa học" : "Tạo khóa học"}
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="course-title">
								Tiêu đề{" "}
								<span aria-hidden="true" className="text-destructive">
									*
								</span>
								<span className="sr-only"> bắt buộc</span>
							</Label>
							<Input
								id="course-title"
								onChange={(event) =>
									setCourseForm((current) => ({
										...current,
										title: event.target.value,
									}))
								}
								value={courseForm.title}
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="course-description">
								Mô tả{" "}
								<span className="font-normal text-muted-foreground text-xs">
									(không bắt buộc)
								</span>
							</Label>
							<Textarea
								id="course-description"
								onChange={(event) =>
									setCourseForm((current) => ({
										...current,
										description: event.target.value,
									}))
								}
								value={courseForm.description}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="course-grade">
								Khối lớp{" "}
								<span className="font-normal text-muted-foreground text-xs">
									(không bắt buộc)
								</span>
							</Label>
							<Input
								id="course-grade"
								max="12"
								min="1"
								onChange={(event) =>
									setCourseForm((current) => ({
										...current,
										gradeLevel: event.target.value,
									}))
								}
								type="number"
								value={courseForm.gradeLevel}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="course-language">Ngôn ngữ</Label>
							<Input
								id="course-language"
								onChange={(event) =>
									setCourseForm((current) => ({
										...current,
										language: event.target.value,
									}))
								}
								value={courseForm.language}
							/>
						</div>
						<div className="flex flex-wrap gap-2 sm:col-span-2">
							<Button
								disabled={isSavingCourse}
								onClick={submitCourse}
								type="button"
							>
								{isSavingCourse
									? "Đang lưu…"
									: editingCourseId
										? "Lưu thay đổi"
										: "Tạo khóa học"}
							</Button>
							{editingCourseId ? (
								<Button
									onClick={() => {
										setEditingCourseId(null);
										setCourseForm(emptyCourseForm);
									}}
									type="button"
									variant="outline"
								>
									Hủy
								</Button>
							) : null}
						</div>
					</CardContent>
				</Card>
			</div>

			{selectedCourse ? (
				<Card>
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>Chương trình · {selectedCourse.title}</CardTitle>
								<CardDescription>
									Chỉ học liệu đã xuất bản mới có thể được thêm.
								</CardDescription>
							</div>
							<div className="flex gap-2">
								<Button
									onClick={() => {
										setEditingCourseId(selectedCourse.id);
										setCourseForm(courseToForm(selectedCourse));
									}}
									type="button"
									variant="outline"
								>
									Sửa
								</Button>
								<Button
									disabled={archiveCourse.isPending}
									onClick={() => setIsArchiveDialogOpen(true)}
									type="button"
									variant="destructive"
								>
									Lưu trữ
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-col gap-2 sm:flex-row">
							<label className="sr-only" htmlFor="published-content">
								Học liệu đã xuất bản
							</label>
							<select
								className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
								disabled={
									availableContent.isPending ||
									availableContent.data?.length === 0
								}
								id="published-content"
								onChange={(event) => setAvailableContentId(event.target.value)}
								value={availableContentId}
							>
								<option value="">Chọn học liệu đã xuất bản</option>
								{availableContent.data?.map((content) => (
									<option key={content.contentId} value={content.contentId}>
										{content.title} · {content.kind}
									</option>
								))}
							</select>
							<Button
								disabled={!availableContentId || addContent.isPending}
								onClick={() =>
									addContent.mutate({
										contentId: availableContentId,
										courseId: selectedCourse.id,
									})
								}
								type="button"
							>
								Thêm
							</Button>
						</div>
						{curriculum.isPending || availableContent.isPending ? (
							<Loader />
						) : null}
						{curriculum.isError || availableContent.isError ? (
							<div
								className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm"
								role="alert"
							>
								<span>Không thể tải chương trình khóa học.</span>
								<Button
									onClick={() => {
										void Promise.all([
											curriculum.refetch(),
											availableContent.refetch(),
										]);
									}}
									size="sm"
									type="button"
									variant="outline"
								>
									<RefreshCw aria-hidden="true" />
									Thử lại
								</Button>
							</div>
						) : null}
						{availableContent.data?.length === 0 &&
						curriculum.data &&
						curriculum.data.length > 0 ? (
							<p className="rounded-xl border border-dashed p-3 text-muted-foreground text-sm">
								Mọi học liệu đã xuất bản đều đã có trong chương trình này.
							</p>
						) : null}
						{curriculum.data?.length === 0 ? (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>Chương trình đang trống</EmptyTitle>
									<EmptyDescription>
										Thêm học liệu đã xuất bản để bắt đầu.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : null}
						<ol className="space-y-2">
							{curriculum.data?.map((item, index) => (
								<CurriculumRow
									index={index}
									isBusy={removeContent.isPending || reorderContent.isPending}
									item={item}
									key={item.contentId}
									onMove={moveItem}
									onRemove={() =>
										removeContent.mutate({
											contentId: item.contentId,
											courseId: selectedCourse.id,
										})
									}
									total={curriculum.data.length}
								/>
							))}
						</ol>
					</CardContent>
				</Card>
			) : null}
			<ConfirmActionDialog
				confirmLabel="Lưu trữ khóa học"
				description="Khóa học sẽ không còn xuất hiện trong danh sách hoạt động. Dữ liệu chương trình vẫn được giữ lại."
				isPending={archiveCourse.isPending}
				onCancel={() => setIsArchiveDialogOpen(false)}
				onConfirm={() => {
					if (selectedCourse) {
						archiveCourse.mutate(
							{ courseId: selectedCourse.id },
							{ onSuccess: () => setIsArchiveDialogOpen(false) },
						);
					}
				}}
				open={isArchiveDialogOpen}
				title="Lưu trữ khóa học?"
			/>
		</section>
	);
}

type CurriculumRowProps = {
	index: number;
	isBusy: boolean;
	item: CurriculumItem;
	onMove: (index: number, direction: -1 | 1) => void;
	onRemove: () => void;
	total: number;
};

function CurriculumRow({
	index,
	isBusy,
	item,
	onMove,
	onRemove,
	total,
}: CurriculumRowProps) {
	return (
		<li className="flex items-center gap-3 rounded-md border p-3">
			<span className="w-6 text-center font-medium text-muted-foreground text-sm">
				{item.position}
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">{item.title}</p>
				<p className="text-muted-foreground text-xs">
					{item.kind} ·{" "}
					{item.isPublished ? "Đã xuất bản" : "Không còn xuất bản"}
				</p>
			</div>
			<Button
				aria-label={`Đưa ${item.title} lên`}
				disabled={isBusy || index === 0}
				onClick={() => onMove(index, -1)}
				size="icon"
				type="button"
				variant="outline"
			>
				<ArrowUp aria-hidden="true" />
			</Button>
			<Button
				aria-label={`Đưa ${item.title} xuống`}
				disabled={isBusy || index === total - 1}
				onClick={() => onMove(index, 1)}
				size="icon"
				type="button"
				variant="outline"
			>
				<ArrowDown aria-hidden="true" />
			</Button>
			<Button
				disabled={isBusy}
				onClick={onRemove}
				type="button"
				variant="outline"
			>
				Xóa
			</Button>
		</li>
	);
}
