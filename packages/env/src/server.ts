import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		DATABASE_URL: z.string().min(1),
		OPENAI_COMPATIBLE_API_KEY: z.string().min(1).optional(),
		OPENAI_COMPATIBLE_BASE_URL: z.url().optional(),
		OPENAI_COMPATIBLE_MODEL: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		TUTOR_LLM_API_KEY: z.string().optional(),
		TUTOR_LLM_BASE_URL: z.url().optional(),
		TUTOR_LLM_MODEL: z.string().optional(),
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
