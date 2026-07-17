import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { contentGenerationRouter } from "./content-generation";
import { courseRouter } from "./courses";
import { sourceDocumentRouter } from "./source-documents";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => "OK"),
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	courses: courseRouter,
	contentGeneration: contentGenerationRouter,
	sourceDocuments: sourceDocumentRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
