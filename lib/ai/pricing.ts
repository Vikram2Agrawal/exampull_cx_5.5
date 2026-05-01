export const MODEL_PRICING = {
	"google/gemini-3-flash-preview": {
		inputPerMillion: 0.5,
		outputPerMillion: 3,
	},
	"google/gemini-3.1-pro-preview": {
		inputPerMillion: 1.25,
		outputPerMillion: 5,
	},
	"openai/gpt-5.4-image-2": {
		inputPerMillion: 8,
		outputPerMillion: 0,
	},
} as const;

export function estimateTokenCostUsd({
	model,
	inputTokens,
	outputTokens,
}: {
	model: keyof typeof MODEL_PRICING;
	inputTokens: number;
	outputTokens: number;
}) {
	const pricing = MODEL_PRICING[model];

	return (
		(inputTokens / 1_000_000) * pricing.inputPerMillion +
		(outputTokens / 1_000_000) * pricing.outputPerMillion
	);
}
