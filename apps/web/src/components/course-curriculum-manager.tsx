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
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

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
	description: course.description,
	gradeLevel: String(course.gradeLevel),
	language: course.language,
	title: course.title,
});

export default function CourseCurriculumManager() {
	const queryClient = useQueryClient();
	const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
	const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
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
		const gradeLevel = Number(courseForm.gradeLevel);
		if (
			!courseForm.title.trim() ||
			!courseForm.description.trim() ||
			!Number.isInteger(gradeLevel) ||
			gradeLevel < 1 ||
			gradeLevel > 12
		) {
			toast.error("Nhập đủ tiêu đề, mô tả và khối lớp hợp lệ.");
			return;
		}
		const values = {
			description: courseForm.description,
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

	return (
		<section aria-labelledby="course-manager-title" className="space-y-6">
			<header>
				<h1 className="font-semibold text-2xl" id="course-manager-title">
					Khóa học và chương trình
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Tạo khóa học và sắp xếp học liệu đã xuất bản.
				</p>
			</header>

			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
				<Card>
					<CardHeader>
						<CardTitle>Khóa học</CardTitle>
						<CardDescription>Chọn một khóa học để quản lý.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{courses.isPending ? <Loader /> : null}
						{courses.isError ? (
							<p className="text-destructive text-sm" role="alert">
								Không thể tải danh sách khóa học.
							</p>
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
						{courses.data?.map((course) => (
							<button
								aria-pressed={selectedCourseId === course.id}
								className="w-full rounded-md border p-3 text-left hover:bg-accent aria-pressed:border-primary aria-pressed:bg-accent"
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
									Khối {course.gradeLevel} · {course.language}
								</span>
							</button>
						))}
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
							<Label htmlFor="course-title">Tiêu đề</Label>
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
							<Label htmlFor="course-description">Mô tả</Label>
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
							<Label htmlFor="course-grade">Khối lớp</Label>
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
									onClick={() => {
										if (window.confirm("Lưu trữ khóa học này?")) {
											archiveCourse.mutate({ courseId: selectedCourse.id });
										}
									}}
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
							<p className="text-destructive text-sm" role="alert">
								Không thể tải chương trình khóa học.
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
