import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const documentUploadInput = z.object({
	file: z.instanceof(File),
});

export const sourceDocumentRouter = {
	upload: protectedProcedure
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
