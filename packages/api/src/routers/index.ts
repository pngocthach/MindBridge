import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { contentGenerationRouter } from "./content-generation";
import { contentWorkflowRouter } from "./content-workflow";
import { courseCurriculumRouter } from "./course-curriculum";
import { courseRouter } from "./courses";
import { learnerRouter } from "./learner";
import { masteryRouter } from "./mastery";
import { recommendationRouter } from "./recommendation";
import { sourceDocumentRouter } from "./source-documents";
import { teacherRouter } from "./teacher";
import { tutorRouter } from "./tutor";
import { usersRouter } from "./users";

export const appRouter = {
	contentWorkflow: contentWorkflowRouter,
	courseCurriculum: courseCurriculumRouter,
	healthCheck: publicProcedure.handler(() => "OK"),
	learner: learnerRouter,
	mastery: masteryRouter,
	privateData: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.session?.user,
	})),
	courses: courseRouter,
	contentGeneration: contentGenerationRouter,
	recommendation: recommendationRouter,
	sourceDocuments: sourceDocumentRouter,
	teacher: teacherRouter,
	tutor: tutorRouter,
	users: usersRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
