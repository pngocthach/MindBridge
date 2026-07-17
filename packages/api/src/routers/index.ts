import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { contentGenerationRouter } from "./content-generation";
import { contentWorkflowRouter } from "./content-workflow";
import { masteryRouter } from "./mastery";
import { recommendationRouter } from "./recommendation";
import { sourceDocumentRouter } from "./source-documents";
import { teacherRouter } from "./teacher";
import { tutorRouter } from "./tutor";

export const appRouter = {
	contentWorkflow: contentWorkflowRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	mastery: masteryRouter,
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	contentGeneration: contentGenerationRouter,
	recommendation: recommendationRouter,
	sourceDocuments: sourceDocumentRouter,
	teacher: teacherRouter,
	tutor: tutorRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
