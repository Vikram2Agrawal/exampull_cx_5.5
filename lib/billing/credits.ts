import { z } from "zod";
import { CREDIT_COSTS, TIER_MAX_QUESTIONS_PER_EXAM, type Tier } from "@/lib/product/constants";

export const QUESTION_STYLES = [
	"multiple_choice",
	"short_answer",
	"calculation",
	"essay",
	"proof",
] as const;

export const QUESTION_DIFFICULTIES = ["light", "balanced", "hardcore"] as const;

export const powerQuestionSlotSchema = z.object({
	topic: z.string().trim().min(1).max(160),
	style: z.enum(QUESTION_STYLES),
	difficulty: z.enum(QUESTION_DIFFICULTIES),
	points: z.number().int().min(1).max(100),
});

export type QuestionStyle = (typeof QUESTION_STYLES)[number];
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];
export type PowerQuestionSlot = z.infer<typeof powerQuestionSlotSchema>;

function validatePowerSlots(
	input: { mode?: "standard" | "power"; powerSlots?: PowerQuestionSlot[] },
	context: z.RefinementCtx,
) {
	if (input.mode === "power" && (!input.powerSlots || input.powerSlots.length === 0)) {
		context.addIssue({
			code: "custom",
			path: ["powerSlots"],
			message: "Power Mode requires at least one question slot.",
		});
	}
}

const examConfigBaseSchema = z.object({
	title: z.string().trim().max(120).optional(),
	topics: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
	questionCount: z.number().int().min(1).max(100),
	tier: z.enum(["free", "scholar", "guru"]),
	mode: z.enum(["standard", "power"]).default("standard"),
	powerSlots: z.array(powerQuestionSlotSchema).max(100).optional(),
	mirrorInstructorStyle: z.boolean().optional(),
});

export const examConfigSchema = examConfigBaseSchema.superRefine(validatePowerSlots);

export const createExamConfigSchema = examConfigBaseSchema
	.omit({ tier: true })
	.superRefine(validatePowerSlots);

export type ExamConfigInput = z.infer<typeof examConfigSchema>;

export function computeGenerationCredits(questionCount: number) {
	return questionCount * CREDIT_COSTS.GENERATE_QUESTION;
}

export function assertTierQuestionLimit(tier: Tier, questionCount: number) {
	const limit = TIER_MAX_QUESTIONS_PER_EXAM[tier];

	if (questionCount > limit) {
		throw new Error(`Tier ${tier} supports at most ${limit} questions per exam.`);
	}
}

export function computeExamCost(input: ExamConfigInput) {
	const questionCount =
		input.mode === "power" && input.powerSlots ? input.powerSlots.length : input.questionCount;

	assertTierQuestionLimit(input.tier, questionCount);

	return computeGenerationCredits(questionCount);
}
