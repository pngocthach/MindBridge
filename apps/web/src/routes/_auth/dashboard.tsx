import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@MindBridge/ui/components/empty";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BookOpen,
	CheckCircle2,
	Clock3,
	Send,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

const lessonContext = {
	content:
		"Phân số biểu thị một hay nhiều phần bằng nhau của một đơn vị. Tử số cho biết số phần được lấy, mẫu số cho biết đơn vị được chia thành bao nhiêu phần bằng nhau. Muốn cộng hai phân số khác mẫu, cần quy đồng mẫu số trước rồi cộng các tử số.",
	id: "lesson-fractions-intro",
	title: "Phân số và phép cộng phân số",
} as const;

const skillProfile = {
	level: "beginner",
	needsSupport: ["quy đồng mẫu số"],
	strengths: ["nhận biết tử số và mẫu số"],
} as const;

type TutorReply = {
	followUpQuestion: string;
	introduction: string;
	steps: { content: string; title: string }[];
};

type ChatMessage =
	| { content: string; id: number; role: "learner" }
	| { content: TutorReply; id: number; role: "tutor" };

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const privateData = useQuery(orpc.privateData.queryOptions());

	if (privateData.isPending) {
		return <Loader />;
	}

	if (privateData.isError) {
		return (
			<section
				className="rounded-lg border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không thể tải tổng quan</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Hãy thử lại sau ít phút.
				</p>
			</section>
		);
	}

	if (!privateData.data) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>Chưa có dữ liệu tổng quan</EmptyTitle>
					<EmptyDescription>
						Dữ liệu học tập sẽ xuất hiện khi bạn bắt đầu sử dụng MindBridge.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<section aria-labelledby="course-dashboard-title" className="space-y-6">
			<header className="space-y-3">
				<div className="flex items-center gap-2 font-medium text-primary text-xs uppercase tracking-widest">
					<BookOpen aria-hidden="true" className="size-4" />
					Khóa học đang học
				</div>
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1
							className="font-semibold text-3xl tracking-tight"
							id="course-dashboard-title"
						>
							Xin chào, {session.data?.user.name}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Tiếp tục bài học của bạn và hỏi trợ giảng bất cứ lúc nào.
						</p>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Clock3 aria-hidden="true" className="size-4" />
						Khoảng 12 phút còn lại
					</div>
				</div>
				<div
					className="h-2 overflow-hidden rounded-full bg-muted"
					role="progressbar"
					aria-label="Tiến độ khóa học"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={42}
				>
					<div className="h-full w-[42%] rounded-full bg-primary" />
				</div>
				<div className="flex justify-between text-muted-foreground text-xs">
					<span>42% hoàn thành</span>
					<span>Tuần 2 / 5</span>
				</div>
			</header>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
				<Card className="overflow-hidden">
					<div className="bg-primary px-6 py-8 text-primary-foreground">
						<p className="text-primary-foreground/75 text-xs uppercase tracking-widest">
							Bài 2 · Nền tảng
						</p>
						<h2 className="mt-2 font-semibold text-2xl">
							{lessonContext.title}
						</h2>
						<p className="mt-2 max-w-2xl text-primary-foreground/80 text-sm">
							{privateData.data.message}
						</p>
					</div>
					<CardHeader>
						<CardTitle>Nội dung bài học</CardTitle>
						<CardDescription>
							Đọc phần tóm tắt, sau đó trao đổi với trợ giảng để kiểm tra hiểu
							bài.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<p className="text-sm leading-7">{lessonContext.content}</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="border bg-muted/30 p-4">
								<p className="font-medium text-sm">Mục tiêu bài học</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Nhận biết vai trò của tử số, mẫu số và cách cộng phân số.
								</p>
							</div>
							<div className="border bg-muted/30 p-4">
								<p className="font-medium text-sm">Trạng thái</p>
								<p className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
									<CheckCircle2
										aria-hidden="true"
										className="size-3 text-emerald-600"
									/>{" "}
									Đang học
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<TutorChat />
			</div>
		</section>
	);
}

function TutorChat() {
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
				lessonContext,
				question: trimmedQuestion,
				skillProfile: {
					level: skillProfile.level,
					needsSupport: [...skillProfile.needsSupport],
					strengths: [...skillProfile.strengths],
				},
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
		<Card className="flex min-h-[560px] flex-col lg:sticky lg:top-6">
			<CardHeader className="border-b pb-4">
				<div className="flex items-center gap-2">
					<Sparkles aria-hidden="true" className="size-4" />
					<CardTitle id="tutor-title">Trợ giảng AI</CardTitle>
				</div>
				<CardDescription className="line-clamp-1">
					Đang hỗ trợ: <strong>{lessonContext.title}</strong>
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
						<p className="border border-dashed p-4 text-muted-foreground">
							Hãy hỏi về khái niệm hoặc bước bạn đang vướng. Trợ giảng sẽ gợi ý
							từng bước dựa trên bài đang mở.
						</p>
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
									<p className="font-medium text-xs">Trợ giảng AI</p>
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
						<p className="text-muted-foreground">
							Trợ giảng đang chuẩn bị gợi ý…
						</p>
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
						<label className="sr-only" htmlFor="tutor-question">
							Câu hỏi của bạn
						</label>
						<Textarea
							disabled={tutor.isPending}
							id="tutor-question"
							maxLength={2000}
							onChange={(event) => setQuestion(event.target.value)}
							placeholder="Ví dụ: Vì sao cần quy đồng mẫu số?"
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
