import { createDb } from "@MindBridge/db";
import * as schema from "@MindBridge/db/schema/auth";
import { env } from "@MindBridge/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
	const db = createDb();

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
		plugins: [],
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.CORS_ORIGIN],
	});
}

export const auth = createAuth();
