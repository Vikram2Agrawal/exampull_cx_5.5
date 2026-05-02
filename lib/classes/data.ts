import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { adminDb, adminStorage, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { parseTopicLines } from "@/lib/materials/source-reader";
import { CREDIT_COSTS } from "@/lib/product/constants";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";

const maxUploadBytes = 100 * 1024 * 1024;
const inFlightStatuses = ["queued", "generating", "qa_in_progress"] as const;

export const classCreateSchema = z.object({
	name: z.string().trim().min(2).max(120),
	institution: z.string().trim().max(120).optional(),
	educationLevel: z.number().int().min(0).max(100),
	description: z.string().trim().max(1000).optional(),
});

export const classUpdateSchema = classCreateSchema.partial().extend({
	archived: z.boolean().optional(),
});

export const materialUploadSchema = z.object({
	filename: z.string().trim().min(1).max(180),
	contentType: z.string().trim().min(1).max(120),
	sizeBytes: z.number().int().min(1).max(maxUploadBytes),
	focus: z.string().trim().max(500).optional(),
	styleReference: z.boolean().default(false),
});

export type ClassCreateInput = z.infer<typeof classCreateSchema>;
export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;
export type MaterialUploadInput = z.infer<typeof materialUploadSchema>;

export type MaterialSummary = {
	id: string;
	filename: string;
	contentType: string;
	sizeBytes: number;
	focus: string | null;
	status: string;
	styleReference: boolean;
	extractedTopics: string[];
	createdAt: string;
	uploadedAt: string | null;
};

export type ClassSummary = {
	id: string;
	name: string;
	institution: string | null;
	educationLevel: number;
	description: string | null;
	archived: boolean;
	materialCount: number;
	styleExampleCount: number;
	styleGuideStatus: string;
	styleGuide: string | null;
	createdAt: string;
	updatedAt: string;
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

function stringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

function classFromDoc(id: string, data: FirebaseFirestore.DocumentData): ClassSummary {
	return {
		id,
		name: typeof data.name === "string" ? data.name : "Untitled class",
		institution:
			typeof data.institution === "string" && data.institution ? data.institution : null,
		educationLevel: Number(data.educationLevel ?? 50),
		description:
			typeof data.description === "string" && data.description ? data.description : null,
		archived: Boolean(data.archived ?? false),
		materialCount: Number(data.materialCount ?? 0),
		styleExampleCount: Number(data.styleExampleCount ?? 0),
		styleGuideStatus:
			typeof data.styleGuideStatus === "string" ? data.styleGuideStatus : "not_started",
		styleGuide: typeof data.styleGuide === "string" && data.styleGuide ? data.styleGuide : null,
		createdAt: isoDate(data.createdAt),
		updatedAt: isoDate(data.updatedAt),
	};
}

function materialFromDoc(id: string, data: FirebaseFirestore.DocumentData): MaterialSummary {
	return {
		id,
		filename: typeof data.filename === "string" ? data.filename : "material",
		contentType:
			typeof data.contentType === "string" ? data.contentType : "application/octet-stream",
		sizeBytes: Number(data.sizeBytes ?? 0),
		focus: typeof data.focus === "string" && data.focus ? data.focus : null,
		status: typeof data.status === "string" ? data.status : "uploading",
		styleReference: Boolean(data.styleReference ?? false),
		extractedTopics: stringList(data.extractedTopics),
		createdAt: isoDate(data.createdAt),
		uploadedAt: optionalIsoDate(data.uploadedAt),
	};
}

function classCollection(userId: string) {
	return adminDb.collection("users").doc(userId).collection("classes");
}

function safeFilename(filename: string) {
	return (
		filename
			.normalize("NFKD")
			.replace(/[^\w.\- ]+/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.slice(0, 120) || "material"
	);
}

export async function listUserClasses(userId: string) {
	const snapshot = await classCollection(userId).orderBy("updatedAt", "desc").get();

	return snapshot.docs.map((doc) => classFromDoc(doc.id, doc.data()));
}

export async function getUserClass(userId: string, classId: string) {
	const snapshot = await classCollection(userId).doc(classId).get();

	if (!snapshot.exists) {
		return null;
	}

	return classFromDoc(snapshot.id, snapshot.data() ?? {});
}

export async function listClassMaterials(userId: string, classId: string) {
	const snapshot = await classCollection(userId)
		.doc(classId)
		.collection("materials")
		.orderBy("createdAt", "desc")
		.get();

	return snapshot.docs.map((doc) => materialFromDoc(doc.id, doc.data()));
}

export async function createClassForUser(user: CurrentUser, input: ClassCreateInput) {
	const parsed = classCreateSchema.parse(input);
	const classId = randomUUID();
	const now = Timestamp.now();

	await classCollection(user.uid)
		.doc(classId)
		.create({
			name: parsed.name,
			institution: parsed.institution || null,
			educationLevel: parsed.educationLevel,
			description: parsed.description || null,
			archived: false,
			materialCount: 0,
			styleExampleCount: 0,
			styleGuideStatus: "not_started",
			styleGuide: null,
			createdAt: now,
			updatedAt: now,
			isTestData: user.isTestAccount,
		});

	return { classId };
}

export async function updateClassForUser(userId: string, classId: string, input: ClassUpdateInput) {
	const parsed = classUpdateSchema.parse(input);
	const classRef = classCollection(userId).doc(classId);
	const snapshot = await classRef.get();

	if (!snapshot.exists) {
		return null;
	}

	const updateData: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
		updatedAt: Timestamp.now(),
	};

	if (parsed.name !== undefined) updateData.name = parsed.name;
	if (parsed.institution !== undefined) updateData.institution = parsed.institution || null;
	if (parsed.educationLevel !== undefined) updateData.educationLevel = parsed.educationLevel;
	if (parsed.description !== undefined) updateData.description = parsed.description || null;
	if (parsed.archived !== undefined) updateData.archived = parsed.archived;

	await classRef.update(updateData);

	return { classId };
}

export async function deleteClassForUser(userId: string, classId: string) {
	const exams = await adminDb
		.collection("users")
		.doc(userId)
		.collection("exams")
		.where("classId", "==", classId)
		.get();
	const hasInFlightExam = exams.docs.some((doc) => {
		const status = doc.get("status");
		return typeof status === "string" && inFlightStatuses.some((item) => item === status);
	});

	if (hasInFlightExam) {
		throw new Error(
			"An exam from this class is still generating. Wait for it to finish first.",
		);
	}

	const classRef = classCollection(userId).doc(classId);
	const materials = await classRef.collection("materials").limit(200).get();
	const storagePaths = materials.docs
		.map((material) => material.get("storagePath"))
		.filter((value): value is string => typeof value === "string" && value.length > 0);
	const mutations: ((batch: FirebaseFirestore.WriteBatch) => void)[] = [];
	const now = Timestamp.now();

	for (const material of materials.docs) {
		mutations.push((batch) => batch.delete(material.ref));
	}

	for (const exam of exams.docs) {
		mutations.push((batch) =>
			batch.update(exam.ref, {
				classId: null,
				className: "Manual topics",
				sourceClassDeletedAt: now,
				updatedAt: now,
			}),
		);
	}

	mutations.push((batch) => batch.delete(classRef));

	for (let index = 0; index < mutations.length; index += 450) {
		const batch = adminDb.batch();
		for (const mutation of mutations.slice(index, index + 450)) {
			mutation(batch);
		}
		await batch.commit();
	}

	await Promise.all(
		storagePaths.map((storagePath) =>
			adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true }),
		),
	);

	return { deleted: true };
}

export async function createMaterialUpload({
	user,
	classId,
	input,
}: {
	user: CurrentUser;
	classId: string;
	input: MaterialUploadInput;
}) {
	const parsed = materialUploadSchema.parse(input);
	const classRef = classCollection(user.uid).doc(classId);
	const classSnapshot = await classRef.get();

	if (!classSnapshot.exists) {
		throw new Error("Class not found.");
	}

	if (parsed.styleReference && user.credits < CREDIT_COSTS.STYLE_GUIDE_UPLOAD) {
		throw new Error("Insufficient credits for instructor style processing.");
	}

	const materialId = randomUUID();
	const filename = safeFilename(parsed.filename);
	const storagePath = `users/${user.uid}/materials/${materialId}/${filename}`;
	const materialRef = classRef.collection("materials").doc(materialId);
	const now = Timestamp.now();

	await adminDb.runTransaction(async (transaction) => {
		if (parsed.styleReference) {
			const userRef = adminDb.collection("users").doc(user.uid);
			const userSnapshot = await transaction.get(userRef);
			const credits = Number(userSnapshot.get("credits") ?? 0);

			if (credits < CREDIT_COSTS.STYLE_GUIDE_UPLOAD) {
				throw new Error("Insufficient credits for instructor style processing.");
			}

			transaction.update(userRef, {
				credits: credits - CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
				reservedCredits:
					Number(userSnapshot.get("reservedCredits") ?? 0) +
					CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
				updatedAt: now,
			});
		}

		transaction.create(materialRef, {
			filename: parsed.filename,
			contentType: parsed.contentType,
			sizeBytes: parsed.sizeBytes,
			focus: parsed.focus || null,
			styleReference: parsed.styleReference,
			storagePath,
			status: "uploading",
			extractedTopics: [],
			createdAt: now,
			updatedAt: now,
			uploadedAt: null,
			isTestData: user.isTestAccount,
		});
		const classUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
			materialCount: FieldValue.increment(1),
			styleExampleCount: parsed.styleReference
				? FieldValue.increment(1)
				: FieldValue.increment(0),
			updatedAt: now,
		};

		if (parsed.styleReference) {
			classUpdate.styleGuideStatus = "queued";
		}

		transaction.update(classRef, classUpdate);
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

	return { materialId, uploadUrl, storagePath };
}

export async function completeMaterialUpload(
	user: CurrentUser,
	classId: string,
	materialId: string,
) {
	const classRef = classCollection(user.uid).doc(classId);
	const materialRef = classRef.collection("materials").doc(materialId);
	const snapshot = await materialRef.get();

	if (!snapshot.exists) {
		throw new Error("Material not found.");
	}

	const styleReference = Boolean(snapshot.get("styleReference") ?? false);
	const filename = String(snapshot.get("filename") ?? "material");
	const focus = typeof snapshot.get("focus") === "string" ? String(snapshot.get("focus")) : "";

	await materialRef.update({
		status: styleReference ? "style_queued" : "extracting_topics",
		uploadedAt: Timestamp.now(),
		updatedAt: Timestamp.now(),
	});

	const route = styleReference ? "/api/workers/style-guide" : "/api/workers/extract-topics";
	const queueResult = await enqueueWorkerTask({
		route,
		payload: { userId: user.uid, classId, materialId },
	});

	if (!queueResult.queued) {
		const fallbackTopics = parseTopicLines("", `${filename} ${focus}`.trim());

		if (styleReference) {
			const now = Timestamp.now();
			const styleGuide = [
				`Instructor style guide inferred from ${filename}.`,
				focus ? `Focus: ${focus}.` : "Focus: entire uploaded reference.",
				"Use concise exam wording, visible point values, clear answer-space expectations, and problems that mirror the uploaded reference topics.",
			].join("\n");
			const userRef = adminDb.collection("users").doc(user.uid);

			await adminDb.runTransaction(async (transaction) => {
				const userSnapshot = await transaction.get(userRef);
				transaction.update(userRef, {
					reservedCredits: Math.max(
						0,
						Number(userSnapshot.get("reservedCredits") ?? 0) -
							CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
					),
					totalCreditsConsumed:
						Number(userSnapshot.get("totalCreditsConsumed") ?? 0) +
						CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
					updatedAt: now,
				});
				transaction.update(classRef, {
					styleGuide,
					styleGuideStatus: "ready",
					styleGuideUpdatedAt: now,
					updatedAt: now,
				});
				transaction.update(materialRef, {
					status: "style_ready",
					extractedTopics: fallbackTopics,
					styleGuideContribution: styleGuide,
					queueWarning: queueResult.reason,
					updatedAt: now,
				});
			});
		} else {
			await materialRef.set(
				{
					status: "ready",
					queueWarning: queueResult.reason,
					extractedTopics: fallbackTopics,
					updatedAt: Timestamp.now(),
				},
				{ merge: true },
			);
		}
	}

	return { queued: queueResult.queued };
}

export async function deleteMaterialForUser(userId: string, classId: string, materialId: string) {
	const classRef = classCollection(userId).doc(classId);
	const materialRef = classRef.collection("materials").doc(materialId);
	const snapshot = await materialRef.get();

	if (!snapshot.exists) {
		return null;
	}

	const storagePath = snapshot.get("storagePath");
	const styleReference = Boolean(snapshot.get("styleReference") ?? false);

	await adminDb.runTransaction(async (transaction) => {
		transaction.delete(materialRef);
		transaction.update(classRef, {
			materialCount: FieldValue.increment(-1),
			styleExampleCount: styleReference ? FieldValue.increment(-1) : FieldValue.increment(0),
			updatedAt: Timestamp.now(),
		});
	});

	if (typeof storagePath === "string") {
		await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true });
	}

	return { deleted: true };
}
