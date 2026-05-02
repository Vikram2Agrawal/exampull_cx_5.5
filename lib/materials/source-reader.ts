import { adminStorage } from "@/lib/firebase/admin";
import { dataUrlFromBuffer, extractTextFromPdfWithMetadata } from "@/lib/materials/extract-text";
import { renderPdfPageDataUrls } from "@/lib/materials/pdf-raster";

export type SourceDocumentDescriptor = {
	filename: string;
	focus: string;
	contentType: string;
	storagePath: string;
};

export type ReadSourceDocumentResult = {
	text: string;
	fallback: string;
	imageDataUrl?: string;
	imageDataUrls?: string[];
	pageCount?: number;
	pagesRead?: number;
	renderedImagePageCount?: number;
};

export type ParsedTopicExtraction = {
	topics: string[];
	extractedContext: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringItems(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

function extractJsonObject(value: string) {
	const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
	const candidate = fenced ?? value;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");

	if (start < 0 || end <= start) {
		return null;
	}

	try {
		const decoded: unknown = JSON.parse(candidate.slice(start, end + 1));
		return isRecord(decoded) ? decoded : null;
	} catch {
		return null;
	}
}

function normalizedContext(value: string) {
	return value.replace(/\s+/g, " ").trim().slice(0, 12000);
}

export function parseTopicLines(content: string, fallback: string, limit = 12) {
	const candidates = content
		.split(/\n|;/)
		.flatMap((line) => line.split(/,(?=\s*[A-Z0-9])/))
		.map((line) => line.replace(/^\s*[-*\u2022\d.)]+/, "").trim())
		.filter((line) => line.length > 2 && line.length <= 120)
		.slice(0, limit);

	if (candidates.length > 0) {
		return Array.from(new Set(candidates));
	}

	return fallback
		.split(/[-_.,\s]+/)
		.map((piece) => piece.trim())
		.filter((piece) => piece.length > 3)
		.slice(0, Math.min(8, limit));
}

export function parseTopicExtractionResponse(
	content: string,
	fallback: string,
	limit = 12,
): ParsedTopicExtraction {
	const decoded = extractJsonObject(content);

	if (decoded) {
		const topicText = stringItems(decoded.topics).join("\n");
		const extractedContext =
			typeof decoded.extractedContext === "string"
				? decoded.extractedContext
				: typeof decoded.sourceContext === "string"
					? decoded.sourceContext
					: "";

		return {
			topics: parseTopicLines(topicText, fallback, limit),
			extractedContext: normalizedContext(extractedContext),
		};
	}

	return {
		topics: parseTopicLines(content, fallback, limit),
		extractedContext: normalizedContext(content),
	};
}

export function sourceDocumentContentParts(source: ReadSourceDocumentResult) {
	const imageDataUrls = source.imageDataUrls?.length
		? source.imageDataUrls
		: source.imageDataUrl
			? [source.imageDataUrl]
			: [];

	if (imageDataUrls.length === 0) {
		return source.text;
	}

	return [
		{ type: "text" as const, text: source.text },
		...imageDataUrls.map((url) => ({
			type: "image_url" as const,
			image_url: { url },
		})),
	];
}

export async function readSourceDocumentContent({
	filename,
	focus,
	contentType,
	storagePath,
}: SourceDocumentDescriptor): Promise<ReadSourceDocumentResult> {
	let text = `Filename: ${filename}\nFocus: ${focus || "none"}`;
	let imageDataUrl: string | undefined;
	let imageDataUrls: string[] | undefined;
	const fallback = `${filename} ${focus}`.trim();

	if (!storagePath) {
		return { text, fallback, imageDataUrl, imageDataUrls };
	}

	if (
		contentType.startsWith("text/") ||
		contentType.includes("json") ||
		contentType.includes("csv") ||
		contentType.includes("markdown")
	) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		text = `${text}\n\n${buffer.toString("utf8").slice(0, 50000)}`;
	}

	if (contentType === "application/pdf") {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		const extracted = await extractTextFromPdfWithMetadata(buffer);
		const scannedFallback = extracted.text.trim().length < 40;
		if (scannedFallback) {
			imageDataUrls = await renderPdfPageDataUrls(buffer, 3);
			imageDataUrl = imageDataUrls[0];
		}
		text = `${text}\n\nPDF pages read: ${extracted.pagesRead} of ${extracted.pageCount}\n\n${
			scannedFallback
				? "This PDF appears to be scanned or image-only. Use the attached rendered page images to extract visible lecture text, notes, diagram labels, formulas, and exam topics."
				: extracted.text
		}`;
		return {
			text,
			fallback,
			imageDataUrl,
			imageDataUrls,
			pageCount: extracted.pageCount,
			pagesRead: extracted.pagesRead,
			renderedImagePageCount: imageDataUrls?.length ?? 0,
		};
	}

	if (contentType.startsWith("image/")) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		if (buffer.length <= 8 * 1024 * 1024) {
			imageDataUrl = dataUrlFromBuffer(buffer, contentType);
			imageDataUrls = [imageDataUrl];
			text = `${text}\n\nUse the attached image to extract visible lecture, notes, diagram labels, formulas, and exam topics.`;
		}
	}

	return {
		text,
		fallback,
		imageDataUrl,
		imageDataUrls,
		renderedImagePageCount: imageDataUrls?.length ?? 0,
	};
}
