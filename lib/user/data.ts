import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { readStorageBase64 } from "@/lib/exams/artifacts";
import { adminAuth, adminDb, adminStorage, FieldValue, Timestamp } from "@/lib/firebase/admin";

export const feedbackSchema = z.object({
	kind: z.enum(["feature", "bug", "general"]),
	title: z.string().trim().min(3).max(140),
	body: z.string().trim().min(10).max(4000),
	examId: z.string().trim().max(120).optional(),
	shareId: z.string().trim().max(120).optional(),
});

export const profileSettingsSchema = z.object({
	displayName: z.string().trim().min(2).max(80),
	notificationEmail: z.boolean().default(true),
	notificationProduct: z.boolean().default(true),
	theme: z.enum(["system", "light", "dark"]).default("system"),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

export type UserNotification = {
	id: string;
	title: string;
	body: string;
	kind: string;
	read: boolean;
	href: string | null;
	createdAt: string;
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

function notificationFromDoc(id: string, data: FirebaseFirestore.DocumentData): UserNotification {
	return {
		id,
		title: typeof data.title === "string" ? data.title : "Notification",
		body: typeof data.body === "string" ? data.body : "",
		kind: typeof data.kind === "string" ? data.kind : "system",
		read: Boolean(data.read ?? false),
		href: typeof data.href === "string" && data.href ? data.href : null,
		createdAt: isoDate(data.createdAt),
	};
}

function userRef(userId: string) {
	return adminDb.collection("users").doc(userId);
}

export async function submitFeedback(user: CurrentUser | null, input: FeedbackInput) {
	const parsed = feedbackSchema.parse(input);
	const now = Timestamp.now();
	const ref = await adminDb.collection("feedback").add({
		kind: parsed.kind,
		title: parsed.title,
		body: parsed.body,
		examId: parsed.examId ?? null,
		shareId: parsed.shareId ?? null,
		userId: user?.uid ?? null,
		email: user?.email ?? null,
		status: "open",
		isTestData: user?.isTestAccount ?? false,
		createdAt: now,
		updatedAt: now,
	});

	if (user) {
		await createUserNotification({
			userId: user.uid,
			title: "Feedback received",
			body: "Your note is in the operator review queue.",
			kind: "feedback",
			href: "/feedback",
		});
	}

	return { feedbackId: ref.id };
}

export async function listUserNotifications(userId: string, limit = 50) {
	const snapshot = await userRef(userId)
		.collection("notifications")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => notificationFromDoc(doc.id, doc.data()));
}

export async function createUserNotification({
	userId,
	title,
	body,
	kind,
	href,
}: {
	userId: string;
	title: string;
	body: string;
	kind: string;
	href?: string;
}) {
	const ref = await userRef(userId)
		.collection("notifications")
		.add({
			title,
			body,
			kind,
			href: href ?? null,
			read: false,
			createdAt: Timestamp.now(),
		});
	await userRef(userId).set(
		{
			unreadNotificationCount: FieldValue.increment(1),
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);

	return { notificationId: ref.id };
}

export async function markAllNotificationsRead(userId: string) {
	const snapshot = await userRef(userId)
		.collection("notifications")
		.where("read", "==", false)
		.limit(450)
		.get();

	const batch = adminDb.batch();

	for (const notification of snapshot.docs) {
		batch.update(notification.ref, { read: true, readAt: Timestamp.now() });
	}

	batch.set(
		userRef(userId),
		{
			unreadNotificationCount: 0,
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);
	await batch.commit();

	return { marked: snapshot.size };
}

export async function markNotificationRead(userId: string, notificationId: string) {
	const base = userRef(userId);
	const notificationRef = base.collection("notifications").doc(notificationId);
	const now = Timestamp.now();

	await adminDb.runTransaction(async (transaction) => {
		const [profileSnapshot, notificationSnapshot] = await Promise.all([
			transaction.get(base),
			transaction.get(notificationRef),
		]);

		if (!notificationSnapshot.exists) {
			throw new Error("Notification not found.");
		}

		const wasUnread = notificationSnapshot.get("read") !== true;
		transaction.update(notificationRef, {
			read: true,
			readAt: notificationSnapshot.get("readAt") ?? now,
			updatedAt: now,
		});

		if (wasUnread) {
			transaction.set(
				base,
				{
					unreadNotificationCount: Math.max(
						0,
						Number(profileSnapshot.get("unreadNotificationCount") ?? 0) - 1,
					),
					updatedAt: now,
				},
				{ merge: true },
			);
		}
	});

	return { updated: true };
}

export async function deleteNotification(userId: string, notificationId: string) {
	const base = userRef(userId);
	const notificationRef = base.collection("notifications").doc(notificationId);
	const now = Timestamp.now();

	await adminDb.runTransaction(async (transaction) => {
		const [profileSnapshot, notificationSnapshot] = await Promise.all([
			transaction.get(base),
			transaction.get(notificationRef),
		]);

		if (!notificationSnapshot.exists) {
			throw new Error("Notification not found.");
		}

		const wasUnread = notificationSnapshot.get("read") !== true;
		transaction.delete(notificationRef);

		if (wasUnread) {
			transaction.set(
				base,
				{
					unreadNotificationCount: Math.max(
						0,
						Number(profileSnapshot.get("unreadNotificationCount") ?? 0) - 1,
					),
					updatedAt: now,
				},
				{ merge: true },
			);
		}
	});

	return { deleted: true };
}

export async function clearNotifications(userId: string) {
	const base = userRef(userId);
	const snapshot = await base.collection("notifications").limit(450).get();
	const batch = adminDb.batch();

	for (const notification of snapshot.docs) {
		batch.delete(notification.ref);
	}

	batch.set(
		base,
		{
			unreadNotificationCount: 0,
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);
	await batch.commit();

	return { deleted: snapshot.size };
}

export async function updateProfileSettings(user: CurrentUser, input: ProfileSettingsInput) {
	const parsed = profileSettingsSchema.parse(input);

	await Promise.all([
		userRef(user.uid).set(
			{
				displayName: parsed.displayName,
				settings: {
					notificationEmail: parsed.notificationEmail,
					notificationProduct: parsed.notificationProduct,
					theme: parsed.theme,
				},
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		),
		adminAuth.updateUser(user.uid, { displayName: parsed.displayName }),
	]);

	return { updated: true };
}

type ExportedDocument = FirebaseFirestore.DocumentData & {
	id: string;
};

type InlinePdfField = "examPdfBase64" | "answerKeyPdfBase64" | "visualFeedbackPdfBase64";
type StoragePdfField =
	| "examPdfStoragePath"
	| "answerKeyPdfStoragePath"
	| "visualFeedbackPdfStoragePath";

async function collectionToJson(
	collection: FirebaseFirestore.CollectionReference,
): Promise<ExportedDocument[]> {
	const snapshot = await collection.get();

	return snapshot.docs.map((doc) => ({
		...doc.data(),
		id: doc.id,
	}));
}

async function exportedPdfBase64(
	exam: ExportedDocument,
	inlineField: InlinePdfField,
	storageField: StoragePdfField,
) {
	const inlinePdf = exam[inlineField];

	if (typeof inlinePdf === "string" && inlinePdf.length > 0) {
		return inlinePdf;
	}

	const storagePath = exam[storageField];

	if (typeof storagePath !== "string" || storagePath.length === 0) {
		return null;
	}

	return readStorageBase64(storagePath);
}

async function examWithExportedArtifacts(exam: ExportedDocument): Promise<ExportedDocument> {
	const [examPdfBase64, answerKeyPdfBase64] = await Promise.all([
		exportedPdfBase64(exam, "examPdfBase64", "examPdfStoragePath"),
		exportedPdfBase64(exam, "answerKeyPdfBase64", "answerKeyPdfStoragePath"),
	]);

	return {
		...exam,
		examPdfBase64,
		answerKeyPdfBase64,
	};
}

async function attemptWithExportedArtifacts(attempt: ExportedDocument): Promise<ExportedDocument> {
	const visualFeedbackPdfBase64 = await exportedPdfBase64(
		attempt,
		"visualFeedbackPdfBase64",
		"visualFeedbackPdfStoragePath",
	);

	return {
		...attempt,
		visualFeedbackPdfBase64,
	};
}

export async function exportUserData(userId: string) {
	const base = userRef(userId);
	const [profile, rawExams, classes, notifications] = await Promise.all([
		base.get(),
		collectionToJson(base.collection("exams")),
		collectionToJson(base.collection("classes")),
		collectionToJson(base.collection("notifications")),
	]);
	const exams = await Promise.all(rawExams.map(examWithExportedArtifacts));

	const classMaterials = await Promise.all(
		classes.map(async (course) => {
			const courseId = typeof course.id === "string" ? course.id : "";
			return {
				classId: courseId,
				materials: await collectionToJson(
					base.collection("classes").doc(courseId).collection("materials"),
				),
			};
		}),
	);
	const attempts = await Promise.all(
		exams.map(async (exam) => {
			const examId = typeof exam.id === "string" ? exam.id : "";
			return {
				examId,
				attempts: await Promise.all(
					(
						await collectionToJson(
							base.collection("exams").doc(examId).collection("attempts"),
						)
					).map(attemptWithExportedArtifacts),
				),
			};
		}),
	);

	return {
		exportedAt: new Date().toISOString(),
		profile: profile.exists ? profile.data() : null,
		exams,
		attempts,
		classes,
		classMaterials,
		notifications,
	};
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

export async function deleteUserAccount(user: CurrentUser) {
	const base = userRef(user.uid);
	const [classes, exams] = await Promise.all([
		base.collection("classes").get(),
		base.collection("exams").get(),
	]);

	for (const course of classes.docs) {
		await deleteCollection(course.ref.collection("materials"));
	}

	for (const exam of exams.docs) {
		await deleteCollection(exam.ref.collection("attempts"));
	}

	await Promise.all([
		deleteCollection(base.collection("classes")),
		deleteCollection(base.collection("exams")),
		deleteCollection(base.collection("notifications")),
		deleteCollection(base.collection("referrals")),
	]);

	await adminDb.collection("accountDeletions").add({
		userId: user.uid,
		email: user.email,
		isTestData: user.isTestAccount,
		createdAt: Timestamp.now(),
	});
	await base.delete();
	await adminStorage.bucket().deleteFiles({ prefix: `users/${user.uid}/` });
	await adminAuth.deleteUser(user.uid);

	return { deleted: true };
}
