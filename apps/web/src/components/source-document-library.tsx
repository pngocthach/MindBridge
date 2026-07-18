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
import {
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

const EMPTY_DOCUMENT_ID = "00000000-0000-0000-0000-000000000000";

type SourceDocument = Awaited<
	ReturnType<typeof orpc.sourceDocuments.list.call>
>[number];

const sourceName = (document: SourceDocument): string =>
	document.fileName ?? `Văn bản dán ${formatDate(document.createdAt)}`;

const formatDate = (value: Date | string): string =>
	new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));

const statusLabels = {
	completed: "Đã xử lý",
	failed: "Lỗi xử lý",
	pending: "Đang xử lý",
} as const;

export default function SourceDocumentLibrary() {
	const queryClient = useQueryClient();
	const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
	const [pastedText, setPastedText] = useState("");
	const documents = useQuery(orpc.sourceDocuments.list.queryOptions());
	const detail = useQuery(
		orpc.sourceDocuments.detail.queryOptions({
			enabled: Boolean(selectedDocumentId),
			input: { documentId: selectedDocumentId ?? EMPTY_DOCUMENT_ID },
		}),
	);

	useEffect(() => {
		if (
			selectedDocumentId &&
			documents.data &&
			!documents.data.some((document) => document.id === selectedDocumentId)
		) {
			setSelectedDocumentId(undefined);
		}
	}, [documents.data, selectedDocumentId]);

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

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) upload.mutate({ file });
		event.target.value = "";
	};

	return (
		<section aria-labelledby="source-library-title" className="space-y-4">
			<header className="rounded-xl border bg-card/80 p-4 shadow-sm">
				<h1 className="font-semibold text-2xl" id="source-library-title">
					Thư viện tài liệu nguồn
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Tải lên, kiểm tra và quản lý các nguồn dùng để tạo học liệu.
				</p>
			</header>

			<div className="grid items-start gap-4 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(24rem,1.2fr)]">
				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Thêm tài liệu</CardTitle>
							<CardDescription>
								Tải tệp tối đa 50 MB hoặc dán văn bản trực tiếp.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<label className="block space-y-1 font-medium text-xs">
								<span>Tệp tài liệu</span>
								<Input
									disabled={upload.isPending}
									onChange={handleFileChange}
									type="file"
								/>
							</label>
							<label className="block space-y-1 font-medium text-xs">
								<span>Văn bản nguồn</span>
								<Textarea
									className="min-h-28"
									onChange={(event) => setPastedText(event.target.value)}
									placeholder="Dán nội dung tại đây…"
									value={pastedText}
								/>
							</label>
						</CardContent>
						<CardFooter className="justify-end">
							<Button
								disabled={!pastedText.trim() || paste.isPending}
								onClick={() => paste.mutate({ text: pastedText })}
								type="button"
							>
								{paste.isPending ? "Đang thêm…" : "Thêm văn bản"}
							</Button>
						</CardFooter>
					</Card>

					<section aria-label="Danh sách tài liệu" className="space-y-2">
						{documents.isPending ? (
							<p className="text-muted-foreground text-sm">
								Đang tải tài liệu…
							</p>
						) : null}
						{documents.isError ? (
							<p className="text-destructive text-sm" role="alert">
								Không thể tải thư viện tài liệu.
							</p>
						) : null}
						{documents.data?.length === 0 ? (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>Chưa có tài liệu nguồn</EmptyTitle>
									<EmptyDescription>
										Tải tệp hoặc dán văn bản để bắt đầu.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : null}
						{documents.data?.map((document) => (
							<button
								aria-pressed={selectedDocumentId === document.id}
								className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 aria-pressed:border-primary aria-pressed:bg-primary/5"
								key={document.id}
								onClick={() => setSelectedDocumentId(document.id)}
								type="button"
							>
								<span className="block font-medium">
									{sourceName(document)}
								</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									{statusLabels[document.extractionStatus]} ·{" "}
									{document.chunkCount} đoạn · {formatDate(document.updatedAt)}
								</span>
								{document.preview ? (
									<span className="mt-2 line-clamp-2 block text-sm">
										{document.preview}
									</span>
								) : null}
							</button>
						))}
					</section>
				</div>

				<SourceDocumentDetail
					detail={detail}
					documentId={selectedDocumentId}
					onDeleted={() => setSelectedDocumentId(undefined)}
					onUpdated={refreshDocuments}
				/>
			</div>
		</section>
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
			setName(
				detail.data.fileName ??
					`Văn bản dán ${formatDate(detail.data.createdAt)}`,
			);
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
			<Empty>
				<EmptyHeader>
					<EmptyTitle>Chọn một tài liệu</EmptyTitle>
					<EmptyDescription>
						Chi tiết và các đoạn trích sẽ hiển thị tại đây.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	if (detail.isPending) {
		return <p className="text-muted-foreground text-sm">Đang tải chi tiết…</p>;
	}
	if (detail.isError || !detail.data) {
		return (
			<p className="text-destructive text-sm" role="alert">
				Không thể tải chi tiết tài liệu.
			</p>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Chi tiết tài liệu</CardTitle>
				<CardDescription>
					{detail.data.sourceType === "upload" ? "Tệp tải lên" : "Văn bản dán"}{" "}
					· {statusLabels[detail.data.extractionStatus]} ·{" "}
					{detail.data.chunks.length} đoạn
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<label className="block space-y-1 font-medium text-xs">
					<span>Tên hiển thị</span>
					<Input
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</label>
				<dl className="grid gap-2 text-sm sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground">Loại nội dung</dt>
						<dd>{detail.data.mimeType ?? "Văn bản thuần"}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Cập nhật</dt>
						<dd>{formatDate(detail.data.updatedAt)}</dd>
					</div>
				</dl>
				{detail.data.extractionError ? (
					<p className="text-destructive text-sm" role="alert">
						{detail.data.extractionError}
					</p>
				) : null}
				<section aria-labelledby="source-content-title" className="space-y-2">
					<h3 className="font-medium" id="source-content-title">
						Nội dung đã trích xuất
					</h3>
					{detail.data.chunks.length > 0 ? (
						<div className="max-h-80 space-y-2 overflow-auto rounded-md border bg-muted/40 p-3">
							{detail.data.chunks.map((chunk) => (
								<article key={chunk.id}>
									<h4 className="font-medium text-muted-foreground text-xs">
										Đoạn {chunk.ordinal}
									</h4>
									<p className="mt-1 whitespace-pre-wrap text-xs">
										{chunk.text}
									</p>
								</article>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							Không có nội dung trích xuất.
						</p>
					)}
				</section>
			</CardContent>
			<CardFooter className="flex flex-wrap justify-end gap-2">
				{isConfirmingDelete ? (
					<>
						<span className="mr-auto text-destructive text-sm">
							Xóa vĩnh viễn tài liệu này?
						</span>
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
							{deleteDocument.isPending ? "Đang xóa…" : "Xác nhận xóa"}
						</Button>
					</>
				) : (
					<>
						<Button
							onClick={() => setIsConfirmingDelete(true)}
							type="button"
							variant="destructive"
						>
							Xóa
						</Button>
						<Button
							disabled={!name.trim() || updateDocument.isPending}
							onClick={() =>
								updateDocument.mutate({ documentId, name: name.trim() })
							}
							type="button"
						>
							{updateDocument.isPending ? "Đang lưu…" : "Lưu tên"}
						</Button>
					</>
				)}
			</CardFooter>
		</Card>
	);
}
