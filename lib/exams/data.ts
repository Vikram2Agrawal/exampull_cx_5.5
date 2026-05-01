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
	className: string;
	topics: string[];
	questionCount: number;
	status: ExamStatus;
	tierAtGen: Tier;
	createdAt: string;
	rating: number | null;
	bookmarked: boolean;
	archived: boolean;
	shareCount: number;
	creditsReserved: number;
	creditsConsumed: number;
	examPdfBase64: string | null;
	answerKeyPdfBase64: string | null;
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

function isoDate(value: unknown) {
	if (value instanceof Timestamp) {
		return value.toDate().toISOString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return new Date().toISOString();
}

export async function listUserExams(userId: string, limit = 24) {
	const snapshot = await adminDb
		.collection("users")
		.doc(userId)
		.collection("exams")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs
		.map((doc) => examFromDoc(doc.id, doc.data()))
		.filter((exam) => !exam.archived);
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
	return {
		id,
		title: typeof data.title === "string" ? data.title : "Untitled practice exam",
		className: typeof data.className === "string" ? data.className : "Manual topics",
		topics: stringList(data.topics),
		questionCount: Number(data.questionCount ?? 0),
		status: isExamStatus(data.status) ? data.status : "queued",
		tierAtGen: isTier(data.tierAtGen) ? data.tierAtGen : "free",
		createdAt: isoDate(data.createdAt),
		rating: typeof data.rating === "number" ? data.rating : null,
		bookmarked: Boolean(data.bookmarked ?? false),
		archived: Boolean(data.archived ?? false),
		shareCount: Number(data.shareCount ?? 0),
		creditsReserved: Number(data.creditsReserved ?? 0),
		creditsConsumed: Number(data.creditsConsumed ?? 0),
		examPdfBase64: typeof data.examPdfBase64 === "string" ? data.examPdfBase64 : null,
		answerKeyPdfBase64:
			typeof data.answerKeyPdfBase64 === "string" ? data.answerKeyPdfBase64 : null,
	};
}
