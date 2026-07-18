import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BrainCircuit,
	MessagesSquare,
	RouteIcon,
	Sparkles,
	WandSparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<main className="relative flex min-h-svh items-center overflow-hidden px-6 py-16">
			<div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/15 blur-3xl" />
			<div className="absolute -right-24 bottom-0 size-96 rounded-full bg-cyan-400/15 blur-3xl" />
			<section className="relative mx-auto w-full max-w-5xl text-center">
				<div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-400 text-white shadow-xl shadow-primary/25">
					<BrainCircuit aria-hidden="true" className="size-8" />
				</div>
				<p className="mt-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-4 py-2 font-semibold text-primary text-xs uppercase tracking-[0.16em]">
					<Sparkles aria-hidden="true" className="size-3.5" />
					AI-powered learning workspace
				</p>
				<h1 className="mx-auto mt-6 max-w-4xl bg-gradient-to-r from-foreground via-primary to-violet-500 bg-clip-text font-extrabold text-5xl text-transparent tracking-[-0.04em] md:text-7xl">
					Học đúng điều bạn cần, theo cách phù hợp với bạn.
				</h1>
				<p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-8 md:text-xl">
					MindBridge kết nối lộ trình học cá nhân, trợ giảng AI và công cụ tạo
					học liệu trong một không gian thống nhất.
				</p>
				<div className="mt-9 flex flex-wrap justify-center gap-3">
					<Link
						className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
						search={{ mode: "sign-up" }}
						to="/login"
					>
						Bắt đầu miễn phí
						<ArrowRight aria-hidden="true" className="size-4" />
					</Link>
					<Link
						className="inline-flex h-12 items-center rounded-xl border bg-background/70 px-6 font-semibold shadow-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-accent/60"
						search={{ mode: "sign-in" }}
						to="/login"
					>
						Đăng nhập
					</Link>
				</div>
				<div className="mx-auto mt-14 grid max-w-4xl gap-3 text-left md:grid-cols-3">
					{[
						{
							description:
								"Tiến độ và đề xuất cập nhật từ kết quả học thực tế.",
							icon: RouteIcon,
							title: "Lộ trình cá nhân",
						},
						{
							description:
								"Hỏi đáp theo đúng bài học và hồ sơ kỹ năng đang mở.",
							icon: MessagesSquare,
							title: "Trợ giảng theo ngữ cảnh",
						},
						{
							description:
								"Tạo, review và xuất bản học liệu trong một quy trình.",
							icon: WandSparkles,
							title: "Content Studio",
						},
					].map((feature) => (
						<div
							className="flex gap-3 rounded-xl border bg-card/70 p-4 shadow-sm backdrop-blur-sm"
							key={feature.title}
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<feature.icon aria-hidden="true" className="size-4" />
							</div>
							<div>
								<p className="font-semibold text-sm">{feature.title}</p>
								<p className="mt-1 text-muted-foreground text-xs leading-5">
									{feature.description}
								</p>
							</div>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
