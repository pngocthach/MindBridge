import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<main className="mx-auto flex min-h-svh max-w-2xl items-center px-6">
			<section>
				<p className="text-muted-foreground text-sm">EduOne AI</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-tight">
					MindBridge
				</h1>
				<p className="mt-4 text-lg text-muted-foreground">
					Cá nhân hóa lộ trình học và hỗ trợ đội ngũ tạo học liệu.
				</p>
				<div className="mt-6 flex gap-3">
					<Link
						className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
						search={{ mode: "sign-up" }}
						to="/login"
					>
						Tạo tài khoản
					</Link>
					<Link
						className="rounded-md border px-4 py-2 font-medium"
						search={{ mode: "sign-in" }}
						to="/login"
					>
						Đăng nhập
					</Link>
				</div>
			</section>
		</main>
	);
}
