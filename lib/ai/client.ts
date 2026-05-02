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

export type LlmContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

export type LlmMessage = {
	role: "system" | "user" | "assistant";
	content: string | LlmContentPart[];
};

export type LlmResult = {
	content: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
};

export function canUseDeterministicAiFallback({
	nodeEnv,
	mockEnabled,
}: {
	nodeEnv: string | undefined;
	mockEnabled: boolean;
}) {
	return mockEnabled || nodeEnv !== "production";
}

function contentText(content: LlmMessage["content"]) {
	if (typeof content === "string") {
		return content;
	}

	return content.map((part) => (part.type === "text" ? part.text : "[image]")).join("\n");
}

function mockQuestionJson(messages: LlmMessage[]) {
	const text = messages.map((message) => contentText(message.content)).join("\n");
	const count = Math.max(
		1,
		Math.min(100, Number(text.match(/Generate exactly (\d+) questions/i)?.[1] ?? 3)),
	);

	return JSON.stringify(
		Array.from({ length: count }, (_, index) => ({
			prompt: `Mock exam question ${index + 1}: Explain a core idea from the supplied course materials and show the reasoning needed for partial credit.`,
			answer: `A complete answer for question ${index + 1} identifies the relevant concept, states the governing relationship, and justifies each step clearly.`,
			points: 10,
		})),
	);
}

function mockContent(stage: PipelineStage, messages: LlmMessage[]) {
	const text = messages.map((message) => contentText(message.content)).join("\n");

	if (stage === "questionGeneration") {
		return mockQuestionJson(messages);
	}

	if (stage === "topicExtraction") {
		const focus = text.match(/^Focus:\s*(.+)$/im)?.[1]?.trim();
		if (focus && focus.toLowerCase() !== "none") {
			return `${focus}\n${focus} worked examples\n${focus} application problems\nCommon misconceptions\nExam synthesis`;
		}

		return "Core concepts\nWorked examples\nApplication problems\nCommon misconceptions\nExam synthesis";
	}

	if (stage === "styleGuide") {
		return "Use concise prompts, visible point values, formal wording, and clear answer-space expectations.";
	}

	return "Balanced exam blueprint with representative coverage, escalating difficulty, and clear point allocation.";
}

export async function callLlm({
	stage,
	tier,
	messages,
}: {
	stage: PipelineStage;
	tier: Tier;
	messages: LlmMessage[];
}): Promise<LlmResult> {
	if (process.env.AI_GATEWAY_MOCK === "true") {
		return {
			content: mockContent(stage, messages),
			model: `mock/${modelForStage(stage, tier)}`,
			inputTokens: 0,
			outputTokens: 0,
			latencyMs: 0,
		};
	}

	if (!env.OPENROUTER_API_KEY) {
		if (
			!canUseDeterministicAiFallback({
				nodeEnv: process.env.NODE_ENV,
				mockEnabled: false,
			})
		) {
			throw new Error("OPENROUTER_API_KEY is required in production.");
		}

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
