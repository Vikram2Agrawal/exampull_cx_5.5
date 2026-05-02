import { createHash } from "node:crypto";
import { publicBaseUrl } from "@/lib/env";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { TIER_MONTHLY_CREDITS, type Tier } from "@/lib/product/constants";
import { referralSuspicionReasons, referralVelocityWindowMs } from "@/lib/referrals/policy";
import { createUserNotification } from "@/lib/user/data";

const referralWindowMs = 30 * 24 * 60 * 60 * 1000;

export type ReferralOverrideAction =
	| "mark_reviewed"
	| "flag"
	| "grant_scholar"
	| "grant_guru"
	| "revoke_scholar"
	| "revoke_guru";

function accessUntil(value: unknown, now: number) {
	if (value instanceof Timestamp) {
		return Math.max(value.toMillis(), now);
	}

	return now;
}

function accessUntilAfterSubtract(value: unknown, now: number) {
	if (value instanceof Timestamp) {
		return Math.max(now, value.toMillis() - referralWindowMs);
	}

	return now;
}

function numberField(snapshot: FirebaseFirestore.DocumentSnapshot, field: string) {
	return Number(snapshot.get(field) ?? 0);
}

function hasActivePaidSubscription(snapshot: FirebaseFirestore.DocumentSnapshot) {
	const subscriptionStatus = snapshot.get("subscriptionStatus");
	return subscriptionStatus === "active" || subscriptionStatus === "trialing";
}

function referralReviewPending(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
	return snapshot.get("reviewStatus") === "pending";
}

export function referralCodeForUser(userId: string) {
	return createHash("sha256").update(`exampull:${userId}`).digest("base64url").slice(0, 12);
}

export function referralUrl(code: string) {
	return `${publicBaseUrl()}/sign-up?ref=${encodeURIComponent(code)}`;
}

export async function ensureReferralCode(userId: string) {
	const userRef = adminDb.collection("users").doc(userId);
	const snapshot = await userRef.get();
	const existing = snapshot.get("referralCode");

	if (typeof existing === "string" && existing) {
		return existing;
	}

	const code = referralCodeForUser(userId);
	await userRef.set({ referralCode: code, updatedAt: Timestamp.now() }, { merge: true });

	return code;
}

export async function createReferralSignup({
	referralCode,
	referredUserId,
	isTestData,
}: {
	referralCode?: string | null;
	referredUserId: string;
	isTestData: boolean;
}) {
	const code = referralCode?.trim();
	if (!code) {
		return null;
	}

	const referrerSnapshot = await adminDb
		.collection("users")
		.where("referralCode", "==", code)
		.limit(1)
		.get();
	const referrer = referrerSnapshot.docs[0];

	if (!referrer || referrer.id === referredUserId) {
		return null;
	}

	const referralId = `${referrer.id}_${referredUserId}`;
	const referralRef = adminDb.collection("referrals").doc(referralId);
	const referralSnapshot = await referralRef.get();

	if (referralSnapshot.exists) {
		return referralId;
	}

	const now = Timestamp.now();
	const recentCutoff = now.toMillis() - referralVelocityWindowMs;
	const [referredSnapshot, recentReferrals] = await Promise.all([
		adminDb.collection("users").doc(referredUserId).get(),
		adminDb.collection("referrals").where("referrerUserId", "==", referrer.id).limit(20).get(),
	]);
	const recentReferralCount = recentReferrals.docs.filter((doc) => {
		const createdAt = doc.get("createdAt");
		return createdAt instanceof Timestamp && createdAt.toMillis() >= recentCutoff;
	}).length;
	const suspiciousReasons = referralSuspicionReasons({
		referrerEmail: referrer.get("email"),
		referredEmail: referredSnapshot.get("email"),
		referrerPhoneNumber: referrer.get("phoneNumber"),
		referredPhoneNumber: referredSnapshot.get("phoneNumber"),
		recentReferralCount,
	});
	const reviewStatus = suspiciousReasons.length > 0 ? "pending" : "none";

	await referralRef.create({
		referrerUserId: referrer.id,
		referredUserId,
		referralCode: code,
		status: reviewStatus === "pending" ? "signed_up_review" : "signed_up",
		creditsGranted: 0,
		scholarMonthsGranted: 0,
		guruMonthsGranted: 0,
		suspicious: reviewStatus === "pending",
		suspiciousReasons,
		reviewStatus,
		isTestData,
		createdAt: now,
		updatedAt: now,
	});
	await adminDb.collection("users").doc(referredUserId).set(
		{
			referredByUserId: referrer.id,
			referralCodeUsed: code,
			updatedAt: now,
		},
		{ merge: true },
	);
	await createUserNotification({
		userId: referrer.id,
		title: reviewStatus === "pending" ? "Referral under review" : "Referral signed up",
		body:
			reviewStatus === "pending"
				? "A referral joined from a pattern that needs operator review before rewards unlock."
				: "A friend joined from your referral link. Rewards unlock after they generate an exam.",
		kind: "referral",
		href: "/settings",
	});

	return referralId;
}

export async function applyReferralExamReward(referredUserId: string) {
	const snapshot = await adminDb
		.collection("referrals")
		.where("referredUserId", "==", referredUserId)
		.limit(1)
		.get();
	const referral = snapshot.docs[0];

	if (!referral || referral.get("examRewardedAt") || referralReviewPending(referral)) {
		return false;
	}

	const referrerUserId = referral.get("referrerUserId");
	if (typeof referrerUserId !== "string") {
		return false;
	}

	const now = Date.now();
	const referrerRef = adminDb.collection("users").doc(referrerUserId);
	await adminDb.runTransaction(async (transaction) => {
		const [referralSnapshot, referrerSnapshot] = await Promise.all([
			transaction.get(referral.ref),
			transaction.get(referrerRef),
		]);

		if (
			referralSnapshot.get("examRewardedAt") ||
			referralSnapshot.get("reviewStatus") === "pending"
		) {
			return;
		}

		transaction.update(referral.ref, {
			status: "exam_completed",
			examRewardedAt: Timestamp.fromMillis(now),
			scholarMonthsGranted: FieldValue.increment(1),
			creditsGranted: FieldValue.increment(TIER_MONTHLY_CREDITS.scholar),
			updatedAt: Timestamp.fromMillis(now),
		});
		transaction.set(
			referrerRef,
			{
				tier: referrerSnapshot.get("tier") === "guru" ? "guru" : "scholar",
				credits:
					Number(referrerSnapshot.get("credits") ?? 0) + TIER_MONTHLY_CREDITS.scholar,
				referralScholarMonthsEarned: FieldValue.increment(1),
				referralScholarAccessUntil: Timestamp.fromMillis(
					accessUntil(referrerSnapshot.get("referralScholarAccessUntil"), now) +
						referralWindowMs,
				),
				updatedAt: Timestamp.fromMillis(now),
			},
			{ merge: true },
		);
	});
	await createUserNotification({
		userId: referrerUserId,
		title: "Referral reward earned",
		body: "A referred friend generated an exam. One Scholar month has been added.",
		kind: "referral",
		href: "/settings",
	});

	return true;
}

export async function applyReferralPaidReward(referredUserId: string, tier: Tier) {
	if (tier === "free") {
		return false;
	}

	const snapshot = await adminDb
		.collection("referrals")
		.where("referredUserId", "==", referredUserId)
		.limit(1)
		.get();
	const referral = snapshot.docs[0];

	if (!referral || referral.get("paidRewardedAt") || referralReviewPending(referral)) {
		return false;
	}

	const referrerUserId = referral.get("referrerUserId");
	if (typeof referrerUserId !== "string") {
		return false;
	}

	const now = Date.now();
	const referrerRef = adminDb.collection("users").doc(referrerUserId);
	await adminDb.runTransaction(async (transaction) => {
		const [referralSnapshot, referrerSnapshot] = await Promise.all([
			transaction.get(referral.ref),
			transaction.get(referrerRef),
		]);

		if (
			referralSnapshot.get("paidRewardedAt") ||
			referralSnapshot.get("reviewStatus") === "pending"
		) {
			return;
		}

		transaction.update(referral.ref, {
			status: "paid_converted",
			paidRewardedAt: Timestamp.fromMillis(now),
			guruMonthsGranted: FieldValue.increment(1),
			creditsGranted: FieldValue.increment(TIER_MONTHLY_CREDITS.guru),
			updatedAt: Timestamp.fromMillis(now),
		});
		transaction.set(
			referrerRef,
			{
				tier: "guru",
				credits: Number(referrerSnapshot.get("credits") ?? 0) + TIER_MONTHLY_CREDITS.guru,
				referralGuruMonthsEarned: FieldValue.increment(1),
				referralGuruAccessUntil: Timestamp.fromMillis(
					accessUntil(referrerSnapshot.get("referralGuruAccessUntil"), now) +
						referralWindowMs,
				),
				updatedAt: Timestamp.fromMillis(now),
			},
			{ merge: true },
		);
	});
	await createUserNotification({
		userId: referrerUserId,
		title: "Referral upgraded",
		body: "A referred friend upgraded. One Guru month has been added.",
		kind: "referral",
		href: "/settings",
	});

	return true;
}

export async function overrideReferralReward({
	referralId,
	action,
	reason,
}: {
	referralId: string;
	action: ReferralOverrideAction;
	reason: string;
}) {
	const referralRef = adminDb.collection("referrals").doc(referralId);
	const now = Timestamp.now();
	const result = await adminDb.runTransaction(async (transaction) => {
		const referralSnapshot = await transaction.get(referralRef);
		if (!referralSnapshot.exists) {
			throw new Error("Referral not found.");
		}

		const referrerUserId = referralSnapshot.get("referrerUserId");
		if (typeof referrerUserId !== "string" || !referrerUserId) {
			throw new Error("Referral is missing a referrer.");
		}

		const referrerRef = adminDb.collection("users").doc(referrerUserId);
		const referrerSnapshot = await transaction.get(referrerRef);
		if (!referrerSnapshot.exists) {
			throw new Error("Referrer not found.");
		}

		const referralUpdates: Record<string, unknown> = {
			manualOverrideAt: now,
			manualOverrideAction: action,
			manualOverrideReason: reason,
			updatedAt: now,
		};
		const userUpdates: Record<string, unknown> = { updatedAt: now };
		let notification: {
			title: string;
			body: string;
		} | null = null;

		if (action === "mark_reviewed") {
			referralUpdates.reviewStatus = "reviewed";
			referralUpdates.reviewedAt = now;
		}

		if (action === "flag") {
			referralUpdates.reviewStatus = "pending";
			referralUpdates.suspicious = true;
			referralUpdates.suspiciousReasons = FieldValue.arrayUnion("manual_flag");
			referralUpdates.status = "manual_review";
		}

		if (action === "grant_scholar") {
			referralUpdates.status =
				referralSnapshot.get("status") === "paid_converted"
					? "paid_converted"
					: "exam_completed";
			referralUpdates.reviewStatus = "reviewed";
			referralUpdates.reviewedAt = now;
			referralUpdates.scholarMonthsGranted = FieldValue.increment(1);
			referralUpdates.creditsGranted = FieldValue.increment(TIER_MONTHLY_CREDITS.scholar);
			referralUpdates.manualScholarGrants = FieldValue.increment(1);
			userUpdates.tier = referrerSnapshot.get("tier") === "guru" ? "guru" : "scholar";
			userUpdates.credits =
				numberField(referrerSnapshot, "credits") + TIER_MONTHLY_CREDITS.scholar;
			userUpdates.referralScholarMonthsEarned =
				numberField(referrerSnapshot, "referralScholarMonthsEarned") + 1;
			userUpdates.referralScholarAccessUntil = Timestamp.fromMillis(
				accessUntil(referrerSnapshot.get("referralScholarAccessUntil"), now.toMillis()) +
					referralWindowMs,
			);
			notification = {
				title: "Referral reward manually granted",
				body: "A Scholar referral reward was added after operator review.",
			};
		}

		if (action === "grant_guru") {
			referralUpdates.status = "paid_converted";
			referralUpdates.reviewStatus = "reviewed";
			referralUpdates.reviewedAt = now;
			referralUpdates.guruMonthsGranted = FieldValue.increment(1);
			referralUpdates.creditsGranted = FieldValue.increment(TIER_MONTHLY_CREDITS.guru);
			referralUpdates.manualGuruGrants = FieldValue.increment(1);
			userUpdates.tier = "guru";
			userUpdates.credits =
				numberField(referrerSnapshot, "credits") + TIER_MONTHLY_CREDITS.guru;
			userUpdates.referralGuruMonthsEarned =
				numberField(referrerSnapshot, "referralGuruMonthsEarned") + 1;
			userUpdates.referralGuruAccessUntil = Timestamp.fromMillis(
				accessUntil(referrerSnapshot.get("referralGuruAccessUntil"), now.toMillis()) +
					referralWindowMs,
			);
			notification = {
				title: "Referral reward manually granted",
				body: "A Guru referral reward was added after operator review.",
			};
		}

		if (action === "revoke_scholar") {
			referralUpdates.status = "reward_revoked";
			referralUpdates.reviewStatus = "reviewed";
			referralUpdates.revokedAt = now;
			referralUpdates.scholarMonthsGranted = Math.max(
				0,
				numberField(referralSnapshot, "scholarMonthsGranted") - 1,
			);
			referralUpdates.creditsGranted = Math.max(
				0,
				numberField(referralSnapshot, "creditsGranted") - TIER_MONTHLY_CREDITS.scholar,
			);
			userUpdates.credits = Math.max(
				0,
				numberField(referrerSnapshot, "credits") - TIER_MONTHLY_CREDITS.scholar,
			);
			userUpdates.referralScholarMonthsEarned = Math.max(
				0,
				numberField(referrerSnapshot, "referralScholarMonthsEarned") - 1,
			);
			userUpdates.referralScholarAccessUntil = Timestamp.fromMillis(
				accessUntilAfterSubtract(
					referrerSnapshot.get("referralScholarAccessUntil"),
					now.toMillis(),
				),
			);
			if (
				referrerSnapshot.get("tier") === "scholar" &&
				!hasActivePaidSubscription(referrerSnapshot)
			) {
				userUpdates.tier = "free";
			}
			notification = {
				title: "Referral reward revoked",
				body: "A Scholar referral reward was removed after operator review.",
			};
		}

		if (action === "revoke_guru") {
			referralUpdates.status = "reward_revoked";
			referralUpdates.reviewStatus = "reviewed";
			referralUpdates.revokedAt = now;
			referralUpdates.guruMonthsGranted = Math.max(
				0,
				numberField(referralSnapshot, "guruMonthsGranted") - 1,
			);
			referralUpdates.creditsGranted = Math.max(
				0,
				numberField(referralSnapshot, "creditsGranted") - TIER_MONTHLY_CREDITS.guru,
			);
			userUpdates.credits = Math.max(
				0,
				numberField(referrerSnapshot, "credits") - TIER_MONTHLY_CREDITS.guru,
			);
			userUpdates.referralGuruMonthsEarned = Math.max(
				0,
				numberField(referrerSnapshot, "referralGuruMonthsEarned") - 1,
			);
			userUpdates.referralGuruAccessUntil = Timestamp.fromMillis(
				accessUntilAfterSubtract(
					referrerSnapshot.get("referralGuruAccessUntil"),
					now.toMillis(),
				),
			);
			if (
				referrerSnapshot.get("tier") === "guru" &&
				!hasActivePaidSubscription(referrerSnapshot)
			) {
				const scholarUntil = referrerSnapshot.get("referralScholarAccessUntil");
				userUpdates.tier =
					scholarUntil instanceof Timestamp && scholarUntil.toMillis() > now.toMillis()
						? "scholar"
						: "free";
			}
			notification = {
				title: "Referral reward revoked",
				body: "A Guru referral reward was removed after operator review.",
			};
		}

		transaction.set(referralRef, referralUpdates, { merge: true });
		transaction.set(referrerRef, userUpdates, { merge: true });

		return { referrerUserId, notification };
	});

	await adminDb.collection("audit_log").add({
		action: "referral_override",
		target: `referrals/${referralId}`,
		details: `${action}: ${reason}`,
		createdAt: Timestamp.now(),
	});

	if (result.notification) {
		await createUserNotification({
			userId: result.referrerUserId,
			title: result.notification.title,
			body: result.notification.body,
			kind: "referral",
			href: "/settings",
		});
	}

	return { updated: true };
}
