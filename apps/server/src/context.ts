import type {
	ApiContext,
	ContentGenerationPort,
	DocumentIngestionPort,
} from "@MindBridge/api";
import { auth } from "@MindBridge/auth";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
	contentGeneration: ContentGenerationPort;
	context: HonoContext;
	documentIngestion: DocumentIngestionPort;
}

export const createContext = async ({
	contentGeneration,
	context,
	documentIngestion,
}: CreateContextOptions): Promise<ApiContext> => {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	return {
		contentGeneration,
		documentIngestion,
		session,
	};
};
