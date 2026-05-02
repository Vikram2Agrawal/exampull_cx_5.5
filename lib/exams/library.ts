import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { publicBaseUrl } from "@/lib/env";
import { readStorageBase64 } from "@/lib/exams/artifacts";
import { createExamForUser, createExamRequestSchema } from "@/lib/exams/create";
import { adminDb, adminStorage, FieldValue, Timestamp } from "@/lib/firebase/admin";

const shareCollection = adminDb.collection("share_links");
const abuseCollection = adminDb.collection("abuseReports");

export const examUpdateSchema = z.object({
	bookmarked: z.boolean().optional(),
	archived: z.boolean().optional(),
	rating: z.number().int().min(1).max(5).nullable().optional(),
	reportReason: z.string().trim().min(8).max(1200).optional(),
});

export const examBulkActionSchema = z
	.object({
		examIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
		action: z.enum(["archive", "restore", "bookmark", "unbookmark", "delete", "move_class"]),
		classId: z.string().trim().min(1).max(120).nullable().optional(),
	})
	.superRefine((input, context) => {
		if (input.action === "move_class" && input.classId === undefined) {
			context.addIssue({
				code: "custom",
				path: ["classId"],
				message: "Move to class requires a class id or null.",
			});
		}
	});

export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;
export type ExamBulkActionInput = z.infer<typeof examBulkActionSchema>;

export type SharedExam = {
	shareId: string;
	examId: string;
	title: string;
	className: string;
	topics: string[];
	questionCount: number;
	status: string;
	examPdfReady: boolean;
	examPdfBase64: string | null;
	createdAt: string;
};

function examRef(userId: string, examId: string) {
	return adminDb.collection("users").doc(userId).collection("exams").doc(examId);
}

async function deleteCollection(collection: FirebaseFirestore.CollectionReference) {
	for (;;) {
		const snapshot = await collection.limit(450).get();

		if (snapshot.empty) {
			return;
		}

		const batch = adminDb.batch();

		for (const doc of snapshot.docs) {
			batch.delete(doc.ref);
		}

		await batch.commit();
	}
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

function storagePathList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function pdfReady(data: FirebaseFirestore.DocumentData, type: "exam" | "answer") {
	const base64Field = type === "answer" ? "answerKeyPdfBase64" : "examPdfBase64";
	const storageField = type === "answer" ? "answerKeyPdfStoragePath" : "examPdfStoragePath";

	return typeof data[base64Field] === "string" || typeof data[storageField] === "string";
}

async function pdfBase64FromData(data: FirebaseFirestore.DocumentData, type: "exam" | "answer") {
	const base64Field = type === "answer" ? "answerKeyPdfBase64" : "examPdfBase64";
	const storageField = type === "answer" ? "answerKeyPdfStoragePath" : "examPdfStoragePath";
	const inlinePdf = data[base64Field];

	if (typeof inlinePdf === "string" && inlinePdf.length > 0) {
		return inlinePdf;
	}

	const storagePath = data[storageField];

	if (typeof storagePath === "string" && storagePath.length > 0) {
		return readStorageBase64(storagePath);
	}

	return null;
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
		const createdAt = snapshot.get("createdAt");
		const boostedScholar = Boolean(snapshot.get("boostedScholar") ?? false);
		const boostWithinRegretWindow =
			boostedScholar &&
			createdAt instanceof Timestamp &&
			Date.now() - createdAt.toMillis() <= 24 * 60 * 60 * 1000;

		if (boostWithinRegretWindow) {
			await adminDb.collection("users").doc(user.uid).set(
				{
					boostUsedAt: FieldValue.delete(),
					boostExamId: FieldValue.delete(),
					boostGradingUsedAt: FieldValue.delete(),
					boostGradingAttemptId: FieldValue.delete(),
					updatedAt: Timestamp.now(),
				},
				{ merge: true },
			);
			await ref.set(
				{
					boostRefundedAt: Timestamp.now(),
					updatedAt: Timestamp.now(),
				},
				{ merge: true },
			);
		}

		await abuseCollection.add({
			kind: "exam_report",
			userId: user.uid,
			examId,
			reason: parsed.reportReason,
			status: "open",
			boostRefunded: boostWithinRegretWindow,
			isTestData: user.isTestAccount,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		});
	}

	return { examId };
}

export async function deleteExamForUser(user: CurrentUser, examId: string) {
	const ref = examRef(user.uid, examId);
	const snapshot = await ref.get();

	if (!snapshot.exists) {
		return null;
	}

	const creditsReserved = Number(snapshot.get("creditsReserved") ?? 0);
	const userRef = adminDb.collection("users").doc(user.uid);
	const attempts = await ref.collection("attempts").get();
	const attemptStoragePaths = attempts.docs
		.map((doc) => doc.get("storagePath"))
		.filter((value): value is string => typeof value === "string" && value.length > 0);
	const adHocUploadIds = stringList(snapshot.get("adHocUploadIds"));
	const adHocUploads = await Promise.all(
		adHocUploadIds.map((uploadId) => userRef.collection("examUploads").doc(uploadId).get()),
	);
	const adHocStoragePaths = adHocUploads
		.filter((upload) => upload.exists && upload.get("examId") === examId)
		.map((upload) => upload.get("storagePath"))
		.filter((value): value is string => typeof value === "string" && value.length > 0);
	const artifactStoragePaths = [
		snapshot.get("examPdfStoragePath"),
		snapshot.get("answerKeyPdfStoragePath"),
		...storagePathList(snapshot.get("examRenderedPageStoragePaths")),
		...storagePathList(snapshot.get("answerKeyRenderedPageStoragePaths")),
	].filter((value): value is string => typeof value === "string" && value.length > 0);
	const shares = await shareCollection
		.where("ownerUid", "==", user.uid)
		.where("examId", "==", examId)
		.get();

	if (creditsReserved > 0) {
		await adminDb.runTransaction(async (transaction) => {
			const userSnapshot = await transaction.get(userRef);
			transaction.update(userRef, {
				credits: Number(userSnapshot.get("credits") ?? 0) + creditsReserved,
				reservedCredits: Math.max(
					0,
					Number(userSnapshot.get("reservedCredits") ?? 0) - creditsReserved,
				),
				updatedAt: Timestamp.now(),
			});
		});
	}

	await Promise.all(
		[...attemptStoragePaths, ...adHocStoragePaths, ...artifactStoragePaths].map((storagePath) =>
			adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true }),
		),
	);
	await deleteCollection(ref.collection("attempts"));

	const batch = adminDb.batch();
	for (const upload of adHocUploads) {
		if (upload.exists && upload.get("examId") === examId) {
			batch.delete(upload.ref);
		}
	}
	for (const share of shares.docs) {
		batch.delete(share.ref);
	}
	batch.delete(ref);
	await batch.commit();

	return { examId, deleted: true };
}

export async function bulkUpdateExamsForUser({
	user,
	input,
}: {
	user: CurrentUser;
	input: ExamBulkActionInput;
}) {
	const parsed = examBulkActionSchema.parse(input);
	const uniqueExamIds = Array.from(new Set(parsed.examIds));

	if (parsed.action === "delete") {
		let deleted = 0;
		for (const examId of uniqueExamIds) {
			const result = await deleteExamForUser(user, examId);
			if (result) {
				deleted += 1;
			}
		}

		return { updated: 0, deleted };
	}

	let className: string | null = null;
	if (parsed.action === "move_class" && parsed.classId) {
		const classSnapshot = await adminDb
			.collection("users")
			.doc(user.uid)
			.collection("classes")
			.doc(parsed.classId)
			.get();

		if (!classSnapshot.exists) {
			throw new Error("Class not found.");
		}

		className =
			typeof classSnapshot.get("name") === "string"
				? String(classSnapshot.get("name"))
				: null;
	}

	let updated = 0;
	for (let index = 0; index < uniqueExamIds.length; index += 450) {
		const chunk = uniqueExamIds.slice(index, index + 450);
		const snapshots = await Promise.all(chunk.map((examId) => examRef(user.uid, examId).get()));
		const batch = adminDb.batch();

		for (const snapshot of snapshots) {
			if (!snapshot.exists) {
				continue;
			}

			const updateData: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
				updatedAt: Timestamp.now(),
			};

			if (parsed.action === "archive") updateData.archived = true;
			if (parsed.action === "restore") updateData.archived = false;
			if (parsed.action === "bookmark") updateData.bookmarked = true;
			if (parsed.action === "unbookmark") updateData.bookmarked = false;
			if (parsed.action === "move_class") {
				updateData.classId = parsed.classId ?? null;
				updateData.className = className ?? "Manual topics";
			}

			batch.update(snapshot.ref, updateData);
			updated += 1;
		}

		await batch.commit();
	}

	return { updated, deleted: 0 };
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
		adHocUploadIds: stringList(data.adHocUploadIds),
		sourceNotes,
		questionCount: Number(data.questionCount ?? config.questionCount ?? 6),
		mode,
		powerSlots: Array.isArray(config.powerSlots) ? config.powerSlots : undefined,
		mirrorInstructorStyle:
			typeof config.mirrorInstructorStyle === "boolean"
				? config.mirrorInstructorStyle
				: undefined,
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
		examPdfReady: pdfReady(data, "exam"),
		examPdfBase64: typeof data.examPdfBase64 === "string" ? data.examPdfBase64 : null,
		createdAt: isoDate(data.createdAt),
	};
}

export async function getSharedExamPdf(shareId: string) {
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
	const pdfBase64 = await pdfBase64FromData(data, "exam");

	if (!pdfBase64) {
		return null;
	}

	const title = typeof data.title === "string" ? data.title : "Shared practice exam";

	return { title, pdfBase64 };
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

	const data = snapshot.data() ?? {};
	const answerKeyUnlocked =
		Boolean(data.answerKeyUnlocked ?? false) || Boolean(data.boostedScholar ?? false);

	if (type === "answer" && user.tier === "free" && !answerKeyUnlocked) {
		throw new Error("Answer keys are available on Scholar and Guru.");
	}

	const pdf = await pdfBase64FromData(data, type);

	if (!pdf) {
		return null;
	}

	const title = typeof data.title === "string" ? data.title : "practice-exam";

	return { title, pdfBase64: pdf };
}
