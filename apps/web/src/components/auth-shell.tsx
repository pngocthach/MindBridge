import { Link } from "@tanstack/react-router";
import { BrainCircuit, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

type AuthShellProps = {
	children: ReactNode;
};

export default function AuthShell({ children }: AuthShellProps) {
	const [isMiloGreeting, setIsMiloGreeting] = useState(false);

	return (
		<main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-[#dcecff] via-[#f7faff] to-[#d9f5f2] p-5 sm:p-10">
			<div className="absolute -top-40 -left-40 size-[32rem] rounded-full bg-blue-300/30 blur-3xl" />
			<div className="absolute -right-40 -bottom-40 size-[34rem] rounded-full bg-cyan-300/25 blur-3xl" />
			<div className="absolute top-1/4 right-[12%] size-5 rounded-full bg-white/80 shadow-lg" />
			<div className="absolute bottom-1/4 left-[14%] size-3 rounded-full bg-primary/30" />

			<Link
				className="absolute top-7 left-7 z-20 flex items-center gap-3 font-extrabold text-[#17233c] text-xl"
				to="/"
			>
				<span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
					<BrainCircuit aria-hidden="true" className="size-6" />
				</span>
				MindBridge
			</Link>

			<div className="absolute right-[5%] bottom-0 z-10 hidden h-[min(62vh,34rem)] w-72 lg:block xl:w-80">
				<div
					aria-hidden="true"
					className="absolute right-5 bottom-0 h-6 w-56 rounded-[50%] bg-[#003f9e]/25 blur-lg"
				/>
				{isMiloGreeting ? (
					<div className="absolute right-10 bottom-[85%] rounded-2xl rounded-br-sm bg-white px-4 py-3 text-[#17233c] text-sm shadow-lg">
						Chào bạn! Milo sẵn sàng đồng hành 🤖
					</div>
				) : null}
				<button
					aria-label="Nói chuyện với Milo"
					className="relative block h-full w-full border-0 bg-transparent p-0 shadow-none transition-transform duration-300 hover:scale-105 focus-visible:scale-105"
					data-slot="button"
					onClick={() => setIsMiloGreeting((current) => !current)}
					type="button"
				>
					<img
						alt=""
						aria-hidden="true"
						className="h-full w-full object-contain object-bottom drop-shadow-[0_18px_20px_rgba(0,60,140,.18)] animate-[milo-float_4s_ease-in-out_infinite]"
						height="1536"
						src="/images/milo-mascot.png"
						width="1024"
					/>
				</button>
			</div>
			<div className="pointer-events-none absolute bottom-10 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-primary text-xs shadow-sm backdrop-blur sm:flex">
				<Sparkles aria-hidden="true" className="size-3.5" />
				Học cùng Milo, tiến bộ mỗi ngày
			</div>

			<section className="relative z-10 flex w-full max-w-md items-center justify-center">
				{children}
			</section>
		</main>
	);
}
