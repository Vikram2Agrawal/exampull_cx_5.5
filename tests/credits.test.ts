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

	it("charges Power Mode by configured question slots", () => {
		expect(
			computeExamCost({
				tier: "scholar",
				questionCount: 25,
				topics: ["Derivatives"],
				mode: "power",
				powerSlots: [
					{
						topic: "Product rule",
						style: "calculation",
						difficulty: "balanced",
						points: 8,
					},
					{
						topic: "Mean Value Theorem",
						style: "proof",
						difficulty: "hardcore",
						points: 12,
					},
				],
			}),
		).toBe(4);
	});
});
