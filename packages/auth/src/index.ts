import { db } from "@MindBridge/db";
import * as schema from "@MindBridge/db/schema/auth";
import { env } from "@MindBridge/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { userRoles } from "./permissions";

export function createAuth() {
	return betterAuth({
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "none",
				secure: true,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		database: drizzleAdapter(db, {
			provider: "pg",

			schema,
		}),
		emailAndPassword: {
			enabled: true,
		},
		user: {
			additionalFields: {
				role: {
					defaultValue: "learner",
					input: false,
					required: true,
					type: [...userRoles],
				},
			},
		},
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.CORS_ORIGIN],
	});
}

export const auth = createAuth();
