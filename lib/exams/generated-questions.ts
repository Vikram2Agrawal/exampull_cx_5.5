import { z } from "zod";

export type GeneratedExamQuestion = {
	prompt: string;
	answer: string;
	points: number;
};

const generatedQuestionSchema = z.object({
	prompt: z.string().trim().min(10).max(1500),
	answer: z.string().trim().min(10).max(2500),
	points: z.coerce.number().int().min(1).max(100),
});

function extractJson(value: string) {
	const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
	if (fenced) {
		return fenced;
	}

	const objectStart = value.indexOf("{");
	const objectEnd = value.lastIndexOf("}");
	const arrayStart = value.indexOf("[");
	const arrayEnd = value.lastIndexOf("]");

	if (objectStart >= 0 && objectEnd > objectStart) {
		return value.slice(objectStart, objectEnd + 1);
	}

	if (arrayStart >= 0 && arrayEnd > arrayStart) {
		return value.slice(arrayStart, arrayEnd + 1);
	}

	return value;
}

function questionListFromJson(decoded: unknown) {
	if (Array.isArray(decoded)) {
		return decoded;
	}

	if (
		decoded &&
		typeof decoded === "object" &&
		"questions" in decoded &&
		Array.isArray(decoded.questions)
	) {
		return decoded.questions;
	}

	return [];
}

export function parseGeneratedQuestions(value: string, expectedCount: number) {
	let decoded: unknown;
	try {
		decoded = JSON.parse(extractJson(value));
	} catch {
		return [];
	}

	const parsed = z.array(generatedQuestionSchema).safeParse(questionListFromJson(decoded));

	if (!parsed.success) {
		return [];
	}

	return parsed.data.slice(0, expectedCount);
}

export function hasCompleteGeneratedQuestionSet(
	questions: GeneratedExamQuestion[],
	expectedCount: number,
) {
	return questions.length === expectedCount;
}
