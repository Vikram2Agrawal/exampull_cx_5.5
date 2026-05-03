import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";
import { CREDIT_COSTS } from "@/lib/product/constants";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";

const maxUploadBytes = 100 * 1024 * 1024;

export const attemptUploadSchema = z.object({
	filename: z.string().trim().min(1).max(180),
	contentType: z.string().trim().min(1).max(120),
	sizeBytes: z.number().int().min(1).max(maxUploadBytes),
	visualAnnotations: z.boolean().optional(),
});

export type AttemptUploadInput = z.infer<typeof attemptUploadSchema>;

export type AttemptSummary = {
	id: string;
	filename: string;
	status: string;
	score: number | null;
	maxScore: number | null;
	feedback: string | null;
	visualAnnotations: boolean;
	visualAnnotationStatus: string | null;
	visualFeedbackReady: boolean;
	createdAt: string;
	gradedAt: string | null;
};

function isoDate(value: unknown) {
	if (value instanceof Timestamp) {
		return value.toDate().toISOString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return new Date().toISOString();
}

function optionalIsoDate(value: unknown) {
	if (!value) {
		return null;
	}

	return isoDate(value);
}

function safeFilename(filename: string) {
	return (
		filename
			.normalize("NFKD")
			.replace(/[^\w.\- ]+/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.slice(0, 120) || "attempt"
	);
}

function examRef(userId: string, examId: string) {
	return adminDb.collection("users").doc(userId).collection("exams").doc(examId);
}

function attemptFromDoc(id: string, data: FirebaseFirestore.DocumentData): AttemptSummary {
	return {
		id,
		filename: typeof data.filename === "string" ? data.filename : "attempt",
		status: typeof data.status === "string" ? data.status : "uploading",
		score: typeof data.score === "number" ? data.score : null,
		maxScore: typeof data.maxScore === "number" ? data.maxScore : null,
		feedback: typeof data.feedback === "string" ? data.feedback : null,
		visualAnnotations: Boolean(data.visualAnnotations ?? false),
		visualAnnotationStatus:
			typeof data.visualAnnotationStatus === "string" ? data.visualAnnotationStatus : null,
		visualFeedbackReady:
			typeof data.visualFeedbackPdfBase64 === "string" ||
			typeof data.visualFeedbackPdfStoragePath === "string",
		createdAt: isoDate(data.createdAt),
		gradedAt: optionalIsoDate(data.gradedAt),
	};
}

export async function listExamAttempts(userId: string, examId: string) {
	const snapshot = await examRef(userId, examId)
		.collection("attempts")
		.orderBy("createdAt", "desc")
		.get();

	return snapshot.docs.map((doc) => attemptFromDoc(doc.id, doc.data()));
}

export async function createAttemptUpload({
	user,
	examId,
	input,
}: {
	user: CurrentUser;
	examId: string;
	input: AttemptUploadInput;
}) {
	const parsed = attemptUploadSchema.parse(input);
	const examSnapshot = await examRef(user.uid, examId).get();
	if (!examSnapshot.exists) {
		throw new Error("Exam not found.");
	}

	const boostGradingAvailable =
		user.tier === "free" &&
		Boolean(examSnapshot.get("boostGradingIncluded") ?? false) &&
		!user.boostGradingUsedAt;

	if (user.tier === "free" && !boostGradingAvailable) {
		throw new Error("Attempt grading is available on Scholar and Guru.");
	}

	if (parsed.visualAnnotations) {
		throw new Error("Upload and grade first. Visual annotations are requested after grading.");
	}

	const attemptId = randomUUID();
	const filename = safeFilename(parsed.filename);
	const storagePath = `users/${user.uid}/attempts/${attemptId}/${filename}`;
	const now = Timestamp.now();

	await examRef(user.uid, examId).collection("attempts").doc(attemptId).create({
		filename: parsed.filename,
		contentType: parsed.contentType,
		sizeBytes: parsed.sizeBytes,
		storagePath,
		status: "uploading",
		visualAnnotations: false,
		visualAnnotationStatus: null,
		boostGradingCandidate: boostGradingAvailable,
		creditsReserved: 0,
		createdAt: now,
		updatedAt: now,
		uploadedAt: null,
		isTestData: user.isTestAccount,
	});

	const [uploadUrl] = await adminStorage
		.bucket()
		.file(storagePath)
		.getSignedUrl({
			version: "v4",
			action: "write",
			expires: Date.now() + 15 * 60 * 1000,
			contentType: parsed.contentType,
		});

	return { attemptId, uploadUrl };
}

export async function completeAttemptUpload(user: CurrentUser, examId: string, attemptId: string) {
	const userRef = adminDb.collection("users").doc(user.uid);
	const targetExamRef = examRef(user.uid, examId);
	const attemptRef = targetExamRef.collection("attempts").doc(attemptId);
	let creditsReserved = 0;
	let boostGradingUsed = false;

	await adminDb.runTransaction(async (transaction) => {
		const [userSnapshot, examSnapshot, attemptSnapshot] = await Promise.all([
			transaction.get(userRef),
			transaction.get(targetExamRef),
			transaction.get(attemptRef),
		]);

		if (!examSnapshot.exists || !attemptSnapshot.exists) {
			throw new Error("Attempt not found.");
		}

		const questionCount = Number(examSnapshot.get("questionCount") ?? 0);
		boostGradingUsed =
			user.tier === "free" &&
			Boolean(examSnapshot.get("boostGradingIncluded") ?? false) &&
			!userSnapshot.get("boostGradingUsedAt");
		creditsReserved = boostGradingUsed ? 0 : questionCount * CREDIT_COSTS.GRADE_QUESTION;
		const availableCredits = Number(userSnapshot.get("credits") ?? 0);

		if (availableCredits < creditsReserved) {
			throw new Error("Insufficient credits for grading.");
		}

		if (boostGradingUsed) {
			transaction.update(userRef, {
				boostGradingUsedAt: Timestamp.now(),
				boostGradingAttemptId: attemptId,
				updatedAt: Timestamp.now(),
			});
		} else {
			transaction.update(userRef, {
				credits: availableCredits - creditsReserved,
				reservedCredits: Number(userSnapshot.get("reservedCredits") ?? 0) + creditsReserved,
				updatedAt: Timestamp.now(),
			});
		}
		transaction.update(attemptRef, {
			status: "grading_queued",
			visualAnnotationStatus: null,
			creditsReserved,
			boostGradingUsed,
			uploadedAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		});
	});

	const queueResult = await enqueueWorkerTask({
		route: "/api/workers/grade-attempt",
		payload: { userId: user.uid, examId, attemptId },
	});

	if (!queueResult.queued) {
		await attemptRef.set(
			{
				queueWarning: queueResult.reason,
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	}

	return { queued: queueResult.queued, creditsReserved, visualAnnotations: false };
}

export async function requestVisualFeedback({
	user,
	examId,
	attemptId,
}: {
	user: CurrentUser;
	examId: string;
	attemptId: string;
}) {
	if (user.tier !== "guru") {
		throw new Error("Visual annotations require Guru.");
	}

	const userRef = adminDb.collection("users").doc(user.uid);
	const targetExamRef = examRef(user.uid, examId);
	const attemptRef = targetExamRef.collection("attempts").doc(attemptId);
	let creditsReserved = 0;

	await adminDb.runTransaction(async (transaction) => {
		const [userSnapshot, examSnapshot, attemptSnapshot] = await Promise.all([
			transaction.get(userRef),
			transaction.get(targetExamRef),
			transaction.get(attemptRef),
		]);

		if (!examSnapshot.exists || !attemptSnapshot.exists) {
			throw new Error("Attempt not found.");
		}

		if (attemptSnapshot.get("status") !== "graded") {
			throw new Error("Grade the attempt before requesting visual annotations.");
		}

		if (
			typeof attemptSnapshot.get("visualFeedbackPdfBase64") === "string" ||
			typeof attemptSnapshot.get("visualFeedbackPdfStoragePath") === "string"
		) {
			throw new Error("Visual annotations are already ready.");
		}

		const currentStatus = attemptSnapshot.get("visualAnnotationStatus");
		if (currentStatus === "queued" || currentStatus === "annotating") {
			throw new Error("Visual annotations are already in progress.");
		}

		const questionCount = Number(examSnapshot.get("questionCount") ?? 0);
		creditsReserved = questionCount * CREDIT_COSTS.ANNOTATE_QUESTION;
		const availableCredits = Number(userSnapshot.get("credits") ?? 0);

		if (availableCredits < creditsReserved) {
			throw new Error("Insufficient credits for visual annotations.");
		}

		transaction.update(userRef, {
			credits: availableCredits - creditsReserved,
			reservedCredits: Number(userSnapshot.get("reservedCredits") ?? 0) + creditsReserved,
			updatedAt: Timestamp.now(),
		});
		transaction.update(attemptRef, {
			visualAnnotations: true,
			visualAnnotationStatus: "queued",
			creditsReserved,
			updatedAt: Timestamp.now(),
		});
	});

	const input = { userId: user.uid, examId, attemptId };
	const queueResult = await enqueueWorkerTask({
		route: "/api/workers/visual-feedback",
		payload: input,
	});

	if (!queueResult.queued) {
		await attemptRef.set(
			{
				visualAnnotationStatus: "annotating_inline",
				queueWarning: queueResult.reason,
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);

		const { completeVisualFeedback } = await import("@/lib/exams/visual-feedback");
		await completeVisualFeedback(input);
	}

	return { queued: queueResult.queued, creditsReserved };
}
