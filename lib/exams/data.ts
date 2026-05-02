import { adminDb, Timestamp } from "@/lib/firebase/admin";
import {
	EXAM_STATUSES,
	type ExamStatus,
	TIER_MONTHLY_CREDITS,
	type Tier,
} from "@/lib/product/constants";

export type ExamSummary = {
	id: string;
	title: string;
	classId: string | null;
	className: string;
	topics: string[];
	questionCount: number;
	status: ExamStatus;
	tierAtGen: Tier;
	mode: "standard" | "power";
	questionStyles: string[];
	difficulties: string[];
	boostedScholar: boolean;
	answerKeyUnlocked: boolean;
	boostGradingIncluded: boolean;
	createdAt: string;
	rating: number | null;
	bookmarked: boolean;
	archived: boolean;
	shareCount: number;
	creditsReserved: number;
	creditsConsumed: number;
	examPdfReady: boolean;
	answerKeyPdfReady: boolean;
	examPdfBase64: string | null;
	answerKeyPdfBase64: string | null;
	adHocSources: {
		id: string;
		filename: string;
		focus: string | null;
		extractedTopics: string[];
		extractedContextExcerpt: string | null;
	}[];
};

function isExamStatus(value: unknown): value is ExamStatus {
	return typeof value === "string" && EXAM_STATUSES.includes(value as ExamStatus);
}

function isTier(value: unknown): value is Tier {
	return value === "free" || value === "scholar" || value === "guru";
}

function stringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueSlotValues(data: FirebaseFirestore.DocumentData, field: "style" | "difficulty") {
	const config = isRecord(data.config) ? data.config : {};
	if (!Array.isArray(config.powerSlots)) {
		return [];
	}

	return Array.from(
		new Set(
			config.powerSlots
				.filter(isRecord)
				.map((slot) => slot[field])
				.filter((value): value is string => typeof value === "string"),
		),
	);
}

function adHocSources(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(isRecord).flatMap((source) => {
		const id = typeof source.id === "string" ? source.id : "";
		const filename = typeof source.filename === "string" ? source.filename : "Source upload";

		if (!id) {
			return [];
		}

		return [
			{
				id,
				filename,
				focus: typeof source.focus === "string" && source.focus ? source.focus : null,
				extractedTopics: stringList(source.extractedTopics),
				extractedContextExcerpt:
					typeof source.extractedContextExcerpt === "string" &&
					source.extractedContextExcerpt
						? source.extractedContextExcerpt
						: null,
			},
		];
	});
}

function isoDate(value: unknown) {
	if (value instanceof Timestamp) {
		return value.toDate().toISOString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return new Date().toISOString();
}

export async function listUserExams(
	userId: string,
	options: number | { limit?: number; includeArchived?: boolean } = {},
) {
	const limit = typeof options === "number" ? options : (options.limit ?? 24);
	const includeArchived = typeof options === "number" ? false : options.includeArchived === true;
	const snapshot = await adminDb
		.collection("users")
		.doc(userId)
		.collection("exams")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs
		.map((doc) => examFromDoc(doc.id, doc.data()))
		.filter((exam) => includeArchived || !exam.archived);
}

export async function getUserExam(userId: string, examId: string) {
	const snapshot = await adminDb
		.collection("users")
		.doc(userId)
		.collection("exams")
		.doc(examId)
		.get();

	if (!snapshot.exists) {
		return null;
	}

	return examFromDoc(snapshot.id, snapshot.data() ?? {});
}

export function emptyUserCredits() {
	return {
		tier: "free" as Tier,
		credits: TIER_MONTHLY_CREDITS.free,
		reservedCredits: 0,
	};
}

function examFromDoc(id: string, data: FirebaseFirestore.DocumentData): ExamSummary {
	const config = isRecord(data.config) ? data.config : {};
	const examPdfReady =
		typeof data.examPdfBase64 === "string" || typeof data.examPdfStoragePath === "string";
	const answerKeyPdfReady =
		typeof data.answerKeyPdfBase64 === "string" ||
		typeof data.answerKeyPdfStoragePath === "string";

	return {
		id,
		title: typeof data.title === "string" ? data.title : "Untitled practice exam",
		classId: typeof data.classId === "string" ? data.classId : null,
		className: typeof data.className === "string" ? data.className : "Manual topics",
		topics: stringList(data.topics),
		questionCount: Number(data.questionCount ?? 0),
		status: isExamStatus(data.status) ? data.status : "queued",
		tierAtGen: isTier(data.tierAtGen) ? data.tierAtGen : "free",
		mode: config.mode === "power" ? "power" : "standard",
		questionStyles: uniqueSlotValues(data, "style"),
		difficulties: uniqueSlotValues(data, "difficulty"),
		boostedScholar: Boolean(data.boostedScholar ?? false),
		answerKeyUnlocked: Boolean(data.answerKeyUnlocked ?? false),
		boostGradingIncluded: Boolean(data.boostGradingIncluded ?? false),
		createdAt: isoDate(data.createdAt),
		rating: typeof data.rating === "number" ? data.rating : null,
		bookmarked: Boolean(data.bookmarked ?? false),
		archived: Boolean(data.archived ?? false),
		shareCount: Number(data.shareCount ?? 0),
		creditsReserved: Number(data.creditsReserved ?? 0),
		creditsConsumed: Number(data.creditsConsumed ?? 0),
		examPdfReady,
		answerKeyPdfReady,
		examPdfBase64: typeof data.examPdfBase64 === "string" ? data.examPdfBase64 : null,
		answerKeyPdfBase64:
			typeof data.answerKeyPdfBase64 === "string" ? data.answerKeyPdfBase64 : null,
		adHocSources: adHocSources(data.adHocSources),
	};
}
