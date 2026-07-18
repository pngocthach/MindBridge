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
import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	CheckCircle2,
	ChevronRight,
	CircleAlert,
	Clock3,
	FileText,
	Filter,
	RefreshCw,
	Search,
	ShieldCheck,
	Sparkles,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import SkillGraphManager from "@/components/skill-graph-manager";
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

const statusStyles: Record<ContentStatus, string> = {
	approved: "border-blue-200 bg-blue-50 text-blue-700",
	archived: "border-slate-200 bg-slate-100 text-slate-600",
	draft: "border-slate-200 bg-slate-50 text-slate-700",
	in_review: "border-amber-200 bg-amber-50 text-amber-700",
	published: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const userRoles = ["learner", "teacher", "editor", "admin"] as const;
type UserRole = (typeof userRoles)[number];
type UserStatusFilter = "active" | "all" | "disabled";

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
				className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4"
				role="alert"
			>
				<Card className="w-full border-destructive/20 bg-destructive/[0.04] text-center">
					<CardContent className="flex flex-col items-center gap-3 py-8">
						<span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
							<ShieldCheck aria-hidden="true" className="size-6" />
						</span>
						<h1 className="font-semibold text-xl">Không có quyền truy cập</h1>
						<p className="max-w-sm text-muted-foreground text-sm">
							Admin Console chỉ dành cho tài khoản quản trị viên.
						</p>
						<Link
							className={buttonVariants({ variant: "outline" })}
							to="/dashboard"
						>
							Quay lại tổng quan
						</Link>
					</CardContent>
				</Card>
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
	const usersSummary = useQuery(orpc.users.list.queryOptions());
	const versionsByStatus = useQueries({
		queries: statuses.map((status) =>
			orpc.contentWorkflow.list.queryOptions({ input: { status } }),
		),
	});
	const isLoading = versionsByStatus.some((query) => query.isPending);
	const isError = versionsByStatus.some((query) => query.isError);
	const versions = versionsByStatus.flatMap((query) => query.data ?? []);
	const statusCounts = Object.fromEntries(
		statuses.map((status, index) => [
			status,
			versionsByStatus[index]?.data?.length ?? 0,
		]),
	) as Record<ContentStatus, number>;

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

	const normalizedSearch = search.trim().toLowerCase();
	const filteredVersions = versions.filter((version) => {
		const metadata = asMetadata(version.metadata);
		const searchableText =
			`${version.title} ${version.kind} ${metadata.courseTitle ?? ""} ${metadata.skill ?? metadata.skillName ?? ""}`.toLowerCase();
		const course = metadata.courseTitle ?? metadata.courseId;
		const skill = metadata.skill ?? metadata.skillName;
		return (
			(!normalizedSearch || searchableText.includes(normalizedSearch)) &&
			(statusFilter === "all" || version.status === statusFilter) &&
			(courseFilter === "all" || course === courseFilter) &&
			(skillFilter === "all" || skill === skillFilter) &&
			(difficultyFilter === "all" || metadata.difficulty === difficultyFilter)
		);
	});
	const activeUserCount =
		usersSummary.data?.filter((user) => user.credentialCount > 0).length ?? 0;
	const hasContentFilters =
		Boolean(search.trim()) ||
		courseFilter !== "all" ||
		skillFilter !== "all" ||
		difficultyFilter !== "all" ||
		statusFilter !== "all";

	const resetContentFilters = () => {
		setSearch("");
		setCourseFilter("all");
		setSkillFilter("all");
		setDifficultyFilter("all");
		setStatusFilter("all");
	};

	const retryContent = () => {
		void Promise.all(versionsByStatus.map((query) => query.refetch()));
	};

	return (
		<section
			aria-labelledby="admin-console-title"
			className="mx-auto w-full max-w-[1600px] space-y-6 pb-10"
		>
			<header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-cyan-500/[0.07] p-5 shadow-sm sm:p-7">
				<div
					aria-hidden="true"
					className="absolute -top-20 -right-16 size-60 rounded-full bg-primary/10 blur-3xl"
				/>
				<div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
					<div>
						<div className="mb-3 flex items-center gap-2 font-semibold text-primary text-xs uppercase tracking-[0.16em]">
							<Sparkles aria-hidden="true" className="size-4" />
							Trung tâm vận hành
						</div>
						<h1
							className="font-semibold text-3xl tracking-tight sm:text-4xl"
							id="admin-console-title"
						>
							Chào mừng trở lại, quản trị viên
						</h1>
						<p className="mt-3 max-w-2xl text-muted-foreground text-sm/relaxed sm:text-base/relaxed">
							Theo dõi sức khỏe hệ thống, quản lý người dùng và đưa học liệu từ
							bản nháp đến xuất bản trong một không gian thống nhất.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<a className={buttonVariants()} href="#admin-users">
							<Users aria-hidden="true" />
							Quản lý người dùng
						</a>
					</div>
				</div>
			</header>

			<nav
				aria-label="Điều hướng nhanh trong Admin Console"
				className="flex gap-2 overflow-x-auto rounded-2xl border bg-card/80 p-2 shadow-xs"
			>
				<QuickNavItem href="#admin-overview" label="Tổng quan" />
				<QuickNavItem href="#admin-users" label="Người dùng" />
				<QuickNavItem href="#admin-skills" label="Kỹ năng" />
				<QuickNavItem href="#admin-content" label="Học liệu" />
			</nav>

			<section
				aria-labelledby="admin-overview-title"
				className="scroll-mt-24 space-y-4"
				id="admin-overview"
			>
				<SectionHeading
					description="Những chỉ số quan trọng cần chú ý ngay hôm nay."
					title="Tổng quan hệ thống"
				/>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						description={`${activeUserCount} tài khoản đang hoạt động`}
						icon={Users}
						label="Tổng người dùng"
						loading={usersSummary.isPending}
						tone="blue"
						value={usersSummary.data?.length ?? 0}
					/>
					<MetricCard
						description="Cần được đội ngũ kiểm duyệt xử lý"
						icon={Clock3}
						label="Đang chờ duyệt"
						loading={isLoading}
						tone="amber"
						value={statusCounts.in_review}
					/>
					<MetricCard
						description="Sẵn sàng phục vụ học viên"
						icon={CheckCircle2}
						label="Đã xuất bản"
						loading={isLoading}
						tone="emerald"
						value={statusCounts.published}
					/>
					<MetricCard
						description="Nội dung đang trong quá trình biên soạn"
						icon={FileText}
						label="Bản nháp AI"
						loading={isLoading}
						tone="violet"
						value={statusCounts.draft}
					/>
				</div>
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
					<Card className="hover:translate-y-0">
						<CardHeader>
							<CardTitle>Luồng học liệu</CardTitle>
							<CardDescription>
								Phân bổ nội dung theo từng trạng thái xử lý.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-2 sm:grid-cols-5">
							{statuses.map((status) => (
								<button
									className="group rounded-2xl border bg-muted/25 p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
									key={status}
									onClick={() => {
										setStatusFilter(status);
										document
											.getElementById("admin-content")
											?.scrollIntoView({ behavior: "smooth" });
									}}
									type="button"
								>
									<p className="text-muted-foreground text-xs">
										{statusLabels[status]}
									</p>
									<p className="mt-1 font-semibold text-2xl">
										{isLoading ? "—" : statusCounts[status]}
									</p>
									<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary transition-all"
											style={{
												width: `${versions.length > 0 ? Math.max((statusCounts[status] / versions.length) * 100, 6) : 0}%`,
											}}
										/>
									</div>
								</button>
							))}
						</CardContent>
					</Card>
					<Card className="border-amber-200/80 bg-amber-50/60 hover:translate-y-0">
						<CardHeader>
							<div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
								<CircleAlert aria-hidden="true" className="size-5" />
							</div>
							<CardTitle>Ưu tiên hôm nay</CardTitle>
							<CardDescription>
								{statusCounts.in_review > 0
									? `${statusCounts.in_review} học liệu đang chờ quyết định kiểm duyệt.`
									: "Không có học liệu tồn đọng cần kiểm duyệt."}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link
								className={buttonVariants({
									className: "w-full",
									variant: statusCounts.in_review > 0 ? "default" : "outline",
								})}
								to="/admin-content"
							>
								{statusCounts.in_review > 0
									? "Mở hàng đợi kiểm duyệt"
									: "Xem thư viện học liệu"}
								<ChevronRight aria-hidden="true" data-icon="inline-end" />
							</Link>
						</CardContent>
					</Card>
				</div>
			</section>

			<UserManagement />

			<section
				aria-labelledby="admin-skills-title"
				className="scroll-mt-24 space-y-4"
				id="admin-skills"
			>
				<SectionHeading
					description="Tổ chức mối quan hệ giữa các kỹ năng trong lộ trình học."
					title="Bản đồ kỹ năng"
				/>
				<SkillGraphManager />
			</section>

			<section
				aria-labelledby="content-library-title"
				className="scroll-mt-24 space-y-4"
				id="admin-content"
			>
				<SectionHeading
					action={
						<Link
							className={buttonVariants({ variant: "outline" })}
							to="/admin-content"
						>
							Mở toàn bộ thư viện
							<ChevronRight aria-hidden="true" data-icon="inline-end" />
						</Link>
					}
					description="Tìm, lọc và chuyển nhanh đến phiên bản học liệu cần xử lý."
					icon={BookOpen}
					title="Thư viện học liệu"
				/>

				<Card className="hover:translate-y-0">
					<CardContent className="space-y-5 pt-1">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
							<label className="relative sm:col-span-2 xl:col-span-2">
								<span className="mb-1.5 block font-medium text-xs">
									Tìm kiếm
								</span>
								<Search
									aria-hidden="true"
									className="absolute bottom-3 left-3 size-4 text-muted-foreground"
								/>
								<Input
									className="pl-9"
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Tiêu đề, loại, khóa học hoặc kỹ năng…"
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

						<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<Filter aria-hidden="true" className="size-4" />
								<span>
									Hiển thị{" "}
									<strong className="text-foreground">
										{filteredVersions.length}
									</strong>
									/{versions.length} học liệu
								</span>
							</div>
							{hasContentFilters ? (
								<Button
									onClick={resetContentFilters}
									size="sm"
									type="button"
									variant="ghost"
								>
									<X aria-hidden="true" />
									Xóa bộ lọc
								</Button>
							) : null}
						</div>

						{isError ? (
							<InlineError
								description="Một phần dữ liệu học liệu chưa tải được. Bạn có thể thử lại mà không mất bộ lọc hiện tại."
								onRetry={retryContent}
								title="Không thể tải đầy đủ thư viện"
							/>
						) : null}

						{isLoading ? <ContentTableSkeleton /> : null}

						{!isLoading && filteredVersions.length === 0 ? (
							<Empty className="min-h-56 rounded-2xl border border-dashed bg-muted/20">
								<EmptyHeader>
									<EmptyTitle>
										{versions.length === 0
											? "Thư viện chưa có học liệu"
											: "Không tìm thấy học liệu phù hợp"}
									</EmptyTitle>
									<EmptyDescription>
										{versions.length === 0
											? "Học liệu do giáo viên và biên tập viên tạo sẽ xuất hiện ở đây để chờ kiểm duyệt."
											: "Hãy đổi từ khóa hoặc xóa bớt bộ lọc."}
									</EmptyDescription>
								</EmptyHeader>
								{hasContentFilters ? (
									<Button
										onClick={resetContentFilters}
										type="button"
										variant="outline"
									>
										Xóa toàn bộ bộ lọc
									</Button>
								) : null}
							</Empty>
						) : null}

						{!isLoading && filteredVersions.length > 0 ? (
							<ContentList versions={filteredVersions} />
						) : null}
					</CardContent>
				</Card>
			</section>
		</section>
	);
}

function UserManagement() {
	const { session: currentSession } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
	const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
	const [userPendingDisable, setUserPendingDisable] = useState<{
		id: string;
		name: string;
	} | null>(null);
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
				setUserPendingDisable(null);
				toast.success("Đã vô hiệu hóa tài khoản.");
			},
		}),
	);
	const normalizedSearch = search.trim().toLowerCase();
	const filteredUsers = (users.data ?? []).filter((managedUser) => {
		const isDisabled = managedUser.credentialCount === 0;
		const matchesSearch = `${managedUser.name} ${managedUser.email}`
			.toLowerCase()
			.includes(normalizedSearch);
		const matchesRole = roleFilter === "all" || managedUser.role === roleFilter;
		const matchesStatus =
			statusFilter === "all" ||
			(statusFilter === "active" && !isDisabled) ||
			(statusFilter === "disabled" && isDisabled);
		return matchesSearch && matchesRole && matchesStatus;
	});
	const activeUsers =
		users.data?.filter((managedUser) => managedUser.credentialCount > 0)
			.length ?? 0;
	const adminUsers =
		users.data?.filter((managedUser) => managedUser.role === "admin").length ??
		0;
	const hasFilters =
		Boolean(search.trim()) || roleFilter !== "all" || statusFilter !== "all";

	const resetFilters = () => {
		setSearch("");
		setRoleFilter("all");
		setStatusFilter("all");
	};

	return (
		<section
			aria-labelledby="admin-users-title"
			className="scroll-mt-24 space-y-4"
			id="admin-users"
		>
			<SectionHeading
				description="Quản lý quyền truy cập, vai trò và các phiên đăng nhập trên hệ thống."
				icon={Users}
				title="Người dùng và phân quyền"
			/>

			<Card className="hover:translate-y-0">
				<CardHeader className="border-b bg-muted/15">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<CardTitle>Danh sách tài khoản</CardTitle>
							<CardDescription className="mt-1">
								Thay đổi vai trò hoặc thu hồi quyền truy cập của từng tài khoản.
							</CardDescription>
						</div>
						<div className="flex flex-wrap gap-2">
							<SummaryPill label="Hoạt động" value={activeUsers} />
							<SummaryPill label="Quản trị viên" value={adminUsers} />
							<SummaryPill label="Tổng" value={users.data?.length ?? 0} />
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-5 pt-1">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_200px_200px_auto]">
						<label className="relative sm:col-span-2 lg:col-span-1">
							<span className="mb-1.5 block font-medium text-xs">Tìm kiếm</span>
							<Search
								aria-hidden="true"
								className="absolute bottom-3 left-3 size-4 text-muted-foreground"
							/>
							<Input
								className="pl-9"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Tên hoặc địa chỉ email…"
								value={search}
							/>
						</label>
						<FilterSelect
							label="Vai trò"
							onChange={(value) => setRoleFilter(value as UserRole | "all")}
							options={userRoles.map((role) => roleLabels[role])}
							optionValues={[...userRoles]}
							value={roleFilter}
						/>
						<FilterSelect
							label="Trạng thái"
							onChange={(value) => setStatusFilter(value as UserStatusFilter)}
							options={["Đang hoạt động", "Đã vô hiệu hóa"]}
							optionValues={["active", "disabled"]}
							value={statusFilter}
						/>
						<div className="flex items-end">
							<Button
								className="w-full lg:w-auto"
								disabled={!hasFilters}
								onClick={resetFilters}
								type="button"
								variant="ghost"
							>
								<X aria-hidden="true" />
								Xóa lọc
							</Button>
						</div>
					</div>

					<div className="flex items-center justify-between border-t pt-4 text-muted-foreground text-sm">
						<span>
							Hiển thị{" "}
							<strong className="text-foreground">
								{filteredUsers.length}
							</strong>
							/{users.data?.length ?? 0} người dùng
						</span>
						{users.isFetching && !users.isPending ? (
							<span className="flex items-center gap-1.5">
								<RefreshCw
									aria-hidden="true"
									className="size-3.5 animate-spin"
								/>
								Đang đồng bộ
							</span>
						) : null}
					</div>

					{users.isPending ? <UserTableSkeleton /> : null}
					{users.isError ? (
						<InlineError
							description="Danh sách tài khoản chưa tải được. Hãy kiểm tra kết nối và thử lại."
							onRetry={() => {
								void users.refetch();
							}}
							title="Không thể tải người dùng"
						/>
					) : null}
					{!users.isPending && !users.isError && filteredUsers.length === 0 ? (
						<Empty className="min-h-52 rounded-2xl border border-dashed bg-muted/20">
							<EmptyHeader>
								<EmptyTitle>Không tìm thấy người dùng</EmptyTitle>
								<EmptyDescription>
									Không có tài khoản nào khớp với bộ lọc hiện tại.
								</EmptyDescription>
							</EmptyHeader>
							{hasFilters ? (
								<Button onClick={resetFilters} type="button" variant="outline">
									Xóa toàn bộ bộ lọc
								</Button>
							) : null}
						</Empty>
					) : null}

					{!users.isPending && filteredUsers.length > 0 ? (
						<>
							<div className="hidden overflow-hidden rounded-2xl border lg:block">
								<table className="w-full text-left text-sm">
									<thead className="bg-muted/40 text-muted-foreground text-xs">
										<tr>
											<th className="px-4 py-3 font-medium" scope="col">
												Người dùng
											</th>
											<th className="px-4 py-3 font-medium" scope="col">
												Vai trò
											</th>
											<th className="px-4 py-3 font-medium" scope="col">
												Trạng thái
											</th>
											<th className="px-4 py-3 font-medium" scope="col">
												Phiên đăng nhập
											</th>
											<th
												className="px-4 py-3 text-right font-medium"
												scope="col"
											>
												Hành động
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
											const isRevoking =
												revokeSessions.isPending &&
												revokeSessions.variables?.userId === managedUser.id;
											const isDisabling =
												disableAccount.isPending &&
												disableAccount.variables?.userId === managedUser.id;
											return (
												<tr
													className="transition-colors hover:bg-muted/20"
													key={managedUser.id}
												>
													<td className="px-4 py-3.5">
														<UserIdentity
															email={managedUser.email}
															emailVerified={managedUser.emailVerified}
															isCurrentUser={isCurrentUser}
															name={managedUser.name}
														/>
													</td>
													<td className="px-4 py-3.5">
														<UserRoleSelect
															disabled={isDisabled || isUpdatingRole}
															isPending={isUpdatingRole}
															onChange={(role) =>
																updateRole.mutate({
																	role,
																	userId: managedUser.id,
																})
															}
															role={managedUser.role}
															userName={managedUser.name}
														/>
													</td>
													<td className="px-4 py-3.5">
														<UserStatusBadge isDisabled={isDisabled} />
													</td>
													<td className="px-4 py-3.5">
														<p className="font-medium tabular-nums">
															{managedUser.activeSessionCount}
														</p>
														<p className="text-muted-foreground text-xs">
															phiên hoạt động
														</p>
													</td>
													<td className="px-4 py-3.5">
														<UserActions
															activeSessionCount={
																managedUser.activeSessionCount
															}
															isCurrentUser={isCurrentUser}
															isDisabled={isDisabled}
															isDisabling={isDisabling}
															isRevoking={isRevoking}
															onDisable={() =>
																setUserPendingDisable({
																	id: managedUser.id,
																	name: managedUser.name,
																})
															}
															onRevoke={() =>
																revokeSessions.mutate({
																	userId: managedUser.id,
																})
															}
														/>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							<div className="grid gap-3 lg:hidden">
								{filteredUsers.map((managedUser) => {
									const isCurrentUser =
										managedUser.id === currentSession.data?.user.id;
									const isDisabled = managedUser.credentialCount === 0;
									const isUpdatingRole =
										updateRole.isPending &&
										updateRole.variables?.userId === managedUser.id;
									const isRevoking =
										revokeSessions.isPending &&
										revokeSessions.variables?.userId === managedUser.id;
									const isDisabling =
										disableAccount.isPending &&
										disableAccount.variables?.userId === managedUser.id;
									return (
										<article
											className="space-y-4 rounded-2xl border bg-muted/15 p-4"
											key={managedUser.id}
										>
											<div className="flex items-start justify-between gap-3">
												<UserIdentity
													email={managedUser.email}
													emailVerified={managedUser.emailVerified}
													isCurrentUser={isCurrentUser}
													name={managedUser.name}
												/>
												<UserStatusBadge isDisabled={isDisabled} />
											</div>
											<div className="grid gap-3 sm:grid-cols-2">
												<div>
													<p className="mb-1.5 text-muted-foreground text-xs">
														Vai trò
													</p>
													<UserRoleSelect
														disabled={isDisabled || isUpdatingRole}
														isPending={isUpdatingRole}
														onChange={(role) =>
															updateRole.mutate({
																role,
																userId: managedUser.id,
															})
														}
														role={managedUser.role}
														userName={managedUser.name}
													/>
												</div>
												<div>
													<p className="mb-1.5 text-muted-foreground text-xs">
														Phiên đăng nhập
													</p>
													<p className="font-medium">
														{managedUser.activeSessionCount} phiên hoạt động
													</p>
												</div>
											</div>
											<UserActions
												activeSessionCount={managedUser.activeSessionCount}
												isCurrentUser={isCurrentUser}
												isDisabled={isDisabled}
												isDisabling={isDisabling}
												isRevoking={isRevoking}
												onDisable={() =>
													setUserPendingDisable({
														id: managedUser.id,
														name: managedUser.name,
													})
												}
												onRevoke={() =>
													revokeSessions.mutate({ userId: managedUser.id })
												}
											/>
										</article>
									);
								})}
							</div>
						</>
					) : null}
				</CardContent>
			</Card>
			<ConfirmActionDialog
				confirmLabel="Vô hiệu hóa tài khoản"
				description={`${userPendingDisable?.name ?? "Người dùng"} sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập lại bằng thông tin hiện tại.`}
				isPending={disableAccount.isPending}
				onCancel={() => setUserPendingDisable(null)}
				onConfirm={() => {
					if (userPendingDisable) {
						disableAccount.mutate({ userId: userPendingDisable.id });
					}
				}}
				open={userPendingDisable !== null}
				title="Vô hiệu hóa tài khoản?"
			/>
		</section>
	);
}

type UserIdentityProps = {
	email: string;
	emailVerified: boolean;
	isCurrentUser: boolean;
	name: string;
};

function UserIdentity({
	email,
	emailVerified,
	isCurrentUser,
	name,
}: UserIdentityProps) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<span
				aria-hidden="true"
				className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary text-sm"
			>
				{getInitials(name)}
			</span>
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-1.5">
					<p className="truncate font-medium">{name}</p>
					{isCurrentUser ? (
						<span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-[10px]">
							Bạn
						</span>
					) : null}
				</div>
				<div className="flex min-w-0 items-center gap-1.5">
					<p className="truncate text-muted-foreground text-xs">{email}</p>
					{emailVerified ? (
						<CheckCircle2
							aria-label="Email đã xác minh"
							className="size-3.5 shrink-0 text-emerald-600"
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}

type UserRoleSelectProps = {
	disabled: boolean;
	isPending: boolean;
	onChange: (role: UserRole) => void;
	role: UserRole;
	userName: string;
};

function UserRoleSelect({
	disabled,
	isPending,
	onChange,
	role,
	userName,
}: UserRoleSelectProps) {
	return (
		<div className="relative">
			<select
				aria-label={`Vai trò của ${userName}`}
				className="h-9 min-w-36 rounded-xl border border-input bg-background px-3 pr-8 text-xs outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={disabled}
				onChange={(event) => onChange(event.target.value as UserRole)}
				value={role}
			>
				{userRoles.map((roleOption) => (
					<option key={roleOption} value={roleOption}>
						{roleLabels[roleOption]}
					</option>
				))}
			</select>
			{isPending ? (
				<RefreshCw
					aria-hidden="true"
					className="absolute top-2.5 right-2.5 size-3.5 animate-spin text-muted-foreground"
				/>
			) : null}
		</div>
	);
}

function UserStatusBadge({ isDisabled }: { isDisabled: boolean }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium text-xs ${
				isDisabled
					? "border-red-200 bg-red-50 text-red-700"
					: "border-emerald-200 bg-emerald-50 text-emerald-700"
			}`}
		>
			<span
				aria-hidden="true"
				className={`size-1.5 rounded-full ${isDisabled ? "bg-red-500" : "bg-emerald-500"}`}
			/>
			{isDisabled ? "Đã vô hiệu hóa" : "Đang hoạt động"}
		</span>
	);
}

type UserActionsProps = {
	activeSessionCount: number;
	isCurrentUser: boolean;
	isDisabled: boolean;
	isDisabling: boolean;
	isRevoking: boolean;
	onDisable: () => void;
	onRevoke: () => void;
};

function UserActions({
	activeSessionCount,
	isCurrentUser,
	isDisabled,
	isDisabling,
	isRevoking,
	onDisable,
	onRevoke,
}: UserActionsProps) {
	return (
		<div className="flex flex-wrap justify-end gap-2">
			<Button
				disabled={
					isCurrentUser || activeSessionCount === 0 || isDisabled || isRevoking
				}
				onClick={onRevoke}
				size="sm"
				type="button"
				variant="outline"
			>
				{isRevoking ? (
					<RefreshCw aria-hidden="true" className="animate-spin" />
				) : null}
				{isRevoking ? "Đang đăng xuất…" : "Đăng xuất mọi phiên"}
			</Button>
			<Button
				disabled={isCurrentUser || isDisabled || isDisabling}
				onClick={onDisable}
				size="sm"
				type="button"
				variant="destructive"
			>
				{isDisabling ? (
					<RefreshCw aria-hidden="true" className="animate-spin" />
				) : (
					<ShieldCheck aria-hidden="true" />
				)}
				{isDisabling ? "Đang xử lý…" : "Vô hiệu hóa"}
			</Button>
		</div>
	);
}

type ContentListProps = {
	versions: Array<{
		id: string;
		kind: string;
		metadata: unknown;
		status: ContentStatus;
		title: string;
		versionNumber: number;
	}>;
};

function ContentList({ versions }: ContentListProps) {
	return (
		<>
			<div className="hidden overflow-hidden rounded-2xl border lg:block">
				<table className="w-full text-left text-sm">
					<thead className="bg-muted/40 text-muted-foreground text-xs">
						<tr>
							<th className="px-4 py-3 font-medium" scope="col">
								Học liệu
							</th>
							<th className="px-4 py-3 font-medium" scope="col">
								Khóa học / kỹ năng
							</th>
							<th className="px-4 py-3 font-medium" scope="col">
								Phiên bản
							</th>
							<th className="px-4 py-3 font-medium" scope="col">
								Trạng thái
							</th>
							<th className="px-4 py-3 text-right font-medium" scope="col">
								Hành động
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{versions.map((version) => {
							const metadata = asMetadata(version.metadata);
							return (
								<tr
									className="transition-colors hover:bg-muted/20"
									key={version.id}
								>
									<td className="max-w-md px-4 py-3.5">
										<p className="truncate font-medium">{version.title}</p>
										<p className="mt-0.5 text-muted-foreground text-xs">
											{version.kind}
										</p>
									</td>
									<td className="px-4 py-3.5">
										<p className="font-medium text-xs">
											{metadata.courseTitle ??
												metadata.courseId ??
												"Chưa gắn khóa học"}
										</p>
										<p className="mt-0.5 text-muted-foreground text-xs">
											{metadata.skill ??
												metadata.skillName ??
												"Chưa gắn kỹ năng"}
										</p>
									</td>
									<td className="px-4 py-3.5 font-medium tabular-nums">
										v{version.versionNumber}
									</td>
									<td className="px-4 py-3.5">
										<ContentStatusBadge status={version.status} />
									</td>
									<td className="px-4 py-3.5 text-right">
										<Link
											className={buttonVariants({
												size: "sm",
												variant: "outline",
											})}
											to="/admin-content"
										>
											Xem và xử lý
											<ChevronRight aria-hidden="true" data-icon="inline-end" />
										</Link>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="grid gap-3 lg:hidden">
				{versions.map((version) => {
					const metadata = asMetadata(version.metadata);
					return (
						<article
							className="rounded-2xl border bg-muted/15 p-4"
							key={version.id}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-medium">{version.title}</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{version.kind} · v{version.versionNumber}
									</p>
								</div>
								<ContentStatusBadge status={version.status} />
							</div>
							<div className="mt-4 grid gap-2 border-t pt-3 text-xs sm:grid-cols-2">
								<p>
									<span className="text-muted-foreground">Khóa học: </span>
									{metadata.courseTitle ?? metadata.courseId ?? "Chưa gắn"}
								</p>
								<p>
									<span className="text-muted-foreground">Kỹ năng: </span>
									{metadata.skill ?? metadata.skillName ?? "Chưa gắn"}
								</p>
							</div>
							<Link
								className={buttonVariants({
									className: "mt-4 w-full",
									size: "sm",
									variant: "outline",
								})}
								to="/admin-content"
							>
								Xem và xử lý
								<ChevronRight aria-hidden="true" data-icon="inline-end" />
							</Link>
						</article>
					);
				})}
			</div>
		</>
	);
}

function ContentStatusBadge({ status }: { status: ContentStatus }) {
	return (
		<span
			className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 font-medium text-xs ${statusStyles[status]}`}
		>
			{statusLabels[status]}
		</span>
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
		<label className="block">
			<span className="mb-1.5 block font-medium text-xs">{label}</span>
			<select
				aria-label={label}
				className="h-10 w-full rounded-xl border border-input bg-background px-3 pr-8 text-xs outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
				onChange={(event) => onChange(event.target.value)}
				value={value}
			>
				<option value="all">Tất cả {label.toLowerCase()}</option>
				{options.map((option, index) => (
					<option
						key={optionValues?.[index] ?? option}
						value={optionValues?.[index] ?? option}
					>
						{option}
					</option>
				))}
			</select>
		</label>
	);
}

type SectionHeadingProps = {
	action?: React.ReactNode;
	description: string;
	icon?: LucideIcon;
	title: string;
};

function SectionHeading({
	action,
	description,
	icon: Icon,
	title,
}: SectionHeadingProps) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div className="flex items-start gap-3">
				{Icon ? (
					<span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<Icon aria-hidden="true" className="size-5" />
					</span>
				) : null}
				<div>
					<h2 className="font-semibold text-xl tracking-tight sm:text-2xl">
						{title}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				</div>
			</div>
			{action}
		</div>
	);
}

type MetricCardProps = {
	description: string;
	icon: LucideIcon;
	label: string;
	loading: boolean;
	tone: "amber" | "blue" | "emerald" | "violet";
	value: number;
};

const metricToneStyles: Record<MetricCardProps["tone"], string> = {
	amber: "bg-amber-100 text-amber-700",
	blue: "bg-blue-100 text-blue-700",
	emerald: "bg-emerald-100 text-emerald-700",
	violet: "bg-violet-100 text-violet-700",
};

function MetricCard({
	description,
	icon: Icon,
	label,
	loading,
	tone,
	value,
}: MetricCardProps) {
	return (
		<Card className="hover:translate-y-0">
			<CardContent className="flex items-start justify-between gap-4 pt-1">
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-sm">{label}</p>
					{loading ? (
						<div className="mt-2 h-9 w-16 animate-pulse rounded-lg bg-muted" />
					) : (
						<p className="mt-1 font-semibold text-3xl tracking-tight tabular-nums">
							{value}
						</p>
					)}
					<p className="mt-2 text-muted-foreground text-xs/relaxed">
						{description}
					</p>
				</div>
				<span
					className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${metricToneStyles[tone]}`}
				>
					<Icon aria-hidden="true" className="size-5" />
				</span>
			</CardContent>
		</Card>
	);
}

function QuickNavItem({ href, label }: { href: string; label: string }) {
	return (
		<a
			className="shrink-0 rounded-xl px-4 py-2 font-medium text-muted-foreground text-sm transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
			href={href}
		>
			{label}
		</a>
	);
}

function SummaryPill({ label, value }: { label: string; value: number }) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs">
			<span className="text-muted-foreground">{label}</span>
			<strong className="tabular-nums">{value}</strong>
		</span>
	);
}

type InlineErrorProps = {
	description: string;
	onRetry: () => void;
	title: string;
};

function InlineError({ description, onRetry, title }: InlineErrorProps) {
	return (
		<div
			className="flex flex-col justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.04] p-4 sm:flex-row sm:items-center"
			role="alert"
		>
			<div className="flex items-start gap-3">
				<CircleAlert
					aria-hidden="true"
					className="mt-0.5 size-5 shrink-0 text-destructive"
				/>
				<div>
					<p className="font-medium">{title}</p>
					<p className="mt-0.5 text-muted-foreground text-sm">{description}</p>
				</div>
			</div>
			<Button onClick={onRetry} size="sm" type="button" variant="outline">
				<RefreshCw aria-hidden="true" />
				Thử lại
			</Button>
		</div>
	);
}

function UserTableSkeleton() {
	return (
		<div
			aria-label="Đang tải danh sách người dùng"
			className="overflow-hidden rounded-2xl border"
			role="status"
		>
			{["user-a", "user-b", "user-c"].map((key) => (
				<div
					className="flex items-center gap-3 border-b p-4 last:border-0"
					key={key}
				>
					<div className="size-10 animate-pulse rounded-xl bg-muted" />
					<div className="flex-1 space-y-2">
						<div className="h-3 w-36 animate-pulse rounded bg-muted" />
						<div className="h-2.5 w-52 max-w-full animate-pulse rounded bg-muted" />
					</div>
					<div className="hidden h-8 w-32 animate-pulse rounded-xl bg-muted sm:block" />
				</div>
			))}
		</div>
	);
}

function ContentTableSkeleton() {
	return (
		<div
			aria-label="Đang tải thư viện học liệu"
			className="overflow-hidden rounded-2xl border"
			role="status"
		>
			{["content-a", "content-b", "content-c"].map((key) => (
				<div
					className="flex items-center gap-3 border-b p-4 last:border-0"
					key={key}
				>
					<div className="flex-1 space-y-2">
						<div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted" />
						<div className="h-2.5 w-28 animate-pulse rounded bg-muted" />
					</div>
					<div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
				</div>
			))}
		</div>
	);
}

const getInitials = (name: string): string => {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return "MB";
	}
	return parts
		.slice(-2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
};

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
