import { describe, expect, it } from "vitest";
import { parseTopicLines, sourceDocumentContentParts } from "@/lib/materials/source-reader";

describe("source reader topic parser", () => {
	it("deduplicates structured LLM topic lines", () => {
		expect(
			parseTopicLines(
				"- Thermodynamics\n- Kinetic theory\n- Thermodynamics\n4. Heat engines",
				"physics notes",
			),
		).toEqual(["Thermodynamics", "Kinetic theory", "Heat engines"]);
	});

	it("falls back to filename and focus when extraction returns no topic lines", () => {
		expect(parseTopicLines("", "midterm-review unit-four")).toEqual([
			"midterm",
			"review",
			"unit",
			"four",
		]);
	});

	it("builds multimodal content parts for rendered scanned PDF pages", () => {
		expect(
			sourceDocumentContentParts({
				text: "Read the attached rendered pages.",
				fallback: "scanned notes",
				imageDataUrls: ["data:image/png;base64,page1", "data:image/png;base64,page2"],
			}),
		).toEqual([
			{ type: "text", text: "Read the attached rendered pages." },
			{ type: "image_url", image_url: { url: "data:image/png;base64,page1" } },
			{ type: "image_url", image_url: { url: "data:image/png;base64,page2" } },
		]);
	});
});
