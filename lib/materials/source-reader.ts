import { adminStorage } from "@/lib/firebase/admin";
import { dataUrlFromBuffer, extractTextFromPdfWithMetadata } from "@/lib/materials/extract-text";

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
	pageCount?: number;
	pagesRead?: number;
};

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

export async function readSourceDocumentContent({
	filename,
	focus,
	contentType,
	storagePath,
}: SourceDocumentDescriptor): Promise<ReadSourceDocumentResult> {
	let text = `Filename: ${filename}\nFocus: ${focus || "none"}`;
	let imageDataUrl: string | undefined;
	const fallback = `${filename} ${focus}`.trim();

	if (!storagePath) {
		return { text, fallback, imageDataUrl };
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
		text = `${text}\n\nPDF pages read: ${extracted.pagesRead} of ${extracted.pageCount}\n\n${extracted.text}`;
		return {
			text,
			fallback,
			imageDataUrl,
			pageCount: extracted.pageCount,
			pagesRead: extracted.pagesRead,
		};
	}

	if (contentType.startsWith("image/")) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		if (buffer.length <= 8 * 1024 * 1024) {
			imageDataUrl = dataUrlFromBuffer(buffer, contentType);
			text = `${text}\n\nUse the attached image to extract visible lecture, notes, diagram labels, formulas, and exam topics.`;
		}
	}

	return { text, fallback, imageDataUrl };
}
