import { isUserRole } from "@MindBridge/auth/permissions";
import { Button } from "@MindBridge/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
	BookOpenCheck,
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
		<div className="min-h-svh bg-muted/30 md:grid md:grid-cols-[15rem_1fr]">
			<aside className="border-b bg-background md:border-r md:border-b-0">
				<div className="flex h-16 items-center border-b px-5">
					<span className="font-semibold text-lg">MindBridge</span>
				</div>
				<nav aria-label="Điều hướng chính" className="space-y-1 p-3">
					{navItems
						.filter((item) => item.roles.includes(userRole))
						.map((item) => (
							<Link
								activeProps={{ className: "bg-accent" }}
								className="flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm hover:bg-accent/60"
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
				<header className="flex min-h-16 items-center justify-between border-b bg-background px-4 md:px-8">
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
				<main className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</main>
			</div>
		</div>
	);
}
