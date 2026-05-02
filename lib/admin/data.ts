import { appendAdminAudit, recordAdminAuditAccess } from "@/lib/admin/audit";
import { env } from "@/lib/env";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";
import { createUserNotification } from "@/lib/user/data";

export type AdminUserRow = {
	id: string;
	email: string;
	tier: string;
	tierOverride: string | null;
	accountStatus: string;
	suspendedAt: string | null;
	suspensionReason: string | null;
	credits: number;
	reservedCredits: number;
	totalCreditsConsumed: number;
	isTestAccount: boolean;
	createdAt: string;
	lastActiveAt: string;
};

export type AdminSuspendedUserRow = {
	id: string;
	email: string;
	reason: string;
	suspendedAt: string;
	suspendedBy: string;
};

export type AdminExamRow = {
	id: string;
	userId: string;
	title: string;
	status: string;
	tier: string;
	questionCount: number;
	creditsConsumed: number;
	rating: number | null;
	createdAt: string;
};

export type AdminQueueItem = {
	id: string;
	userId: string;
	title: string;
	status: string;
	failureReason: string | null;
	queueWarning: string | null;
	updatedAt: string;
};

export type AdminFeedbackRow = {
	id: string;
	kind: string;
	title: string;
	body: string;
	status: string;
	source: string;
	visibility: string;
	userId: string | null;
	createdAt: string;
};

export type AdminCommunicationRow = {
	id: string;
	kind: string;
	channel: string;
	subject: string;
	body: string;
	status: string;
	userId: string | null;
	email: string | null;
	phoneNumber: string | null;
	providerId: string | null;
	errorMessage: string | null;
	createdAt: string;
};

export type AdminAuditRow = {
	id: string;
	action: string;
	target: string;
	details: string;
	createdAt: string;
	hash: string | null;
	previousHash: string | null;
	sequence: number | null;
};

export type AdminReferralRow = {
	id: string;
	referrerUserId: string;
	referredUserId: string | null;
	status: string;
	creditsGranted: number;
	scholarMonthsGranted: number;
	guruMonthsGranted: number;
	suspicious: boolean;
	suspiciousReasons: string[];
	reviewStatus: string;
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

function timestampMillis(value: unknown) {
	return value instanceof Timestamp ? value.toMillis() : 0;
}

function firestoreCode(error: unknown) {
	if (!error || typeof error !== "object" || !("code" in error)) {
		return null;
	}

	const code = (error as { code?: unknown }).code;

	return typeof code === "number" ? code : null;
}

function text(value: unknown, fallback = "") {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalIsoDate(value: unknown) {
	return value instanceof Timestamp || value instanceof Date ? isoDate(value) : null;
}

function userIdFromCollectionGroupDoc(doc: FirebaseFirestore.QueryDocumentSnapshot) {
	return doc.ref.parent.parent?.id ?? "unknown";
}

export async function getAdminOverview() {
	const [users, exams, feedback, abuse] = await Promise.all([
		adminDb.collection("users").limit(1000).get(),
		adminDb.collectionGroup("exams").limit(1000).get(),
		adminDb.collection("feedback").where("status", "==", "open").limit(1000).get(),
		adminDb.collection("abuseReports").where("status", "==", "open").limit(1000).get(),
	]);
	const now = Date.now();
	const oneDay = 24 * 60 * 60 * 1000;
	const recentExams = exams.docs.filter((doc) => {
		const createdAt = doc.get("createdAt");
		const createdMs = createdAt instanceof Timestamp ? createdAt.toMillis() : 0;
		return now - createdMs <= oneDay;
	});
	const failedExams = exams.docs.filter((doc) => doc.get("status") === "failed");
	const completeExams = exams.docs.filter((doc) => doc.get("status") === "complete");
	const ratings = exams.docs
		.map((doc) => doc.get("rating"))
		.filter((rating): rating is number => typeof rating === "number");
	const creditsConsumed = exams.docs.reduce(
		(total, doc) => total + Number(doc.get("creditsConsumed") ?? 0),
		0,
	);

	return {
		userCount: users.size,
		testUserCount: users.docs.filter((doc) => doc.get("isTestAccount") === true).length,
		examCount: exams.size,
		recentExamCount: recentExams.length,
		failedExamCount: failedExams.length,
		completeExamCount: completeExams.length,
		openFeedbackCount: feedback.size,
		openAbuseCount: abuse.size,
		creditsConsumed,
		averageRating:
			ratings.length > 0
				? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
				: null,
	};
}

export async function listAdminUsers(limit = 100): Promise<AdminUserRow[]> {
	const snapshot = await adminDb
		.collection("users")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		email: text(doc.get("email"), "unknown"),
		tier: text(doc.get("tier"), "free"),
		tierOverride:
			typeof doc.get("tierOverrideReason") === "string"
				? doc.get("tierOverrideReason")
				: null,
		accountStatus: text(doc.get("accountStatus"), "clean"),
		suspendedAt: optionalIsoDate(doc.get("suspendedAt")),
		suspensionReason:
			typeof doc.get("suspensionReason") === "string" ? doc.get("suspensionReason") : null,
		credits: Number(doc.get("credits") ?? 0),
		reservedCredits: Number(doc.get("reservedCredits") ?? 0),
		totalCreditsConsumed: Number(doc.get("totalCreditsConsumed") ?? 0),
		isTestAccount: doc.get("isTestAccount") === true,
		createdAt: isoDate(doc.get("createdAt")),
		lastActiveAt: isoDate(doc.get("lastActiveAt") ?? doc.get("updatedAt")),
	}));
}

export async function listSuspendedUsers(limit = 100): Promise<AdminSuspendedUserRow[]> {
	const snapshot = await adminDb
		.collection("users")
		.where("accountStatus", "==", "suspended")
		.limit(limit)
		.get();

	return snapshot.docs
		.map((doc) => ({
			id: doc.id,
			email: text(doc.get("email"), "unknown"),
			reason: text(doc.get("suspensionReason"), "No reason recorded"),
			suspendedAt: isoDate(doc.get("suspendedAt")),
			suspendedBy: text(doc.get("suspendedBy"), "agent"),
		}))
		.sort((left, right) => Date.parse(right.suspendedAt) - Date.parse(left.suspendedAt));
}

export async function listAdminExams(limit = 100): Promise<AdminExamRow[]> {
	let snapshot: FirebaseFirestore.QuerySnapshot;

	try {
		snapshot = await adminDb
			.collectionGroup("exams")
			.orderBy("createdAt", "desc")
			.limit(limit)
			.get();
	} catch (error) {
		if (firestoreCode(error) !== 9) {
			throw error;
		}

		snapshot = await adminDb
			.collectionGroup("exams")
			.limit(Math.max(limit, limit * 3))
			.get();
	}

	return snapshot.docs
		.sort(
			(left, right) =>
				timestampMillis(right.get("createdAt")) - timestampMillis(left.get("createdAt")),
		)
		.slice(0, limit)
		.map((doc) => ({
			id: doc.id,
			userId: userIdFromCollectionGroupDoc(doc),
			title: text(doc.get("title"), "Untitled exam"),
			status: text(doc.get("status"), "queued"),
			tier: text(doc.get("tierAtGen"), "free"),
			questionCount: Number(doc.get("questionCount") ?? 0),
			creditsConsumed: Number(doc.get("creditsConsumed") ?? 0),
			rating: typeof doc.get("rating") === "number" ? Number(doc.get("rating")) : null,
			createdAt: isoDate(doc.get("createdAt")),
		}));
}

export async function listAdminQueueItems(limit = 100): Promise<AdminQueueItem[]> {
	let snapshot: FirebaseFirestore.QuerySnapshot;

	try {
		snapshot = await adminDb
			.collectionGroup("exams")
			.orderBy("updatedAt", "desc")
			.limit(limit)
			.get();
	} catch (error) {
		if (firestoreCode(error) !== 9) {
			throw error;
		}

		try {
			snapshot = await adminDb
				.collectionGroup("exams")
				.orderBy("createdAt", "desc")
				.limit(Math.max(limit, limit * 3))
				.get();
		} catch (fallbackError) {
			if (firestoreCode(fallbackError) !== 9) {
				throw fallbackError;
			}

			snapshot = await adminDb
				.collectionGroup("exams")
				.limit(Math.max(limit, limit * 3))
				.get();
		}
	}

	return snapshot.docs
		.filter((doc) => {
			const status = doc.get("status");
			return (
				status === "queued" ||
				status === "generating" ||
				status === "qa_in_progress" ||
				status === "failed" ||
				typeof doc.get("queueWarning") === "string"
			);
		})
		.sort(
			(left, right) =>
				timestampMillis(right.get("updatedAt")) - timestampMillis(left.get("updatedAt")),
		)
		.slice(0, limit)
		.map((doc) => ({
			id: doc.id,
			userId: userIdFromCollectionGroupDoc(doc),
			title: text(doc.get("title"), "Untitled exam"),
			status: text(doc.get("status"), "queued"),
			failureReason:
				typeof doc.get("failureReason") === "string" ? doc.get("failureReason") : null,
			queueWarning:
				typeof doc.get("queueWarning") === "string" ? doc.get("queueWarning") : null,
			updatedAt: isoDate(doc.get("updatedAt")),
		}));
}

export async function listAdminFeedback(
	collectionName: "feedback" | "abuseReports",
	limit = 100,
): Promise<AdminFeedbackRow[]> {
	const snapshot = await adminDb
		.collection(collectionName)
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		kind: text(doc.get("kind"), collectionName === "feedback" ? "general" : "report"),
		title: text(doc.get("title"), text(doc.get("examId"), "Untitled")),
		body: text(doc.get("body"), text(doc.get("reason"), "")),
		status: text(doc.get("status"), "open"),
		source: text(
			doc.get("source"),
			collectionName === "feedback" ? "feedback_page" : "exam_report",
		),
		visibility: text(doc.get("visibility"), "private"),
		userId: typeof doc.get("userId") === "string" ? doc.get("userId") : null,
		createdAt: isoDate(doc.get("createdAt")),
	}));
}

export async function listAdminCommunications(limit = 100): Promise<AdminCommunicationRow[]> {
	const snapshot = await adminDb
		.collection("communications")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		kind: text(doc.get("kind"), "message"),
		channel: text(doc.get("channel"), "unknown"),
		subject: text(doc.get("subject"), "(no subject)"),
		body: text(doc.get("body"), ""),
		status: text(doc.get("status"), "unknown"),
		userId: typeof doc.get("userId") === "string" ? doc.get("userId") : null,
		email: typeof doc.get("email") === "string" ? doc.get("email") : null,
		phoneNumber: typeof doc.get("phoneNumber") === "string" ? doc.get("phoneNumber") : null,
		providerId: typeof doc.get("providerId") === "string" ? doc.get("providerId") : null,
		errorMessage: typeof doc.get("errorMessage") === "string" ? doc.get("errorMessage") : null,
		createdAt: isoDate(doc.get("createdAt")),
	}));
}

export async function listAdminAudit(limit = 100): Promise<AdminAuditRow[]> {
	const snapshot = await adminDb
		.collection("audit_log")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();
	await recordAdminAuditAccess();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		action: text(doc.get("action"), "admin_action"),
		target: text(doc.get("target"), "system"),
		details: text(doc.get("details"), ""),
		createdAt: isoDate(doc.get("createdAt")),
		hash: typeof doc.get("hash") === "string" ? doc.get("hash") : null,
		previousHash: typeof doc.get("previousHash") === "string" ? doc.get("previousHash") : null,
		sequence: typeof doc.get("sequence") === "number" ? Number(doc.get("sequence")) : null,
	}));
}

export async function listAdminReferrals(limit = 100): Promise<AdminReferralRow[]> {
	const snapshot = await adminDb
		.collection("referrals")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		referrerUserId: text(doc.get("referrerUserId"), "unknown"),
		referredUserId:
			typeof doc.get("referredUserId") === "string" ? doc.get("referredUserId") : null,
		status: text(doc.get("status"), "pending"),
		creditsGranted: Number(doc.get("creditsGranted") ?? 0),
		scholarMonthsGranted: Number(doc.get("scholarMonthsGranted") ?? 0),
		guruMonthsGranted: Number(doc.get("guruMonthsGranted") ?? 0),
		suspicious: doc.get("suspicious") === true,
		suspiciousReasons: Array.isArray(doc.get("suspiciousReasons"))
			? doc.get("suspiciousReasons").filter((reason: unknown) => typeof reason === "string")
			: [],
		reviewStatus: text(doc.get("reviewStatus"), "none"),
		createdAt: isoDate(doc.get("createdAt")),
	}));
}

export function getAdminConfiguration() {
	return [
		{ name: "WEB_URL", configured: Boolean(env.WEB_URL), value: env.WEB_URL ?? "" },
		{
			name: "LATEX_SERVICE_URL",
			configured: Boolean(env.LATEX_SERVICE_URL),
			value: env.LATEX_SERVICE_URL ?? "",
		},
		{
			name: "CLOUD_TASKS_QUEUE",
			configured: Boolean(env.CLOUD_TASKS_QUEUE),
			value: env.CLOUD_TASKS_QUEUE,
		},
		{
			name: "OPENROUTER_API_KEY",
			configured: Boolean(env.OPENROUTER_API_KEY),
			value: env.OPENROUTER_API_KEY ? "set" : "",
		},
		{
			name: "STRIPE_SECRET_KEY",
			configured: Boolean(env.STRIPE_SECRET_KEY),
			value: env.STRIPE_SECRET_KEY ? "set" : "",
		},
		{
			name: "STRIPE_WEBHOOK_SECRET",
			configured: Boolean(env.STRIPE_WEBHOOK_SECRET),
			value: env.STRIPE_WEBHOOK_SECRET ? "set" : "",
		},
		{
			name: "ADMIN_AGENT_AUTH_ENABLED",
			configured: true,
			value: env.ADMIN_AGENT_AUTH_ENABLED,
		},
	] as const;
}

export async function writeAdminAudit({
	action,
	target,
	details,
}: {
	action: string;
	target: string;
	details: string;
}) {
	await appendAdminAudit({
		action,
		target,
		details,
	});
}

export async function grantUserCredits({
	userId,
	amount,
	reason,
}: {
	userId: string;
	amount: number;
	reason: string;
}) {
	await adminDb
		.collection("users")
		.doc(userId)
		.set(
			{
				credits: FieldValue.increment(amount),
				manualCreditGrantCount: FieldValue.increment(1),
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	await writeAdminAudit({
		action: "grant_credits",
		target: `users/${userId}`,
		details: `${amount} credits: ${reason}`,
	});

	return { granted: amount };
}

export async function overrideUserTier({
	userId,
	tier,
	expiresAt,
	reason,
}: {
	userId: string;
	tier: "free" | "scholar" | "guru";
	expiresAt: string | null;
	reason: string;
}) {
	const userRef = adminDb.collection("users").doc(userId);
	const snapshot = await userRef.get();

	if (!snapshot.exists) {
		throw new Error("User not found.");
	}

	const expiresAtTimestamp = expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null;

	await userRef.set(
		{
			tier,
			tierOverrideReason: reason,
			tierOverrideExpiresAt: expiresAtTimestamp,
			tierOverrideUpdatedAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);
	await createUserNotification({
		userId,
		title: "Tier updated",
		body: `Your account tier is now ${tier}.`,
		kind: "billing",
		href: "/billing",
	});
	await writeAdminAudit({
		action: "override_tier",
		target: `users/${userId}`,
		details: `${tier}${expiresAt ? ` until ${expiresAt}` : ""}: ${reason}`,
	});

	return { tier };
}

export async function setUserSuspension({
	userId,
	action,
	reason,
}: {
	userId: string;
	action: "suspend" | "unsuspend";
	reason: string;
}) {
	const userRef = adminDb.collection("users").doc(userId);
	const snapshot = await userRef.get();

	if (!snapshot.exists) {
		throw new Error("User not found.");
	}

	const now = Timestamp.now();

	if (action === "suspend") {
		await userRef.set(
			{
				accountStatus: "suspended",
				suspended: true,
				suspendedAt: now,
				suspendedBy: "agent",
				suspensionReason: reason,
				suspensionHistory: FieldValue.arrayUnion({
					action: "suspend",
					reason,
					by: "agent",
					at: now,
				}),
				updatedAt: now,
			},
			{ merge: true },
		);
		await createUserNotification({
			userId,
			title: "Account suspended",
			body: "You can still view your library, but new exam generation is paused while this is reviewed.",
			kind: "account",
			href: "/support",
		});
		await writeAdminAudit({
			action: "suspend_user",
			target: `users/${userId}`,
			details: reason,
		});

		return { accountStatus: "suspended" };
	}

	await userRef.set(
		{
			accountStatus: "clean",
			suspended: false,
			suspendedAt: FieldValue.delete(),
			suspendedBy: FieldValue.delete(),
			suspensionReason: FieldValue.delete(),
			unsuspendedAt: now,
			unsuspendedBy: "agent",
			unsuspensionReason: reason,
			suspensionHistory: FieldValue.arrayUnion({
				action: "unsuspend",
				reason,
				by: "agent",
				at: now,
			}),
			updatedAt: now,
		},
		{ merge: true },
	);
	await createUserNotification({
		userId,
		title: "Account reinstated",
		body: "You can generate exams again.",
		kind: "account",
		href: "/exams/new",
	});
	await writeAdminAudit({
		action: "unsuspend_user",
		target: `users/${userId}`,
		details: reason,
	});

	return { accountStatus: "clean" };
}

export async function forceRegenerateExam({
	userId,
	examId,
	reason,
}: {
	userId: string;
	examId: string;
	reason: string;
}) {
	const examRef = adminDb.collection("users").doc(userId).collection("exams").doc(examId);
	const snapshot = await examRef.get();

	if (!snapshot.exists) {
		throw new Error("Exam not found.");
	}

	const status = text(snapshot.get("status"), "queued");
	if (status === "generating" || status === "qa_in_progress") {
		throw new Error("This exam is already generating.");
	}

	const now = Timestamp.now();
	const queueResult = await enqueueWorkerTask({
		route: "/api/workers/generate-exam",
		payload: { userId, examId },
	});

	await examRef.set(
		{
			status: "queued",
			adminRegenerationCount: FieldValue.increment(1),
			adminRegenerationRequestedAt: now,
			adminRegenerationReason: reason,
			adminRegenerationPreviousStatus: status,
			adminRegenerationQueueWarning: queueResult.queued ? null : queueResult.reason,
			creditsReserved: 0,
			failureReason: FieldValue.delete(),
			queueWarning: queueResult.queued ? FieldValue.delete() : queueResult.reason,
			updatedAt: now,
		},
		{ merge: true },
	);
	await createUserNotification({
		userId,
		title: "Exam repair started",
		body: "An operator queued a no-cost regeneration for one of your exams.",
		kind: "exam",
		href: `/exams/${examId}`,
	});
	await writeAdminAudit({
		action: "force_regenerate_exam",
		target: `users/${userId}/exams/${examId}`,
		details: reason,
	});

	return { examId, queueResult };
}

export async function updateTriageStatus({
	collectionName,
	itemId,
	status,
	note,
}: {
	collectionName: "feedback" | "abuseReports";
	itemId: string;
	status: "open" | "reviewing" | "resolved" | "dismissed";
	note?: string;
}) {
	await adminDb
		.collection(collectionName)
		.doc(itemId)
		.set(
			{
				status,
				operatorNote: note ?? null,
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	await writeAdminAudit({
		action: "triage_update",
		target: `${collectionName}/${itemId}`,
		details: `${status}${note ? `: ${note}` : ""}`,
	});

	return { updated: true };
}
