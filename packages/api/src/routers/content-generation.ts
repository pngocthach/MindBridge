import { eventIterator } from "@orpc/contract";
import { z } from "zod";

import { permissionProcedure } from "../index";

const generationEvent = z.discriminatedUnion("type", [
	z.object({
		generationId: z.string().uuid(),
		type: z.literal("started"),
	}),
	z.object({
		draft: z.record(z.string(), z.unknown()),
		type: z.literal("partial"),
	}),
	z.object({
		contentId: z.string().uuid(),
		contentVersionId: z.string().uuid(),
		generationId: z.string().uuid(),
		type: z.literal("completed"),
	}),
	z.object({
		generationId: z.string().uuid(),
		message: z.string(),
		type: z.literal("failed"),
	}),
]);

export const contentGenerationRouter = {
	generateLessonDraft: permissionProcedure("content:create")
		.input(
			z.object({
				chunkIds: z.array(z.string().uuid()).min(1).optional(),
				courseId: z.string().uuid(),
				documentId: z.string().uuid(),
			}),
		)
		.output(eventIterator(generationEvent))
		.handler(({ context, input, signal }) =>
			context.contentGeneration.generateLessonDraft({
				...input,
				canUseAnySource: context.role === "admin",
				requestedBy: context.session.user.id,
				signal: signal ?? new AbortController().signal,
			}),
		),
};
