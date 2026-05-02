import { PDFParse } from "pdf-parse";

export async function renderPdfPageDataUrls(buffer: Buffer, maxPages = 3) {
	const parser = new PDFParse({
		data: new Uint8Array(buffer),
		disableFontFace: true,
		isEvalSupported: false,
	});

	try {
		const screenshots = await parser.getScreenshot({
			first: maxPages,
			imageBuffer: false,
			imageDataUrl: true,
			scale: 1.5,
		});

		return screenshots.pages
			.map((page) => page.dataUrl)
			.filter((dataUrl) => dataUrl.startsWith("data:image/"));
	} finally {
		await parser.destroy();
	}
}
