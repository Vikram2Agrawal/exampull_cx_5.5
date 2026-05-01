import { describe, expect, it } from "vitest";
import { computeExamCost, computeGenerationCredits } from "@/lib/billing/credits";

describe("credit math", () => {
	it("charges two credits per generated question", () => {
		expect(computeGenerationCredits(15)).toBe(30);
	});

	it("enforces tier question limits", () => {
		expect(() =>
			computeExamCost({
				tier: "free",
				questionCount: 13,
				topics: ["Entropy"],
				mode: "standard",
			}),
		).toThrow("supports at most 12");
	});
});
