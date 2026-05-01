import { describe, expect, it } from "vitest";
import { parseTopicLines } from "@/lib/materials/source-reader";

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
});
