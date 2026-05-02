import { adminStorage } from "@/lib/firebase/admin";
import { dataUrlFromBuffer, extractTextFromPdfWithMetadata } from "@/lib/materials/extract-text";
import { renderPdfPageDataUrls } from "@/lib/materials/pdf-raster";

export {
	type ParsedTopicExtraction,
	parseTopicExtractionResponse,
	parseTopicLines,
} from "@/lib/materials/topic-parser";

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
