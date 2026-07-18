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

import AuthShell from "./auth-shell";
import Loader from "./loader";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			name: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					name: value.name,
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
						toast.success("Sign up successful");
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				name: z.string().min(2, "Name must be at least 2 characters"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<AuthShell>
			<Card className="w-full border-blue-100 bg-white/95 shadow-xl shadow-blue-950/8">
				<CardHeader>
					<CardTitle className="text-2xl">Tạo tài khoản</CardTitle>
					<CardDescription>
						Bắt đầu xây dựng lộ trình học phù hợp với bạn.
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
						<form.Field name="name">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Họ và tên{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
										<span className="sr-only"> bắt buộc</span>
									</Label>
									<Input
										autoComplete="name"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Nguyễn Văn An"
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

						<form.Field name="email">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>
										Email{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
										<span className="sr-only"> bắt buộc</span>
									</Label>
									<Input
										autoComplete="email"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="email@gmail.com"
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
									<Label htmlFor={field.name}>
										Mật khẩu{" "}
										<span aria-hidden="true" className="text-destructive">
											*
										</span>
										<span className="sr-only"> bắt buộc</span>
									</Label>
									<Input
										autoComplete="new-password"
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
									{isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</CardContent>
				<CardFooter className="justify-center border-t">
					<Button onClick={onSwitchToSignIn} type="button" variant="link">
						Đã có tài khoản? Đăng nhập
					</Button>
				</CardFooter>
			</Card>
		</AuthShell>
	);
}
