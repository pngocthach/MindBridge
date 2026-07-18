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
	icon: ComponentType<{ "aria-hidden"?: boolean; "data-icon"?: string }>;
	label: string;
	roles: readonly string[];
	to: string;
};

const navItems: readonly NavItem[] = [
	{
		icon: LayoutDashboard,
		label: "Tổng quan",
		roles: ["learner", "teacher", "editor", "admin"],
		to: "/dashboard",
	},
	{
		icon: BookOpenCheck,
		label: "Lộ trình học",
		roles: ["learner"],
		to: "/learn",
	},
	{ icon: Users, label: "Lớp của tôi", roles: ["teacher"], to: "/teacher" },
	{ icon: ShieldCheck, label: "Admin Console", roles: ["admin"], to: "/admin" },
	{
		icon: FileStack,
		label: "Kiểm duyệt học liệu",
		roles: ["admin"],
		to: "/admin-content",
	},
	{
		icon: FileStack,
		label: "Content Studio",
		roles: ["admin", "editor"],
		to: "/content-studio",
	},
];

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
	return (
		<div className="min-h-svh md:grid md:grid-cols-[15rem_1fr]">
			<aside className="border-sidebar-border border-b bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
				<div className="flex h-16 items-center gap-3 border-sidebar-border border-b px-4">
					<div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-violet-400 text-white shadow-lg shadow-black/20">
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
				<nav
					aria-label="Điều hướng chính"
					className="flex gap-1 overflow-x-auto p-2.5 md:block md:space-y-0.5 md:overflow-visible"
				>
					{navItems
						.filter((item) => item.roles.includes(userRole))
						.map((item) => (
							<Link
								activeProps={{
									className:
										"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm before:bg-sidebar-primary",
								}}
								className="relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sidebar-foreground/70 text-sm transition-all before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-full hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
								key={item.to}
								to={item.to}
							>
								<item.icon aria-hidden={true} data-icon="inline-start" />
								{item.label}
							</Link>
						))}
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
				<main className="w-full p-3 md:p-5 lg:p-6">{children}</main>
			</div>
		</div>
	);
}
