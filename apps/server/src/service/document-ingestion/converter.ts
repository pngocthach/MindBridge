import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_TIMEOUT_MS = 30_000;
const MAX_WORKER_OUTPUT_BYTES = 12 * 1024 * 1024;
const defaultWorkerDirectory = fileURLToPath(
	new URL("../../../../ingestion-worker/", import.meta.url),
);

export type DocumentConversionErrorCode =
	| "CONVERSION_FAILED"
	| "EMPTY_DOCUMENT"
	| "INVALID_REQUEST"
	| "UNREADABLE_DOCUMENT"
	| "UNSUPPORTED_FORMAT";

export interface ConvertDocumentInput {
	content: Uint8Array;
	fileName: string;
}

export interface ConvertedDocument {
	markdown: string;
	metadata: {
		detectedMimeType: string | null;
	};
}

export interface DocumentConverter {
	convert(input: ConvertDocumentInput): Promise<ConvertedDocument>;
}

interface WorkerFailure {
	error: {
		code: DocumentConversionErrorCode;
		message: string;
	};
	ok: false;
}

interface WorkerSuccess {
	markdown: string;
	metadata: {
		detectedMimeType: string | null;
	};
	ok: true;
}

type WorkerResult = WorkerFailure | WorkerSuccess;

export class DocumentConversionError extends Error {
	constructor(
		public readonly code: DocumentConversionErrorCode,
		message: string,
	) {
		super(message);
		this.name = "DocumentConversionError";
	}
}

export class LocalPythonDocumentConverter implements DocumentConverter {
	constructor(
		private readonly workerDirectory: string = defaultWorkerDirectory,
	) {}

	async convert({
		content,
		fileName,
	}: ConvertDocumentInput): Promise<ConvertedDocument> {
		const temporaryDirectory = await mkdtemp(
			join(tmpdir(), "mindbridge-upload-"),
		);
		const extension = extname(fileName).toLowerCase();
		const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : "";
		const temporaryFile = join(temporaryDirectory, `document${safeExtension}`);

		try {
			await writeFile(temporaryFile, content);
			const output = await runWorker(this.workerDirectory, temporaryFile);
			const result = parseWorkerResult(output);

			if (!result.ok) {
				throw new DocumentConversionError(
					result.error.code,
					result.error.message,
				);
			}

			return {
				markdown: result.markdown,
				metadata: result.metadata,
			};
		} finally {
			await rm(temporaryDirectory, { force: true, recursive: true });
		}
	}
}

const runWorker = async (
	workerDirectory: string,
	filePath: string,
): Promise<string> => {
	const childProcess = spawn(
		"uv",
		["run", "--project", workerDirectory, "python", "convert.py", filePath],
		{
			cwd: workerDirectory,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: WORKER_TIMEOUT_MS,
			windowsHide: true,
		},
	);
	const outputChunks: Buffer[] = [];
	let outputLength = 0;
	let exceededOutputLimit = false;

	childProcess.stdout?.on("data", (chunk: Buffer) => {
		outputLength += chunk.length;
		if (outputLength > MAX_WORKER_OUTPUT_BYTES) {
			exceededOutputLimit = true;
			childProcess.kill();
			return;
		}
		outputChunks.push(chunk);
	});
	childProcess.stderr?.resume();

	try {
		await once(childProcess, "close");
	} catch {
		throw new DocumentConversionError(
			"CONVERSION_FAILED",
			"Document conversion could not be started.",
		);
	}

	if (exceededOutputLimit) {
		throw new DocumentConversionError(
			"CONVERSION_FAILED",
			"The converted document is too large.",
		);
	}

	const output = Buffer.concat(outputChunks).toString("utf8");
	if (!output) {
		throw new DocumentConversionError(
			"CONVERSION_FAILED",
			"The converter returned no result.",
		);
	}

	return output;
};

const parseWorkerResult = (output: string): WorkerResult => {
	try {
		const result: unknown = JSON.parse(output);
		if (!isWorkerResult(result)) {
			throw new Error("Invalid worker response.");
		}
		return result;
	} catch {
		throw new DocumentConversionError(
			"CONVERSION_FAILED",
			"The converter returned an invalid result.",
		);
	}
};

const isWorkerResult = (value: unknown): value is WorkerResult => {
	if (!value || typeof value !== "object" || !("ok" in value)) {
		return false;
	}

	if (value.ok === true) {
		return (
			"markdown" in value &&
			typeof value.markdown === "string" &&
			"metadata" in value &&
			typeof value.metadata === "object" &&
			value.metadata !== null &&
			"detectedMimeType" in value.metadata &&
			(value.metadata.detectedMimeType === null ||
				typeof value.metadata.detectedMimeType === "string")
		);
	}

	return (
		value.ok === false &&
		"error" in value &&
		typeof value.error === "object" &&
		value.error !== null &&
		"code" in value.error &&
		typeof value.error.code === "string" &&
		"message" in value.error &&
		typeof value.error.message === "string"
	);
};
