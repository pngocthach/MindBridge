import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { GraduationCap, Send, ShieldAlert, Sparkles, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { orpc } from "@/utils/orpc";

type TutorReply = {
	followUpQuestion: string;
	introduction: string;
	steps: { content: string; title: string }[];
};

type ChatMessage =
	| { content: string; id: number; role: "learner" }
	| { content: TutorReply; id: number; role: "tutor" };

type MiloLesson = { content: string; id: string; title: string };
type MiloSkillProfile = {
	level: "advanced" | "beginner" | "intermediate";
	needsSupport: string[];
	strengths: string[];
};

export function MiloAssistant({
	dialogKey,
	lesson,
	skillProfile,
}: {
	dialogKey: string;
	lesson: MiloLesson;
	skillProfile: MiloSkillProfile;
}) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<button
				aria-controls="milo-assistant"
				aria-expanded={isOpen}
				aria-label="Mở trợ giảng AI Milo"
				className="group fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-full border border-primary/20 bg-primary px-4 py-3 text-primary-foreground shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
				onClick={() => setIsOpen(true)}
				type="button"
			>
				<span className="relative flex size-12 items-center justify-center overflow-hidden rounded-full bg-white">
					<span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
					<img
						alt=""
						aria-hidden="true"
						className="relative mt-3 w-10 scale-125"
						height="1536"
						src="/images/milo-mascot.png"
						width="1024"
					/>
				</span>
				<span className="hidden text-left sm:block">
					<span className="block font-semibold text-sm">Milo AI</span>
					<span className="block text-primary-foreground/80 text-xs">
						Hỏi trợ giảng
					</span>
				</span>
			</button>

			{isOpen ? (
				<div
					aria-labelledby="milo-title"
					aria-modal="true"
					className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
					id="milo-assistant"
					role="dialog"
				>
					<div className="absolute inset-3 sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(720px,calc(100vh-2.5rem))] sm:w-[min(430px,calc(100vw-2.5rem))]">
						<Button
							aria-label="Đóng trợ giảng Milo"
							className="absolute top-3 right-3 z-10"
							onClick={() => setIsOpen(false)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<X aria-hidden="true" />
						</Button>
						<MiloChat
							key={dialogKey}
							lesson={lesson}
							skillProfile={skillProfile}
						/>
					</div>
				</div>
			) : null}
		</>
	);
}

type MiloChatProps = {
	lesson: MiloLesson;
	skillProfile: MiloSkillProfile;
};

function MiloChat({ lesson, skillProfile }: MiloChatProps) {
	const [question, setQuestion] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const tutor = useMutation(orpc.tutor.ask.mutationOptions());

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedQuestion = question.trim();
		if (!trimmedQuestion || tutor.isPending) {
			return;
		}

		const messageId = Date.now();
		setMessages((currentMessages) => [
			...currentMessages,
			{ content: trimmedQuestion, id: messageId, role: "learner" },
		]);
		setQuestion("");

		try {
			const reply = await tutor.mutateAsync({
				lessonContext: lesson,
				question: trimmedQuestion,
				skillProfile,
			});
			setMessages((currentMessages) => [
				...currentMessages,
				{ content: reply, id: messageId + 1, role: "tutor" },
			]);
		} catch {
			// Mutation state renders the error while preserving the learner's message.
		}
	};

	return (
		<Card className="flex h-full min-h-0 flex-col overflow-hidden shadow-2xl">
			<CardHeader className="border-b pb-4">
				<div className="flex items-center gap-2">
					<Sparkles aria-hidden="true" className="size-4" />
					<CardTitle id="milo-title">Milo · Trợ giảng AI</CardTitle>
				</div>
				<CardDescription className="line-clamp-1">
					Đang hỗ trợ: <strong>{lesson.title}</strong>
				</CardDescription>
				<div
					className="mt-2 flex gap-2 border border-amber-500/40 bg-amber-500/10 p-3 text-amber-950 text-xs dark:text-amber-100"
					role="note"
				>
					<ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<p>
						Không chia sẻ dữ liệu cá nhân. AI có thể sai; hãy kiểm tra lại thông
						tin với giáo viên và tài liệu bài học.
					</p>
				</div>
			</CardHeader>

			<CardContent className="min-h-0 flex-1 overflow-y-auto pt-4">
				<div aria-live="polite" className="space-y-4" role="log">
					{messages.length === 0 ? (
						<div className="border border-dashed p-4 text-muted-foreground">
							<p className="flex items-center gap-2 font-medium text-foreground text-sm">
								<GraduationCap aria-hidden="true" className="size-4" />
								Milo đã sẵn sàng hỗ trợ bạn
							</p>
							<p className="mt-1 text-xs">
								Hãy hỏi về khái niệm hoặc bước bạn đang vướng.
							</p>
						</div>
					) : null}
					{messages.map((message) =>
						message.role === "learner" ? (
							<div className="flex justify-end" key={message.id}>
								<div className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground text-sm">
									<p>{message.content}</p>
								</div>
							</div>
						) : (
							<div className="flex gap-2" key={message.id}>
								<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
									<Sparkles aria-hidden="true" className="size-4" />
								</div>
								<div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-3 text-sm">
									<p className="font-medium text-xs">Milo</p>
									<p className="mt-2 leading-6">
										{message.content.introduction}
									</p>
									<ol className="mt-3 space-y-3">
										{message.content.steps.map((step) => (
											<li key={step.title}>
												<p className="font-medium">{step.title}</p>
												<p className="mt-1 text-muted-foreground text-xs leading-5">
													{step.content}
												</p>
											</li>
										))}
									</ol>
									<p className="mt-3 border-t pt-3 font-medium text-xs">
										{message.content.followUpQuestion}
									</p>
								</div>
							</div>
						),
					)}
					{tutor.isPending ? (
						<p className="text-muted-foreground">Milo đang chuẩn bị gợi ý…</p>
					) : null}
					{tutor.isError ? (
						<p className="text-destructive" role="alert">
							Không thể nhận gợi ý lúc này. Hãy thử gửi lại câu hỏi.
						</p>
					) : null}
				</div>
			</CardContent>

			<CardFooter className="border-t bg-background pt-4">
				<form className="flex w-full items-end gap-2" onSubmit={handleSubmit}>
					<div className="flex-1">
						<label className="sr-only" htmlFor="milo-question">
							Câu hỏi của bạn
						</label>
						<Textarea
							disabled={tutor.isPending}
							id="milo-question"
							maxLength={2000}
							onChange={(event) => setQuestion(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									event.currentTarget.form?.requestSubmit();
								}
							}}
							placeholder="Hỏi Milo… (Enter để gửi, Shift+Enter xuống dòng)"
							required
							value={question}
						/>
					</div>
					<Button disabled={!question.trim() || tutor.isPending} type="submit">
						<Send aria-hidden="true" data-icon="inline-start" />
						Gửi
					</Button>
				</form>
			</CardFooter>
		</Card>
	);
}
