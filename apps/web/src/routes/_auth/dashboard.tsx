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
import { Send, ShieldAlert, Sparkles } from "lucide-react";
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
		<Card>
			<CardHeader>
				<CardTitle>Xin chào, {session.data?.user.name}</CardTitle>
				<CardDescription>
					Tổng quan cá nhân của bạn sẽ được cập nhật tại đây.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-muted-foreground text-sm">
					{privateData.data.message}
				</p>
			</CardContent>
			<TutorChat />
		</Card>
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
		<section aria-labelledby="tutor-title" className="border-t pt-4">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Sparkles aria-hidden="true" className="size-4" />
					<CardTitle id="tutor-title">Trợ giảng AI</CardTitle>
				</div>
				<CardDescription>
					Đang hỗ trợ bài: <strong>{lessonContext.title}</strong>
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

			<CardContent>
				<div aria-live="polite" className="space-y-3" role="log">
					{messages.length === 0 ? (
						<p className="border border-dashed p-4 text-muted-foreground">
							Hãy hỏi về khái niệm hoặc bước bạn đang vướng. Trợ giảng sẽ gợi ý
							từng bước dựa trên bài đang mở.
						</p>
					) : null}
					{messages.map((message) =>
						message.role === "learner" ? (
							<div
								className="ml-auto max-w-[85%] bg-primary p-3 text-primary-foreground"
								key={message.id}
							>
								<p className="font-medium">Bạn</p>
								<p className="mt-1">{message.content}</p>
							</div>
						) : (
							<div
								className="max-w-[90%] border bg-muted/40 p-3"
								key={message.id}
							>
								<p className="font-medium">Trợ giảng AI</p>
								<p className="mt-2">{message.content.introduction}</p>
								<ol className="mt-3 space-y-3">
									{message.content.steps.map((step) => (
										<li key={step.title}>
											<p className="font-medium">{step.title}</p>
											<p className="mt-1 text-muted-foreground">
												{step.content}
											</p>
										</li>
									))}
								</ol>
								<p className="mt-3 border-t pt-3 font-medium">
									{message.content.followUpQuestion}
								</p>
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

			<CardFooter>
				<form className="flex w-full items-end gap-2" onSubmit={handleSubmit}>
					<div className="flex-1">
						<label
							className="mb-1 block font-medium text-xs"
							htmlFor="tutor-question"
						>
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
		</section>
	);
}
