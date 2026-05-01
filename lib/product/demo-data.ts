import type { ExamStatus, Tier } from "./constants";

export type DemoExam = {
	id: string;
	title: string;
	className: string;
	topics: string[];
	questionCount: number;
	status: ExamStatus;
	tierAtGen: Tier;
	createdAt: string;
	rating: number | null;
	bookmarked: boolean;
};

export type DemoClass = {
	id: string;
	name: string;
	institution: string;
	educationLevel: number;
	materialCount: number;
	styleGuideStatus: "none" | "processing" | "ready";
	status: "active" | "archived";
};

export const demoExams: DemoExam[] = [
	{
		id: "real-analysis-midterm",
		title: "Real Analysis Practice Midterm",
		className: "MATH 301",
		topics: ["Compactness", "Uniform continuity", "Sequences"],
		questionCount: 12,
		status: "complete",
		tierAtGen: "scholar",
		createdAt: "2026-05-01",
		rating: 5,
		bookmarked: true,
	},
	{
		id: "organic-chem-review",
		title: "Organic Chemistry Reaction Mechanisms",
		className: "CHEM 242",
		topics: ["SN1", "SN2", "E1", "E2"],
		questionCount: 25,
		status: "qa_in_progress",
		tierAtGen: "guru",
		createdAt: "2026-05-01",
		rating: null,
		bookmarked: false,
	},
	{
		id: "apush-progressive-era",
		title: "AP US History - Progressive Era",
		className: "APUSH",
		topics: ["Muckrakers", "Trust busting", "Suffrage"],
		questionCount: 10,
		status: "complete",
		tierAtGen: "free",
		createdAt: "2026-04-30",
		rating: 4,
		bookmarked: false,
	},
];

export const demoClasses: DemoClass[] = [
	{
		id: "math-301",
		name: "MATH 301 - Real Analysis",
		institution: "University course",
		educationLevel: 60,
		materialCount: 8,
		styleGuideStatus: "ready",
		status: "active",
	},
	{
		id: "chem-242",
		name: "CHEM 242 - Organic Chemistry",
		institution: "Pre-med sequence",
		educationLevel: 60,
		materialCount: 14,
		styleGuideStatus: "processing",
		status: "active",
	},
	{
		id: "apush",
		name: "AP US History",
		institution: "High school",
		educationLevel: 45,
		materialCount: 5,
		styleGuideStatus: "none",
		status: "active",
	},
];

export const pipelineStages = [
	"Reading materials",
	"Drafting test plan",
	"Writing questions",
	"Assembling LaTeX",
	"Checking layout",
	"Finalizing PDFs",
] as const;
