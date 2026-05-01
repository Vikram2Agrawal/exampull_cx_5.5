import { describe, expect, it } from "vitest";
import { buildExamLatex } from "@/lib/exams/latex";

describe("exam LaTeX builder", () => {
	it("renders Power Mode slots with requested points and styles", () => {
		const latex = buildExamLatex({
			title: "Power Test",
			topics: ["Derivatives"],
			questionCount: 2,
			answerKey: false,
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
		});

		expect(latex).toContain("\\question[8]");
		expect(latex).toContain("Calculation");
		expect(latex).toContain("Product rule");
		expect(latex).toContain("\\question[12]");
		expect(latex).toContain("Proof");
		expect(latex).toContain("Mean Value Theorem");
	});
});
