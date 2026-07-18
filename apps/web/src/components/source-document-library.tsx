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
	EmptyMedia,
	EmptyTitle,
} from "@MindBridge/ui/components/empty";
import { Input } from "@MindBridge/ui/components/input";
import { Textarea } from "@MindBridge/ui/components/textarea";
import {
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	Clock3,
	FileStack,
	FileText,
	Loader2,
	RefreshCw,
	Save,
	Search,
	Trash2,
	UploadCloud,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

const EMPTY_DOCUMENT_ID = "00000000-0000-0000-0000-000000000000";

type SourceDocument = Awaited<
	ReturnType<typeof orpc.sourceDocuments.list.call>
>[number];

type SourceMode = "paste" | "upload";

const sourceName = (document: {
	createdAt: Date | string;
	fileName: string | null;
}): string =>
	document.fileName ?? `Văn bản dán ${formatDate(document.createdAt)}`;

const formatDate = (value: Date | string): string =>
	new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));

const statusLabels = {
	completed: "Đã xử lý",
	failed: "Xử lý lỗi",
	pending: "Đang xử lý",
} as const;

const statusClassNames = {
	completed:
		"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
	failed:
		"border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/15",
	pending:
		"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
} as const;

const StatusBadge = ({
	status,
}: {
	status: SourceDocument["extractionStatus"];
}) => (
	<span
		className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold text-[11px] ${statusClassNames[status]}`}
	>
		{status === "completed" ? (
			<CheckCircle2 aria-hidden="true" className="size-3" />
		) : null}
		{status === "pending" ? (
			<Clock3 aria-hidden="true" className="size-3" />
		) : null}
		{status === "failed" ? (
			<AlertCircle aria-hidden="true" className="size-3" />
		) : null}
		{statusLabels[status]}
	</span>
);

export default function SourceDocumentLibrary() {
	const queryClient = useQueryClient();
	const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
	const [pastedText, setPastedText] = useState("");
	const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
	const [searchQuery, setSearchQuery] = useState("");
	const documents = useQuery(orpc.sourceDocuments.list.queryOptions());
	const detail = useQuery(
		orpc.sourceDocuments.detail.queryOptions({
			enabled: Boolean(selectedDocumentId),
			input: { documentId: selectedDocumentId ?? EMPTY_DOCUMENT_ID },
		}),
	);

	useEffect(() => {
		if (!documents.data) {
			return;
		}

		const selectedDocumentExists = documents.data.some(
			(document) => document.id === selectedDocumentId,
		);
		if (selectedDocumentId && !selectedDocumentExists) {
			setSelectedDocumentId(documents.data[0]?.id);
			return;
		}
		if (!selectedDocumentId && documents.data.length > 0) {
			setSelectedDocumentId(documents.data[0]?.id);
		}
	}, [documents.data, selectedDocumentId]);

	const filteredDocuments = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLocaleLowerCase("vi");
		if (!normalizedQuery) {
			return documents.data ?? [];
		}

		return (documents.data ?? []).filter((document) => {
			const searchableText = `${sourceName(document)} ${document.preview ?? ""}`;
			return searchableText.toLocaleLowerCase("vi").includes(normalizedQuery);
		});
	}, [documents.data, searchQuery]);

	useEffect(() => {
		if (!searchQuery.trim()) {
			return;
		}
		const selectedDocumentIsVisible = filteredDocuments.some(
			(document) => document.id === selectedDocumentId,
		);
		if (!selectedDocumentIsVisible) {
			setSelectedDocumentId(filteredDocuments[0]?.id);
		}
	}, [filteredDocuments, searchQuery, selectedDocumentId]);

	const completedCount =
		documents.data?.filter(
			(document) => document.extractionStatus === "completed",
		).length ?? 0;

	const refreshDocuments = async (): Promise<void> => {
		await queryClient.invalidateQueries({
			queryKey: orpc.sourceDocuments.list.key(),
		});
	};

	const upload = useMutation(
		orpc.sourceDocuments.upload.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (result) => {
				await refreshDocuments();
				setSelectedDocumentId(result.documentId);
				toast.success("Đã thêm tài liệu nguồn.");
			},
		}),
	);
	const paste = useMutation(
		orpc.sourceDocuments.paste.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (result) => {
				if (result.type === "conversion_error") {
					toast.error(result.message);
					return;
				}
				await refreshDocuments();
				setPastedText("");
				setSelectedDocumentId(result.documentId);
				toast.success("Đã thêm văn bản nguồn.");
			},
		}),
	);

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0];
		if (file) {
			upload.mutate({ file });
		}
		event.target.value = "";
	};

	return (
		<section aria-labelledby="source-library-title" className="space-y-5">
			<header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<FileStack aria-hidden="true" className="size-5" />
					</div>
					<div>
						<h1
							className="font-semibold text-2xl tracking-tight"
							id="source-library-title"
						>
							Thư viện tài liệu nguồn
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							Quản lý nguồn đầu vào dùng để tạo bài học và đánh giá.
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 text-sm">
					<span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
						{documents.data?.length ?? 0} tài liệu
					</span>
					<span className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
						{completedCount} sẵn sàng
					</span>
				</div>
			</header>

			<Card className="hover:translate-y-0 hover:shadow-[0_8px_24px_oklch(0.3_0.06_255/8%)]">
				<CardHeader className="border-b">
					<CardTitle>Thêm nguồn học liệu</CardTitle>
					<CardDescription>
						Tải tệp tối đa 50 MB hoặc dán nội dung có sẵn.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 pt-1 lg:grid-cols-[13rem_1fr]">
					<div
						aria-label="Cách thêm nguồn"
						className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:content-start"
						role="group"
					>
						<Button
							aria-pressed={sourceMode === "upload"}
							className="justify-start"
							onClick={() => setSourceMode("upload")}
							type="button"
							variant={sourceMode === "upload" ? "secondary" : "ghost"}
						>
							<UploadCloud aria-hidden="true" />
							Tải tệp lên
						</Button>
						<Button
							aria-pressed={sourceMode === "paste"}
							className="justify-start"
							onClick={() => setSourceMode("paste")}
							type="button"
							variant={sourceMode === "paste" ? "secondary" : "ghost"}
						>
							<FileText aria-hidden="true" />
							Dán văn bản
						</Button>
					</div>

					{sourceMode === "upload" ? (
						<label className="group relative block cursor-pointer rounded-2xl focus-within:outline-none focus-within:ring-3 focus-within:ring-ring/25">
							<Input
								aria-label="Chọn tài liệu nguồn để tải lên"
								accept=".md,.markdown,.pdf,text/markdown,application/pdf"
								className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
								disabled={upload.isPending}
								onChange={handleFileChange}
								type="file"
							/>
							<span
								aria-hidden="true"
								className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-border border-dashed bg-muted/20 p-6 text-center transition-colors group-hover:border-primary/50 group-hover:bg-primary/5"
							>
								<span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
									{upload.isPending ? (
										<Loader2
											aria-hidden="true"
											className="size-5 animate-spin"
										/>
									) : (
										<UploadCloud aria-hidden="true" className="size-5" />
									)}
								</span>
								<span className="font-semibold">
									{upload.isPending
										? "Đang tải và xử lý tài liệu…"
										: "Chọn tài liệu từ thiết bị"}
								</span>
								<span className="mt-1 text-muted-foreground text-xs">
									Tệp tài liệu có nội dung văn bản · Tối đa 50 MB
								</span>
							</span>
						</label>
					) : (
						<div className="space-y-3">
							<label className="block space-y-1.5 font-medium text-sm">
								<span>Nội dung nguồn</span>
								<Textarea
									className="min-h-32 resize-y"
									disabled={paste.isPending}
									onChange={(event) => setPastedText(event.target.value)}
									placeholder="Dán nội dung Markdown hoặc văn bản đã trích xuất…"
									value={pastedText}
								/>
							</label>
							<div className="flex items-center justify-between gap-3">
								<span className="text-muted-foreground text-xs">
									{pastedText.trim().length.toLocaleString("vi-VN")} ký tự
								</span>
								<Button
									disabled={!pastedText.trim() || paste.isPending}
									onClick={() => paste.mutate({ text: pastedText.trim() })}
									type="button"
								>
									{paste.isPending ? (
										<Loader2 aria-hidden="true" className="animate-spin" />
									) : (
										<FileText aria-hidden="true" />
									)}
									{paste.isPending ? "Đang thêm…" : "Thêm vào thư viện"}
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<div className="grid items-start gap-5 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(32rem,1.22fr)]">
				<Card className="hover:translate-y-0 hover:shadow-[0_8px_24px_oklch(0.3_0.06_255/8%)]">
					<CardHeader className="border-b">
						<CardTitle>Danh sách tài liệu</CardTitle>
						<CardDescription>
							Chọn một nguồn để xem nội dung đã trích xuất.
						</CardDescription>
						<div className="relative mt-2">
							<Search
								aria-hidden="true"
								className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label="Tìm tài liệu"
								className="pl-9"
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Tìm theo tên hoặc nội dung…"
								value={searchQuery}
							/>
						</div>
					</CardHeader>
					<CardContent className="px-2">
						<DocumentList
							documents={filteredDocuments}
							isError={documents.isError}
							isPending={documents.isPending}
							onRetry={() => documents.refetch()}
							onSelect={setSelectedDocumentId}
							searchQuery={searchQuery}
							selectedDocumentId={selectedDocumentId}
						/>
					</CardContent>
				</Card>

				<div className="min-w-0 xl:sticky xl:top-20">
					<SourceDocumentDetail
						detail={detail}
						documentId={selectedDocumentId}
						onDeleted={() => setSelectedDocumentId(undefined)}
						onUpdated={refreshDocuments}
					/>
				</div>
			</div>
		</section>
	);
}

function DocumentList({
	documents,
	isError,
	isPending,
	onRetry,
	onSelect,
	searchQuery,
	selectedDocumentId,
}: {
	documents: SourceDocument[];
	isError: boolean;
	isPending: boolean;
	onRetry: () => Promise<unknown>;
	onSelect: (documentId: string) => void;
	searchQuery: string;
	selectedDocumentId?: string;
}) {
	if (isPending) {
		return (
			<div
				aria-busy="true"
				aria-label="Đang tải tài liệu"
				className="space-y-2"
				role="status"
			>
				{["first", "second", "third"].map((item) => (
					<div className="h-24 animate-pulse rounded-xl bg-muted" key={item} />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<Empty className="min-h-64 rounded-xl border">
				<EmptyHeader>
					<EmptyMedia className="text-destructive" variant="icon">
						<AlertCircle aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>Không thể tải thư viện</EmptyTitle>
					<EmptyDescription>
						Kiểm tra kết nối rồi thử tải lại dữ liệu.
					</EmptyDescription>
				</EmptyHeader>
				<Button
					onClick={async () => {
						await onRetry();
					}}
					size="sm"
					type="button"
					variant="outline"
				>
					<RefreshCw aria-hidden="true" />
					Thử lại
				</Button>
			</Empty>
		);
	}

	if (documents.length === 0) {
		return (
			<Empty className="min-h-64 rounded-xl border">
				<EmptyHeader>
					<EmptyMedia className="text-muted-foreground" variant="icon">
						<FileText aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>
						{searchQuery ? "Không tìm thấy tài liệu" : "Chưa có tài liệu nguồn"}
					</EmptyTitle>
					<EmptyDescription>
						{searchQuery
							? "Thử tên hoặc từ khóa khác."
							: "Tải tệp hoặc dán văn bản để bắt đầu."}
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="max-h-[36rem] space-y-1.5 overflow-y-auto pr-1">
			{documents.map((document) => {
				const isSelected = selectedDocumentId === document.id;
				return (
					<button
						aria-pressed={isSelected}
						className="group relative w-full rounded-xl border border-transparent p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary/25 aria-pressed:bg-primary/8"
						key={document.id}
						onClick={() => onSelect(document.id)}
						type="button"
					>
						<span className="flex items-start gap-3">
							<span
								className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
									isSelected
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground"
								}`}
							>
								<FileText aria-hidden="true" className="size-4" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-center justify-between gap-2">
									<span className="truncate font-semibold">
										{sourceName(document)}
									</span>
									<StatusBadge status={document.extractionStatus} />
								</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									{document.chunkCount} đoạn · {formatDate(document.updatedAt)}
								</span>
								{document.preview ? (
									<span className="mt-1.5 line-clamp-2 block text-muted-foreground text-xs/relaxed">
										{document.preview}
									</span>
								) : null}
							</span>
							<ChevronRight
								aria-hidden="true"
								className={`mt-2 size-4 shrink-0 transition-transform ${
									isSelected
										? "translate-x-0 text-primary"
										: "-translate-x-1 text-muted-foreground/60 group-hover:translate-x-0"
								}`}
							/>
						</span>
					</button>
				);
			})}
		</div>
	);
}

type DetailQuery = UseQueryResult<
	Awaited<ReturnType<typeof orpc.sourceDocuments.detail.call>>
>;

function SourceDocumentDetail({
	detail,
	documentId,
	onDeleted,
	onUpdated,
}: {
	detail: DetailQuery;
	documentId?: string;
	onDeleted: () => void;
	onUpdated: () => Promise<void>;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

	useEffect(() => {
		if (detail.data) {
			setName(sourceName(detail.data));
			setIsConfirmingDelete(false);
		}
	}, [detail.data]);

	const updateDocument = useMutation(
		orpc.sourceDocuments.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await onUpdated();
				if (documentId) {
					await queryClient.invalidateQueries({
						queryKey: orpc.sourceDocuments.detail.key({
							input: { documentId },
						}),
					});
				}
				toast.success("Đã cập nhật tên tài liệu.");
			},
		}),
	);
	const deleteDocument = useMutation(
		orpc.sourceDocuments.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await onUpdated();
				onDeleted();
				toast.success("Đã xóa tài liệu nguồn.");
			},
		}),
	);

	if (!documentId) {
		return (
			<Card className="min-h-[28rem] hover:translate-y-0 hover:shadow-[0_8px_24px_oklch(0.3_0.06_255/8%)]">
				<Empty className="min-h-[28rem]">
					<EmptyHeader>
						<EmptyMedia className="text-muted-foreground" variant="icon">
							<FileText aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Chọn một tài liệu</EmptyTitle>
						<EmptyDescription>
							Nội dung trích xuất và thao tác quản lý sẽ hiển thị tại đây.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</Card>
		);
	}
	if (detail.isPending) {
		return (
			<Card
				aria-busy="true"
				aria-label="Đang tải chi tiết tài liệu"
				className="min-h-[28rem] hover:translate-y-0"
			>
				<CardHeader>
					<div className="h-6 w-48 animate-pulse rounded bg-muted" />
					<div className="h-4 w-64 animate-pulse rounded bg-muted" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="h-10 animate-pulse rounded-xl bg-muted" />
					<div className="grid grid-cols-3 gap-2">
						<div className="h-16 animate-pulse rounded-xl bg-muted" />
						<div className="h-16 animate-pulse rounded-xl bg-muted" />
						<div className="h-16 animate-pulse rounded-xl bg-muted" />
					</div>
					<div className="h-52 animate-pulse rounded-xl bg-muted" />
				</CardContent>
			</Card>
		);
	}
	if (detail.isError || !detail.data) {
		return (
			<Card className="min-h-[28rem] hover:translate-y-0">
				<Empty className="min-h-[28rem]">
					<EmptyHeader>
						<EmptyMedia className="text-destructive" variant="icon">
							<AlertCircle aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Không thể tải chi tiết</EmptyTitle>
						<EmptyDescription>
							Tài liệu có thể đã thay đổi. Hãy thử tải lại.
						</EmptyDescription>
					</EmptyHeader>
					<Button
						onClick={async () => {
							await detail.refetch();
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						<RefreshCw aria-hidden="true" />
						Thử lại
					</Button>
				</Empty>
			</Card>
		);
	}

	const savedName = sourceName(detail.data);
	const isNameChanged = name.trim() !== savedName;

	return (
		<Card className="hover:translate-y-0 hover:shadow-[0_8px_24px_oklch(0.3_0.06_255/8%)]">
			<CardHeader className="border-b">
				<div className="flex min-w-0 items-start gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<FileText aria-hidden="true" className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle className="truncate">{savedName}</CardTitle>
							<StatusBadge status={detail.data.extractionStatus} />
						</div>
						<CardDescription className="mt-1">
							{detail.data.sourceType === "upload"
								? "Tài liệu tải lên"
								: "Văn bản dán trực tiếp"}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				<section aria-labelledby="document-name-label" className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<label
							className="font-semibold text-sm"
							htmlFor="document-display-name"
							id="document-name-label"
						>
							Tên hiển thị
						</label>
						{isNameChanged ? (
							<span className="text-amber-700 text-xs dark:text-amber-300">
								Chưa lưu thay đổi
							</span>
						) : null}
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							id="document-display-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
						<Button
							disabled={
								!name.trim() || !isNameChanged || updateDocument.isPending
							}
							onClick={() =>
								updateDocument.mutate({ documentId, name: name.trim() })
							}
							type="button"
						>
							{updateDocument.isPending ? (
								<Loader2 aria-hidden="true" className="animate-spin" />
							) : (
								<Save aria-hidden="true" />
							)}
							{updateDocument.isPending ? "Đang lưu…" : "Lưu thay đổi"}
						</Button>
					</div>
				</section>

				<dl className="grid gap-2 text-sm sm:grid-cols-3">
					<div className="rounded-xl border bg-muted/25 p-3">
						<dt className="text-muted-foreground text-xs">Định dạng</dt>
						<dd className="mt-1 truncate font-medium">
							{detail.data.mimeType ?? "Văn bản thuần"}
						</dd>
					</div>
					<div className="rounded-xl border bg-muted/25 p-3">
						<dt className="text-muted-foreground text-xs">Số đoạn</dt>
						<dd className="mt-1 font-medium">
							{detail.data.chunks.length.toLocaleString("vi-VN")}
						</dd>
					</div>
					<div className="rounded-xl border bg-muted/25 p-3">
						<dt className="text-muted-foreground text-xs">Cập nhật</dt>
						<dd className="mt-1 font-medium">
							{formatDate(detail.data.updatedAt)}
						</dd>
					</div>
				</dl>

				{detail.data.extractionError ? (
					<div
						className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-destructive text-sm"
						role="alert"
					>
						<AlertCircle
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0"
						/>
						<div>
							<p className="font-semibold">Không thể trích xuất nội dung</p>
							<p className="mt-0.5 opacity-90">{detail.data.extractionError}</p>
						</div>
					</div>
				) : null}

				<section aria-labelledby="source-content-title" className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<div>
							<h3 className="font-semibold" id="source-content-title">
								Nội dung đã trích xuất
							</h3>
							<p className="text-muted-foreground text-xs">
								Các đoạn này được dùng làm ngữ cảnh khi tạo học liệu.
							</p>
						</div>
						<span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-muted-foreground text-xs">
							{detail.data.chunks.length} đoạn
						</span>
					</div>
					{detail.data.chunks.length > 0 ? (
						<div className="max-h-[25rem] space-y-2 overflow-auto rounded-xl border bg-muted/20 p-2">
							{detail.data.chunks.map((chunk) => (
								<article
									className="rounded-lg border bg-background p-3"
									key={chunk.id}
								>
									<h4 className="font-semibold text-muted-foreground text-xs">
										Đoạn {chunk.ordinal}
									</h4>
									<p className="mt-1.5 whitespace-pre-wrap text-xs/relaxed">
										{chunk.text}
									</p>
								</article>
							))}
						</div>
					) : (
						<div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
							{detail.data.extractionStatus === "pending"
								? "Tài liệu đang được xử lý. Nội dung sẽ sớm xuất hiện."
								: "Tài liệu chưa có nội dung trích xuất."}
						</div>
					)}
				</section>
			</CardContent>
			<CardFooter className="flex flex-wrap justify-between gap-3">
				{isConfirmingDelete ? (
					<>
						<div className="mr-auto">
							<p className="font-semibold text-destructive text-sm">
								Xóa vĩnh viễn tài liệu này?
							</p>
							<p className="text-muted-foreground text-xs">
								Các đoạn nội dung liên quan cũng sẽ bị xóa.
							</p>
						</div>
						<Button
							onClick={() => setIsConfirmingDelete(false)}
							type="button"
							variant="outline"
						>
							Hủy
						</Button>
						<Button
							disabled={deleteDocument.isPending}
							onClick={() => deleteDocument.mutate({ documentId })}
							type="button"
							variant="destructive"
						>
							{deleteDocument.isPending ? (
								<Loader2 aria-hidden="true" className="animate-spin" />
							) : (
								<Trash2 aria-hidden="true" />
							)}
							{deleteDocument.isPending ? "Đang xóa…" : "Xác nhận xóa"}
						</Button>
					</>
				) : (
					<>
						<p className="text-muted-foreground text-xs">
							Xóa tài liệu chỉ khi không còn dùng làm nguồn học liệu.
						</p>
						<Button
							onClick={() => setIsConfirmingDelete(true)}
							type="button"
							variant="destructive"
						>
							<Trash2 aria-hidden="true" />
							Xóa tài liệu
						</Button>
					</>
				)}
			</CardFooter>
		</Card>
	);
}
