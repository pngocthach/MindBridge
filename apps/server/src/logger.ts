import { env } from "@MindBridge/env/server";
import pino from "pino";

export const logger = pino({
	level: env.NODE_ENV === "test" ? "silent" : "info",
	transport:
		env.NODE_ENV === "production"
			? undefined
			: {
					target: "pino-pretty",
					options: {
						colorize: true,
						ignore: "pid,hostname",
						translateTime: "SYS:standard",
					},
				},
});
