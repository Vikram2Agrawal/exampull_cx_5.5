import { installPdfNodePolyfills } from "@/lib/materials/pdf-node-polyfills";

export type PdfTextExtraction = {
	text: string;
	pageCount: number;
	pagesRead: number;
};

export async function extractTextFromPdfWithMetadata(
	buffer: Buffer,
	maxChars = 50000,
	maxPages = 40,
): Promise<PdfTextExtraction> {
	await installPdfNodePolyfills();
	const { PDFParse } = await import("pdf-parse");
	const parser = new PDFParse({
		data: new Uint8Array(buffer),
		disableFontFace: true,
		isEvalSupported: false,
	});

	try {
		const result = await parser.getText({ first: maxPages, pageJoiner: "\n" });
		return {
			text: result.text.slice(0, maxChars),
			pageCount: result.total,
			pagesRead: result.pages.length,
		};
	} finally {
		await parser.destroy();
	}
}

export async function extractTextFromPdf(buffer: Buffer, maxChars = 50000) {
	return (await extractTextFromPdfWithMetadata(buffer, maxChars)).text;
}

export function dataUrlFromBuffer(buffer: Buffer, contentType: string) {
	return `data:${contentType};base64,${buffer.toString("base64")}`;
}
