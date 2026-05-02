import { type EmailStatus, sendTransactionalEmail } from "@/lib/email/transactional";
import { publicBaseUrl } from "@/lib/env";
import { startShareAnswerKeyDowngradeGrace } from "@/lib/exams/library";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import type { Tier } from "@/lib/product/constants";
import { type SmsStatus, sendTransactionalSms } from "@/lib/sms/transactional";
import { createUserNotification } from "@/lib/user/data";

const paymentFailureGraceMs = 14 * 24 * 60 * 60 * 1000;
const paymentFailureReminderMs = 3 * 24 * 60 * 60 * 1000;
const maxPaymentFailureReminderCount = 5;

type CommunicationResult<TStatus extends string> = {
	status: TStatus;
	providerId: string | null;
	errorMessage?: string;
};

function timestampMillis(value: unknown) {
	return value instanceof Timestamp ? value.toMillis() : null;
}

function stringField(snapshot: FirebaseFirestore.DocumentSnapshot, field: string) {
	const value = snapshot.get(field);

	return typeof value === "string" && value.trim() ? value : null;
}

function boolField(snapshot: FirebaseFirestore.DocumentSnapshot, field: string) {
	return snapshot.get(field) === true;
}

function paymentFailureBody({ tier, graceUntil }: { tier: Tier; graceUntil: Date }) {
	return `We could not renew your ${tier} subscription. Your paid ExamPull features stay active until ${graceUntil.toISOString()}, but new subscription credit grants are paused until payment succeeds.\n\nUpdate your payment method here: ${publicBaseUrl()}/billing\n\nIf payment is not resolved by that deadline, your account will move to Free. Existing generated exams and purchased credit packs stay available.`;
}

function paymentFailureSms({ tier, graceUntil }: { tier: Tier; graceUntil: Date }) {
	return `ExamPull: your ${tier} payment needs attention. Paid access stays active until ${graceUntil.toISOString()}. Update payment: ${publicBaseUrl()}/billing`;
}

function paymentGraceExpiredBody({ tier }: { tier: Tier }) {
	return `Your ${tier} payment grace period ended without a successful renewal, so your account has moved to Free.\n\nExisting generated exams and purchased credit packs remain available. You can restore paid features from ${publicBaseUrl()}/billing.`;
}

async function sendEmail({
	to,
	subject,
	body,
	testMode,
}: {
	to: string | null;
	subject: string;
	body: string;
	testMode: boolean;
}): Promise<CommunicationResult<EmailStatus>> {
	try {
		return await sendTransactionalEmail({
			to,
			subject,
			text: body,
			testMode,
		});
	} catch (error) {
		return {
			status: "failed",
			providerId: null,
			errorMessage: error instanceof Error ? error.message : "Email send failed.",
		};
	}
}

async function sendSms({
	to,
	body,
	testMode,
}: {
	to: string | null;
	body: string;
	testMode: boolean;
}): Promise<CommunicationResult<SmsStatus>> {
	try {
		return await sendTransactionalSms({ to, body, testMode });
	} catch (error) {
		return {
			status: "failed",
			providerId: null,
			errorMessage: error instanceof Error ? error.message : "SMS send failed.",
		};
	}
}

async function recordCommunication({
	userId,
	email,
	phoneNumber,
	kind,
	subject,
	body,
	smsBody,
	emailResult,
	smsResult,
	graceUntil,
	noticeKey,
	isTestData,
}: {
	userId: string;
	email: string | null;
	phoneNumber: string | null;
	kind: "payment_failure" | "payment_failure_grace_expired";
	subject: string;
	body: string;
	smsBody: string;
	emailResult: CommunicationResult<EmailStatus>;
	smsResult: CommunicationResult<SmsStatus>;
	graceUntil: Date | null;
	noticeKey: string;
	isTestData: boolean;
}) {
	const now = Timestamp.now();
	await Promise.all([
		adminDb.collection("communications").add({
			userId,
			email,
			phoneNumber,
			kind,
			channel: "email",
			subject,
			body,
			status: emailResult.status,
			providerId: emailResult.providerId,
			errorMessage: emailResult.errorMessage ?? null,
			graceUntil: graceUntil ? Timestamp.fromDate(graceUntil) : null,
			noticeKey,
			isTestData,
			createdAt: now,
			updatedAt: now,
		}),
		adminDb.collection("communications").add({
			userId,
			email,
			phoneNumber,
			kind,
			channel: "sms",
			subject: null,
			body: smsBody,
			status: smsResult.status,
			providerId: smsResult.providerId,
			errorMessage: smsResult.errorMessage ?? null,
			graceUntil: graceUntil ? Timestamp.fromDate(graceUntil) : null,
			noticeKey,
			isTestData,
			createdAt: now,
			updatedAt: now,
		}),
	]);
}

async function notifyPaymentFailure({
	userId,
	userSnapshot,
	tier,
	graceUntil,
	noticeKey,
	title,
	body,
	notificationBody,
	kind,
}: {
	userId: string;
	userSnapshot: FirebaseFirestore.DocumentSnapshot;
	tier: Tier;
	graceUntil: Date | null;
	noticeKey: string;
	title: string;
	body: string;
	notificationBody: string;
	kind: "payment_failure" | "payment_failure_grace_expired";
}) {
	const email = stringField(userSnapshot, "email");
	const phoneNumber = stringField(userSnapshot, "phoneNumber");
	const isTestData = boolField(userSnapshot, "isTestAccount");
	const smsBody =
		kind === "payment_failure" && graceUntil
			? paymentFailureSms({ tier, graceUntil })
			: `ExamPull: your ${tier} payment grace period ended. Your account is now Free. Restore paid features: ${publicBaseUrl()}/billing`;
	const [emailResult, smsResult] = await Promise.all([
		sendEmail({ to: email, subject: title, body, testMode: isTestData }),
		sendSms({ to: phoneNumber, body: smsBody, testMode: isTestData }),
	]);

	await Promise.all([
		createUserNotification({
			userId,
			title,
			body: notificationBody,
			kind: "billing",
			href: "/billing",
		}),
		recordCommunication({
			userId,
			email,
			phoneNumber,
			kind,
			subject: title,
			body,
			smsBody,
			emailResult,
			smsResult,
			graceUntil,
			noticeKey,
			isTestData,
		}),
	]);
}

function graceNoticeKey({
	subscriptionId,
	invoiceId,
}: {
	subscriptionId: string;
	invoiceId: string | null;
}) {
	return `payment_failure:${subscriptionId}:${invoiceId ?? "subscription"}`;
}

export async function startPaymentFailureGrace({
	userId,
	tier,
	subscriptionId,
	invoiceId = null,
}: {
	userId: string;
	tier: Tier;
	subscriptionId: string;
	invoiceId?: string | null;
}) {
	const userRef = adminDb.collection("users").doc(userId);
	const userSnapshot = await userRef.get();

	if (!userSnapshot.exists) {
		return { started: false, expired: false, notified: false };
	}

	const now = Date.now();
	const existingGraceUntil = timestampMillis(userSnapshot.get("paymentFailureGraceUntil"));
	const existingStartedAt = timestampMillis(userSnapshot.get("paymentFailureGraceStartedAt"));

	if (existingGraceUntil !== null && existingGraceUntil <= now) {
		const expired = await expirePaymentFailureGraceForUser({
			userId,
			userSnapshot,
			tier,
			noticeKey: `payment_failure_expired:${subscriptionId}`,
		});
		return { started: false, expired, notified: false };
	}

	const noticeKey = graceNoticeKey({ subscriptionId, invoiceId });
	const previousNoticeKey = userSnapshot.get("paymentFailureGraceNoticeKey");
	const graceUntilMillis = existingGraceUntil ?? now + paymentFailureGraceMs;
	const graceStartedAtMillis = existingStartedAt ?? now;
	const graceUntil = new Date(graceUntilMillis);
	const shouldNotify = previousNoticeKey !== noticeKey;

	await userRef.set(
		{
			tier,
			subscriptionStatus: "grace_period",
			stripeSubscriptionId: subscriptionId,
			stripeSubscriptionPaymentStatus: "past_due",
			paymentFailureGraceStartedAt: Timestamp.fromMillis(graceStartedAtMillis),
			paymentFailureGraceUntil: Timestamp.fromMillis(graceUntilMillis),
			paymentFailureGraceNoticeKey: noticeKey,
			...(shouldNotify
				? {
						paymentFailureLastReminderAt: Timestamp.now(),
						paymentFailureLastReminderNoticeKey: noticeKey,
						paymentFailureReminderCount: FieldValue.increment(1),
					}
				: {}),
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);

	if (shouldNotify) {
		const body = paymentFailureBody({ tier, graceUntil });
		await notifyPaymentFailure({
			userId,
			userSnapshot,
			tier,
			graceUntil,
			noticeKey,
			title: "Payment issue - grace period started",
			body,
			notificationBody: `Your ${tier} access stays active for 14 days while you update payment.`,
			kind: "payment_failure",
		});
	}

	return { started: true, expired: false, notified: shouldNotify };
}

export async function resolvePaymentFailureGrace({
	userId,
	tier,
	subscriptionId,
}: {
	userId: string;
	tier: Tier;
	subscriptionId?: string | null;
}) {
	await adminDb
		.collection("users")
		.doc(userId)
		.set(
			{
				tier,
				subscriptionStatus: "active",
				...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
				stripeSubscriptionPaymentStatus: FieldValue.delete(),
				paymentFailureGraceStartedAt: FieldValue.delete(),
				paymentFailureGraceUntil: FieldValue.delete(),
				paymentFailureGraceNoticeKey: FieldValue.delete(),
				paymentFailureLastReminderAt: FieldValue.delete(),
				paymentFailureLastReminderNoticeKey: FieldValue.delete(),
				paymentFailureReminderCount: FieldValue.delete(),
				paymentFailureDowngradedAt: FieldValue.delete(),
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
}

async function expirePaymentFailureGraceForUser({
	userId,
	userSnapshot,
	tier,
	noticeKey,
}: {
	userId: string;
	userSnapshot: FirebaseFirestore.DocumentSnapshot;
	tier: Tier;
	noticeKey: string;
}) {
	const previousTier = userSnapshot.get("tier");

	if (previousTier !== "scholar" && previousTier !== "guru") {
		return false;
	}

	const alreadyDowngradedAt = timestampMillis(userSnapshot.get("paymentFailureDowngradedAt"));
	if (alreadyDowngradedAt !== null) {
		return false;
	}

	await adminDb.collection("users").doc(userId).set(
		{
			tier: "free",
			subscriptionStatus: "past_due",
			paymentFailureDowngradedAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);
	await startShareAnswerKeyDowngradeGrace({
		userId,
		noticeKey,
	});
	await notifyPaymentFailure({
		userId,
		userSnapshot,
		tier,
		graceUntil: null,
		noticeKey,
		title: "Payment grace expired",
		body: paymentGraceExpiredBody({ tier }),
		notificationBody: `Your ${tier} grace period ended, so your account moved to Free.`,
		kind: "payment_failure_grace_expired",
	});

	return true;
}

async function maybeSendReminder({
	userId,
	userSnapshot,
	now,
}: {
	userId: string;
	userSnapshot: FirebaseFirestore.DocumentSnapshot;
	now: number;
}) {
	const tier = userSnapshot.get("tier");
	if (tier !== "scholar" && tier !== "guru") {
		return false;
	}

	const graceUntilMillis = timestampMillis(userSnapshot.get("paymentFailureGraceUntil"));
	if (graceUntilMillis === null || graceUntilMillis <= now) {
		return false;
	}

	const reminderCount = Number(userSnapshot.get("paymentFailureReminderCount") ?? 0);
	if (reminderCount >= maxPaymentFailureReminderCount) {
		return false;
	}

	const lastReminderAt = timestampMillis(userSnapshot.get("paymentFailureLastReminderAt"));
	if (lastReminderAt !== null && lastReminderAt + paymentFailureReminderMs > now) {
		return false;
	}

	const graceStartedAt =
		timestampMillis(userSnapshot.get("paymentFailureGraceStartedAt")) ??
		graceUntilMillis - paymentFailureGraceMs;
	const reminderIndex = Math.floor((now - graceStartedAt) / paymentFailureReminderMs);
	const noticeKey = `payment_failure_reminder:${userSnapshot.id}:${reminderIndex}`;

	if (userSnapshot.get("paymentFailureLastReminderNoticeKey") === noticeKey) {
		return false;
	}

	await adminDb
		.collection("users")
		.doc(userId)
		.set(
			{
				paymentFailureLastReminderAt: Timestamp.now(),
				paymentFailureLastReminderNoticeKey: noticeKey,
				paymentFailureReminderCount: FieldValue.increment(1),
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	const graceUntil = new Date(graceUntilMillis);
	await notifyPaymentFailure({
		userId,
		userSnapshot,
		tier,
		graceUntil,
		noticeKey,
		title: "Payment issue reminder",
		body: paymentFailureBody({ tier, graceUntil }),
		notificationBody: `Your ${tier} payment still needs attention before ${graceUntil.toISOString()}.`,
		kind: "payment_failure",
	});

	return true;
}

export async function processPaymentFailureGracePeriods({ limit }: { limit: number }) {
	const now = Date.now();
	const snapshot = await adminDb
		.collection("users")
		.where("subscriptionStatus", "==", "grace_period")
		.limit(limit)
		.get();
	let expired = 0;
	let reminded = 0;

	for (const userSnapshot of snapshot.docs) {
		const graceUntil = timestampMillis(userSnapshot.get("paymentFailureGraceUntil"));
		const tier = userSnapshot.get("tier");

		if (graceUntil !== null && graceUntil <= now && (tier === "scholar" || tier === "guru")) {
			const didExpire = await expirePaymentFailureGraceForUser({
				userId: userSnapshot.id,
				userSnapshot,
				tier,
				noticeKey: `payment_failure_expired:${userSnapshot.id}`,
			});
			if (didExpire) {
				expired += 1;
			}
			continue;
		}

		if (await maybeSendReminder({ userId: userSnapshot.id, userSnapshot, now })) {
			reminded += 1;
		}
	}

	return { scanned: snapshot.size, expired, reminded };
}
