export const CREDIT_COSTS = {
	GENERATE_QUESTION: 2,
	GRADE_QUESTION: 1,
	ANNOTATE_QUESTION: 4,
	STYLE_GUIDE_UPLOAD: 2,
} as const;

export const TIER_MONTHLY_CREDITS = {
	free: 40,
	scholar: 400,
	guru: 4000,
} as const;

export const TIER_MAX_QUESTIONS_PER_EXAM = {
	free: 12,
	scholar: 25,
	guru: 100,
} as const;

export const CREDIT_PACK_PRICES = {
	pack20: 100,
	pack100: 400,
	pack240: 800,
} as const;

export const EDUCATION_LEVELS = [
	{ label: "Elementary", value: 5 },
	{ label: "Middle School", value: 15 },
	{ label: "High School", value: 25 },
	{ label: "Honors", value: 35 },
	{ label: "AP / IB", value: 45 },
	{ label: "Undergraduate", value: 60 },
	{ label: "Graduate", value: 80 },
	{ label: "Professional", value: 95 },
] as const;

export const EXAM_STATUSES = [
	"queued",
	"generating",
	"qa_in_progress",
	"complete",
	"failed",
	"partial_qa_fail",
	"reported",
] as const;

export type Tier = keyof typeof TIER_MONTHLY_CREDITS;
export type ExamStatus = (typeof EXAM_STATUSES)[number];
