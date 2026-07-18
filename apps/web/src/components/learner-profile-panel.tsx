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
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

type LearnerProfile = Exclude<
	Awaited<ReturnType<typeof orpc.learner.getProfile.call>>,
	null
>;

type ProfileValues = {
	gradeLevel: string;
	learningGoal: string;
	locale: "en-US" | "vi-VN";
	proficiencyLevel: "advanced" | "beginner" | "intermediate";
};

const proficiencyLabels = {
	advanced: "Nâng cao",
	beginner: "Mới bắt đầu",
	intermediate: "Trung cấp",
} as const;

const initialValues = (profile: LearnerProfile | null): ProfileValues => ({
	gradeLevel: String(profile?.gradeLevel ?? 6),
	learningGoal: profile?.learningGoal ?? "",
	locale: profile?.locale === "en-US" ? "en-US" : "vi-VN",
	proficiencyLevel:
		profile?.proficiencyLevel === "advanced" ||
		profile?.proficiencyLevel === "intermediate"
			? profile.proficiencyLevel
			: "beginner",
});

export default function LearnerProfilePanel({
	learnerName,
	profile,
}: {
	learnerName: string;
	profile: LearnerProfile | null;
}) {
	const queryClient = useQueryClient();
	const [isEditing, setIsEditing] = useState(profile === null);
	const [values, setValues] = useState(() => initialValues(profile));
	const saveProfile = useMutation(
		orpc.learner.upsertProfile.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.learner.getProfile.key(),
				});
				setIsEditing(false);
				toast.success(profile ? "Đã cập nhật hồ sơ." : "Hồ sơ đã sẵn sàng.");
			},
		}),
	);

	const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
		event.preventDefault();
		saveProfile.mutate({
			gradeLevel: Number(values.gradeLevel),
			learningGoal: values.learningGoal,
			locale: values.locale,
			proficiencyLevel: values.proficiencyLevel,
		});
	};

	if (!(isEditing || profile === null)) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Hồ sơ học tập</CardTitle>
					<CardDescription>
						Lớp {profile.gradeLevel} ·{" "}
						{proficiencyLabels[values.proficiencyLevel]}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm">{profile.learningGoal}</p>
				</CardContent>
				<CardFooter className="justify-end">
					<Button
						onClick={() => setIsEditing(true)}
						type="button"
						variant="outline"
					>
						Chỉnh sửa hồ sơ
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		<section aria-labelledby="profile-title" className="mx-auto max-w-2xl">
			<Card>
				<CardHeader>
					<CardTitle id="profile-title">
						{profile ? "Chỉnh sửa hồ sơ học tập" : `Chào ${learnerName}!`}
					</CardTitle>
					<CardDescription>
						{profile
							? "Cập nhật thông tin để MindBridge điều chỉnh trải nghiệm học."
							: "Hoàn tất hồ sơ để nhận nội dung phù hợp ngay từ lần đăng nhập đầu tiên."}
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit}>
					<CardContent className="grid gap-4 sm:grid-cols-2">
						<label className="space-y-1 font-medium text-xs">
							<span>Lớp hiện tại</span>
							<Input
								max="12"
								min="1"
								onChange={(event) =>
									setValues({ ...values, gradeLevel: event.target.value })
								}
								required
								type="number"
								value={values.gradeLevel}
							/>
						</label>
						<label className="space-y-1 font-medium text-xs">
							<span>Trình độ hiện tại</span>
							<select
								className="h-9 w-full border border-input bg-background px-3 text-sm"
								onChange={(event) =>
									setValues({
										...values,
										proficiencyLevel: event.target
											.value as ProfileValues["proficiencyLevel"],
									})
								}
								value={values.proficiencyLevel}
							>
								{Object.entries(proficiencyLabels).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1 font-medium text-xs">
							<span>Ngôn ngữ</span>
							<select
								className="h-9 w-full border border-input bg-background px-3 text-sm"
								onChange={(event) =>
									setValues({
										...values,
										locale: event.target.value as ProfileValues["locale"],
									})
								}
								value={values.locale}
							>
								<option value="vi-VN">Tiếng Việt</option>
								<option value="en-US">English</option>
							</select>
						</label>
						<label className="space-y-1 font-medium text-xs sm:col-span-2">
							<span>Mục tiêu học tập</span>
							<Textarea
								className="min-h-28"
								maxLength={2000}
								onChange={(event) =>
									setValues({ ...values, learningGoal: event.target.value })
								}
								placeholder="Ví dụ: Củng cố nền tảng lập trình và tự hoàn thành một dự án nhỏ."
								required
								value={values.learningGoal}
							/>
						</label>
						{saveProfile.isError ? (
							<p
								className="text-destructive text-sm sm:col-span-2"
								role="alert"
							>
								Không thể lưu hồ sơ. {saveProfile.error.message}
							</p>
						) : null}
					</CardContent>
					<CardFooter className="flex justify-end gap-2">
						{profile ? (
							<Button
								onClick={() => {
									setValues(initialValues(profile));
									setIsEditing(false);
								}}
								type="button"
								variant="outline"
							>
								Hủy
							</Button>
						) : null}
						<Button disabled={saveProfile.isPending} type="submit">
							{saveProfile.isPending
								? "Đang lưu…"
								: profile
									? "Lưu hồ sơ"
									: "Bắt đầu học"}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</section>
	);
}
