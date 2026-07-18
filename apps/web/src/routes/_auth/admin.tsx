import { Button, buttonVariants } from "@MindBridge/ui/components/button";
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
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookOpen,
	ChevronRight,
	Search,
	ShieldCheck,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

const statuses = [
	"draft",
	"in_review",
	"approved",
	"published",
	"archived",
] as const;
type ContentStatus = (typeof statuses)[number];

const statusLabels: Record<ContentStatus, string> = {
	approved: "Đã duyệt",
	archived: "Lưu trữ",
	draft: "Bản nháp",
	in_review: "Chờ duyệt",
	published: "Đã xuất bản",
};

const userRoles = ["learner", "teacher", "editor", "admin"] as const;
type UserRole = (typeof userRoles)[number];

const roleLabels: Record<UserRole, string> = {
	admin: "Quản trị viên",
	editor: "Biên tập viên",
	learner: "Học viên",
	teacher: "Giáo viên",
};

export const Route = createFileRoute("/_auth/admin")({
	component: AdminConsole,
});

function AdminConsole() {
	const { session } = Route.useRouteContext();
	const isAdmin = session.data?.user.role === "admin";

	if (!isAdmin) {
		return (
			<section
				className="rounded-none border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">403 — Không có quyền truy cập</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Admin Console chỉ dành cho quản trị viên.
				</p>
			</section>
		);
	}

	return <AdminConsoleContent />;
}

function AdminConsoleContent() {
	const [search, setSearch] = useState("");
	const [courseFilter, setCourseFilter] = useState("all");
	const [skillFilter, setSkillFilter] = useState("all");
	const [difficultyFilter, setDifficultyFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">(
		"all",
	);
	const versionsByStatus = useQueries({
		queries: statuses.map((status) =>
			orpc.contentWorkflow.list.queryOptions({ input: { status } }),
		),
	});
	const isLoading = versionsByStatus.some((query) => query.isPending);
	const isError = versionsByStatus.some((query) => query.isError);
	const versions = versionsByStatus.flatMap((query) => query.data ?? []);

	const options = useMemo(() => {
		const courses = new Set<string>();
		const skills = new Set<string>();
		const difficulties = new Set<string>();
		for (const version of versions) {
			const metadata = asMetadata(version.metadata);
			addOption(courses, metadata.courseTitle ?? metadata.courseId);
			addOption(skills, metadata.skill ?? metadata.skillName);
			addOption(difficulties, metadata.difficulty);
		}
		return {
			courses: [...courses].sort(),
			difficulties: [...difficulties].sort(),
			skills: [...skills].sort(),
		};
	}, [versions]);

	const filteredVersions = versions.filter((version) => {
		const metadata = asMetadata(version.metadata);
		const searchableText = `${version.title} ${version.kind}`.toLowerCase();
		const course = metadata.courseTitle ?? metadata.courseId;
		const skill = metadata.skill ?? metadata.skillName;
		return (
			(!search.trim() ||
				searchableText.includes(search.trim().toLowerCase())) &&
			(statusFilter === "all" || version.status === statusFilter) &&
			(courseFilter === "all" || course === courseFilter) &&
			(skillFilter === "all" || skill === skillFilter) &&
			(difficultyFilter === "all" || metadata.difficulty === difficultyFilter)
		);
	});

	return (
		<section aria-labelledby="admin-console-title" className="space-y-4">
			<header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
				<div>
					<p className="font-medium text-primary text-sm">Content Curriculum</p>
					<h1 className="mt-1 font-semibold text-3xl" id="admin-console-title">
						Admin Console
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
						Tổng quan học liệu chính thức và thư viện để đội ngũ quản trị tìm
						kiếm, lọc và kiểm duyệt nội dung.
					</p>
				</div>
				<Link className={buttonVariants()} to="/admin-content">
					Mở Content Studio
					<ChevronRight aria-hidden="true" data-icon="inline-end" />
				</Link>
			</header>

			<UserManagement />

			{isLoading ? <Loader /> : null}
			{isError ? (
				<section
					className="rounded-none border border-destructive/30 bg-destructive/10 p-6"
					role="alert"
				>
					<h2 className="font-semibold">Không thể tải thống kê</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Hãy thử lại sau ít phút.
					</p>
				</section>
			) : null}

			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
				{statuses.map((status) => {
					const count =
						versionsByStatus[statuses.indexOf(status)]?.data?.length ?? 0;
					return (
						<Card key={status} size="sm">
							<CardHeader>
								<CardDescription>{statusLabels[status]}</CardDescription>
								<CardTitle className="text-2xl">{count}</CardTitle>
							</CardHeader>
						</Card>
					);
				})}
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<BookOpen aria-hidden="true" className="size-5 text-primary" />
						<CardTitle>Thư viện học liệu</CardTitle>
					</div>
					<CardDescription>
						Tìm kiếm và lọc toàn bộ phiên bản học liệu trong hệ thống.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<label className="relative min-w-56 flex-1">
							<span className="sr-only">Tìm theo tiêu đề</span>
							<Search
								aria-hidden="true"
								className="absolute top-2.5 left-2 size-4 text-muted-foreground"
							/>
							<Input
								className="pl-8"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Tìm theo tiêu đề hoặc loại…"
								value={search}
							/>
						</label>
						<FilterSelect
							label="Khóa học"
							onChange={setCourseFilter}
							options={options.courses}
							value={courseFilter}
						/>
						<FilterSelect
							label="Kỹ năng"
							onChange={setSkillFilter}
							options={options.skills}
							value={skillFilter}
						/>
						<FilterSelect
							label="Độ khó"
							onChange={setDifficultyFilter}
							options={options.difficulties}
							value={difficultyFilter}
						/>
						<FilterSelect
							label="Trạng thái"
							onChange={(value) =>
								setStatusFilter(value as ContentStatus | "all")
							}
							options={statuses.map((status) => statusLabels[status])}
							optionValues={[...statuses]}
							value={statusFilter}
						/>
					</div>

					{filteredVersions.length === 0 && !isLoading ? (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>Không tìm thấy học liệu</EmptyTitle>
								<EmptyDescription>
									Thử thay đổi từ khóa hoặc bộ lọc.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<div className="divide-y border-y">
							{filteredVersions.map((version) => (
								<div
									className="flex flex-wrap items-center justify-between gap-3 py-3"
									key={version.id}
								>
									<div className="min-w-0">
										<p className="truncate font-medium">{version.title}</p>
										<p className="text-muted-foreground text-xs">
											{version.kind} · Phiên bản {version.versionNumber} ·{" "}
											{statusLabels[version.status]}
										</p>
									</div>
									<Link
										className={buttonVariants({
											size: "sm",
											variant: "outline",
										})}
										to="/admin-content"
									>
										Xem và xử lý
									</Link>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</section>
	);
}

function UserManagement() {
	const { session: currentSession } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const users = useQuery(orpc.users.list.queryOptions());
	const refreshUsers = async () => {
		await queryClient.invalidateQueries({ queryKey: orpc.users.list.key() });
	};
	const updateRole = useMutation(
		orpc.users.updateRole.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshUsers();
				toast.success("Đã cập nhật vai trò.");
			},
		}),
	);
	const revokeSessions = useMutation(
		orpc.users.revokeSessions.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshUsers();
				toast.success("Đã đăng xuất tài khoản khỏi mọi thiết bị.");
			},
		}),
	);
	const disableAccount = useMutation(
		orpc.users.disable.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await refreshUsers();
				toast.success("Đã vô hiệu hóa tài khoản.");
			},
		}),
	);
	const normalizedSearch = search.trim().toLowerCase();
	const filteredUsers = (users.data ?? []).filter((managedUser) =>
		`${managedUser.name} ${managedUser.email}`
			.toLowerCase()
			.includes(normalizedSearch),
	);

	const handleDisable = (userId: string, name: string) => {
		const confirmed = globalThis.confirm(
			`Vô hiệu hóa ${name}? Người dùng sẽ bị đăng xuất và không thể đăng nhập lại bằng thông tin hiện tại.`,
		);
		if (confirmed) {
			disableAccount.mutate({ userId });
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Users aria-hidden="true" className="size-5 text-primary" />
					<CardTitle>Người dùng và phân quyền</CardTitle>
				</div>
				<CardDescription>
					Quản lý vai trò, phiên đăng nhập và quyền truy cập tài khoản.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<label className="relative block max-w-md">
					<span className="sr-only">Tìm người dùng</span>
					<Search
						aria-hidden="true"
						className="absolute top-2.5 left-2 size-4 text-muted-foreground"
					/>
					<Input
						className="pl-8"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Tìm theo tên hoặc email…"
						value={search}
					/>
				</label>

				{users.isPending ? <Loader /> : null}
				{users.isError ? (
					<p className="text-destructive text-sm" role="alert">
						Không thể tải danh sách người dùng.
					</p>
				) : null}
				{!users.isPending && filteredUsers.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>Không tìm thấy người dùng</EmptyTitle>
							<EmptyDescription>Thử một từ khóa khác.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : null}

				{filteredUsers.length > 0 ? (
					<div className="overflow-x-auto border-y">
						<table className="w-full text-left text-sm">
							<thead className="text-muted-foreground text-xs">
								<tr className="border-b">
									<th className="px-2 py-3 font-medium" scope="col">
										Người dùng
									</th>
									<th className="px-2 py-3 font-medium" scope="col">
										Trạng thái
									</th>
									<th className="px-2 py-3 font-medium" scope="col">
										Vai trò
									</th>
									<th className="px-2 py-3 text-right font-medium" scope="col">
										Quản lý
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{filteredUsers.map((managedUser) => {
									const isCurrentUser =
										managedUser.id === currentSession.data?.user.id;
									const isDisabled = managedUser.credentialCount === 0;
									const isUpdatingRole =
										updateRole.isPending &&
										updateRole.variables?.userId === managedUser.id;
									return (
										<tr key={managedUser.id}>
											<td className="px-2 py-3">
												<p className="font-medium">{managedUser.name}</p>
												<p className="text-muted-foreground text-xs">
													{managedUser.email}
												</p>
											</td>
											<td className="px-2 py-3">
												<span
													className={
														isDisabled ? "text-destructive" : "text-emerald-600"
													}
												>
													{isDisabled ? "Đã vô hiệu hóa" : "Đang hoạt động"}
												</span>
												<p className="text-muted-foreground text-xs">
													{managedUser.activeSessionCount} phiên đăng nhập
												</p>
											</td>
											<td className="px-2 py-3">
												<select
													aria-label={`Vai trò của ${managedUser.name}`}
													className="h-8 border border-input bg-background px-2 text-xs"
													disabled={isUpdatingRole || isDisabled}
													onChange={(event) =>
														updateRole.mutate({
															role: event.target.value as UserRole,
															userId: managedUser.id,
														})
													}
													value={managedUser.role}
												>
													{userRoles.map((role) => (
														<option key={role} value={role}>
															{roleLabels[role]}
														</option>
													))}
												</select>
											</td>
											<td className="px-2 py-3">
												<div className="flex justify-end gap-2">
													<Button
														disabled={
															isCurrentUser ||
															managedUser.activeSessionCount === 0 ||
															revokeSessions.isPending
														}
														onClick={() =>
															revokeSessions.mutate({ userId: managedUser.id })
														}
														size="sm"
														type="button"
														variant="outline"
													>
														Đăng xuất
													</Button>
													<Button
														disabled={
															isCurrentUser ||
															isDisabled ||
															disableAccount.isPending
														}
														onClick={() =>
															handleDisable(managedUser.id, managedUser.name)
														}
														size="sm"
														type="button"
														variant="destructive"
													>
														<ShieldCheck aria-hidden="true" />
														Vô hiệu hóa
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

type FilterSelectProps = {
	label: string;
	onChange: (value: string) => void;
	options: string[];
	optionValues?: string[];
	value: string;
};

function FilterSelect({
	label,
	onChange,
	options,
	optionValues,
	value,
}: FilterSelectProps) {
	return (
		<label className="flex items-center gap-2 text-xs">
			<span className="sr-only">{label}</span>
			<select
				aria-label={label}
				className="h-8 border border-input bg-background px-2 text-xs"
				onChange={(event) => onChange(event.target.value)}
				value={value}
			>
				<option value="all">Tất cả {label.toLowerCase()}</option>
				{options.map((option, index) => (
					<option key={option} value={optionValues?.[index] ?? option}>
						{option}
					</option>
				))}
			</select>
		</label>
	);
}

const asMetadata = (value: unknown): Record<string, string> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
};

const addOption = (options: Set<string>, value: string | undefined) => {
	if (value) {
		options.add(value);
	}
};
