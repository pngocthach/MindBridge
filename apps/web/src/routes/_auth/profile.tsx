import { isUserRole } from "@MindBridge/auth/permissions";
import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import { Input } from "@MindBridge/ui/components/input";
import { Label } from "@MindBridge/ui/components/label";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

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

			<ProfileNameCard currentName={user.name} />
			<ChangePasswordCard />
		</section>
	);
}

function ProfileNameCard({ currentName }: { currentName: string }) {
	const [name, setName] = useState(currentName);
	const [isSaving, setIsSaving] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || trimmed === currentName || isSaving) {
			return;
		}

		setIsSaving(true);
		await authClient.updateUser(
			{ name: trimmed },
			{
				onError: (error) => {
					toast.error(error.error.message || "Không thể cập nhật tên.");
				},
				onSuccess: () => {
					toast.success("Đã cập nhật tên hiển thị.");
				},
			},
		);
		setIsSaving(false);
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<UserRound aria-hidden="true" className="size-4" />
					<CardTitle className="text-lg">Chỉnh sửa thông tin</CardTitle>
				</div>
				<CardDescription>Cập nhật tên hiển thị của bạn.</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2.5">
						<Label htmlFor="profile-name">
							Tên hiển thị{" "}
							<span aria-hidden="true" className="text-destructive">
								*
							</span>
							<span className="sr-only"> bắt buộc</span>
						</Label>
						<Input
							id="profile-name"
							maxLength={120}
							onChange={(event) => setName(event.target.value)}
							required
							value={name}
						/>
					</div>
					<Button
						disabled={!name.trim() || name.trim() === currentName || isSaving}
						type="submit"
					>
						{isSaving ? "Đang lưu..." : "Lưu thay đổi"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function ChangePasswordCard() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSaving) {
			return;
		}
		if (newPassword.length < 8) {
			toast.error("Mật khẩu mới phải có ít nhất 8 ký tự.");
			return;
		}
		if (newPassword !== confirmPassword) {
			toast.error("Mật khẩu xác nhận không khớp.");
			return;
		}

		setIsSaving(true);
		await authClient.changePassword(
			{
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			},
			{
				onError: (error) => {
					toast.error(error.error.message || "Không thể đổi mật khẩu.");
				},
				onSuccess: () => {
					toast.success("Đã đổi mật khẩu.");
					setCurrentPassword("");
					setNewPassword("");
					setConfirmPassword("");
				},
			},
		);
		setIsSaving(false);
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<KeyRound aria-hidden="true" className="size-4" />
					<CardTitle className="text-lg">Đổi mật khẩu</CardTitle>
				</div>
				<CardDescription>
					Đăng nhập lại trên các thiết bị khác sau khi đổi.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2.5">
						<Label htmlFor="current-password">Mật khẩu hiện tại</Label>
						<Input
							autoComplete="current-password"
							id="current-password"
							onChange={(event) => setCurrentPassword(event.target.value)}
							required
							type="password"
							value={currentPassword}
						/>
					</div>
					<div className="space-y-2.5">
						<Label htmlFor="new-password">Mật khẩu mới</Label>
						<Input
							autoComplete="new-password"
							id="new-password"
							minLength={8}
							onChange={(event) => setNewPassword(event.target.value)}
							required
							type="password"
							value={newPassword}
						/>
					</div>
					<div className="space-y-2.5">
						<Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
						<Input
							autoComplete="new-password"
							id="confirm-password"
							minLength={8}
							onChange={(event) => setConfirmPassword(event.target.value)}
							required
							type="password"
							value={confirmPassword}
						/>
					</div>
					<Button
						disabled={
							!(currentPassword && newPassword && confirmPassword) || isSaving
						}
						type="submit"
					>
						{isSaving ? "Đang đổi..." : "Đổi mật khẩu"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
