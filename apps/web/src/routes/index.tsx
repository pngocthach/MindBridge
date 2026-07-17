import { createFileRoute } from "@tanstack/react-router";

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
			</section>
		</main>
	);
}
