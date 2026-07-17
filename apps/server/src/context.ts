import type {
	ApiContext,
	ContentGenerationPort,
	CourseCatalogPort,
	DocumentIngestionPort,
} from "@MindBridge/api";
import { auth } from "@MindBridge/auth";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
	contentGeneration: ContentGenerationPort;
	courseCatalog: CourseCatalogPort;
	context: HonoContext;
	documentIngestion: DocumentIngestionPort;
}

export const createContext = async ({
	contentGeneration,
	courseCatalog,
	context,
	documentIngestion,
}: CreateContextOptions): Promise<ApiContext> => {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});

	return {
		contentGeneration,
		courseCatalog,
		documentIngestion,
		session,
	};
};
