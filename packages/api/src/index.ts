import {
	hasPermission,
	isUserRole,
	type Permission,
} from "@MindBridge/auth/permissions";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export const permissionProcedure = (permission: Permission) =>
	protectedProcedure.use(async ({ context, next }) => {
		const role = context.session.user.role;
		if (!isUserRole(role) || !hasPermission(role, permission)) {
			throw new ORPCError("FORBIDDEN");
		}

		return next({
			context: {
				role,
				session: context.session,
			},
		});
	});
