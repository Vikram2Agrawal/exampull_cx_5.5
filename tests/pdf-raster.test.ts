import { describe, expect, it } from "vitest";
import { renderPdfPageDataUrls } from "@/lib/materials/pdf-raster";

const blankPdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Root 1 0 R /Size 4 >>
startxref
186
%%EOF`);

describe("PDF rasterization", () => {
	it("renders PDF pages to image data URLs for scanned-document fallback", async () => {
		const pages = await renderPdfPageDataUrls(blankPdf, 1);

		expect(pages).toHaveLength(1);
		expect(pages[0]).toMatch(/^data:image\/png;base64,/);
		expect(pages[0].length).toBeGreaterThan(100);
	});
});
