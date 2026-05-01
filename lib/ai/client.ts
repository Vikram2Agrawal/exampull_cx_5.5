import { z } from "zod";
import { env } from "@/lib/env";
import type { Tier } from "@/lib/product/constants";
import { modelForStage, type PipelineStage } from "./models";

const responseSchema = z.object({
	choices: z.array(
		z.object({
			message: z.object({
				content: z.string().nullable(),
			}),
		}),
	),
	usage: z
		.object({
			prompt_tokens: z.number().optional(),
			completion_tokens: z.number().optional(),
		})
		.optional(),
});

export type LlmMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type LlmResult = {
	content: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
};

export async function callLlm({
	stage,
	tier,
	messages,
}: {
	stage: PipelineStage;
	tier: Tier;
	messages: LlmMessage[];
}): Promise<LlmResult> {
	if (!env.OPENROUTER_API_KEY) {
		return {
			content: "OpenRouter key missing. Build-phase deterministic fallback response.",
			model: modelForStage(stage, tier),
			inputTokens: 0,
			outputTokens: 0,
			latencyMs: 0,
		};
	}

	const model = modelForStage(stage, tier);
	const startedAt = performance.now();
	const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			"Content-Type": "application/json",
			"HTTP-Referer": env.WEB_URL ?? "http://localhost:3000",
			"X-Title": "ExamPull",
		},
		body: JSON.stringify({
			model,
			messages,
			temperature: 0.4,
		}),
	});

	if (!response.ok) {
		throw new Error(`OpenRouter request failed with ${response.status}`);
	}

	const parsed = responseSchema.parse(await response.json());
	const content = parsed.choices[0]?.message.content ?? "";

	return {
		content,
		model,
		inputTokens: parsed.usage?.prompt_tokens ?? 0,
		outputTokens: parsed.usage?.completion_tokens ?? 0,
		latencyMs: Math.round(performance.now() - startedAt),
	};
}
