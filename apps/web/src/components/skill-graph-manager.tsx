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
import { Input } from "@MindBridge/ui/components/input";
import { Textarea } from "@MindBridge/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

type SkillGraph = Awaited<ReturnType<typeof orpc.skills.list.call>>;
type Skill = SkillGraph["skills"][number];

type SkillFormValues = {
	description: string;
	gradeLevel: string;
	masteryThreshold: string;
	name: string;
	slug: string;
};

const emptyForm: SkillFormValues = {
	description: "",
	gradeLevel: "1",
	masteryThreshold: "70",
	name: "",
	slug: "",
};

const formFromSkill = (skill: Skill): SkillFormValues => ({
	description: skill.description,
	gradeLevel: String(skill.gradeLevel),
	masteryThreshold: String(Math.round(skill.masteryThreshold * 100)),
	name: skill.name,
	slug: skill.slug,
});

const toMutationValues = (values: SkillFormValues) => ({
	description: values.description,
	gradeLevel: Number(values.gradeLevel),
	masteryThreshold: Number(values.masteryThreshold) / 100,
	name: values.name,
	slug: values.slug,
});

export default function SkillGraphManager() {
	const queryClient = useQueryClient();
	const graph = useQuery(orpc.skills.list.queryOptions());
	const [selectedSkillId, setSelectedSkillId] = useState<string>();
	const [createValues, setCreateValues] = useState(emptyForm);
	const [editValues, setEditValues] = useState(emptyForm);
	const [prerequisiteSkillId, setPrerequisiteSkillId] = useState("");
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const selectedSkill = graph.data?.skills.find(
		(skill) => skill.id === selectedSkillId,
	);

	useEffect(() => {
		if (selectedSkill) {
			setEditValues(formFromSkill(selectedSkill));
			setPrerequisiteSkillId("");
			setIsConfirmingDelete(false);
		}
	}, [selectedSkill]);

	const refreshGraph = async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() });
	};
	const callbacks = {
		onError: (error: Error) => toast.error(error.message),
	};
	const createSkill = useMutation(
		orpc.skills.create.mutationOptions({
			...callbacks,
			onSuccess: async (createdSkill) => {
				await refreshGraph();
				setCreateValues(emptyForm);
				setSelectedSkillId(createdSkill.id);
				toast.success("Đã tạo kỹ năng.");
			},
		}),
	);
	const updateSkill = useMutation(
		orpc.skills.update.mutationOptions({
			...callbacks,
			onSuccess: async () => {
				await refreshGraph();
				toast.success("Đã cập nhật kỹ năng.");
			},
		}),
	);
	const deleteSkill = useMutation(
		orpc.skills.delete.mutationOptions({
			...callbacks,
			onSuccess: async () => {
				setSelectedSkillId(undefined);
				await refreshGraph();
				toast.success("Đã xóa kỹ năng và các liên kết liên quan.");
			},
		}),
	);
	const addPrerequisite = useMutation(
		orpc.skills.addPrerequisite.mutationOptions({
			...callbacks,
			onSuccess: async () => {
				setPrerequisiteSkillId("");
				await refreshGraph();
				toast.success("Đã thêm kỹ năng tiên quyết.");
			},
		}),
	);
	const removePrerequisite = useMutation(
		orpc.skills.removePrerequisite.mutationOptions({
			...callbacks,
			onSuccess: async () => {
				await refreshGraph();
				toast.success("Đã gỡ kỹ năng tiên quyết.");
			},
		}),
	);

	const relationships = useMemo(() => {
		if (!(graph.data && selectedSkillId)) {
			return { dependents: [] as Skill[], prerequisites: [] as Skill[] };
		}
		const skillById = new Map(
			graph.data.skills.map((skill) => [skill.id, skill]),
		);
		return {
			dependents: graph.data.prerequisites
				.filter((edge) => edge.prerequisiteSkillId === selectedSkillId)
				.map((edge) => skillById.get(edge.skillId))
				.filter((skill): skill is Skill => Boolean(skill)),
			prerequisites: graph.data.prerequisites
				.filter((edge) => edge.skillId === selectedSkillId)
				.map((edge) => skillById.get(edge.prerequisiteSkillId))
				.filter((skill): skill is Skill => Boolean(skill)),
		};
	}, [graph.data, selectedSkillId]);
	const availablePrerequisites = (graph.data?.skills ?? []).filter(
		(skill) =>
			skill.id !== selectedSkillId &&
			!relationships.prerequisites.some(
				(prerequisite) => prerequisite.id === skill.id,
			),
	);

	return (
		<section aria-labelledby="skill-graph-title" className="space-y-4">
			<header className="flex items-center gap-2">
				<Network aria-hidden="true" className="size-5 text-primary" />
				<div>
					<h2 className="font-semibold text-xl" id="skill-graph-title">
						Đồ thị kỹ năng
					</h2>
					<p className="text-muted-foreground text-sm">
						Quản lý kỹ năng và quan hệ tiên quyết không tạo chu trình.
					</p>
				</div>
			</header>

			<div className="grid items-start gap-4 xl:grid-cols-[minmax(20rem,0.75fr)_minmax(28rem,1.25fr)]">
				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Tạo kỹ năng</CardTitle>
							<CardDescription>
								Thêm một node mới vào đồ thị học tập.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<SkillForm onChange={setCreateValues} values={createValues} />
						</CardContent>
						<CardFooter className="justify-end">
							<Button
								disabled={createSkill.isPending}
								onClick={() =>
									createSkill.mutate(toMutationValues(createValues))
								}
								type="button"
							>
								{createSkill.isPending ? "Đang tạo…" : "Tạo kỹ năng"}
							</Button>
						</CardFooter>
					</Card>

					<section aria-label="Danh sách kỹ năng" className="space-y-2">
						{graph.isPending ? (
							<p className="text-muted-foreground text-sm">Đang tải kỹ năng…</p>
						) : null}
						{graph.isError ? (
							<p className="text-destructive text-sm" role="alert">
								Không thể tải đồ thị kỹ năng.
							</p>
						) : null}
						{graph.data?.skills.length === 0 ? (
							<Empty>
								<EmptyHeader>
									<EmptyTitle>Chưa có kỹ năng</EmptyTitle>
									<EmptyDescription>
										Tạo node đầu tiên để bắt đầu xây dựng đồ thị.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : null}
						{graph.data?.skills.map((skill) => (
							<button
								aria-pressed={selectedSkillId === skill.id}
								className="w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/50 aria-pressed:border-primary aria-pressed:bg-primary/5"
								key={skill.id}
								onClick={() => setSelectedSkillId(skill.id)}
								type="button"
							>
								<span className="block font-medium">{skill.name}</span>
								<span className="text-muted-foreground text-xs">
									{skill.slug} · Lớp {skill.gradeLevel} · Ngưỡng{" "}
									{Math.round(skill.masteryThreshold * 100)}%
								</span>
							</button>
						))}
					</section>
				</div>

				{selectedSkill ? (
					<Card>
						<CardHeader>
							<CardTitle>Chỉnh sửa {selectedSkill.name}</CardTitle>
							<CardDescription>
								Cập nhật node và các liên kết trực tiếp của kỹ năng.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<SkillForm onChange={setEditValues} values={editValues} />
							<section
								aria-labelledby="prerequisite-title"
								className="space-y-3"
							>
								<h3 className="font-medium" id="prerequisite-title">
									Kỹ năng tiên quyết
								</h3>
								<div className="flex gap-2">
									<select
										aria-label="Chọn kỹ năng tiên quyết"
										className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm"
										onChange={(event) =>
											setPrerequisiteSkillId(event.target.value)
										}
										value={prerequisiteSkillId}
									>
										<option value="">Chọn kỹ năng…</option>
										{availablePrerequisites.map((skill) => (
											<option key={skill.id} value={skill.id}>
												{skill.name}
											</option>
										))}
									</select>
									<Button
										disabled={!prerequisiteSkillId || addPrerequisite.isPending}
										onClick={() =>
											addPrerequisite.mutate({
												prerequisiteSkillId,
												skillId: selectedSkill.id,
											})
										}
										type="button"
									>
										Thêm
									</Button>
								</div>
								{relationships.prerequisites.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										Kỹ năng này không có tiên quyết.
									</p>
								) : (
									<div className="space-y-2">
										{relationships.prerequisites.map((prerequisite) => (
											<div
												className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
												key={prerequisite.id}
											>
												<span className="flex items-center gap-2">
													{prerequisite.name}
													<ArrowRight aria-hidden="true" className="size-4" />
													{selectedSkill.name}
												</span>
												<Button
													disabled={removePrerequisite.isPending}
													onClick={() =>
														removePrerequisite.mutate({
															prerequisiteSkillId: prerequisite.id,
															skillId: selectedSkill.id,
														})
													}
													size="sm"
													type="button"
													variant="outline"
												>
													Gỡ
												</Button>
											</div>
										))}
									</div>
								)}
								<p className="text-muted-foreground text-xs">
									Được dùng làm tiên quyết cho {relationships.dependents.length}{" "}
									kỹ năng.
								</p>
							</section>
						</CardContent>
						<CardFooter className="flex flex-wrap justify-end gap-2">
							{isConfirmingDelete ? (
								<>
									<span className="mr-auto text-destructive text-sm">
										Xóa kỹ năng và mọi liên kết?
									</span>
									<Button
										onClick={() => setIsConfirmingDelete(false)}
										type="button"
										variant="outline"
									>
										Hủy
									</Button>
									<Button
										disabled={deleteSkill.isPending}
										onClick={() =>
											deleteSkill.mutate({ skillId: selectedSkill.id })
										}
										type="button"
										variant="destructive"
									>
										Xác nhận xóa
									</Button>
								</>
							) : (
								<>
									<Button
										onClick={() => setIsConfirmingDelete(true)}
										type="button"
										variant="destructive"
									>
										Xóa kỹ năng
									</Button>
									<Button
										disabled={updateSkill.isPending}
										onClick={() =>
											updateSkill.mutate({
												...toMutationValues(editValues),
												skillId: selectedSkill.id,
											})
										}
										type="button"
									>
										{updateSkill.isPending ? "Đang lưu…" : "Lưu thay đổi"}
									</Button>
								</>
							)}
						</CardFooter>
					</Card>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>Chọn một kỹ năng</EmptyTitle>
							<EmptyDescription>
								Chọn node để chỉnh sửa và quản lý tiên quyết.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</section>
	);
}

function SkillForm({
	onChange,
	values,
}: {
	onChange: (values: SkillFormValues) => void;
	values: SkillFormValues;
}) {
	const update = (field: keyof SkillFormValues, value: string): void => {
		onChange({ ...values, [field]: value });
	};
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<label className="space-y-1 font-medium text-xs">
				<span>Tên</span>
				<Input
					onChange={(event) => update("name", event.target.value)}
					value={values.name}
				/>
			</label>
			<label className="space-y-1 font-medium text-xs">
				<span>Slug</span>
				<Input
					onChange={(event) => update("slug", event.target.value)}
					placeholder="vi-du-ky-nang"
					value={values.slug}
				/>
			</label>
			<label className="space-y-1 font-medium text-xs">
				<span>Lớp</span>
				<Input
					max="12"
					min="1"
					onChange={(event) => update("gradeLevel", event.target.value)}
					type="number"
					value={values.gradeLevel}
				/>
			</label>
			<label className="space-y-1 font-medium text-xs">
				<span>Ngưỡng thành thạo (%)</span>
				<Input
					max="100"
					min="0"
					onChange={(event) => update("masteryThreshold", event.target.value)}
					type="number"
					value={values.masteryThreshold}
				/>
			</label>
			<label className="space-y-1 font-medium text-xs sm:col-span-2">
				<span>Mô tả</span>
				<Textarea
					onChange={(event) => update("description", event.target.value)}
					value={values.description}
				/>
			</label>
		</div>
	);
}
