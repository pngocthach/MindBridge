import { isUserRole } from "@MindBridge/auth/permissions";
import { Button } from "@MindBridge/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
	BookOpenCheck,
	BrainCircuit,
	FileStack,
	LayoutDashboard,
	LogOut,
	ShieldCheck,
	Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

const roleLabels = {
	admin: "Quản trị viên",
	editor: "Biên tập viên",
	learner: "Học viên",
	teacher: "Giáo viên",
} as const;

type NavItem = {
	group: "content" | "management" | "workspace";
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
		roles: ["admin", "editor"],
		to: "/content-studio",
	},
];

const navGroupLabels = {
	content: "Nội dung",
	management: "Quản lý",
	workspace: "Không gian làm việc",
} as const;

const navGroupOrder = ["workspace", "management", "content"] as const;

type AppShellProps = {
	children: ReactNode;
	name: string;
	onSignOut: () => Promise<void>;
	userRole: string;
};

export default function AppShell({
	children,
	name,
	onSignOut,
	userRole,
}: AppShellProps) {
	const visibleNavItems = navItems.filter((item) =>
		item.roles.includes(userRole),
	);

	return (
		<div className="min-h-svh md:grid md:grid-cols-[15rem_1fr]">
			<aside className="border-sidebar-border border-b bg-sidebar text-sidebar-foreground shadow-[inset_-10px_0_24px_oklch(0.55_0.1_255/5%)] md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
				<div className="flex h-16 items-center gap-3 border-sidebar-border border-b px-4">
					<div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-cyan-500 text-white shadow-md">
						<BrainCircuit aria-hidden="true" className="size-5" />
					</div>
					<div>
						<span className="block font-bold text-base tracking-tight">
							MindBridge
						</span>
						<span className="text-[10px] text-sidebar-foreground/55 uppercase tracking-[0.18em]">
							Learning OS
						</span>
					</div>
				</div>
				<nav aria-label="Điều hướng chính" className="overflow-x-auto p-2.5">
					<div className="flex gap-2 md:block md:space-y-5">
						{navGroupOrder.map((group) => {
							const groupItems = visibleNavItems.filter(
								(item) => item.group === group,
							);
							if (groupItems.length === 0) {
								return null;
							}
							return (
								<section className="flex shrink-0 gap-1 md:block" key={group}>
									<p className="mb-1 hidden px-3 font-bold text-[10px] text-sidebar-foreground/45 uppercase tracking-[0.16em] md:block">
										{navGroupLabels[group]}
									</p>
									<div className="flex gap-1 md:block md:space-y-1">
										{groupItems.map((item) => (
											<Link
												activeProps={{
													className:
														"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm before:bg-sidebar-primary",
												}}
												className="relative flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 font-medium text-sidebar-foreground/70 text-sm transition-all before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-full hover:-translate-y-0.5 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
												key={item.to}
												to={item.to}
											>
												<item.icon
													aria-hidden={true}
													data-icon="inline-start"
												/>
												{item.label}
											</Link>
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
					<div>
						<p className="font-medium text-sm">{name}</p>
						<p className="text-muted-foreground text-xs">
							{isUserRole(userRole) ? roleLabels[userRole] : "Người dùng"}
						</p>
					</div>
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
	);
}
