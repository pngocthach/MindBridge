import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import { Input } from "@MindBridge/ui/components/input";
import { Label } from "@MindBridge/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
					onSuccess: () => {
						navigate({
							to: "/dashboard",
						});
						toast.success("Sign in successful");
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-2xl">Chào mừng bạn trở lại</CardTitle>
					<CardDescription>
						Đăng nhập để tiếp tục lộ trình học của bạn.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="space-y-5"
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<form.Field name="email">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Email</Label>
									<Input
										autoComplete="email"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="ban@example.com"
										type="email"
										value={field.state.value}
									/>
									{field.state.meta.errors.map((error) => (
										<p
											className="text-destructive text-sm"
											key={error?.message}
										>
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Field name="password">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Mật khẩu</Label>
									<Input
										autoComplete="current-password"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										type="password"
										value={field.state.value}
									/>
									{field.state.meta.errors.map((error) => (
										<p
											className="text-destructive text-sm"
											key={error?.message}
										>
											{error?.message}
										</p>
									))}
								</div>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<Button
									className="w-full"
									disabled={!canSubmit || isSubmitting}
									type="submit"
								>
									{isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
				<CardFooter className="justify-center border-t">
					<Button onClick={onSwitchToSignUp} type="button" variant="link">
						Chưa có tài khoản? Tạo tài khoản
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
}
