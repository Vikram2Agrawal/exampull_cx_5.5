import { appendAdminAudit } from "@/lib/admin/audit";
import { stripeClient } from "@/lib/billing/stripe";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { createUserNotification } from "@/lib/user/data";
import { notificationChannelEnabled } from "@/lib/user/notification-preferences";

export type RefundSourceCollection = "feedback" | "abuseReports";
export type RefundAction = "approve" | "decline" | "escalate" | "submit_evidence";

export type AdminRefundRequestRow = {
	id: string;
	sourceCollection: RefundSourceCollection;
	sourceId: string;
	kind: string;
	status: string;
	userId: string | null;
	email: string | null;
	examId: string | null;
	title: string;
	reason: string;
	requestedCredits: number;
	refundHistoryCount: number;
	createdAt: string;
};

export type AdminRefundHistoryRow = {
	id: string;
	userId: string;
	email: string | null;
	sourceCollection: RefundSourceCollection;
	sourceId: string;
	status: string;
	refundType: string;
	creditAmount: number;
	cashAmountCents: number;
	cashStatus: string;
	note: string;
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

function text(value: unknown, fallback = "") {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableText(value: unknown) {
	return typeof value === "string" && value.trim() ? value : null;
}

function refundRequestId(sourceCollection: RefundSourceCollection, sourceId: string) {
	return `${sourceCollection}:${sourceId}`;
}

async function userSnapshotFor(userId: string | null) {
	return userId ? adminDb.collection("users").doc(userId).get() : null;
}

export async function listAdminRefundRequests(limit = 100): Promise<AdminRefundRequestRow[]> {
	const [feedback, abuseReports, refundHistory] = await Promise.all([
		adminDb.collection("feedback").orderBy("createdAt", "desc").limit(limit).get(),
		adminDb.collection("abuseReports").orderBy("createdAt", "desc").limit(limit).get(),
		adminDb.collection("refunds").orderBy("createdAt", "desc").limit(500).get(),
	]);
	const historyCounts = new Map<string, number>();

	for (const refund of refundHistory.docs) {
		const userId = nullableText(refund.get("userId"));
		if (!userId) {
			continue;
		}

		historyCounts.set(userId, (historyCounts.get(userId) ?? 0) + 1);
	}

	const sourceDocs = [
		...feedback.docs
			.filter((doc) => doc.get("kind") === "refund")
			.map((doc) => ({ sourceCollection: "feedback" as const, doc })),
		...abuseReports.docs
			.filter((doc) => text(doc.get("kind"), "exam_report") === "exam_report")
			.map((doc) => ({ sourceCollection: "abuseReports" as const, doc })),
	].filter(({ doc }) => {
		const status = text(doc.get("status"), "open");
		return status === "open" || status === "reviewing" || status === "escalated";
	});
	const rows = await Promise.all(
		sourceDocs.map(async ({ sourceCollection, doc }) => {
			const userId = nullableText(doc.get("userId"));
			const user = await userSnapshotFor(userId);
			const email = nullableText(doc.get("email")) ?? nullableText(user?.get("email"));
			const title = text(doc.get("title"), text(doc.get("examId"), "Refund request"));

			return {
				id: refundRequestId(sourceCollection, doc.id),
				sourceCollection,
				sourceId: doc.id,
				kind: text(
					doc.get("kind"),
					sourceCollection === "feedback" ? "refund" : "exam_report",
				),
				status: text(doc.get("status"), "open"),
				userId,
				email,
				examId: nullableText(doc.get("examId")),
				title,
				reason: text(doc.get("body"), text(doc.get("reason"), "No reason provided.")),
				requestedCredits: Number(doc.get("creditsRefundedAmount") ?? 0),
				refundHistoryCount: userId ? (historyCounts.get(userId) ?? 0) : 0,
				createdAt: isoDate(doc.get("createdAt")),
			};
		}),
	);

	return rows
		.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
		.slice(0, limit);
}

export async function listAdminRefundHistory(limit = 100): Promise<AdminRefundHistoryRow[]> {
	const snapshot = await adminDb
		.collection("refunds")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		userId: text(doc.get("userId"), "unknown"),
		email: nullableText(doc.get("email")),
		sourceCollection:
			doc.get("sourceCollection") === "abuseReports" ? "abuseReports" : "feedback",
		sourceId: text(doc.get("sourceId"), "unknown"),
		status: text(doc.get("status"), "approved"),
		refundType: text(doc.get("refundType"), "credit"),
		creditAmount: Number(doc.get("creditAmount") ?? 0),
		cashAmountCents: Number(doc.get("cashAmountCents") ?? 0),
		cashStatus: text(doc.get("cashStatus"), "not_requested"),
		note: text(doc.get("note"), ""),
		createdAt: isoDate(doc.get("createdAt")),
	}));
}

async function maybeIssueStripeRefund({
	userIsTest,
	stripeChargeId,
	cashAmountCents,
	refundId,
}: {
	userIsTest: boolean;
	stripeChargeId: string | null;
	cashAmountCents: number;
	refundId: string;
}) {
	if (cashAmountCents <= 0) {
		return { cashStatus: "not_requested", stripeRefundId: null };
	}

	if (userIsTest) {
		return { cashStatus: "skipped_test", stripeRefundId: null };
	}

	if (!stripeChargeId) {
		return { cashStatus: "manual_charge_required", stripeRefundId: null };
	}

	const refund = await stripeClient().refunds.create(
		{
			charge: stripeChargeId,
			amount: cashAmountCents,
			reason: "requested_by_customer",
			metadata: { adminRefundId: refundId },
		},
		{ idempotencyKey: `admin-refund-${refundId}` },
	);

	return { cashStatus: refund.status ?? "submitted", stripeRefundId: refund.id };
}

async function recordRefundEmail({
	userId,
	email,
	userIsTest,
	notificationPreferences,
	subject,
	body,
}: {
	userId: string;
	email: string | null;
	userIsTest: boolean;
	notificationPreferences: unknown;
	subject: string;
	body: string;
}) {
	const emailEnabled = notificationChannelEnabled({
		preferences: notificationPreferences,
		eventType: "payment_receipt",
		channel: "email",
	});
	const result = await sendTransactionalEmail({
		to: email,
		subject,
		text: body,
		testMode: userIsTest,
		enabled: emailEnabled,
	});

	await adminDb.collection("communications").add({
		kind: "refund",
		channel: "email",
		subject,
		body,
		status: result.status,
		userId,
		email,
		phoneNumber: null,
		providerId: result.providerId,
		errorMessage: null,
		source: "admin_refund",
		visibility: "private",
		isTestData: userIsTest,
		createdAt: Timestamp.now(),
	});
}

export async function processAdminRefundAction({
	sourceCollection,
	sourceId,
	action,
	creditAmount,
	cashAmountCents,
	stripeChargeId,
	note,
	disputeEvidence,
}: {
	sourceCollection: RefundSourceCollection;
	sourceId: string;
	action: RefundAction;
	creditAmount: number;
	cashAmountCents: number;
	stripeChargeId: string | null;
	note: string;
	disputeEvidence: string | null;
}) {
	const sourceRef = adminDb.collection(sourceCollection).doc(sourceId);
	const sourceSnapshot = await sourceRef.get();

	if (!sourceSnapshot.exists) {
		throw new Error("Refund request not found.");
	}

	const sourceStatus = text(sourceSnapshot.get("status"), "open");
	if (
		sourceStatus === "resolved" ||
		sourceStatus === "dismissed" ||
		sourceStatus === "approved"
	) {
		throw new Error("Refund request is already closed.");
	}

	if (action !== "approve") {
		const status =
			action === "decline" ? "dismissed" : action === "escalate" ? "escalated" : "reviewing";
		await sourceRef.set(
			{
				status,
				operatorNote: note,
				disputeEvidence: action === "submit_evidence" ? disputeEvidence : null,
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
		await appendAdminAudit({
			action: `refund_${action}`,
			target: `${sourceCollection}/${sourceId}`,
			details: note,
		});

		return { status, refundId: null };
	}

	if (creditAmount <= 0 && cashAmountCents <= 0) {
		throw new Error("Approval requires a credit or cash refund amount.");
	}

	const userId = nullableText(sourceSnapshot.get("userId"));

	if (!userId) {
		throw new Error("Refund approval requires a linked user.");
	}

	const userRef = adminDb.collection("users").doc(userId);
	const userSnapshot = await userRef.get();

	if (!userSnapshot.exists) {
		throw new Error("Refund user not found.");
	}

	const refundId = `${sourceCollection}_${sourceId}`;
	const userIsTest = userSnapshot.get("isTestAccount") === true;
	const email =
		nullableText(sourceSnapshot.get("email")) ?? nullableText(userSnapshot.get("email"));
	const cashResult = await maybeIssueStripeRefund({
		userIsTest,
		stripeChargeId,
		cashAmountCents,
		refundId,
	});
	const now = Timestamp.now();
	const refundType =
		creditAmount > 0 && cashAmountCents > 0
			? "combination"
			: cashAmountCents > 0
				? "cash"
				: "credit";

	await adminDb.runTransaction(async (transaction) => {
		const refundRef = adminDb.collection("refunds").doc(refundId);
		const existingRefund = await transaction.get(refundRef);

		if (existingRefund.exists) {
			throw new Error("Refund request is already approved.");
		}

		transaction.set(refundRef, {
			userId,
			email,
			sourceCollection,
			sourceId,
			examId: nullableText(sourceSnapshot.get("examId")),
			status: "approved",
			refundType,
			creditAmount,
			cashAmountCents,
			cashStatus: cashResult.cashStatus,
			stripeChargeId,
			stripeRefundId: cashResult.stripeRefundId,
			note,
			isTestData: userIsTest,
			createdAt: now,
			updatedAt: now,
		});
		transaction.set(
			userRef,
			{
				credits: FieldValue.increment(creditAmount),
				totalCreditsRefunded: FieldValue.increment(creditAmount),
				updatedAt: now,
			},
			{ merge: true },
		);
		transaction.set(
			userRef.collection("creditLedger").doc(refundId),
			{
				type: "admin_refund",
				credits: creditAmount,
				sourceCollection,
				sourceId,
				note,
				createdAt: now,
			},
			{ merge: true },
		);
		transaction.set(
			sourceRef,
			{
				status: "resolved",
				refundStatus: "approved",
				refundId,
				operatorNote: note,
				creditAmount,
				cashAmountCents,
				cashStatus: cashResult.cashStatus,
				updatedAt: now,
			},
			{ merge: true },
		);
	});

	const cashDollars = (cashAmountCents / 100).toFixed(2);
	const summary =
		cashAmountCents > 0 && creditAmount > 0
			? `${creditAmount.toString()} credits and $${cashDollars}`
			: cashAmountCents > 0
				? `$${cashDollars}`
				: `${creditAmount.toString()} credits`;
	await createUserNotification({
		userId,
		title: "Refund approved",
		body: `Your refund for ${summary} has been recorded.`,
		kind: "billing",
		href: "/billing",
	});
	await recordRefundEmail({
		userId,
		email,
		userIsTest,
		notificationPreferences: userSnapshot.get("notificationPreferences"),
		subject: "Your ExamPull refund is confirmed",
		body: `Your refund for ${summary} has been recorded.\n\nReason: ${note}`,
	});
	await appendAdminAudit({
		action: "refund_approved",
		target: `${sourceCollection}/${sourceId}`,
		details: `${summary}: ${note}`,
	});

	return { status: "approved", refundId };
}
