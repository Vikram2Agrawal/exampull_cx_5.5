import { createHash } from "node:crypto";
import { publicBaseUrl } from "@/lib/env";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { TIER_MONTHLY_CREDITS, type Tier } from "@/lib/product/constants";
import { createUserNotification } from "@/lib/user/data";

const referralWindowMs = 30 * 24 * 60 * 60 * 1000;

function accessUntil(value: unknown, now: number) {
	if (value instanceof Timestamp) {
		return Math.max(value.toMillis(), now);
	}

	return now;
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

	await referralRef.create({
		referrerUserId: referrer.id,
		referredUserId,
		referralCode: code,
		status: "signed_up",
		creditsGranted: 0,
		scholarMonthsGranted: 0,
		guruMonthsGranted: 0,
		isTestData,
		createdAt: Timestamp.now(),
		updatedAt: Timestamp.now(),
	});
	await adminDb.collection("users").doc(referredUserId).set(
		{
			referredByUserId: referrer.id,
			referralCodeUsed: code,
			updatedAt: Timestamp.now(),
		},
		{ merge: true },
	);
	await createUserNotification({
		userId: referrer.id,
		title: "Referral signed up",
		body: "A friend joined from your referral link. Rewards unlock after they generate an exam.",
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

	if (!referral || referral.get("examRewardedAt")) {
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

		if (referralSnapshot.get("examRewardedAt")) {
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

	if (!referral || referral.get("paidRewardedAt")) {
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

		if (referralSnapshot.get("paidRewardedAt")) {
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
