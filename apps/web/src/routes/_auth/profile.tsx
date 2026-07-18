import { isUserRole } from "@MindBridge/auth/permissions";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, ShieldCheck, UserRound } from "lucide-react";

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/profile")({
	component: ProfilePage,
});

const roleLabels = {
	admin: "Quản trị viên",
	editor: "Biên tập viên",
	learner: "Học viên",
	teacher: "Giáo viên",
} as const;

function ProfilePage() {
	const { data, isPending } = authClient.useSession();

	if (isPending) {
		return <Loader />;
	}

	const user = data?.user;
	if (!user) {
		return null;
	}

	const roleLabel = isUserRole(user.role)
		? roleLabels[user.role]
		: "Người dùng";
	const initial = user.name.trim().charAt(0).toUpperCase() || "?";

	return (
		<section
			aria-labelledby="profile-title"
			className="mx-auto max-w-2xl space-y-4"
		>
			<header>
				<p className="font-medium text-primary text-xs uppercase tracking-widest">
					Tài khoản
				</p>
				<h1 className="mt-1 font-semibold text-2xl" id="profile-title">
					Thông tin cá nhân
				</h1>
			</header>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-4">
						{user.image ? (
							<img
								alt={user.name}
								className="size-16 rounded-full object-cover"
								src={user.image}
							/>
						) : (
							<div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-500 font-semibold text-2xl text-white">
								{initial}
							</div>
						)}
						<div className="min-w-0">
							<CardTitle className="truncate text-xl">{user.name}</CardTitle>
							<CardDescription>{roleLabel}</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<dl className="divide-y">
						<div className="flex items-center gap-3 py-3">
							<UserRound
								aria-hidden="true"
								className="size-4 text-muted-foreground"
							/>
							<dt className="w-28 shrink-0 text-muted-foreground text-sm">
								Tên
							</dt>
							<dd className="min-w-0 truncate text-sm">{user.name}</dd>
						</div>
						<div className="flex items-center gap-3 py-3">
							<Mail
								aria-hidden="true"
								className="size-4 text-muted-foreground"
							/>
							<dt className="w-28 shrink-0 text-muted-foreground text-sm">
								Email
							</dt>
							<dd className="min-w-0 truncate text-sm">{user.email}</dd>
						</div>
						<div className="flex items-center gap-3 py-3">
							<ShieldCheck
								aria-hidden="true"
								className="size-4 text-muted-foreground"
							/>
							<dt className="w-28 shrink-0 text-muted-foreground text-sm">
								Vai trò
							</dt>
							<dd className="min-w-0 truncate text-sm">{roleLabel}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>
		</section>
	);
}
