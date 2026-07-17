import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { contentGenerationRouter } from "./content-generation";
import { contentWorkflowRouter } from "./content-workflow";
import { sourceDocumentRouter } from "./source-documents";
import { tutorRouter } from "./tutor";

export const appRouter = {
	contentWorkflow: contentWorkflowRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	contentGeneration: contentGenerationRouter,
	sourceDocuments: sourceDocumentRouter,
	tutor: tutorRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
