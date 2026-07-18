import { appRouter } from "@MindBridge/api/routers/index";
import { MAX_DOCUMENT_BYTES } from "@MindBridge/api/routers/source-documents";
import { auth } from "@MindBridge/auth";
import { env } from "@MindBridge/env/server";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { createContext } from "./context";
import { logger } from "./logger";
import { LessonGenerationService } from "./service/content-generation/service";
import { CourseCatalogService } from "./service/course-catalog/service";
import { LocalPythonDocumentConverter } from "./service/document-ingestion/converter";
import { DocumentIngestionService } from "./service/document-ingestion/service";

const contentGenerationApiKey =
	env.OPENAI_COMPATIBLE_API_KEY ?? env.TUTOR_LLM_API_KEY;
const contentGenerationBaseUrl =
	env.OPENAI_COMPATIBLE_BASE_URL ?? env.TUTOR_LLM_BASE_URL;
const contentGenerationModel =
	env.OPENAI_COMPATIBLE_MODEL ?? env.TUTOR_LLM_MODEL;

const lessonGenerationService =
	contentGenerationApiKey && contentGenerationBaseUrl && contentGenerationModel
		? new LessonGenerationService({
				apiKey: contentGenerationApiKey,
				baseUrl: contentGenerationBaseUrl,
				model: contentGenerationModel,
			})
		: new LessonGenerationService();

const courseCatalogService = new CourseCatalogService();

const app = new Hono();
const documentIngestionService = new DocumentIngestionService(
	new LocalPythonDocumentConverter(
		fileURLToPath(new URL("../../ingestion-worker/", import.meta.url)),
	),
);

app.use(honoLogger((message) => logger.info(message)));
app.use(
	"/*",
	cors({
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "OPTIONS"],
		credentials: true,
		origin: env.CORS_ORIGIN,
	}),
);
app.use(
	"/rpc/sourceDocuments/upload",
	bodyLimit({
		maxSize: MAX_DOCUMENT_BYTES,
		onError: (context) =>
			context.json(
				{ message: "The uploaded file must be 50 MB or smaller." },
				413,
			),
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
	interceptors: [
		onError((error) => {
			logger.error({ err: error }, "OpenAPI request failed");
		}),
	],
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			logger.error({ err: error }, "RPC request failed");
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({
		contentGeneration: lessonGenerationService,
		courseCatalog: courseCatalogService,
		context: c,
		documentIngestion: documentIngestionService,
	});

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		context,
		prefix: "/rpc",
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		context,
		prefix: "/api-reference",
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => c.text("OK"));

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		logger.info({ port: info.port }, "Server is running");
	},
);
