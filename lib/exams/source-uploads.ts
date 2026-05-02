import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";
import { parseTopicLines } from "@/lib/materials/source-reader";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";

const maxUploadBytes = 100 * 1024 * 1024;

export const examSourceUploadSchema = z.object({
	filename: z.string().trim().min(1).max(180),
	contentType: z.string().trim().min(1).max(120),
	sizeBytes: z.number().int().min(1).max(maxUploadBytes),
	focus: z.string().trim().max(500).optional(),
	styleReference: z.boolean().default(false),
});

export type ExamSourceUploadInput = z.infer<typeof examSourceUploadSchema>;

export type SourceExtractionProgress = {
	stage: string;
	detail: string;
	percent: number;
	pagesRead: number | null;
	totalPages: number | null;
};

export type ExamSourceUploadSummary = {
	id: string;
	filename: string;
	contentType: string;
	sizeBytes: number;
	focus: string | null;
	status: string;
	styleReference: boolean;
	extractedTopics: string[];
	extractionProgress: SourceExtractionProgress | null;
	createdAt: string;
	uploadedAt: string | null;
};

export type ResolvedExamSourceUpload = ExamSourceUploadSummary & {
	storagePath: string;
	ref: FirebaseFirestore.DocumentReference;
};

function uploadCollection(userId: string) {
	return adminDb.collection("users").doc(userId).collection("examUploads");
}

function safeFilename(filename: string) {
	return (
		filename
			.normalize("NFKD")
			.replace(/[^\w.\- ]+/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.slice(0, 120) || "source"
	);
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

function optionalIsoDate(value: unknown) {
	if (!value) {
		return null;
	}

	return isoDate(value);
}

function stringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

function extractionProgressFromValue(value: unknown): SourceExtractionProgress | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}

	const record = value as Record<string, unknown>;
	const stage = typeof record.stage === "string" ? record.stage : "";
	const detail = typeof record.detail === "string" ? record.detail : "";
	const percent = typeof record.percent === "number" ? record.percent : 0;
	const pagesRead = typeof record.pagesRead === "number" ? record.pagesRead : null;
	const totalPages = typeof record.totalPages === "number" ? record.totalPages : null;

	if (!stage || !detail) {
		return null;
	}

	return {
		stage,
		detail,
		percent: Math.max(0, Math.min(100, Math.round(percent))),
		pagesRead,
		totalPages,
	};
}

function uploadSummaryFromDoc(
	id: string,
	data: FirebaseFirestore.DocumentData,
): ExamSourceUploadSummary {
	return {
		id,
		filename: typeof data.filename === "string" ? data.filename : "source",
		contentType:
			typeof data.contentType === "string" ? data.contentType : "application/octet-stream",
		sizeBytes: Number(data.sizeBytes ?? 0),
		focus: typeof data.focus === "string" && data.focus ? data.focus : null,
		status: typeof data.status === "string" ? data.status : "uploading",
		styleReference: Boolean(data.styleReference ?? false),
		extractedTopics: stringList(data.extractedTopics),
		extractionProgress: extractionProgressFromValue(data.extractionProgress),
		createdAt: isoDate(data.createdAt),
		uploadedAt: optionalIsoDate(data.uploadedAt),
	};
}

export function publicSourceUploadMetadata(source: ExamSourceUploadSummary) {
	return {
		id: source.id,
		filename: source.filename,
		contentType: source.contentType,
		sizeBytes: source.sizeBytes,
		focus: source.focus,
		styleReference: source.styleReference,
		extractedTopics: source.extractedTopics,
	};
}

export async function listExamSourceUploads(userId: string, uploadIds: string[]) {
	const uniqueUploadIds = Array.from(new Set(uploadIds)).slice(0, 50);

	if (uniqueUploadIds.length === 0) {
		return [];
	}

	const snapshots = await Promise.all(
		uniqueUploadIds.map((uploadId) => uploadCollection(userId).doc(uploadId).get()),
	);

	return snapshots
		.filter((snapshot) => snapshot.exists)
		.map((snapshot) => uploadSummaryFromDoc(snapshot.id, snapshot.data() ?? {}));
}

export async function resolveExamSourceUploads(userId: string, uploadIds: string[]) {
	const uniqueUploadIds = Array.from(new Set(uploadIds)).slice(0, 50);

	if (uniqueUploadIds.length === 0) {
		return [];
	}

	const snapshots = await Promise.all(
		uniqueUploadIds.map((uploadId) => uploadCollection(userId).doc(uploadId).get()),
	);
	const resolved: ResolvedExamSourceUpload[] = [];

	for (const snapshot of snapshots) {
		if (!snapshot.exists) {
			throw new Error("One of the uploaded source files could not be found.");
		}

		const data = snapshot.data() ?? {};
		const status = typeof data.status === "string" ? data.status : "uploading";

		if (status === "uploading") {
			throw new Error("One of the uploaded source files is still uploading.");
		}

		resolved.push({
			...uploadSummaryFromDoc(snapshot.id, data),
			storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
			ref: snapshot.ref,
		});
	}

	return resolved;
}

export async function createExamSourceUpload({
	user,
	input,
}: {
	user: CurrentUser;
	input: ExamSourceUploadInput;
}) {
	const parsed = examSourceUploadSchema.parse(input);
	const uploadId = randomUUID();
	const filename = safeFilename(parsed.filename);
	const storagePath = `users/${user.uid}/exam-uploads/${uploadId}/${filename}`;
	const now = Timestamp.now();
	const uploadRef = uploadCollection(user.uid).doc(uploadId);

	await uploadRef.create({
		filename: parsed.filename,
		contentType: parsed.contentType,
		sizeBytes: parsed.sizeBytes,
		focus: parsed.focus || null,
		styleReference: parsed.styleReference,
		storagePath,
		status: "uploading",
		extractedTopics: [],
		extractionProgress: {
			stage: "waiting_upload",
			detail: "Waiting for file upload",
			percent: 5,
			pagesRead: null,
			totalPages: null,
		},
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

	return { uploadId, uploadUrl, storagePath };
}

export async function completeExamSourceUpload(user: CurrentUser, uploadId: string) {
	const uploadRef = uploadCollection(user.uid).doc(uploadId);
	const snapshot = await uploadRef.get();

	if (!snapshot.exists) {
		throw new Error("Source upload not found.");
	}

	await uploadRef.update({
		status: "extracting_topics",
		extractionProgress: {
			stage: "queued",
			detail: "Queued for topic extraction",
			percent: 10,
			pagesRead: null,
			totalPages: null,
		},
		uploadedAt: Timestamp.now(),
		updatedAt: Timestamp.now(),
	});

	const queueResult = await enqueueWorkerTask({
		route: "/api/workers/extract-upload-topics",
		payload: { userId: user.uid, uploadId, tier: user.tier },
	});

	if (!queueResult.queued) {
		const data = snapshot.data() ?? {};
		const filename = typeof data.filename === "string" ? data.filename : "source";
		const focus = typeof data.focus === "string" ? data.focus : "";
		await uploadRef.set(
			{
				status: "ready",
				queueWarning: queueResult.reason,
				extractedTopics: parseTopicLines("", `${filename} ${focus}`.trim()),
				extractionProgress: {
					stage: "complete",
					detail: "Basic topic pass complete",
					percent: 100,
					pagesRead: null,
					totalPages: null,
				},
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	}

	const updated = await uploadRef.get();

	return {
		queued: queueResult.queued,
		upload: uploadSummaryFromDoc(updated.id, updated.data() ?? {}),
	};
}

export async function deleteExamSourceUpload(userId: string, uploadId: string) {
	const uploadRef = uploadCollection(userId).doc(uploadId);
	const snapshot = await uploadRef.get();

	if (!snapshot.exists) {
		return null;
	}

	const storagePath = snapshot.get("storagePath");

	await uploadRef.delete();

	if (typeof storagePath === "string") {
		await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true });
	}

	return { deleted: true };
}
