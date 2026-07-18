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
import { Input } from "@MindBridge/ui/components/input";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import SourceDocumentLibrary from "@/components/source-document-library";
import { orpc } from "@/utils/orpc";

const statuses = [
	"draft",
	"in_review",
	"approved",
	"published",
	"archived",
] as const;
type ContentStatus = (typeof statuses)[number];
type StatusFilter = ContentStatus | "all";
type ContentKind = "lesson" | "practice" | "quiz";

const statusLabels: Record<ContentStatus, string> = {
	approved: "Đã phê duyệt",
	archived: "Đã lưu trữ",
	draft: "Bản nháp",
	in_review: "Chờ duyệt",
	published: "Đã xuất bản",
};

const actionLabels: Partial<Record<ContentStatus, string>> = {
	approved: "Xuất bản",
	draft: "Gửi duyệt",
	in_review: "Phê duyệt",
};

export const Route = createFileRoute("/_auth/admin-content")({
	component: AdminContentPage,
});

function AdminContentPage() {
	const { session } = Route.useRouteContext();
	const role = session.data?.user.role;
	const isAdmin = role === "admin";
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("in_review");
	const versions = useQuery(
		orpc.contentWorkflow.list.queryOptions({
			enabled: isAdmin,
			input: statusFilter === "all" ? {} : { status: statusFilter },
		}),
	);

	if (role !== "admin" && role !== "teacher") {
		return (
			<section
				className="rounded-none border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không có quyền truy cập</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Chỉ quản trị viên và giáo viên được quản lý tài liệu nguồn.
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-8">
			<SourceDocumentLibrary />
			{isAdmin ? (
				<section aria-labelledby="content-workflow-title" className="space-y-4">
					<header className="rounded-xl border bg-card/80 p-4 shadow-sm">
						<h1 className="font-semibold text-2xl" id="content-workflow-title">
							Kiểm duyệt học liệu
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							Mọi học liệu phải được quản trị viên phê duyệt trước khi xuất bản.
						</p>
					</header>

					<ContentCatalog />

					<nav
						aria-label="Lọc theo trạng thái"
						className="flex flex-wrap gap-2"
					>
						<FilterButton
							active={statusFilter === "all"}
							onClick={() => setStatusFilter("all")}
						>
							Đang hoạt động
						</FilterButton>
						{statuses.map((status) => (
							<FilterButton
								active={statusFilter === status}
								key={status}
								onClick={() => setStatusFilter(status)}
							>
								{statusLabels[status]}
							</FilterButton>
						))}
					</nav>

					{versions.isPending ? <Loader /> : null}
					{versions.isError ? (
						<section
							className="rounded-none border border-destructive/30 bg-destructive/10 p-6"
							role="alert"
						>
							<h2 className="font-semibold">Không thể tải học liệu</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Hãy thử tải lại danh sách sau ít phút.
							</p>
						</section>
					) : null}
					{versions.data?.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>Không có học liệu</EmptyTitle>
								<EmptyDescription>
									Chưa có học liệu ở trạng thái đã chọn.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : null}
					{versions.data ? (
						<div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
							{versions.data.map((version) => (
								<ContentVersionCard key={version.id} version={version} />
							))}
						</div>
					) : null}
				</section>
			) : null}
		</div>
	);
}

function ContentCatalog() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [selectedContentId, setSelectedContentId] = useState<string | null>(
		null,
	);
	const [courseId, setCourseId] = useState("");
	const [kind, setKind] = useState<ContentKind>("lesson");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("{}");
	const [metadata, setMetadata] = useState("{}");
	const contentItems = useQuery(
		orpc.contentWorkflow.listContent.queryOptions(),
	);
	const courses = useQuery(
		orpc.courses.list.queryOptions({ input: { includeArchived: false } }),
	);
	const history = useQuery(
		orpc.contentWorkflow.listHistory.queryOptions({
			enabled: selectedContentId !== null,
			input: {
				contentId: selectedContentId ?? "00000000-0000-0000-0000-000000000000",
			},
		}),
	);
	const refreshContent = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.listContent.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.listHistory.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.list.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.listPublished.key(),
		});
	};
	const createDraft = useMutation(
		orpc.contentWorkflow.createDraft.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (result) => {
				await refreshContent();
				setSelectedContentId(result.content.id);
				setTitle("");
				setBody("{}");
				setMetadata("{}");
				toast.success("Đã tạo học liệu và bản nháp đầu tiên.");
			},
		}),
	);
	const createVersionDraft = useMutation(
		orpc.contentWorkflow.createVersionDraft.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshContent();
				toast.success("Đã tạo phiên bản nháp mới.");
			},
		}),
	);
	const archiveContent = useMutation(
		orpc.contentWorkflow.archiveContent.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshContent();
				toast.success("Đã lưu trữ học liệu và các phiên bản đang hoạt động.");
			},
		}),
	);
	const normalizedSearch = search.trim().toLowerCase();
	const filteredContent = (contentItems.data ?? []).filter((item) =>
		`${item.title} ${item.kind}`.toLowerCase().includes(normalizedSearch),
	);

	const handleCreateDraft = () => {
		if (!courseId || !title.trim()) {
			toast.error("Hãy chọn khóa học và nhập tiêu đề.");
			return;
		}
		try {
			const parsedBody: unknown = JSON.parse(body);
			const parsedMetadata: unknown = JSON.parse(metadata);
			if (!isJsonObject(parsedBody) || !isJsonObject(parsedMetadata)) {
				toast.error("Nội dung và metadata phải là JSON object.");
				return;
			}
			createDraft.mutate({
				body: parsedBody,
				courseId,
				kind,
				metadata: parsedMetadata,
				title,
			});
		} catch {
			toast.error("JSON không hợp lệ.");
		}
	};

	const handleArchiveContent = (contentId: string, contentTitle: string) => {
		const confirmed = globalThis.confirm(
			`Lưu trữ ${contentTitle} và mọi phiên bản đang hoạt động?`,
		);
		if (confirmed) archiveContent.mutate({ contentId });
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Tạo học liệu</CardTitle>
					<CardDescription>
						Tạo học liệu mới cùng phiên bản nháp đầu tiên.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-2">
					<label className="space-y-1 text-sm">
						<span>Khóa học</span>
						<select
							className="h-9 w-full border border-input bg-background px-3 text-sm"
							onChange={(event) => setCourseId(event.target.value)}
							value={courseId}
						>
							<option value="">Chọn khóa học</option>
							{courses.data?.map((course) => (
								<option key={course.id} value={course.id}>
									{course.title}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1 text-sm">
						<span>Loại học liệu</span>
						<select
							className="h-9 w-full border border-input bg-background px-3 text-sm"
							onChange={(event) => setKind(event.target.value as ContentKind)}
							value={kind}
						>
							<option value="lesson">Bài học</option>
							<option value="quiz">Bài kiểm tra</option>
							<option value="practice">Bài luyện tập</option>
						</select>
					</label>
					<label className="space-y-1 text-sm md:col-span-2">
						<span>Tiêu đề</span>
						<Input
							onChange={(event) => setTitle(event.target.value)}
							value={title}
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span>Nội dung (JSON)</span>
						<Textarea
							className="min-h-28 font-mono"
							onChange={(event) => setBody(event.target.value)}
							value={body}
						/>
					</label>
					<label className="space-y-1 text-sm">
						<span>Metadata (JSON)</span>
						<Textarea
							className="min-h-28 font-mono"
							onChange={(event) => setMetadata(event.target.value)}
							value={metadata}
						/>
					</label>
				</CardContent>
				<CardFooter className="justify-end">
					<Button
						disabled={createDraft.isPending || courses.isPending}
						onClick={handleCreateDraft}
						type="button"
					>
						{createDraft.isPending ? "Đang tạo…" : "Tạo bản nháp"}
					</Button>
				</CardFooter>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Thư viện và lịch sử phiên bản</CardTitle>
					<CardDescription>
						Chọn một học liệu để xem, chỉnh sửa hoặc quản lý phiên bản.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<label className="block max-w-md space-y-1 text-sm">
						<span className="sr-only">Tìm học liệu</span>
						<Input
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Tìm theo tiêu đề hoặc loại…"
							value={search}
						/>
					</label>
					{contentItems.isPending ? <Loader /> : null}
					{contentItems.isError ? (
						<p className="text-destructive text-sm" role="alert">
							Không thể tải thư viện học liệu.
						</p>
					) : null}
					{!contentItems.isPending && filteredContent.length === 0 ? (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>Không có học liệu</EmptyTitle>
								<EmptyDescription>
									Tạo bản nháp đầu tiên hoặc thử từ khóa khác.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : null}
					<div className="divide-y border-y">
						{filteredContent.map((item) => (
							<div
								className="flex flex-wrap items-center justify-between gap-3 py-3"
								key={item.contentId}
							>
								<div>
									<p className="font-medium">{item.title}</p>
									<p className="text-muted-foreground text-xs">
										{item.kind} · {item.versionCount} phiên bản ·{" "}
										{item.isArchived
											? "Đã lưu trữ"
											: item.latestStatus
												? statusLabels[item.latestStatus]
												: "Chưa có phiên bản"}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										onClick={() => setSelectedContentId(item.contentId)}
										size="sm"
										type="button"
										variant={
											selectedContentId === item.contentId
												? "default"
												: "outline"
										}
									>
										Lịch sử
									</Button>
									<Button
										disabled={
											item.latestStatus === "draft" ||
											createVersionDraft.isPending
										}
										onClick={() =>
											createVersionDraft.mutate({ contentId: item.contentId })
										}
										size="sm"
										type="button"
										variant="outline"
									>
										Bản nháp mới
									</Button>
									<Button
										disabled={item.isArchived || archiveContent.isPending}
										onClick={() =>
											handleArchiveContent(item.contentId, item.title)
										}
										size="sm"
										type="button"
										variant="destructive"
									>
										Lưu trữ
									</Button>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{selectedContentId ? (
				<section aria-live="polite" className="space-y-3">
					<h2 className="font-semibold text-xl">Lịch sử phiên bản</h2>
					{history.isPending ? <Loader /> : null}
					{history.isError ? (
						<p className="text-destructive text-sm" role="alert">
							Không thể tải lịch sử phiên bản.
						</p>
					) : null}
					{history.data ? (
						<div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
							{history.data.versions.map((version) => (
								<ContentVersionCard key={version.id} version={version} />
							))}
						</div>
					) : null}
				</section>
			) : null}
		</div>
	);
}

type FilterButtonProps = {
	active: boolean;
	children: string;
	onClick: () => void;
};

function FilterButton({ active, children, onClick }: FilterButtonProps) {
	return (
		<Button
			aria-pressed={active}
			onClick={onClick}
			type="button"
			variant={active ? "default" : "outline"}
		>
			{children}
		</Button>
	);
}

type ContentVersion = Awaited<
	ReturnType<typeof orpc.contentWorkflow.list.call>
>[number];
type AssessmentItem = Awaited<
	ReturnType<typeof orpc.assessments.list.call>
>[number];

function ContentVersionCard({ version }: { version: ContentVersion }) {
	const queryClient = useQueryClient();
	const [isEditing, setIsEditing] = useState(false);
	const [title, setTitle] = useState(version.title);
	const [body, setBody] = useState(() => JSON.stringify(version.body, null, 2));
	const [metadata, setMetadata] = useState(() =>
		JSON.stringify(version.metadata, null, 2),
	);
	const startEditing = () => {
		setTitle(version.title);
		setBody(JSON.stringify(version.body, null, 2));
		setMetadata(JSON.stringify(version.metadata, null, 2));
		setIsEditing(true);
	};
	const cancelEditing = () => {
		setIsEditing(false);
	};
	const refreshLists = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.list.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.listPublished.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.listContent.key(),
		});
		await queryClient.invalidateQueries({
			queryKey: orpc.contentWorkflow.listHistory.key(),
		});
	};
	const mutationCallbacks = {
		onError: (error: Error) => toast.error(error.message),
		onSuccess: async () => {
			await refreshLists();
			toast.success("Đã cập nhật trạng thái học liệu.");
		},
	};
	const submitForReview = useMutation(
		orpc.contentWorkflow.submitForReview.mutationOptions(mutationCallbacks),
	);
	const approve = useMutation(
		orpc.contentWorkflow.approve.mutationOptions(mutationCallbacks),
	);
	const publish = useMutation(
		orpc.contentWorkflow.publish.mutationOptions(mutationCallbacks),
	);
	const archive = useMutation(
		orpc.contentWorkflow.archive.mutationOptions(mutationCallbacks),
	);
	const editDraft = useMutation(
		orpc.contentWorkflow.editDraft.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshLists();
				setIsEditing(false);
				toast.success("Đã lưu bản nháp.");
			},
		}),
	);
	const isTransitioning =
		submitForReview.isPending ||
		approve.isPending ||
		publish.isPending ||
		archive.isPending;

	const handleTransition = () => {
		const input = { contentVersionId: version.id };
		switch (version.status) {
			case "draft":
				submitForReview.mutate(input);
				break;
			case "in_review":
				approve.mutate(input);
				break;
			case "approved":
				publish.mutate(input);
				break;
			case "published":
			case "archived":
				break;
		}
	};
	const handleArchiveVersion = () => {
		const confirmed = globalThis.confirm(
			`Lưu trữ phiên bản ${version.versionNumber} của ${version.title}?`,
		);
		if (confirmed) archive.mutate({ contentVersionId: version.id });
	};

	const handleSaveDraft = () => {
		try {
			const parsedBody: unknown = JSON.parse(body);
			const parsedMetadata: unknown = JSON.parse(metadata);
			if (!isJsonObject(parsedBody) || !isJsonObject(parsedMetadata)) {
				toast.error("Nội dung và metadata phải là JSON object.");
				return;
			}
			editDraft.mutate({
				body: parsedBody,
				contentVersionId: version.id,
				metadata: parsedMetadata,
				title,
			});
		} catch {
			toast.error("JSON không hợp lệ.");
		}
	};

	const renderDraftActions = () => {
		if (version.status !== "draft") return null;
		if (isEditing) {
			return (
				<>
					<Button onClick={cancelEditing} type="button" variant="outline">
						Hủy
					</Button>
					<Button
						disabled={editDraft.isPending}
						onClick={handleSaveDraft}
						type="button"
					>
						{editDraft.isPending ? "Đang lưu…" : "Lưu bản nháp"}
					</Button>
				</>
			);
		}
		return (
			<Button onClick={startEditing} type="button" variant="outline">
				Chỉnh sửa
			</Button>
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{version.title}</CardTitle>
				<CardDescription>
					{statusLabels[version.status]} · Phiên bản {version.versionNumber} ·{" "}
					{version.kind}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{isEditing ? (
					<>
						<label className="block space-y-1 font-medium text-xs">
							<span>Tiêu đề</span>
							<Input
								onChange={(event) => setTitle(event.target.value)}
								value={title}
							/>
						</label>
						<label className="block space-y-1 font-medium text-xs">
							<span>Nội dung (JSON)</span>
							<Textarea
								className="min-h-36 font-mono"
								onChange={(event) => setBody(event.target.value)}
								value={body}
							/>
						</label>
						<label className="block space-y-1 font-medium text-xs">
							<span>Metadata (JSON)</span>
							<Textarea
								className="min-h-24 font-mono"
								onChange={(event) => setMetadata(event.target.value)}
								value={metadata}
							/>
						</label>
					</>
				) : (
					<pre className="max-h-52 overflow-auto whitespace-pre-wrap border bg-muted/40 p-3 text-xs">
						{JSON.stringify(version.body, null, 2)}
					</pre>
				)}
			</CardContent>
			<AssessmentEditor
				contentVersionId={version.id}
				enabled={version.kind === "quiz"}
			/>
			<CardFooter className="flex flex-wrap justify-end gap-2">
				{renderDraftActions()}
				{version.status !== "archived" && !isEditing ? (
					<Button
						disabled={isTransitioning}
						onClick={handleArchiveVersion}
						type="button"
						variant="destructive"
					>
						Lưu trữ phiên bản
					</Button>
				) : null}
				{actionLabels[version.status] && !isEditing ? (
					<Button
						disabled={isTransitioning}
						onClick={handleTransition}
						type="button"
					>
						{isTransitioning ? "Đang xử lý…" : actionLabels[version.status]}
					</Button>
				) : null}
			</CardFooter>
		</Card>
	);
}

function AssessmentEditor({
	contentVersionId,
	enabled,
}: {
	contentVersionId: string;
	enabled: boolean;
}) {
	const queryClient = useQueryClient();
	const [prompt, setPrompt] = useState("");
	const [explanation, setExplanation] = useState("");
	const [itemType, setItemType] = useState<
		"single_choice" | "multiple_choice" | "short_answer"
	>("single_choice");
	const [ordinal, setOrdinal] = useState(1);
	const items = useQuery(
		orpc.assessments.list.queryOptions({
			enabled,
			input: { contentVersionId },
		}),
	);
	const refresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.assessments.list.key(),
		});
	};
	const createItem = useMutation(
		orpc.assessments.createItem.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refresh();
				setPrompt("");
				setExplanation("");
				setOrdinal((value) => value + 1);
				toast.success("Đã thêm câu hỏi.");
			},
		}),
	);
	if (!enabled) return null;

	return (
		<CardContent className="space-y-4 border-t bg-muted/20 pt-4">
			<div>
				<h4 className="font-semibold text-sm">Câu hỏi và đáp án</h4>
				<p className="text-muted-foreground text-xs">
					Quản lý các câu hỏi của phiên bản quiz này.
				</p>
			</div>
			<form
				className="grid gap-2 border bg-background p-3 md:grid-cols-[5rem_1fr_1fr_auto]"
				onSubmit={(event) => {
					event.preventDefault();
					if (!prompt.trim()) return;
					createItem.mutate({
						contentVersionId,
						explanation,
						itemType,
						ordinal,
						prompt,
					});
				}}
			>
				<label className="space-y-1 text-xs">
					<span>Thứ tự</span>
					<Input
						min={1}
						onChange={(event) => setOrdinal(Number(event.target.value))}
						type="number"
						value={ordinal}
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span>Câu hỏi</span>
					<Input
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="Nhập nội dung câu hỏi"
						value={prompt}
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span>Giải thích</span>
					<Input
						onChange={(event) => setExplanation(event.target.value)}
						placeholder="Giải thích đáp án"
						value={explanation}
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span>Loại</span>
					<select
						className="h-9 w-full border border-input bg-background px-2"
						onChange={(event) =>
							setItemType(event.target.value as typeof itemType)
						}
						value={itemType}
					>
						<option value="single_choice">Một đáp án</option>
						<option value="multiple_choice">Nhiều đáp án</option>
						<option value="short_answer">Tự luận</option>
					</select>
				</label>
				<Button disabled={createItem.isPending || !prompt.trim()} type="submit">
					Thêm câu hỏi
				</Button>
			</form>
			{items.isPending ? (
				<p className="text-muted-foreground text-xs">Đang tải câu hỏi…</p>
			) : null}
			{items.isError ? (
				<p className="text-destructive text-xs" role="alert">
					Không thể tải câu hỏi.
				</p>
			) : null}
			{items.data?.length === 0 ? (
				<p className="text-muted-foreground text-xs">Chưa có câu hỏi.</p>
			) : null}
			{items.data?.map((item) => (
				<AssessmentItemEditor item={item} key={item.id} onRefresh={refresh} />
			))}
		</CardContent>
	);
}

function AssessmentItemEditor({
	item,
	onRefresh,
}: {
	item: AssessmentItem;
	onRefresh: () => Promise<void>;
}) {
	const [prompt, setPrompt] = useState(item.prompt);
	const [explanation, setExplanation] = useState(item.explanation);
	const [ordinal, setOrdinal] = useState(item.ordinal);
	const [itemType, setItemType] = useState(item.itemType);
	const [isEditing, setIsEditing] = useState(false);
	const updateItem = useMutation(
		orpc.assessments.updateItem.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await onRefresh();
				setIsEditing(false);
				toast.success("Đã cập nhật câu hỏi.");
			},
		}),
	);
	const deleteItem = useMutation(
		orpc.assessments.deleteItem.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await onRefresh();
				toast.success("Đã xóa câu hỏi.");
			},
		}),
	);

	return (
		<div className="space-y-3 border bg-background p-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<p className="font-medium text-sm">
						{item.ordinal}. {item.prompt}
					</p>
					<p className="text-muted-foreground text-xs">
						{item.itemType} · {item.options.length} lựa chọn
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={() => setIsEditing((value) => !value)}
						size="sm"
						type="button"
						variant="outline"
					>
						{isEditing ? "Hủy" : "Sửa"}
					</Button>
					<Button
						disabled={deleteItem.isPending}
						onClick={() => deleteItem.mutate({ itemId: item.id })}
						size="sm"
						type="button"
						variant="destructive"
					>
						Xóa
					</Button>
				</div>
			</div>
			{isEditing ? (
				<form
					className="grid gap-2 md:grid-cols-[5rem_1fr_1fr_10rem_auto]"
					onSubmit={(event) => {
						event.preventDefault();
						updateItem.mutate({
							explanation,
							itemId: item.id,
							itemType,
							ordinal,
							prompt,
						});
					}}
				>
					<Input
						min={1}
						onChange={(event) => setOrdinal(Number(event.target.value))}
						type="number"
						value={ordinal}
					/>
					<Input
						onChange={(event) => setPrompt(event.target.value)}
						value={prompt}
					/>
					<Input
						onChange={(event) => setExplanation(event.target.value)}
						value={explanation}
					/>
					<select
						className="h-9 border border-input bg-background px-2 text-xs"
						onChange={(event) =>
							setItemType(event.target.value as typeof itemType)
						}
						value={itemType}
					>
						<option value="single_choice">Một đáp án</option>
						<option value="multiple_choice">Nhiều đáp án</option>
						<option value="short_answer">Tự luận</option>
					</select>
					<Button disabled={updateItem.isPending} size="sm" type="submit">
						Lưu
					</Button>
				</form>
			) : null}
			{item.options.map((option) => (
				<AssessmentOptionEditor
					key={option.id}
					onRefresh={onRefresh}
					option={option}
				/>
			))}
			<NewOptionForm
				itemId={item.id}
				nextOrdinal={
					Math.max(0, ...item.options.map((option) => option.ordinal)) + 1
				}
				onRefresh={onRefresh}
			/>
		</div>
	);
}

type AssessmentOption = AssessmentItem["options"][number];

function AssessmentOptionEditor({
	onRefresh,
	option,
}: {
	onRefresh: () => Promise<void>;
	option: AssessmentOption;
}) {
	const [text, setText] = useState(option.text);
	const [isCorrect, setIsCorrect] = useState(option.isCorrect);
	const [ordinal, setOrdinal] = useState(option.ordinal);
	const updateOption = useMutation(
		orpc.assessments.updateOption.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: onRefresh,
		}),
	);
	const deleteOption = useMutation(
		orpc.assessments.deleteOption.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: onRefresh,
		}),
	);
	return (
		<div className="flex flex-wrap items-center gap-2 pl-4">
			<Input
				className="w-20"
				min={1}
				onChange={(event) => setOrdinal(Number(event.target.value))}
				type="number"
				value={ordinal}
			/>
			<Input
				className="min-w-40 flex-1"
				onChange={(event) => setText(event.target.value)}
				value={text}
			/>
			<label className="flex items-center gap-1 text-xs">
				<input
					checked={isCorrect}
					onChange={(event) => setIsCorrect(event.target.checked)}
					type="checkbox"
				/>
				Đúng
			</label>
			<Button
				disabled={updateOption.isPending}
				onClick={() =>
					updateOption.mutate({
						isCorrect,
						optionId: option.id,
						ordinal,
						text,
					})
				}
				size="sm"
				type="button"
				variant="outline"
			>
				Lưu
			</Button>
			<Button
				disabled={deleteOption.isPending}
				onClick={() => deleteOption.mutate({ optionId: option.id })}
				size="sm"
				type="button"
				variant="ghost"
			>
				Xóa
			</Button>
		</div>
	);
}

function NewOptionForm({
	itemId,
	nextOrdinal,
	onRefresh,
}: {
	itemId: string;
	nextOrdinal: number;
	onRefresh: () => Promise<void>;
}) {
	const [text, setText] = useState("");
	const [isCorrect, setIsCorrect] = useState(false);
	const [ordinal, setOrdinal] = useState(nextOrdinal);
	const createOption = useMutation(
		orpc.assessments.createOption.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await onRefresh();
				setText("");
				setOrdinal((value) => value + 1);
			},
		}),
	);
	return (
		<form
			className="flex flex-wrap items-center gap-2 pl-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (!text.trim()) return;
				createOption.mutate({
					assessmentItemId: itemId,
					isCorrect,
					ordinal,
					text,
				});
			}}
		>
			<Input
				className="w-20"
				min={1}
				onChange={(event) => setOrdinal(Number(event.target.value))}
				type="number"
				value={ordinal}
			/>
			<Input
				className="min-w-40 flex-1"
				onChange={(event) => setText(event.target.value)}
				placeholder="Thêm lựa chọn"
				value={text}
			/>
			<label className="flex items-center gap-1 text-xs">
				<input
					checked={isCorrect}
					onChange={(event) => setIsCorrect(event.target.checked)}
					type="checkbox"
				/>
				Đúng
			</label>
			<Button
				disabled={createOption.isPending || !text.trim()}
				size="sm"
				type="submit"
			>
				Thêm đáp án
			</Button>
		</form>
	);
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
