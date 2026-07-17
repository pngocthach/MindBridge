import type {
	DocumentIngestionPort,
	IngestDocumentInput,
	IngestDocumentResult,
} from "@MindBridge/api";
import { db, sourceChunk, sourceDocument } from "@MindBridge/db";
import {
	type ConvertedDocument,
	DocumentConversionError,
	type DocumentConverter,
	LocalPythonDocumentConverter,
} from "./converter";
import { splitSourceText } from "./source-chunks";

export class DocumentIngestionService implements DocumentIngestionPort {
	constructor(
		private readonly converter: DocumentConverter = new LocalPythonDocumentConverter(),
	) {}

	async ingest({
		content,
		fileName,
		mimeType,
		uploadedBy,
	}: IngestDocumentInput): Promise<IngestDocumentResult> {
		let convertedDocument: ConvertedDocument;
		try {
			convertedDocument = await this.converter.convert({ content, fileName });
		} catch (error) {
			if (error instanceof DocumentConversionError) {
				return { message: error.message, type: "conversion_error" };
			}
			throw error;
		}
		if (!convertedDocument.markdown.trim()) {
			return {
				message: "No readable text was found in this document.",
				type: "conversion_error",
			};
		}

		const chunks = splitSourceText(convertedDocument.markdown);
		const document = await db.transaction(async (transaction) => {
			const [source] = await transaction
				.insert(sourceDocument)
				.values({
					extractionStatus: "completed",
					fileName,
					mimeType: convertedDocument.metadata.detectedMimeType ?? mimeType,
					rawText: convertedDocument.markdown,
					sourceType: "upload",
					uploadedBy,
				})
				.returning({ id: sourceDocument.id });

			if (!source) {
				throw new Error("Source document insert did not return an ID.");
			}

			await transaction.insert(sourceChunk).values(
				chunks.map((chunk) => ({
					...chunk,
					documentId: source.id,
				})),
			);

			return source;
		});

		return {
			chunkCount: chunks.length,
			documentId: document.id,
			preview: convertedDocument.markdown.slice(0, 500),
			type: "success",
		};
	}
}
