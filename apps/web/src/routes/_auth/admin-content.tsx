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
import {
	Archive,
	BookOpen,
	CheckCircle2,
	ChevronRight,
	CircleDot,
	ClipboardCheck,
	Clock3,
	FileClock,
	FilePlus2,
	FileText,
	FolderOpen,
	History,
	Library,
	PencilLine,
	RefreshCw,
	Search,
	Send,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import Loader from "@/components/loader";
import MarkdownContent from "@/components/markdown-content";
import SourceDocumentLibrary from "@/components/source-document-library";
import {
	contentValueToText,
	getLessonMarkdown,
} from "@/utils/content-markdown";
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
type AdminContentView = "catalog" | "reviews" | "sources";

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

const kindLabels: Record<ContentKind, string> = {
	lesson: "Bài học",
	practice: "Bài luyện tập",
	quiz: "Bài kiểm tra",
};

const statusStyles: Record<ContentStatus, string> = {
	approved: "border-blue-200 bg-blue-50 text-blue-700",
	archived: "border-slate-200 bg-slate-100 text-slate-600",
	draft: "border-slate-200 bg-slate-50 text-slate-700",
	in_review: "border-amber-200 bg-amber-50 text-amber-700",
	published: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export const Route = createFileRoute("/_auth/admin-content")({
	component: AdminContentPage,
});

function AdminContentPage() {
	const { session } = Route.useRouteContext();
	const role = session.data?.user.role;
	const isAdmin = role === "admin";
	const [activeView, setActiveView] = useState<AdminContentView>(
		isAdmin ? "reviews" : "sources",
	);
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
				className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 shadow-sm"
				role="alert"
			>
				<div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
					<ShieldCheck aria-hidden="true" className="size-5" />
				</div>
				<h1 className="font-semibold text-lg">Không có quyền truy cập</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Chỉ quản trị viên và giáo viên được quản lý tài liệu nguồn.
				</p>
			</section>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1500px] space-y-6">
			<header className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-background to-cyan-50 p-5 shadow-sm sm:p-6">
				<div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
					<div className="max-w-2xl">
						<div className="mb-3 flex items-center gap-2 font-semibold text-primary text-xs uppercase tracking-[0.16em]">
							<Sparkles aria-hidden="true" className="size-4" />
							Không gian quản trị nội dung
						</div>
						<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
							Tạo, tổ chức và kiểm duyệt học liệu
						</h1>
						<p className="mt-2 text-muted-foreground text-sm/relaxed sm:text-base">
							Quản lý toàn bộ vòng đời nội dung từ tài liệu nguồn đến phiên bản
							sẵn sàng xuất bản trong một quy trình rõ ràng.
						</p>
					</div>
					<div className="hidden items-center gap-3 rounded-2xl border border-primary/10 bg-background/80 p-3 shadow-sm backdrop-blur lg:flex">
						<div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<ShieldCheck aria-hidden="true" className="size-5" />
						</div>
						<div>
							<p className="font-semibold text-sm">Quy trình có kiểm soát</p>
							<p className="text-muted-foreground text-xs">
								Nháp → Duyệt → Xuất bản
							</p>
						</div>
					</div>
				</div>
			</header>

			<nav
				aria-label="Khu vực quản lý nội dung"
				className="grid gap-2 rounded-2xl border bg-card p-2 shadow-sm sm:grid-cols-3"
			>
				<WorkspaceTab
					active={activeView === "sources"}
					description="Tải lên và kiểm tra nguồn"
					icon={<FolderOpen aria-hidden="true" />}
					onClick={() => setActiveView("sources")}
					title="Tài liệu nguồn"
				/>
				{isAdmin ? (
					<>
						<WorkspaceTab
							active={activeView === "catalog"}
							description="Tạo và quản lý phiên bản"
							icon={<Library aria-hidden="true" />}
							onClick={() => setActiveView("catalog")}
							title="Thư viện học liệu"
						/>
						<WorkspaceTab
							active={activeView === "reviews"}
							description="Duyệt và xuất bản"
							icon={<ClipboardCheck aria-hidden="true" />}
							onClick={() => setActiveView("reviews")}
							title="Kiểm duyệt"
						/>
					</>
				) : null}
			</nav>

			{activeView === "sources" ? <SourceDocumentLibrary /> : null}
			{isAdmin && activeView === "catalog" ? <ContentCatalog /> : null}
			{isAdmin && activeView === "reviews" ? (
				<section aria-labelledby="content-workflow-title" className="space-y-5">
					<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
						<div>
							<p className="font-semibold text-primary text-xs uppercase tracking-[0.14em]">
								Hàng đợi biên tập
							</p>
							<h2
								className="mt-1 font-bold text-2xl tracking-tight"
								id="content-workflow-title"
							>
								Kiểm duyệt học liệu
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Kiểm tra nội dung và chuyển tiếp qua từng trạng thái xuất bản.
							</p>
						</div>
						{versions.data ? (
							<div className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm shadow-sm">
								<CircleDot aria-hidden="true" className="size-4 text-primary" />
								<span className="font-semibold">{versions.data.length}</span>
								<span className="text-muted-foreground">kết quả</span>
							</div>
						) : null}
					</div>

					<nav
						aria-label="Lọc theo trạng thái"
						className="flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm"
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

					{versions.isPending ? (
						<div className="flex min-h-48 items-center justify-center rounded-2xl border bg-card">
							<Loader />
						</div>
					) : null}
					{versions.isError ? (
						<QueryErrorState
							description="Hàng đợi kiểm duyệt chưa tải được. Bộ lọc hiện tại vẫn được giữ nguyên."
							onRetry={() => versions.refetch()}
							title="Không thể tải học liệu"
						/>
					) : null}
					{versions.data?.length === 0 ? (
						<Empty className="min-h-64 rounded-2xl border bg-card">
							<EmptyHeader>
								<div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<ClipboardCheck aria-hidden="true" className="size-6" />
								</div>
								<EmptyTitle>Không có học liệu</EmptyTitle>
								<EmptyDescription>
									Chưa có học liệu ở trạng thái đã chọn.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : null}
					{versions.data ? (
						<div className="grid items-start gap-4 xl:grid-cols-2">
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

type WorkspaceTabProps = {
	active: boolean;
	description: string;
	icon: ReactNode;
	onClick: () => void;
	title: string;
};

function WorkspaceTab({
	active,
	description,
	icon,
	onClick,
	title,
}: WorkspaceTabProps) {
	return (
		<button
			aria-pressed={active}
			className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
				active
					? "bg-primary text-primary-foreground shadow-sm"
					: "text-foreground hover:bg-primary/5"
			}`}
			onClick={onClick}
			type="button"
		>
			<span
				className={`flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5 ${
					active ? "bg-white/15" : "bg-primary/10 text-primary"
				}`}
			>
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-semibold text-sm">{title}</span>
				<span
					className={`mt-0.5 block truncate text-xs ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}
				>
					{description}
				</span>
			</span>
			<ChevronRight
				aria-hidden="true"
				className={`size-4 shrink-0 ${active ? "opacity-100" : "opacity-30"}`}
			/>
		</button>
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
	const [archiveTarget, setArchiveTarget] = useState<{
		id: string;
		title: string;
	} | null>(null);
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
				setArchiveTarget(null);
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

	return (
		<section aria-labelledby="content-catalog-title" className="space-y-5">
			<div>
				<p className="font-semibold text-primary text-xs uppercase tracking-[0.14em]">
					Kho nội dung
				</p>
				<h2
					className="mt-1 font-bold text-2xl tracking-tight"
					id="content-catalog-title"
				>
					Thư viện học liệu
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Tạo nội dung mới, quản lý phiên bản và theo dõi lịch sử thay đổi.
				</p>
			</div>

			<div className="grid items-start gap-5 xl:grid-cols-[minmax(19rem,0.75fr)_minmax(32rem,1.25fr)]">
				<Card className="hover:translate-y-0">
					<CardHeader className="border-b bg-primary/[0.04]">
						<div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<FilePlus2 aria-hidden="true" className="size-5" />
						</div>
						<CardTitle>Tạo học liệu</CardTitle>
						<CardDescription>
							Khởi tạo học liệu cùng phiên bản nháp đầu tiên.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 pt-1">
						<label className="block space-y-1.5 font-medium text-sm">
							<span>Khóa học</span>
							<select
								className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-3 focus:ring-primary/15"
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
						{courses.isError ? (
							<div
								className="flex items-center justify-between gap-2 text-destructive text-xs"
								role="alert"
							>
								<span>Không thể tải danh sách khóa học.</span>
								<Button
									onClick={() => void courses.refetch()}
									size="xs"
									type="button"
									variant="outline"
								>
									Thử lại
								</Button>
							</div>
						) : null}
						<label className="block space-y-1.5 font-medium text-sm">
							<span>Loại học liệu</span>
							<select
								className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-3 focus:ring-primary/15"
								onChange={(event) => setKind(event.target.value as ContentKind)}
								value={kind}
							>
								<option value="lesson">Bài học</option>
								<option value="quiz">Bài kiểm tra</option>
								<option value="practice">Bài luyện tập</option>
							</select>
						</label>
						<label className="block space-y-1.5 font-medium text-sm">
							<span>Tiêu đề</span>
							<Input
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Ví dụ: Làm quen với Python"
								value={title}
							/>
						</label>
						<details className="group rounded-xl border bg-muted/20 p-3">
							<summary className="cursor-pointer font-semibold text-sm marker:text-primary">
								Cấu hình nâng cao
							</summary>
							<p className="mt-1 text-muted-foreground text-xs">
								Chỉ chỉnh sửa khi bạn cần nhập dữ liệu JSON thủ công.
							</p>
							<div className="mt-3 space-y-3">
								<label className="block space-y-1.5 font-medium text-xs">
									<span>Nội dung (JSON)</span>
									<Textarea
										className="min-h-28 font-mono"
										onChange={(event) => setBody(event.target.value)}
										value={body}
									/>
								</label>
								<label className="block space-y-1.5 font-medium text-xs">
									<span>Metadata (JSON)</span>
									<Textarea
										className="min-h-24 font-mono"
										onChange={(event) => setMetadata(event.target.value)}
										value={metadata}
									/>
								</label>
							</div>
						</details>
					</CardContent>
					<CardFooter>
						<Button
							className="w-full"
							disabled={createDraft.isPending || courses.isPending}
							onClick={handleCreateDraft}
							type="button"
						>
							<FilePlus2 aria-hidden="true" />
							{createDraft.isPending ? "Đang tạo…" : "Tạo bản nháp"}
						</Button>
					</CardFooter>
				</Card>

				<Card className="min-w-0 hover:translate-y-0">
					<CardHeader className="border-b">
						<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
							<div>
								<CardTitle>Danh mục nội dung</CardTitle>
								<CardDescription className="mt-1">
									{contentItems.data?.length ?? 0} học liệu trong thư viện
								</CardDescription>
							</div>
							<label className="relative block w-full sm:max-w-xs">
								<span className="sr-only">Tìm học liệu</span>
								<Search
									aria-hidden="true"
									className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									className="pl-9"
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Tìm học liệu…"
									value={search}
								/>
							</label>
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						{contentItems.isPending ? (
							<div className="flex min-h-44 items-center justify-center">
								<Loader />
							</div>
						) : null}
						{contentItems.isError ? (
							<QueryErrorState
								description="Không thể đồng bộ danh mục nội dung ở thời điểm này."
								onRetry={() => contentItems.refetch()}
								title="Không thể tải thư viện học liệu"
							/>
						) : null}
						{!contentItems.isPending &&
						!contentItems.isError &&
						filteredContent.length === 0 ? (
							<Empty className="min-h-52 rounded-xl border border-dashed">
								<EmptyHeader>
									<div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<FileText aria-hidden="true" className="size-5" />
									</div>
									<EmptyTitle>Không tìm thấy học liệu</EmptyTitle>
									<EmptyDescription>
										Tạo bản nháp đầu tiên hoặc thử một từ khóa khác.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : null}
						<div className="space-y-2">
							{filteredContent.map((item) => {
								const displayStatus: ContentStatus | null = item.isArchived
									? "archived"
									: item.latestStatus;
								const isSelected = selectedContentId === item.contentId;
								return (
									<article
										className={`rounded-xl border p-3 transition-colors ${
											isSelected
												? "border-primary/40 bg-primary/[0.04]"
												: "bg-background hover:border-primary/20"
										}`}
										key={item.contentId}
									>
										<div className="flex min-w-0 items-start gap-3">
											<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
												<ContentKindIcon kind={item.kind} />
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<h3 className="truncate font-semibold text-sm">
														{item.title}
													</h3>
													{displayStatus ? (
														<StatusBadge status={displayStatus} />
													) : null}
												</div>
												<p className="mt-1 text-muted-foreground text-xs">
													{kindLabels[item.kind]} · {item.versionCount} phiên
													bản
												</p>
											</div>
										</div>
										<div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
											<Button
												onClick={() => setSelectedContentId(item.contentId)}
												size="sm"
												type="button"
												variant={isSelected ? "default" : "outline"}
											>
												<History aria-hidden="true" />
												Lịch sử
											</Button>
											<Button
												disabled={
													item.latestStatus === "draft" ||
													createVersionDraft.isPending
												}
												onClick={() =>
													createVersionDraft.mutate({
														contentId: item.contentId,
													})
												}
												size="sm"
												type="button"
												variant="outline"
											>
												<FilePlus2 aria-hidden="true" />
												Bản nháp mới
											</Button>
											<Button
												disabled={item.isArchived || archiveContent.isPending}
												onClick={() =>
													setArchiveTarget({
														id: item.contentId,
														title: item.title,
													})
												}
												size="sm"
												type="button"
												variant="destructive"
											>
												<Archive aria-hidden="true" />
												Lưu trữ
											</Button>
										</div>
									</article>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			{selectedContentId ? (
				<section aria-live="polite" className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<History aria-hidden="true" className="size-5" />
						</div>
						<div>
							<h2 className="font-bold text-xl">Lịch sử phiên bản</h2>
							<p className="text-muted-foreground text-sm">
								Theo dõi và tiếp tục xử lý từng phiên bản nội dung.
							</p>
						</div>
					</div>
					{history.isPending ? (
						<div className="flex min-h-40 items-center justify-center rounded-2xl border bg-card">
							<Loader />
						</div>
					) : null}
					{history.isError ? (
						<QueryErrorState
							description="Dữ liệu phiên bản của học liệu này chưa tải được."
							onRetry={() => history.refetch()}
							title="Không thể tải lịch sử phiên bản"
						/>
					) : null}
					{history.data ? (
						<div className="grid items-start gap-4 xl:grid-cols-2">
							{history.data.versions.map((version) => (
								<ContentVersionCard key={version.id} version={version} />
							))}
						</div>
					) : null}
				</section>
			) : null}
			<ConfirmActionDialog
				confirmLabel="Lưu trữ học liệu"
				description={`${archiveTarget?.title ?? "Học liệu"} và mọi phiên bản đang hoạt động sẽ được chuyển vào kho lưu trữ.`}
				isPending={archiveContent.isPending}
				onCancel={() => setArchiveTarget(null)}
				onConfirm={() => {
					if (archiveTarget) {
						archiveContent.mutate({ contentId: archiveTarget.id });
					}
				}}
				open={archiveTarget !== null}
				title="Lưu trữ học liệu?"
			/>
		</section>
	);
}

function ContentKindIcon({ kind }: { kind: ContentKind }) {
	switch (kind) {
		case "lesson":
			return <BookOpen aria-hidden="true" className="size-5" />;
		case "practice":
			return <PencilLine aria-hidden="true" className="size-5" />;
		case "quiz":
			return <ClipboardCheck aria-hidden="true" className="size-5" />;
	}
}

function StatusBadge({ status }: { status: ContentStatus }) {
	return (
		<span
			className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-semibold text-[11px] ${statusStyles[status]}`}
		>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
			{statusLabels[status]}
		</span>
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
			className="shrink-0"
			onClick={onClick}
			size="sm"
			type="button"
			variant={active ? "default" : "outline"}
		>
			{children}
		</Button>
	);
}

function QueryErrorState({
	description,
	onRetry,
	title,
}: {
	description: string;
	onRetry: () => Promise<unknown>;
	title: string;
}) {
	return (
		<section
			className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.06] p-4 sm:flex-row sm:items-center"
			role="alert"
		>
			<div>
				<h3 className="font-semibold text-sm">{title}</h3>
				<p className="mt-1 text-muted-foreground text-xs/relaxed">
					{description}
				</p>
			</div>
			<Button
				onClick={() => void onRetry()}
				size="sm"
				type="button"
				variant="outline"
			>
				<RefreshCw aria-hidden="true" />
				Thử lại
			</Button>
		</section>
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
	const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
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
			setIsArchiveDialogOpen(false);
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
	const learnerPreviewMarkdown = getLessonMarkdown(version.body);

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
				<PencilLine aria-hidden="true" />
				Chỉnh sửa
			</Button>
		);
	};

	return (
		<>
			<Card className="hover:translate-y-0">
				<CardHeader className="border-b bg-gradient-to-r from-primary/[0.04] to-transparent">
					<div className="flex min-w-0 items-start gap-3">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<ContentKindIcon kind={version.kind} />
						</div>
						<div className="min-w-0 flex-1">
							<div className="mb-1.5 flex flex-wrap items-center gap-2">
								<StatusBadge status={version.status} />
								<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
									<FileClock aria-hidden="true" className="size-3.5" />
									Phiên bản {version.versionNumber}
								</span>
							</div>
							<CardTitle className="line-clamp-2 text-lg">
								{version.title}
							</CardTitle>
							<CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
								<span>{kindLabels[version.kind]}</span>
								<span className="inline-flex items-center gap-1">
									<Clock3 aria-hidden="true" className="size-3.5" />
									Cập nhật {formatAdminDate(version.updatedAt)}
								</span>
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{isEditing ? (
						<div className="space-y-4 rounded-xl border border-primary/15 bg-primary/[0.025] p-4">
							<div>
								<h4 className="font-semibold text-sm">Chỉnh sửa bản nháp</h4>
								<p className="mt-0.5 text-muted-foreground text-xs">
									Kiểm tra JSON trước khi lưu thay đổi.
								</p>
							</div>
							<label className="block space-y-1.5 font-medium text-xs">
								<span>Tiêu đề</span>
								<Input
									onChange={(event) => setTitle(event.target.value)}
									value={title}
								/>
							</label>
							<label className="block space-y-1.5 font-medium text-xs">
								<span>Nội dung (JSON)</span>
								<Textarea
									className="min-h-44 font-mono text-xs"
									onChange={(event) => setBody(event.target.value)}
									value={body}
								/>
							</label>
							<label className="block space-y-1.5 font-medium text-xs">
								<span>Metadata (JSON)</span>
								<Textarea
									className="min-h-24 font-mono text-xs"
									onChange={(event) => setMetadata(event.target.value)}
									value={metadata}
								/>
							</label>
						</div>
					) : (
						<>
							<div className="rounded-xl border bg-slate-50 p-4">
								<div className="mb-2 flex items-center gap-2 font-semibold text-slate-700 text-xs uppercase tracking-wide">
									<FileText
										aria-hidden="true"
										className="size-4 text-primary"
									/>
									Nội dung xem nhanh
								</div>
								<p className="line-clamp-6 whitespace-pre-line text-slate-700 text-sm/relaxed">
									{getContentPreview(version.body)}
								</p>
							</div>
							{learnerPreviewMarkdown ? (
								<details className="overflow-hidden rounded-xl border bg-background">
									<summary className="cursor-pointer px-3 py-3 font-medium text-muted-foreground text-xs hover:text-foreground">
										Mở bản xem trước như học viên
									</summary>
									<div className="max-h-[32rem] overflow-auto border-t px-4 py-2">
										<MarkdownContent
											className="max-w-none"
											content={learnerPreviewMarkdown}
										/>
									</div>
								</details>
							) : null}
							<details className="rounded-xl border bg-background p-3">
								<summary className="cursor-pointer font-medium text-muted-foreground text-xs hover:text-foreground">
									Xem dữ liệu JSON đầy đủ
								</summary>
								<pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-slate-100 text-xs">
									{JSON.stringify(version.body, null, 2)}
								</pre>
							</details>
						</>
					)}
				</CardContent>
				<AssessmentEditor
					contentVersionId={version.id}
					enabled={version.kind === "quiz"}
				/>
				<CardFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
					{renderDraftActions()}
					{version.status !== "archived" && !isEditing ? (
						<Button
							className="w-full sm:w-auto"
							disabled={isTransitioning}
							onClick={() => setIsArchiveDialogOpen(true)}
							type="button"
							variant="destructive"
						>
							<Archive aria-hidden="true" />
							Lưu trữ phiên bản
						</Button>
					) : null}
					{actionLabels[version.status] && !isEditing ? (
						<Button
							className="w-full sm:w-auto"
							disabled={isTransitioning}
							onClick={handleTransition}
							type="button"
						>
							<TransitionIcon status={version.status} />
							{isTransitioning ? "Đang xử lý…" : actionLabels[version.status]}
						</Button>
					) : null}
				</CardFooter>
			</Card>
			<ConfirmActionDialog
				confirmLabel="Lưu trữ phiên bản"
				description={`Phiên bản ${version.versionNumber} của ${version.title} sẽ không còn nằm trong luồng nội dung đang hoạt động.`}
				isPending={archive.isPending}
				onCancel={() => setIsArchiveDialogOpen(false)}
				onConfirm={() => archive.mutate({ contentVersionId: version.id })}
				open={isArchiveDialogOpen}
				title="Lưu trữ phiên bản?"
			/>
		</>
	);
}

function TransitionIcon({ status }: { status: ContentStatus }) {
	switch (status) {
		case "draft":
			return <Send aria-hidden="true" />;
		case "in_review":
			return <CheckCircle2 aria-hidden="true" />;
		case "approved":
			return <Sparkles aria-hidden="true" />;
		case "archived":
		case "published":
			return null;
	}
}

const formatAdminDate = (value: Date | string): string =>
	new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));

const getContentPreview = (body: unknown): string => {
	if (!isJsonObject(body)) {
		return contentValueToText(body) || "Chưa có nội dung xem trước.";
	}
	const preferredFields = [
		"summary",
		"description",
		"content",
		"markdown",
		"instructions",
	] as const;
	for (const field of preferredFields) {
		const text = contentValueToText(body[field]).trim();
		if (text) return text;
	}
	return contentValueToText(body).trim() || "Chưa có nội dung xem trước.";
};

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
		<CardContent className="space-y-4 border-t bg-primary/[0.025] pt-4">
			<div className="flex items-start gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<ClipboardCheck aria-hidden="true" className="size-4" />
				</div>
				<div>
					<h4 className="font-semibold text-sm">Câu hỏi và đáp án</h4>
					<p className="text-muted-foreground text-xs">
						Quản lý các câu hỏi của phiên bản quiz này.
					</p>
				</div>
			</div>
			<form
				className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2"
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
				<label className="space-y-1.5 font-medium text-xs">
					<span>Thứ tự</span>
					<Input
						min={1}
						onChange={(event) => setOrdinal(Number(event.target.value))}
						type="number"
						value={ordinal}
					/>
				</label>
				<label className="space-y-1.5 font-medium text-xs sm:col-span-2">
					<span>Câu hỏi</span>
					<Input
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="Nhập nội dung câu hỏi"
						value={prompt}
					/>
				</label>
				<label className="space-y-1.5 font-medium text-xs sm:col-span-2">
					<span>Giải thích</span>
					<Input
						onChange={(event) => setExplanation(event.target.value)}
						placeholder="Giải thích đáp án"
						value={explanation}
					/>
				</label>
				<label className="space-y-1.5 font-medium text-xs">
					<span>Loại</span>
					<select
						className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
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
				<Button
					className="sm:col-span-2"
					disabled={createItem.isPending || !prompt.trim()}
					type="submit"
				>
					<FilePlus2 aria-hidden="true" />
					Thêm câu hỏi
				</Button>
			</form>
			{items.isPending ? (
				<p className="text-muted-foreground text-xs">Đang tải câu hỏi…</p>
			) : null}
			{items.isError ? (
				<QueryErrorState
					description="Danh sách câu hỏi của phiên bản quiz này chưa tải được."
					onRetry={() => items.refetch()}
					title="Không thể tải câu hỏi"
				/>
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
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
				setIsDeleteDialogOpen(false);
				toast.success("Đã xóa câu hỏi.");
			},
		}),
	);

	return (
		<>
			<div className="space-y-3 rounded-xl border bg-background p-4">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
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
							onClick={() => setIsDeleteDialogOpen(true)}
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
						className="grid gap-2 rounded-xl bg-muted/30 p-3 sm:grid-cols-2"
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
							aria-label="Thứ tự câu hỏi"
							min={1}
							onChange={(event) => setOrdinal(Number(event.target.value))}
							type="number"
							value={ordinal}
						/>
						<Input
							aria-label="Nội dung câu hỏi"
							onChange={(event) => setPrompt(event.target.value)}
							value={prompt}
						/>
						<Input
							aria-label="Giải thích đáp án"
							onChange={(event) => setExplanation(event.target.value)}
							value={explanation}
						/>
						<select
							aria-label="Loại câu hỏi"
							className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
							onChange={(event) =>
								setItemType(event.target.value as typeof itemType)
							}
							value={itemType}
						>
							<option value="single_choice">Một đáp án</option>
							<option value="multiple_choice">Nhiều đáp án</option>
							<option value="short_answer">Tự luận</option>
						</select>
						<Button
							className="sm:col-span-2"
							disabled={updateItem.isPending}
							size="sm"
							type="submit"
						>
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
			<ConfirmActionDialog
				confirmLabel="Xóa câu hỏi"
				description={`Câu hỏi “${item.prompt}” và toàn bộ lựa chọn trả lời sẽ bị xóa vĩnh viễn.`}
				isPending={deleteItem.isPending}
				onCancel={() => setIsDeleteDialogOpen(false)}
				onConfirm={() => deleteItem.mutate({ itemId: item.id })}
				open={isDeleteDialogOpen}
				title="Xóa câu hỏi?"
			/>
		</>
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
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const updateOption = useMutation(
		orpc.assessments.updateOption.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: onRefresh,
		}),
	);
	const deleteOption = useMutation(
		orpc.assessments.deleteOption.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await onRefresh();
				setIsDeleteDialogOpen(false);
			},
		}),
	);
	return (
		<>
			<div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/15 p-2 sm:ml-4">
				<Input
					aria-label="Thứ tự đáp án"
					className="w-20"
					min={1}
					onChange={(event) => setOrdinal(Number(event.target.value))}
					type="number"
					value={ordinal}
				/>
				<Input
					aria-label="Nội dung đáp án"
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
					onClick={() => setIsDeleteDialogOpen(true)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Xóa
				</Button>
			</div>
			<ConfirmActionDialog
				confirmLabel="Xóa đáp án"
				description={`Lựa chọn “${option.text}” sẽ bị xóa khỏi câu hỏi này.`}
				isPending={deleteOption.isPending}
				onCancel={() => setIsDeleteDialogOpen(false)}
				onConfirm={() => deleteOption.mutate({ optionId: option.id })}
				open={isDeleteDialogOpen}
				title="Xóa lựa chọn trả lời?"
			/>
		</>
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
			className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/20 bg-primary/[0.025] p-2 sm:ml-4"
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
				aria-label="Thứ tự đáp án mới"
				className="w-20"
				min={1}
				onChange={(event) => setOrdinal(Number(event.target.value))}
				type="number"
				value={ordinal}
			/>
			<Input
				aria-label="Nội dung đáp án mới"
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
