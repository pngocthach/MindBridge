import { isUserRole } from "@MindBridge/auth/permissions";
import { Button } from "@MindBridge/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@MindBridge/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import {
	BookOpenCheck,
	BrainCircuit,
	ChevronLeft,
	ChevronRight,
	FileStack,
	LayoutDashboard,
	LogOut,
	ShieldCheck,
	UserRound,
	Users,
} from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";

const roleLabels = {
	admin: "Quản trị viên",
	editor: "Biên tập viên",
	learner: "Học viên",
	teacher: "Giáo viên",
} as const;

const SIDEBAR_STORAGE_KEY = "mindbridge:sidebar-collapsed";

type NavItem = {
	group: "account" | "content" | "management" | "workspace";
	icon: ComponentType<{ "aria-hidden"?: boolean; "data-icon"?: string }>;
	label: string;
	roles: readonly string[];
	to: string;
};

const navItems: readonly NavItem[] = [
	{
		group: "workspace",
		icon: LayoutDashboard,
		label: "Tổng quan",
		roles: ["learner", "teacher", "editor"],
		to: "/dashboard",
	},
	{
		group: "workspace",
		icon: ShieldCheck,
		label: "Tổng quan quản trị",
		roles: ["admin"],
		to: "/admin",
	},
	{
		group: "workspace",
		icon: BookOpenCheck,
		label: "Lộ trình học",
		roles: ["learner"],
		to: "/learn",
	},
	{
		group: "management",
		icon: Users,
		label: "Lớp của tôi",
		roles: ["teacher"],
		to: "/teacher",
	},
	{
		group: "content",
		icon: FileStack,
		label: "Kiểm duyệt học liệu",
		roles: ["admin"],
		to: "/admin-content",
	},
	{
		group: "content",
		icon: FileStack,
		label: "Nguồn học liệu",
		roles: ["teacher"],
		to: "/admin-content",
	},
	{
		group: "content",
		icon: FileStack,
		label: "Content Studio",
		roles: ["admin", "editor", "teacher"],
		to: "/content-studio",
	},
	{
		group: "account",
		icon: UserRound,
		label: "Hồ sơ cá nhân",
		roles: ["learner", "teacher", "editor", "admin"],
		to: "/profile",
	},
];

const navGroupLabels = {
	account: "Tài khoản",
	content: "Nội dung",
	management: "Quản lý",
	workspace: "Không gian làm việc",
} as const;

const navGroupOrder = [
	"workspace",
	"management",
	"content",
	"account",
] as const;

type AppShellProps = {
	children: ReactNode;
	name: string;
	onSignOut: () => Promise<void>;
	userRole: string;
};

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
	const link = (
		<Link
			activeProps={{
				className:
					"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm before:bg-sidebar-primary",
			}}
			className={`relative flex shrink-0 items-center gap-2.5 rounded-lg py-2.5 font-medium text-sidebar-foreground/70 text-sm transition-all before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-full hover:-translate-y-0.5 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground ${
				collapsed ? "md:justify-center md:px-0 px-3.5" : "px-3.5"
			}`}
			to={item.to}
		>
			<item.icon aria-hidden={true} data-icon="inline-start" />
			<span
				className={`overflow-hidden whitespace-nowrap ${
					collapsed ? "md:hidden" : ""
				}`}
			>
				{item.label}
			</span>
		</Link>
	);

	if (!collapsed) {
		return link;
	}

	return (
		<Tooltip>
			<TooltipTrigger render={link} />
			<TooltipContent side="right">{item.label}</TooltipContent>
		</Tooltip>
	);
}

export default function AppShell({
	children,
	name,
	onSignOut,
	userRole,
}: AppShellProps) {
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
	}, []);

	const toggleCollapsed = () => {
		setCollapsed((previous) => {
			const next = !previous;
			window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
			return next;
		});
	};

	const visibleNavItems = navItems.filter((item) =>
		item.roles.includes(userRole),
	);

	return (
		<TooltipProvider>
			<div
				className={`min-h-svh md:grid md:transition-[grid-template-columns] md:duration-300 md:ease-in-out ${
					collapsed ? "md:grid-cols-[4rem_1fr]" : "md:grid-cols-[15rem_1fr]"
				}`}
			>
				<aside className="relative border-sidebar-border border-b bg-sidebar text-sidebar-foreground shadow-[inset_-10px_0_24px_oklch(0.55_0.1_255/5%)] md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
					<button
						aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
						aria-pressed={collapsed}
						className="-right-3.5 absolute top-20 z-40 hidden size-7 items-center justify-center rounded-full border border-sidebar-border bg-background text-sidebar-foreground/70 shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
						onClick={toggleCollapsed}
						type="button"
					>
						{collapsed ? (
							<ChevronRight aria-hidden="true" className="size-4" />
						) : (
							<ChevronLeft aria-hidden="true" className="size-4" />
						)}
					</button>
					<div
						className={`flex h-16 items-center gap-3 border-sidebar-border border-b ${
							collapsed ? "px-4 md:justify-center md:px-2" : "px-4"
						}`}
					>
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-cyan-500 text-white shadow-md">
							<BrainCircuit aria-hidden="true" className="size-5" />
						</div>
						<div className={collapsed ? "md:hidden" : undefined}>
							<span className="block font-bold text-base tracking-tight">
								MindBridge
							</span>
							<span className="text-[10px] text-sidebar-foreground/55 uppercase tracking-[0.18em]">
								Learning OS
							</span>
						</div>
					</div>
					<nav
						aria-label="Điều hướng chính"
						className="overflow-x-auto p-3 md:overflow-x-hidden"
					>
						<div className="flex gap-2 md:block md:space-y-6">
							{navGroupOrder.map((group) => {
								const groupItems = visibleNavItems.filter(
									(item) => item.group === group,
								);
								if (groupItems.length === 0) {
									return null;
								}
								return (
									<section className="flex shrink-0 gap-1 md:block" key={group}>
										<p
											className={`mb-2 hidden overflow-hidden whitespace-nowrap px-3.5 font-bold text-[10px] text-sidebar-foreground/45 uppercase tracking-[0.16em] ${
												collapsed ? "" : "md:block"
											}`}
										>
											{navGroupLabels[group]}
										</p>
										<div className="flex gap-1 md:block md:space-y-1.5">
											{groupItems.map((item) => (
												<NavLink
													collapsed={collapsed}
													item={item}
													key={item.to}
												/>
											))}
										</div>
									</section>
								);
							})}
						</div>
					</nav>
				</aside>
				<div className="min-w-0">
					<header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-xl md:px-6">
						<Link
							className="-mx-2 flex items-center gap-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted"
							to="/profile"
						>
							<div>
								<p className="font-medium text-sm">{name}</p>
								<p className="text-muted-foreground text-xs">
									{isUserRole(userRole) ? roleLabels[userRole] : "Người dùng"}
								</p>
							</div>
						</Link>
						<Button onClick={onSignOut} size="sm" type="button" variant="ghost">
							<LogOut aria-hidden="true" data-icon="inline-start" />
							Đăng xuất
						</Button>
					</header>
					<main className="mx-auto w-full max-w-[1480px] p-4 md:p-6 lg:p-8">
						{children}
					</main>
				</div>
			</div>
		</TooltipProvider>
	);
}
