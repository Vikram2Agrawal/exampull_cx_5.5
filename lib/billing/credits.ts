import { z } from "zod";
import { CREDIT_COSTS, TIER_MAX_QUESTIONS_PER_EXAM, type Tier } from "@/lib/product/constants";

export const examConfigSchema = z.object({
	title: z.string().trim().max(120).optional(),
	topics: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
	questionCount: z.number().int().min(1).max(100),
	tier: z.enum(["free", "scholar", "guru"]),
	mode: z.enum(["standard", "power"]).default("standard"),
});

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
	assertTierQuestionLimit(input.tier, input.questionCount);

	return computeGenerationCredits(input.questionCount);
}
