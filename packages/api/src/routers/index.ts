import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { contentWorkflowRouter } from "./content-workflow";
import { masteryRouter } from "./mastery";
import { sourceDocumentRouter } from "./source-documents";
import { tutorRouter } from "./tutor";

export const appRouter = {
	contentWorkflow: contentWorkflowRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	mastery: masteryRouter,
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	sourceDocuments: sourceDocumentRouter,
	tutor: tutorRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
