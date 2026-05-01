import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(buffer: Buffer, maxChars = 50000) {
	const parser = new PDFParse({
		data: new Uint8Array(buffer),
		disableFontFace: true,
		isEvalSupported: false,
	});

	try {
		const result = await parser.getText({ first: 40, pageJoiner: "\n" });
		return result.text.slice(0, maxChars);
	} finally {
		await parser.destroy();
	}
}

export function dataUrlFromBuffer(buffer: Buffer, contentType: string) {
	return `data:${contentType};base64,${buffer.toString("base64")}`;
}
