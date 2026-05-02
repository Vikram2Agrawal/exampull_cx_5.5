import { NextResponse } from "next/server";
import { z } from "zod";
import { decidePhoneConflict, latestAccountActivityMillis } from "@/lib/auth/phone-conflicts";
import { userSessionCookieName, userSessionMaxAgeSeconds } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminAuth, adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { claimAnonymousPreview } from "@/lib/preview/claim";
import { TIER_MONTHLY_CREDITS } from "@/lib/product/constants";
import { createReferralSignup, ensureReferralCode } from "@/lib/referrals";

export const runtime = "nodejs";

const requestSchema = z.object({
	idToken: z.string().min(1),
	mode: z.enum(["signup", "signin"]),
	displayName: z.string().trim().max(80).optional(),
	testSignupToken: z.string().optional(),
	referralCode: z.string().trim().max(80).optional(),
	previewId: z.string().trim().max(120).optional(),
});

async function releaseDormantPhoneOwner({
	ownerRef,
	ownerUid,
	incomingUid,
	phoneNumber,
	now,
}: {
	ownerRef: FirebaseFirestore.DocumentReference;
	ownerUid: string;
	incomingUid: string;
	phoneNumber: string;
	now: FirebaseFirestore.Timestamp;
}) {
	return adminDb.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(ownerRef);
		if (!snapshot.exists) {
			return false;
		}

		const lastActivityMs = latestAccountActivityMillis([
			snapshot.get("lastLoginAt"),
			snapshot.get("updatedAt"),
			snapshot.get("createdAt"),
		]);
		const decision = decidePhoneConflict({
			existingUid: ownerUid,
			incomingUid,
			lastActivityMs,
			nowMs: now.toMillis(),
		});

		if (decision.kind !== "dormant_reclaim") {
			return false;
		}

		transaction.set(
			ownerRef,
			{
				phoneNumber: FieldValue.delete(),
				previousPhoneNumbers: FieldValue.arrayUnion(phoneNumber),
				phoneReleasedAt: now,
				phoneReleasedToUid: incomingUid,
				phoneReleaseReason: "dormant_reclaim",
				updatedAt: now,
			},
			{ merge: true },
		);
		transaction.create(adminDb.collection("audit_log").doc(), {
			action: "phone_dormant_reclaim",
			target: `users/${ownerUid}`,
			details: `Released ${phoneNumber} to users/${incomingUid} after inactivity since ${decision.dormantSince}.`,
			createdAt: now,
		});

		return true;
	});
}

export async function POST(request: Request) {
	const input = requestSchema.parse(await request.json());
	const decoded = await adminAuth.verifyIdToken(input.idToken, true);
	const phoneNumber = decoded.phone_number;
	const now = Timestamp.now();

	if (!phoneNumber) {
		return NextResponse.json(
			{ error: "Phone verification is required before account creation." },
			{ status: 400 },
		);
	}

	const existingPhone = await adminDb
		.collection("users")
		.where("phoneNumber", "==", phoneNumber)
		.limit(1)
		.get();
	const conflictingPhoneOwner = existingPhone.docs.find((doc) => doc.id !== decoded.uid);

	if (conflictingPhoneOwner) {
		const lastActivityMs = latestAccountActivityMillis([
			conflictingPhoneOwner.get("lastLoginAt"),
			conflictingPhoneOwner.get("updatedAt"),
			conflictingPhoneOwner.get("createdAt"),
		]);
		const decision = decidePhoneConflict({
			existingUid: conflictingPhoneOwner.id,
			incomingUid: decoded.uid,
			lastActivityMs,
			nowMs: now.toMillis(),
		});

		if (decision.kind === "prior_auth_required") {
			return NextResponse.json(
				{
					error: "That phone number is attached to an active ExamPull account. Sign in with a previously linked email or Google account before using this phone.",
					code: "phone_prior_auth_required",
					dormantEligibleAt: decision.dormantEligibleAt,
				},
				{ status: 409 },
			);
		}

		if (decision.kind === "dormant_reclaim") {
			const released = await releaseDormantPhoneOwner({
				ownerRef: conflictingPhoneOwner.ref,
				ownerUid: conflictingPhoneOwner.id,
				incomingUid: decoded.uid,
				phoneNumber,
				now,
			});

			if (!released) {
				return NextResponse.json(
					{
						error: "That phone number is attached to an active ExamPull account. Sign in with a previously linked email or Google account before using this phone.",
						code: "phone_prior_auth_required",
					},
					{ status: 409 },
				);
			}
		}
	}

	const userRef = adminDb.collection("users").doc(decoded.uid);
	const snapshot = await userRef.get();
	const isTestAccount =
		Boolean(env.TEST_SIGNUP_TOKEN) && input.testSignupToken === env.TEST_SIGNUP_TOKEN;
	const displayName =
		input.displayName?.trim() ||
		decoded.name ||
		(decoded.email ? decoded.email.split("@")[0] : "Student");

	if (!snapshot.exists) {
		await userRef.create({
			email: decoded.email ?? null,
			displayName,
			phoneNumber,
			tier: "free",
			credits: TIER_MONTHLY_CREDITS.free,
			reservedCredits: 0,
			totalCreditsConsumed: 0,
			isTestAccount,
			isTestData: isTestAccount,
			createdAt: now,
			lastLoginAt: now,
			monthlyCreditGrant: {
				credits: TIER_MONTHLY_CREDITS.free,
				grantedAt: now,
				tier: "free",
			},
			notificationPreferences: {
				email: true,
				sms: true,
				inApp: true,
			},
		});
		await ensureReferralCode(decoded.uid);
		await createReferralSignup({
			referralCode: input.referralCode,
			referredUserId: decoded.uid,
			isTestData: isTestAccount,
		});
	} else {
		await userRef.set(
			{
				email: decoded.email ?? snapshot.get("email") ?? null,
				displayName,
				phoneNumber,
				lastLoginAt: now,
				updatedAt: now,
			},
			{ merge: true },
		);
		await ensureReferralCode(decoded.uid);
	}

	const claimedPreview = await claimAnonymousPreview({
		previewId: input.previewId,
		userId: decoded.uid,
		isTestData: isTestAccount,
	});
	const sessionCookie = await adminAuth.createSessionCookie(input.idToken, {
		expiresIn: userSessionMaxAgeSeconds * 1000,
	});
	const response = NextResponse.json({ ok: true, ...claimedPreview });
	response.cookies.set(userSessionCookieName, sessionCookie, {
		httpOnly: true,
		maxAge: userSessionMaxAgeSeconds,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	return response;
}

export async function DELETE() {
	const response = NextResponse.json({ ok: true });
	response.cookies.set(userSessionCookieName, "", {
		httpOnly: true,
		maxAge: 0,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	return response;
}
