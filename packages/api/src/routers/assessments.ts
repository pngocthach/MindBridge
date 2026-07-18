import {
	assessmentItem,
	assessmentOption,
	contentVersion,
	db,
} from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { permissionProcedure } from "../index";

const itemTypes = ["single_choice", "multiple_choice", "short_answer"] as const;
const itemTypeSchema = z.enum(itemTypes);
const versionInput = z.object({ contentVersionId: z.string().uuid() });
const itemIdInput = z.object({ itemId: z.string().uuid() });
const optionIdInput = z.object({ optionId: z.string().uuid() });

const adminProcedure = permissionProcedure("content:update").use(
	async ({ context, next }) => {
		if (context.role !== "admin") {
			throw new ORPCError("FORBIDDEN", {
				message: "Only administrators can manage assessment questions.",
			});
		}
		return next({ context });
	},
);

const itemFields = {
	contentVersionId: assessmentItem.contentVersionId,
	explanation: assessmentItem.explanation,
	id: assessmentItem.id,
	itemType: assessmentItem.itemType,
	ordinal: assessmentItem.ordinal,
	prompt: assessmentItem.prompt,
};

const requireVersion = async (contentVersionId: string) => {
	const [version] = await db
		.select({ id: contentVersion.id })
		.from(contentVersion)
		.where(eq(contentVersion.id, contentVersionId))
		.limit(1);
	if (!version) {
		throw new ORPCError("NOT_FOUND", {
			message: "Content version not found.",
		});
	}
	return version;
};

const requireItem = async (itemId: string) => {
	const [item] = await db
		.select(itemFields)
		.from(assessmentItem)
		.where(eq(assessmentItem.id, itemId))
		.limit(1);
	if (!item) {
		throw new ORPCError("NOT_FOUND", { message: "Assessment item not found." });
	}
	return item;
};

const requireOption = async (optionId: string) => {
	const [option] = await db
		.select({
			assessmentItemId: assessmentOption.assessmentItemId,
			id: assessmentOption.id,
		})
		.from(assessmentOption)
		.where(eq(assessmentOption.id, optionId))
		.limit(1);
	if (!option) {
		throw new ORPCError("NOT_FOUND", {
			message: "Assessment option not found.",
		});
	}
	return option;
};

const itemValues = z.object({
	contentVersionId: z.string().uuid(),
	explanation: z.string().trim().max(2000),
	itemType: itemTypeSchema,
	ordinal: z.number().int().positive().max(1000),
	prompt: z.string().trim().min(1).max(2000),
});

const optionValues = z.object({
	assessmentItemId: z.string().uuid(),
	isCorrect: z.boolean(),
	ordinal: z.number().int().positive().max(1000),
	text: z.string().trim().min(1).max(1000),
});

export const assessmentRouter = {
	createItem: adminProcedure.input(itemValues).handler(async ({ input }) => {
		await requireVersion(input.contentVersionId);
		const [createdItem] = await db
			.insert(assessmentItem)
			.values(input)
			.returning();
		return { ...createdItem, options: [] };
	}),
	createOption: adminProcedure
		.input(optionValues)
		.handler(async ({ input }) => {
			await requireItem(input.assessmentItemId);
			const [createdOption] = await db
				.insert(assessmentOption)
				.values(input)
				.returning();
			return createdOption;
		}),
	deleteItem: adminProcedure.input(itemIdInput).handler(async ({ input }) => {
		await requireItem(input.itemId);
		const [deletedItem] = await db
			.delete(assessmentItem)
			.where(eq(assessmentItem.id, input.itemId))
			.returning({ id: assessmentItem.id });
		return deletedItem;
	}),
	deleteOption: adminProcedure
		.input(optionIdInput)
		.handler(async ({ input }) => {
			await requireOption(input.optionId);
			const [deletedOption] = await db
				.delete(assessmentOption)
				.where(eq(assessmentOption.id, input.optionId))
				.returning({ id: assessmentOption.id });
			return deletedOption;
		}),
	list: adminProcedure.input(versionInput).handler(async ({ input }) => {
		await requireVersion(input.contentVersionId);
		const items = await db
			.select(itemFields)
			.from(assessmentItem)
			.where(eq(assessmentItem.contentVersionId, input.contentVersionId))
			.orderBy(asc(assessmentItem.ordinal));
		if (items.length === 0) return [];
		const options = await db
			.select({
				assessmentItemId: assessmentOption.assessmentItemId,
				id: assessmentOption.id,
				isCorrect: assessmentOption.isCorrect,
				ordinal: assessmentOption.ordinal,
				text: assessmentOption.text,
			})
			.from(assessmentOption)
			.where(
				inArray(
					assessmentOption.assessmentItemId,
					items.map(({ id }) => id),
				),
			)
			.orderBy(asc(assessmentOption.ordinal));
		return items.map((item) => ({
			...item,
			options: options.filter((option) => option.assessmentItemId === item.id),
		}));
	}),
	updateItem: adminProcedure
		.input(
			itemIdInput.extend(itemValues.omit({ contentVersionId: true }).shape),
		)
		.handler(async ({ input }) => {
			await requireItem(input.itemId);
			const [updatedItem] = await db
				.update(assessmentItem)
				.set({
					explanation: input.explanation,
					itemType: input.itemType,
					ordinal: input.ordinal,
					prompt: input.prompt,
				})
				.where(eq(assessmentItem.id, input.itemId))
				.returning();
			return updatedItem;
		}),
	updateOption: adminProcedure
		.input(
			optionIdInput.extend(optionValues.omit({ assessmentItemId: true }).shape),
		)
		.handler(async ({ input }) => {
			await requireOption(input.optionId);
			const [updatedOption] = await db
				.update(assessmentOption)
				.set({
					isCorrect: input.isCorrect,
					ordinal: input.ordinal,
					text: input.text,
				})
				.where(eq(assessmentOption.id, input.optionId))
				.returning();
			return updatedOption;
		}),
};
