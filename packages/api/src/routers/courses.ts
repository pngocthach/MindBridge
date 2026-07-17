import { z } from "zod";

import { permissionProcedure } from "../index";

export const courseRouter = {
	search: permissionProcedure("content:create")
		.input(z.object({ query: z.string().max(100).default("") }))
		.handler(({ context, input }) =>
			context.courseCatalog.search({
				canReadAllCourses: context.role === "admin",
				query: input.query,
				requestedBy: context.session.user.id,
			}),
		),
};
