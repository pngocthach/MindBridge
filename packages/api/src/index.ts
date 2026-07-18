import {
	hasPermission,
	isUserRole,
	type Permission,
} from "@MindBridge/auth/permissions";
import { ORPCError, os } from "@orpc/server";

export interface IngestDocumentInput {
	content: Uint8Array;
	fileName: string;
	mimeType: string;
	uploadedBy: string;
}

export interface IngestTextInput {
	text: string;
	uploadedBy: string;
}

export type IngestDocumentResult =
	| {
			chunkCount: number;
			documentId: string;
			preview: string;
			type: "success";
	  }
	| {
			message: string;
			type: "conversion_error";
	  };

export interface DocumentIngestionPort {
	ingest(input: IngestDocumentInput): Promise<IngestDocumentResult>;
	ingestText(input: IngestTextInput): Promise<IngestDocumentResult>;
}

export type ContentGenerationEvent =
	| { generationId: string; type: "started" }
	| { draft: Record<string, unknown>; type: "partial" }
	| {
			contentId: string;
			contentVersionId: string;
			draft: Record<string, unknown>;
			generationId: string;
			type: "completed";
	  }
	| { generationId: string; message: string; type: "failed" };

export interface ContentDraftMetadata {
	difficulty: string;
	gradeLevel: number;
	durationMinutes: number;
	learningObjectives: string[];
	prerequisites: string[];
	skillIds: string[];
}

export interface GenerateLessonDraftInput {
	canUseAnySource: boolean;
	chunkIds?: string[];
	courseId: string;
	documentId: string;
	metadata: ContentDraftMetadata;
	requestedBy: string;
	signal: AbortSignal;
}

export interface ContentGenerationPort {
	generateLessonDraft(
		input: GenerateLessonDraftInput,
	): AsyncGenerator<ContentGenerationEvent>;
}

export interface CourseSearchInput {
	canReadAllCourses: boolean;
	query: string;
	requestedBy: string;
}

export interface CourseOption {
	gradeLevel: number | null;
	id: string;
	title: string;
}

export interface CourseCatalogPort {
	search(input: CourseSearchInput): Promise<CourseOption[]>;
}

export interface ApiContext {
	contentGeneration: ContentGenerationPort;
	courseCatalog: CourseCatalogPort;
	documentIngestion: DocumentIngestionPort;
	session: {
		user: {
			id: string;
			role: string;
		};
	} | null;
}

export const o = os.$context<ApiContext>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			contentGeneration: context.contentGeneration,
			courseCatalog: context.courseCatalog,
			documentIngestion: context.documentIngestion,
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		if (context.session.user.role !== "admin") {
			throw new ORPCError("FORBIDDEN");
		}

		return next({ context });
	},
);

export const permissionProcedure = (permission: Permission) =>
	protectedProcedure.use(async ({ context, next }) => {
		const role = context.session.user.role;
		if (!isUserRole(role) || !hasPermission(role, permission)) {
			throw new ORPCError("FORBIDDEN");
		}

		return next({
			context: {
				contentGeneration: context.contentGeneration,
				courseCatalog: context.courseCatalog,
				documentIngestion: context.documentIngestion,
				role,
				session: context.session,
			},
		});
	});
