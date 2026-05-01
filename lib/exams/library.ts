import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { publicBaseUrl } from "@/lib/env";
import { createExamForUser, createExamRequestSchema } from "@/lib/exams/create";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";

const shareCollection = adminDb.collection("share_links");
const abuseCollection = adminDb.collection("abuseReports");

export const examUpdateSchema = z.object({
	bookmarked: z.boolean().optional(),
	archived: z.boolean().optional(),
	rating: z.number().int().min(1).max(5).nullable().optional(),
	reportReason: z.string().trim().min(8).max(1200).optional(),
});

export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;

export type SharedExam = {
	shareId: string;
	examId: string;
	title: string;
	className: string;
	topics: string[];
	questionCount: number;
	status: string;
	examPdfBase64: string | null;
	createdAt: string;
};

function examRef(userId: string, examId: string) {
	return adminDb.collection("users").doc(userId).collection("exams").doc(examId);
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function updateExamForUser({
	user,
	examId,
	input,
}: {
	user: CurrentUser;
	examId: string;
	input: ExamUpdateInput;
}) {
	const parsed = examUpdateSchema.parse(input);
	const ref = examRef(user.uid, examId);
	const snapshot = await ref.get();

	if (!snapshot.exists) {
		return null;
	}

	const updateData: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
		updatedAt: Timestamp.now(),
	};

	if (parsed.bookmarked !== undefined) updateData.bookmarked = parsed.bookmarked;
	if (parsed.archived !== undefined) updateData.archived = parsed.archived;
	if (parsed.rating !== undefined) updateData.rating = parsed.rating;
	if (parsed.reportReason !== undefined) {
		updateData.status = "reported";
		updateData.reportedAt = Timestamp.now();
		updateData.reportReason = parsed.reportReason;
	}

	await ref.update(updateData);

	if (parsed.reportReason !== undefined) {
		await abuseCollection.add({
			kind: "exam_report",
			userId: user.uid,
			examId,
			reason: parsed.reportReason,
			status: "open",
			isTestData: user.isTestAccount,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		});
	}

	return { examId };
}

export async function cloneExamForUser(user: CurrentUser, examId: string) {
	const snapshot = await examRef(user.uid, examId).get();

	if (!snapshot.exists) {
		return null;
	}

	const data = snapshot.data() ?? {};
	const config = isRecord(data.config) ? data.config : {};
	const mode = config.mode === "power" ? "power" : "standard";
	const sourceNotes =
		typeof data.sourceNotes === "string"
			? data.sourceNotes
			: typeof config.sourceNotes === "string"
				? config.sourceNotes
				: undefined;

	const input = createExamRequestSchema.parse({
		title: typeof data.title === "string" ? `${data.title} copy` : "Cloned practice exam",
		className:
			typeof data.className === "string"
				? data.className
				: typeof config.className === "string"
					? config.className
					: undefined,
		classId:
			typeof data.classId === "string"
				? data.classId
				: typeof config.classId === "string"
					? config.classId
					: undefined,
		topics:
			stringList(data.topics).length > 0
				? stringList(data.topics)
				: stringList(config.topics),
		sourceMaterialIds:
			stringList(data.sourceMaterialIds).length > 0
				? stringList(data.sourceMaterialIds)
				: stringList(config.sourceMaterialIds),
		sourceNotes,
		questionCount: Number(data.questionCount ?? config.questionCount ?? 6),
		mode,
	});

	return createExamForUser({ user, input });
}

export async function createShareForExam(user: CurrentUser, examId: string) {
	const ref = examRef(user.uid, examId);
	const snapshot = await ref.get();

	if (!snapshot.exists) {
		return null;
	}

	const existing = await shareCollection
		.where("ownerUid", "==", user.uid)
		.where("examId", "==", examId)
		.where("revoked", "==", false)
		.limit(1)
		.get();

	const shareId = existing.docs[0]?.id ?? randomUUID();
	const shareRef = shareCollection.doc(shareId);
	const now = Timestamp.now();

	if (existing.empty) {
		await shareRef.create({
			ownerUid: user.uid,
			examId,
			revoked: false,
			createdAt: now,
			updatedAt: now,
			isTestData: user.isTestAccount,
		});
		await ref.set(
			{
				shareCount: FieldValue.increment(1),
				lastSharedAt: now,
				updatedAt: now,
			},
			{ merge: true },
		);
	} else {
		await shareRef.update({ updatedAt: now });
		await ref.set({ lastSharedAt: now, updatedAt: now }, { merge: true });
	}

	return {
		shareId,
		shareUrl: `${publicBaseUrl()}/share/${shareId}`,
	};
}

export async function getSharedExam(shareId: string): Promise<SharedExam | null> {
	const shareSnapshot = await shareCollection.doc(shareId).get();

	if (!shareSnapshot.exists || shareSnapshot.get("revoked") === true) {
		return null;
	}

	const ownerUid = shareSnapshot.get("ownerUid");
	const examId = shareSnapshot.get("examId");

	if (typeof ownerUid !== "string" || typeof examId !== "string") {
		return null;
	}

	const snapshot = await examRef(ownerUid, examId).get();

	if (!snapshot.exists) {
		return null;
	}

	const data = snapshot.data() ?? {};

	return {
		shareId,
		examId,
		title: typeof data.title === "string" ? data.title : "Shared practice exam",
		className: typeof data.className === "string" ? data.className : "Practice exam",
		topics: stringList(data.topics),
		questionCount: Number(data.questionCount ?? 0),
		status: typeof data.status === "string" ? data.status : "queued",
		examPdfBase64: typeof data.examPdfBase64 === "string" ? data.examPdfBase64 : null,
		createdAt: isoDate(data.createdAt),
	};
}

export async function getExamPdfForUser({
	user,
	examId,
	type,
}: {
	user: CurrentUser;
	examId: string;
	type: "exam" | "answer";
}) {
	const snapshot = await examRef(user.uid, examId).get();

	if (!snapshot.exists) {
		return null;
	}

	if (type === "answer" && user.tier === "free") {
		throw new Error("Answer keys are available on Scholar and Guru.");
	}

	const data = snapshot.data() ?? {};
	const pdf =
		type === "answer"
			? typeof data.answerKeyPdfBase64 === "string"
				? data.answerKeyPdfBase64
				: null
			: typeof data.examPdfBase64 === "string"
				? data.examPdfBase64
				: null;

	if (!pdf) {
		return null;
	}

	const title = typeof data.title === "string" ? data.title : "practice-exam";

	return { title, pdfBase64: pdf };
}
