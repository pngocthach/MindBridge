import { Button } from "@MindBridge/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@MindBridge/ui/components/empty";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/learn")({
	component: LearnerPage,
});

function LearnerPage() {
	const queryClient = useQueryClient();
	const profile = useQuery(orpc.mastery.profile.queryOptions());
	const practice = useQuery(orpc.mastery.practice.queryOptions());
	const latest = useQuery(orpc.recommendation.latest.queryOptions());
	const practiceStartedAt = useRef(Date.now());
	const [selectedOptionId, setSelectedOptionId] = useState<string>();
	const generate = useMutation(
		orpc.recommendation.generate.mutationOptions({
			onError: () => toast.error("Không thể tạo đề xuất lúc này."),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.recommendation.latest.key(),
				});
				toast.success("Đã cập nhật lộ trình học của bạn.");
			},
		}),
	);
	const submitAttempt = useMutation(
		orpc.mastery.submitAttempt.mutationOptions({
			onError: () => toast.error("Không thể ghi nhận bài làm. Hãy thử lại."),
		}),
	);

	const isRefreshing = generate.isPending || submitAttempt.isPending;
	const handleGenerate = () => {
		if (!generate.isPending) {
			generate.mutate({ limit: 6 });
		}
	};
	const handleSubmit = async () => {
		if (!selectedOptionId || isRefreshing) {
			return;
		}

		if (!practice.data) {
			return;
		}
		const durationSeconds = Math.max(
			1,
			Math.round((Date.now() - practiceStartedAt.current) / 1000),
		);

		try {
			await submitAttempt.mutateAsync({
				contentVersionId: practice.data.contentVersionId,
				durationSeconds,
				responses: [
					{
						assessmentItemId: practice.data.id,
						attemptNumber: 1,
						durationSeconds,
						selectedOptionId,
					},
				],
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.mastery.profile.key(),
			});
			await generate.mutateAsync({ limit: 6 });
			await queryClient.invalidateQueries({
				queryKey: orpc.recommendation.latest.key(),
			});
			toast.success("Đã ghi nhận kết quả và cập nhật lộ trình.");
		} catch {
			// Mutation states above show an accessible error message to the learner.
		}
	};

	if (profile.isPending || latest.isPending || practice.isPending) {
		return <Loader />;
	}

	if (profile.isError || latest.isError || practice.isError) {
		return (
			<section
				className="rounded-none border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không thể tải lộ trình học</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Hãy tải lại trang hoặc thử lại sau ít phút.
				</p>
			</section>
		);
	}

	const skills = profile.data?.skills ?? [];
	const weakSkills = skills.filter((skill) => !skill.isMastered);
	const recommendations = latest.data?.recommendations ?? [];

	return (
		<section aria-labelledby="learner-title" className="space-y-4">
			<header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
				<div>
					<p className="font-medium text-primary text-xs uppercase tracking-widest">
						Không gian học tập
					</p>
					<h1 className="mt-1 font-semibold text-2xl" id="learner-title">
						Lộ trình học của bạn
					</h1>
					<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
						Theo dõi tiến bộ, luyện tập và nhận bước học tiếp theo dựa trên
						chính kết quả của bạn.
					</p>
				</div>
				<Button disabled={isRefreshing} onClick={handleGenerate} type="button">
					<RefreshCw
						aria-hidden="true"
						className={isRefreshing ? "animate-spin" : undefined}
						data-icon="inline-start"
					/>
					Cập nhật đề xuất
				</Button>
			</header>

			<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
				<div className="space-y-4">
					<section
						aria-labelledby="progress-title"
						className="rounded-xl border bg-card/70 p-4 shadow-sm"
					>
						<div className="mb-3 flex items-baseline justify-between">
							<h2 className="font-semibold text-lg" id="progress-title">
								Tiến độ kỹ năng
							</h2>
							<p className="text-muted-foreground text-xs">
								{skills.filter((skill) => skill.isMastered).length}/
								{skills.length} kỹ năng đã đạt ngưỡng
							</p>
						</div>
						{skills.length === 0 ? (
							<Empty className="border">
								<EmptyHeader>
									<EmptyTitle>Chưa có dữ liệu mastery</EmptyTitle>
									<EmptyDescription>
										Hãy hoàn thành bài luyện tập đầu tiên để bắt đầu theo dõi
										tiến bộ.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
								{skills.map((skill) => (
									<SkillProgress key={skill.skillId} skill={skill} />
								))}
							</div>
						)}
					</section>

					<Card className="border-primary/30 bg-primary/5" id="de-xuat">
						<CardHeader>
							<CardTitle>Đề xuất bước học tiếp theo</CardTitle>
							<CardDescription>
								MindBridge ưu tiên lấp khoảng trống tiền đề trước khi đưa bạn
								đến kỹ năng nâng cao.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{recommendations.length === 0 ? (
								<div className="border border-dashed p-4 text-muted-foreground text-sm">
									Chưa có đề xuất. Nhấn “Cập nhật đề xuất” để tạo lộ trình cá
									nhân hóa.
								</div>
							) : (
								<ol className="space-y-3">
									{recommendations.map((recommendation) => (
										<li
											className="flex gap-3 border bg-background p-4"
											key={recommendation.id}
										>
											<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs">
												{recommendation.rank}
											</div>
											<div className="min-w-0 flex-1">
												<p className="font-medium">
													{recommendation.contentTitle}
												</p>
												<p className="mt-1 text-muted-foreground text-xs">
													Kỹ năng: {recommendation.targetSkillName}
												</p>
												<p className="mt-2 text-sm">
													{recommendation.reasonVi}
												</p>
												<a
													className="mt-3 inline-flex items-center font-medium text-primary text-xs underline-offset-4 hover:underline"
													href="#quiz"
												>
													Mở khu vực luyện tập
													<ArrowRight
														aria-hidden="true"
														className="ml-1 size-3"
													/>
												</a>
											</div>
										</li>
									))}
								</ol>
							)}
						</CardContent>
					</Card>
				</div>

				<aside className="space-y-3 xl:sticky xl:top-20">
					<QuizCard
						error={submitAttempt.isError || generate.isError}
						isPending={isRefreshing}
						isSubmitted={submitAttempt.isSuccess}
						onSelect={setSelectedOptionId}
						onSubmit={handleSubmit}
						practice={practice.data}
						selectedOptionId={selectedOptionId}
					/>

					{weakSkills.length > 0 ? (
						<p className="flex items-start gap-2 rounded-lg border bg-card/70 p-3 text-muted-foreground text-xs">
							<CircleAlert
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0"
							/>
							Khoảng trống hiện tại:{" "}
							{weakSkills.map((skill) => skill.skillName).join(",")}. Hãy làm
							bài luyện tập và xem lại đề xuất sau mỗi lần nộp.
						</p>
					) : null}
				</aside>
			</div>
		</section>
	);
}

type SkillProgressProps = {
	skill: {
		isMastered: boolean;
		masteryThreshold: number;
		score: number;
		skillId: string;
		skillName: string;
	};
};

function SkillProgress({ skill }: SkillProgressProps) {
	const score = Math.round(skill.score * 100);
	const threshold = Math.round(skill.masteryThreshold * 100);
	return (
		<Card size="sm">
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<CardTitle>{skill.skillName}</CardTitle>
					{skill.isMastered ? (
						<CheckCircle2
							aria-label="Đã đạt mastery"
							className="size-4 text-emerald-600"
						/>
					) : (
						<CircleAlert
							aria-label="Cần luyện thêm"
							className="size-4 text-amber-600"
						/>
					)}
				</div>
				<CardDescription>
					{skill.isMastered ? "Đã thành thạo" : "Cần luyện thêm"} · Ngưỡng{" "}
					{threshold}%
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div
					aria-label={`Tiến độ ${skill.skillName}`}
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={score}
					className="h-2 overflow-hidden bg-muted"
					role="progressbar"
				>
					<div
						className={
							skill.isMastered ? "h-full bg-emerald-600" : "h-full bg-primary"
						}
						style={{ width: `${Math.min(100, score)}%` }}
					/>
				</div>
				<p className="mt-2 text-muted-foreground text-xs">
					Điểm hiện tại: {score}%
				</p>
			</CardContent>
		</Card>
	);
}

type QuizCardProps = {
	error: boolean;
	isPending: boolean;
	isSubmitted: boolean;
	onSelect: (optionId: string) => void;
	onSubmit: () => void;
	practice:
		| {
				contentTitle: string;
				id: string;
				options: { id: string; text: string }[];
				prompt: string;
		  }
		| null
		| undefined;
	selectedOptionId: string | undefined;
};

function QuizCard({
	error,
	isPending,
	isSubmitted,
	onSelect,
	onSubmit,
	practice,
	selectedOptionId,
}: QuizCardProps) {
	if (!practice) {
		return (
			<Empty className="border" id="quiz">
				<EmptyHeader>
					<EmptyTitle>Chưa có bài luyện tập</EmptyTitle>
					<EmptyDescription>
						Giáo viên cần xuất bản câu hỏi trước khi bạn có thể luyện tập.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Card id="quiz">
			<CardHeader>
				<CardTitle>Luyện tập: {practice.contentTitle}</CardTitle>
				<CardDescription>
					Chọn một đáp án rồi gửi kết quả để cập nhật mastery và lộ trình của
					bạn.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="font-medium">{practice.prompt}</p>
				<fieldset className="mt-4 space-y-2" disabled={isPending}>
					<legend className="sr-only">Các đáp án</legend>
					{practice.options.map((option) => (
						<label
							className="flex cursor-pointer items-start gap-3 border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
							key={option.id}
						>
							<input
								checked={selectedOptionId === option.id}
								className="mt-0.5"
								name="loop-answer"
								onChange={() => onSelect(option.id)}
								type="radio"
							/>
							<span className="text-sm">{option.text}</span>
						</label>
					))}
				</fieldset>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<Button
						disabled={!selectedOptionId || isPending}
						onClick={onSubmit}
						type="button"
					>
						{isPending ? "Đang ghi nhận…" : "Nộp kết quả"}
					</Button>
					{isSubmitted ? (
						<p
							aria-live="polite"
							className="flex items-center gap-1 text-emerald-700 text-xs"
						>
							<CheckCircle2 aria-hidden="true" className="size-4" />
							Đã cập nhật mastery và đề xuất.
						</p>
					) : null}
					{error ? (
						<p
							aria-live="assertive"
							className="text-destructive text-xs"
							role="alert"
						>
							Có lỗi khi xử lý. Vui lòng thử lại.
						</p>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
