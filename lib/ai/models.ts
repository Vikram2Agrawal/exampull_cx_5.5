import type { Tier } from "@/lib/product/constants";

export type PipelineStage =
	| "uploadValidation"
	| "tocReading"
	| "topicExtraction"
	| "testPlan"
	| "questionGeneration"
	| "latexAssembly"
	| "visualQaCheck"
	| "visualQaFix"
	| "answerSpace"
	| "gradingSanity"
	| "grading"
	| "visualAnnotation"
	| "distributionGuidanceCheck"
	| "styleGuide"
	| "titleGeneration";

const fastModel = "google/gemini-3-flash-preview";
const proModel = "google/gemini-3.1-pro-preview";

type StageRoute = {
	default: string;
	byTier?: Partial<Record<Tier, string>>;
};

export const MODEL_ROUTING: Record<PipelineStage, StageRoute> = {
	uploadValidation: { default: fastModel },
	tocReading: { default: fastModel },
	topicExtraction: { default: fastModel },
	testPlan: { default: fastModel, byTier: { scholar: proModel, guru: proModel } },
	questionGeneration: { default: fastModel, byTier: { scholar: proModel, guru: proModel } },
	latexAssembly: { default: fastModel, byTier: { scholar: proModel, guru: proModel } },
	visualQaCheck: { default: fastModel },
	visualQaFix: { default: fastModel, byTier: { scholar: proModel, guru: proModel } },
	answerSpace: { default: fastModel },
	gradingSanity: { default: fastModel },
	grading: { default: proModel },
	visualAnnotation: { default: "openai/gpt-5.4-image-2" },
	distributionGuidanceCheck: { default: fastModel },
	styleGuide: { default: fastModel },
	titleGeneration: { default: fastModel },
};

export function modelForStage(stage: PipelineStage, tier: Tier) {
	return MODEL_ROUTING[stage].byTier?.[tier] ?? MODEL_ROUTING[stage].default;
}
