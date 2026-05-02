import { describe, expect, it } from "vitest";
import { anonymousPreviewStoragePaths } from "@/lib/preview/purge";

describe("anonymous preview purge helpers", () => {
	it("collects unique storage paths from preview artifact fields", () => {
		expect(
			anonymousPreviewStoragePaths({
				examPdfStoragePath: "anonymous-previews/one/exam.pdf",
				examRenderedPageStoragePaths: [
					"anonymous-previews/one/pages/1.png",
					"anonymous-previews/one/pages/1.png",
					"",
					null,
				],
				materialStoragePaths: [
					"anonymous-previews/one/materials/source.pdf",
					42,
					"anonymous-previews/one/exam.pdf",
				],
			}),
		).toEqual([
			"anonymous-previews/one/exam.pdf",
			"anonymous-previews/one/pages/1.png",
			"anonymous-previews/one/materials/source.pdf",
		]);
	});
});
