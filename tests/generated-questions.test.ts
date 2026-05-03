import { describe, expect, it } from "vitest";
import { parseGeneratedQuestions } from "@/lib/exams/generated-questions";

describe("generated question parsing", () => {
	it("accepts the strict object shape requested from the model", () => {
		const questions = parseGeneratedQuestions(
			JSON.stringify({
				questions: [
					{
						prompt: "Explain how diffusion changes across a semipermeable membrane.",
						answer: "A complete answer cites gradients, membrane permeability, and molecular size.",
						points: "10",
					},
				],
			}),
			1,
		);

		expect(questions).toEqual([
			{
				prompt: "Explain how diffusion changes across a semipermeable membrane.",
				answer: "A complete answer cites gradients, membrane permeability, and molecular size.",
				points: 10,
			},
		]);
	});

	it("extracts fenced arrays for older model responses", () => {
		const questions = parseGeneratedQuestions(
			'```json\n[{"prompt":"Compare osmosis in freshwater and saltwater cells.","answer":"The answer should contrast water potential and net movement.","points":10}]\n```',
			1,
		);

		expect(questions).toHaveLength(1);
		expect(questions[0]?.prompt).toContain("osmosis");
	});

	it("rejects prose that would otherwise trigger a silent generic fallback", () => {
		expect(parseGeneratedQuestions("Here are some practice questions.", 12)).toEqual([]);
	});
});
