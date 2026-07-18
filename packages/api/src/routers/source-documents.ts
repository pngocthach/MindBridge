import { db, sourceChunk, sourceDocument } from "@MindBridge/db";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const documentUploadInput = z.object({
	file: z.instanceof(File),
});

const pastedTextInput = z.object({
	text: z.string().trim().min(1).max(200_000),
});

const documentInput = z.object({
	documentId: z.string().uuid(),
});

const updateDocumentInput = documentInput.extend({
	name: z.string().trim().min(1).max(255),
});

const documentFields = {
	createdAt: sourceDocument.createdAt,
	extractionError: sourceDocument.extractionError,
	extractionStatus: sourceDocument.extractionStatus,
	fileName: sourceDocument.fileName,
	id: sourceDocument.id,
	mimeType: sourceDocument.mimeType,
	sourceType: sourceDocument.sourceType,
	updatedAt: sourceDocument.updatedAt,
	uploadedBy: sourceDocument.uploadedBy,
};

const sourceLibraryProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const role = context.session.user.role;
		if (role !== "admin" && role !== "teacher") {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Only administrators and teachers can manage source documents.",
			});
		}

		return next({
			context: {
				...context,
				isSourceAdministrator: role === "admin",
			},
		});
	},
);

const sourceAccessCondition = (
	documentId: string,
	userId: string,
	isSourceAdministrator: boolean,
) =>
	and(
		eq(sourceDocument.id, documentId),
		isSourceAdministrator ? undefined : eq(sourceDocument.uploadedBy, userId),
	);

export const sourceDocumentRouter = {
	delete: sourceLibraryProcedure
		.input(documentInput)
		.handler(async ({ context, input }) => {
			const [deletedDocument] = await db
				.delete(sourceDocument)
				.where(
					sourceAccessCondition(
						input.documentId,
						context.session.user.id,
						context.isSourceAdministrator,
					),
				)
				.returning({ id: sourceDocument.id });

			if (!deletedDocument) {
				throw new ORPCError("NOT_FOUND", {
					message: "Source document not found.",
				});
			}

			return deletedDocument;
		}),
	detail: sourceLibraryProcedure
		.input(documentInput)
		.handler(async ({ context, input }) => {
			const [document] = await db
				.select(documentFields)
				.from(sourceDocument)
				.where(
					sourceAccessCondition(
						input.documentId,
						context.session.user.id,
						context.isSourceAdministrator,
					),
				)
				.limit(1);

			if (!document) {
				throw new ORPCError("NOT_FOUND", {
					message: "Source document not found.",
				});
			}

			const chunks = await db
				.select({
					charEnd: sourceChunk.charEnd,
					charStart: sourceChunk.charStart,
					id: sourceChunk.id,
					ordinal: sourceChunk.ordinal,
					pageFrom: sourceChunk.pageFrom,
					pageTo: sourceChunk.pageTo,
					text: sourceChunk.text,
				})
				.from(sourceChunk)
				.where(eq(sourceChunk.documentId, document.id))
				.orderBy(asc(sourceChunk.ordinal));

			return { ...document, chunks };
		}),
	list: sourceLibraryProcedure.handler(({ context }) =>
		db
			.select({
				...documentFields,
				chunkCount: sql<number>`(
					select count(*)::int
					from ${sourceChunk}
					where ${sourceChunk.documentId} = ${sourceDocument.id}
				)`,
				preview: sql<string>`coalesce(left(${sourceDocument.rawText}, 240), '')`,
			})
			.from(sourceDocument)
			.where(
				context.isSourceAdministrator
					? undefined
					: eq(sourceDocument.uploadedBy, context.session.user.id),
			)
			.orderBy(desc(sourceDocument.updatedAt)),
	),
	paste: sourceLibraryProcedure
		.input(pastedTextInput)
		.handler(({ context, input }) =>
			context.documentIngestion.ingestText({
				text: input.text,
				uploadedBy: context.session.user.id,
			}),
		),
	update: sourceLibraryProcedure
		.input(updateDocumentInput)
		.handler(async ({ context, input }) => {
			const [updatedDocument] = await db
				.update(sourceDocument)
				.set({ fileName: input.name })
				.where(
					sourceAccessCondition(
						input.documentId,
						context.session.user.id,
						context.isSourceAdministrator,
					),
				)
				.returning(documentFields);

			if (!updatedDocument) {
				throw new ORPCError("NOT_FOUND", {
					message: "Source document not found.",
				});
			}

			return updatedDocument;
		}),
	upload: sourceLibraryProcedure
		.input(documentUploadInput)
		.handler(async ({ context, input }) => {
			if (input.file.size === 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "The uploaded file is empty.",
				});
			}
			if (input.file.size > MAX_DOCUMENT_BYTES) {
				throw new ORPCError("PAYLOAD_TOO_LARGE", {
					message: "The uploaded file must be 50 MB or smaller.",
				});
			}

			const result = await context.documentIngestion.ingest({
				content: new Uint8Array(await input.file.arrayBuffer()),
				fileName: input.file.name,
				mimeType: input.file.type,
				uploadedBy: context.session.user.id,
			});

			if (result.type === "conversion_error") {
				throw new ORPCError("BAD_REQUEST", { message: result.message });
			}

			return result;
		}),
};
