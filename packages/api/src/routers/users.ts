import { userRoles } from "@MindBridge/auth/permissions";
import { account, db, session, user } from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { asc, count, countDistinct, eq } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

const userFields = {
	createdAt: user.createdAt,
	email: user.email,
	emailVerified: user.emailVerified,
	id: user.id,
	name: user.name,
	role: user.role,
	updatedAt: user.updatedAt,
};

const userInput = z.object({ userId: z.string().min(1) });

const requireUser = async (userId: string) => {
	const [existingUser] = await db
		.select(userFields)
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!existingUser) {
		throw new ORPCError("NOT_FOUND", { message: "User not found." });
	}
	return existingUser;
};

const requireAnotherUser = (actorId: string, userId: string) => {
	if (actorId === userId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "You cannot disable or demote your own account.",
		});
	}
};

const requireAnotherAdmin = async () => {
	const [result] = await db
		.select({ value: count() })
		.from(user)
		.where(eq(user.role, "admin"));
	if ((result?.value ?? 0) <= 1) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The final admin account cannot be disabled or demoted.",
		});
	}
};

export const usersRouter = {
	disable: adminProcedure
		.input(userInput)
		.handler(async ({ context, input }) => {
			requireAnotherUser(context.session.user.id, input.userId);
			const existingUser = await requireUser(input.userId);
			if (existingUser.role === "admin") {
				await requireAnotherAdmin();
			}

			return db.transaction(async (transaction) => {
				await transaction
					.delete(session)
					.where(eq(session.userId, input.userId));
				await transaction
					.delete(account)
					.where(eq(account.userId, input.userId));
				return { userId: input.userId };
			});
		}),
	list: adminProcedure.handler(() =>
		db
			.select({
				...userFields,
				activeSessionCount: countDistinct(session.id),
				credentialCount: countDistinct(account.id),
			})
			.from(user)
			.leftJoin(session, eq(session.userId, user.id))
			.leftJoin(account, eq(account.userId, user.id))
			.groupBy(
				user.id,
				user.name,
				user.email,
				user.emailVerified,
				user.createdAt,
				user.updatedAt,
				user.role,
			)
			.orderBy(asc(user.name), asc(user.email)),
	),
	revokeSessions: adminProcedure
		.input(userInput)
		.handler(async ({ context, input }) => {
			requireAnotherUser(context.session.user.id, input.userId);
			await requireUser(input.userId);
			await db.delete(session).where(eq(session.userId, input.userId));
			return { userId: input.userId };
		}),
	updateRole: adminProcedure
		.input(
			userInput.extend({
				role: z.enum(userRoles),
			}),
		)
		.handler(async ({ context, input }) => {
			const existingUser = await requireUser(input.userId);
			if (existingUser.role === input.role) {
				return existingUser;
			}
			if (existingUser.role === "admin" && input.role !== "admin") {
				requireAnotherUser(context.session.user.id, input.userId);
				await requireAnotherAdmin();
			}

			const [updatedUser] = await db
				.update(user)
				.set({ role: input.role })
				.where(eq(user.id, input.userId))
				.returning(userFields);
			if (!updatedUser) {
				throw new ORPCError("NOT_FOUND", { message: "User not found." });
			}
			return updatedUser;
		}),
};
