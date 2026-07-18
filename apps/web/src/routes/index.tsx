import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BookOpen,
	BrainCircuit,
	CheckCircle2,
	GraduationCap,
	Search,
	Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

const featuredCourses = [
	{
		color: "bg-indigo-950",
		icon: "📊",
		title: "Phân tích dữ liệu với Python",
		meta: "8 bài học · 4.9 ★",
	},
	{
		color: "bg-violet-900",
		icon: "🧠",
		title: "Tư duy phản biện & giải quyết vấn đề",
		meta: "6 bài học · 4.8 ★",
	},
	{
		color: "bg-orange-500",
		icon: "🎨",
		title: "Thiết kế UI/UX thực chiến",
		meta: "10 bài học · 4.9 ★",
	},
];

function HomeComponent() {
	return (
		<main className="min-h-svh bg-white text-[#17233c]">
			<header className="sticky top-0 z-40 border-[#eee9e1] border-b bg-white/95 backdrop-blur">
				<div className="mx-auto flex h-20 max-w-7xl items-center gap-5 px-6">
					<Link
						className="flex items-center gap-2 font-extrabold text-xl tracking-tight"
						to="/"
					>
						<span className="flex size-10 items-center justify-center rounded-xl bg-[#0056d2] text-white shadow-md">
							<BrainCircuit aria-hidden="true" className="size-5" />
						</span>
						MindBridge
					</Link>
					<div className="hidden h-12 max-w-sm flex-1 items-center gap-3 rounded-full border border-[#ddd9d2] px-5 text-sm text-[#777582] md:flex">
						<Search aria-hidden="true" className="size-4" />
						<span>Tìm kiếm khóa học</span>
					</div>
					<nav className="ml-auto hidden items-center gap-7 font-semibold text-sm lg:flex">
						<a href="#courses">Khóa học</a>
						<a href="#why">Vì sao MindBridge</a>
						<a href="#teachers">Giáo viên</a>
					</nav>
					<Link
						className="rounded-xl bg-[#0056d2] px-5 py-3 font-bold text-white shadow-md transition-transform hover:-translate-y-0.5 hover:bg-[#0048b5]"
						search={{ mode: "sign-up" }}
						to="/login"
					>
						Tham gia
					</Link>
				</div>
			</header>

			<section className="relative overflow-hidden bg-gradient-to-br from-[#eef5ff] via-white to-[#e9f8f7]">
				<div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.03fr_.97fr] lg:py-28">
					<div>
						<p className="mb-5 inline-flex items-center gap-2 font-bold text-[#0056d2] text-sm uppercase tracking-[0.15em]">
							<Sparkles aria-hidden="true" className="size-4" /> Học theo cách
							của bạn
						</p>
						<h1 className="max-w-3xl font-extrabold text-5xl leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
							Mở khóa
							<br />
							<span className="text-[#0056d2]">tiềm năng</span> của bạn.
						</h1>
						<p className="mt-6 max-w-xl text-[#626174] text-lg leading-8">
							Khám phá các khóa học được cá nhân hóa, học cùng giáo viên và nhận
							trợ giảng AI đồng hành trong từng bước.
						</p>
						<div className="mt-9 flex flex-wrap gap-4">
							<Link
								className="inline-flex items-center gap-2 rounded-xl bg-[#0056d2] px-7 py-4 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#0048b5]"
								search={{ mode: "sign-up" }}
								to="/login"
							>
								Bắt đầu học <ArrowRight aria-hidden="true" className="size-4" />
							</Link>
							<Link
								className="rounded-xl border border-[#b9cbea] bg-white px-7 py-4 font-bold text-[#0056d2] shadow-sm"
								search={{ mode: "sign-in" }}
								to="/login"
							>
								Đăng nhập
							</Link>
						</div>
						<div className="mt-9 flex flex-wrap gap-5 text-[#626174] text-sm">
							<span className="inline-flex items-center gap-2">
								<CheckCircle2 className="size-4 text-[#0f9f99]" /> Lộ trình cá
								nhân
							</span>
							<span className="inline-flex items-center gap-2">
								<CheckCircle2 className="size-4 text-[#0f9f99]" /> Trợ giảng AI
							</span>
						</div>
					</div>
					<div className="relative mx-auto w-full max-w-lg">
						<img
							alt="Milo, linh vật trợ giảng AI của MindBridge"
							className="pointer-events-none absolute -top-28 -right-12 z-10 w-52 drop-shadow-[0_18px_20px_rgba(0,60,140,.22)]"
							height="1536"
							src="/images/milo-mascot.png"
							width="1024"
						/>
						<div className="relative rounded-[3rem] bg-[#0056d2] p-5 shadow-2xl shadow-blue-900/20">
							<div className="rounded-[2.3rem] bg-[#f7faff] p-8 pt-12">
								<div className="mb-8 flex items-center justify-between">
									<span className="font-bold">Không gian học tập</span>
									<span className="rounded-full bg-white px-3 py-1 text-xs">
										Hôm nay
									</span>
								</div>
								<div className="rounded-3xl bg-[#dceaff] p-6 text-[#17233c]">
									<GraduationCap className="mb-5 size-10" />
									<p className="font-extrabold text-2xl">Tiếp tục bài học</p>
									<p className="mt-2 text-sm opacity-75">
										Tư duy phản biện · 76%
									</p>
									<div className="mt-5 h-2 rounded-full bg-white/50">
										<div className="h-full w-3/4 rounded-full bg-[#0056d2]" />
									</div>
								</div>
								<div className="mt-5 grid grid-cols-2 gap-4">
									<div className="rounded-3xl bg-[#d9f3dc] p-5">
										<BookOpen className="mb-3 size-6 text-[#32875a]" />
										<p className="font-bold text-sm">8 khóa học</p>
										<p className="mt-1 text-xs opacity-70">đang theo học</p>
									</div>
									<div className="rounded-3xl bg-[#e7f1ff] p-5">
										<span className="text-2xl">✨</span>
										<p className="mt-3 font-bold text-sm">12 kỹ năng</p>
										<p className="mt-1 text-xs opacity-70">đã mở khóa</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-6 py-20" id="courses">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="font-bold text-[#0056d2] text-sm uppercase tracking-widest">
							Bắt đầu ngay
						</p>
						<h2 className="mt-2 font-extrabold text-4xl tracking-tight">
							Khóa học nổi bật
						</h2>
					</div>
					<a className="font-bold text-[#0056d2] text-sm" href="#courses">
						Xem tất cả →
					</a>
				</div>
				<div className="mt-9 grid gap-6 md:grid-cols-3">
					{featuredCourses.map((course) => (
						<article
							className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_28px_rgba(48,38,90,.1)] transition hover:-translate-y-1"
							key={course.title}
						>
							<div
								className={`flex h-44 items-center justify-center ${course.color} text-7xl`}
							>
								{course.icon}
							</div>
							<div className="p-6">
								<h3 className="font-extrabold text-lg">{course.title}</h3>
								<p className="mt-3 text-[#777582] text-sm">{course.meta}</p>
								<Link
									className="mt-5 inline-block font-bold text-[#0056d2] text-sm"
									search={{ mode: "sign-up" }}
									to="/login"
								>
									Xem khóa học →
								</Link>
							</div>
						</article>
					))}
				</div>
			</section>
		</main>
	);
}
