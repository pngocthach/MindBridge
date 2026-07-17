import { isUserRole } from "@MindBridge/auth/permissions";
import { Button } from "@MindBridge/ui/components/button";
import { LayoutDashboard, LogOut } from "lucide-react";
import type { ReactNode } from "react";

const roleLabels = {
	admin: "Quản trị viên",
	editor: "Biên tập viên",
	learner: "Học viên",
	teacher: "Giáo viên",
} as const;

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
				<nav aria-label="Điều hướng chính" className="p-3">
					<a
						className="flex items-center gap-3 rounded-md bg-accent px-3 py-2 font-medium text-sm"
						href="/dashboard"
					>
						<LayoutDashboard aria-hidden="true" data-icon="inline-start" />
						Tổng quan
					</a>
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
