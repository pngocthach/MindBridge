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
	published: "Lưu trữ",
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
				archive.mutate(input);
				break;
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
			<CardFooter className="flex flex-wrap justify-end gap-2">
				{renderDraftActions()}
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

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
