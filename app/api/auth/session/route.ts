import { NextResponse } from "next/server";
import { z } from "zod";
import {
	type AdminAuditRecord,
	appendAdminAuditInTransaction,
	replicateAdminAudit,
} from "@/lib/admin/audit";
import { decidePhoneConflict, latestAccountActivityMillis } from "@/lib/auth/phone-conflicts";
import {
	emailIdentifiersFromProviders,
	linkedAuthProviderKey,
	linkedAuthProvidersFromDocument,
	linkedAuthProvidersFromFirebase,
	normalizeAuthEmail,
} from "@/lib/auth/providers";
import { userSessionCookieName, userSessionMaxAgeSeconds } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminAuth, adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { claimAnonymousPreview } from "@/lib/preview/claim";
import { TIER_MONTHLY_CREDITS } from "@/lib/product/constants";
import { createReferralSignup, ensureReferralCode } from "@/lib/referrals";
import { createUserNotification } from "@/lib/user/data";
import { defaultNotificationPreferences } from "@/lib/user/notification-preferences";

export const runtime = "nodejs";

const requestSchema = z.object({
	idToken: z.string().min(1),
	mode: z.enum(["signup", "signin"]),
	displayName: z.string().trim().max(80).optional(),
	testSignupToken: z.string().optional(),
	referralCode: z.string().trim().max(80).optional(),
	previewId: z.string().trim().max(120).optional(),
});

async function findExistingEmailOwner(email: string | null, incomingUid: string) {
	const normalizedEmail = normalizeAuthEmail(email);

	if (!normalizedEmail) {
		return null;
	}

	const users = adminDb.collection("users");
	const snapshots = await Promise.all([
		users.where("emails", "array-contains", normalizedEmail).limit(2).get(),
		users.where("email", "==", normalizedEmail).limit(2).get(),
	]);

	for (const snapshot of snapshots) {
		const conflict = snapshot.docs.find((doc) => doc.id !== incomingUid);
		if (conflict) {
			return conflict;
		}
	}

	return null;
}

function documentProviderKeys(snapshot: FirebaseFirestore.DocumentSnapshot) {
	return new Set(
		linkedAuthProvidersFromDocument(snapshot.get("linkedAuthProviders")).map(
			linkedAuthProviderKey,
		),
	);
}

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
	const result = await adminDb.runTransaction(
		async (
			transaction,
		): Promise<{
			released: boolean;
			auditRecord: AdminAuditRecord | null;
		}> => {
			const snapshot = await transaction.get(ownerRef);
			if (!snapshot.exists) {
				return { released: false, auditRecord: null };
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
				return { released: false, auditRecord: null };
			}

			const auditRecord = await appendAdminAuditInTransaction(transaction, {
				action: "phone_dormant_reclaim",
				target: `users/${ownerUid}`,
				details: `Released ${phoneNumber} to users/${incomingUid} after inactivity since ${decision.dormantSince}.`,
				operatorId: "system",
				authMethod: "system",
			});
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

			return { released: true, auditRecord };
		},
	);

	if (result.auditRecord) {
		await replicateAdminAudit(result.auditRecord);
	}

	return result.released;
}

export async function POST(request: Request) {
	const input = requestSchema.parse(await request.json());
	const decoded = await adminAuth.verifyIdToken(input.idToken, true);
	const authUser = await adminAuth.getUser(decoded.uid);
	const phoneNumber = decoded.phone_number;
	const now = Timestamp.now();

	if (!phoneNumber) {
		return NextResponse.json(
			{ error: "Phone verification is required before account creation." },
			{ status: 400 },
		);
	}

	const linkedAuthProviders = linkedAuthProvidersFromFirebase({
		providerData: authUser.providerData,
		email: decoded.email ?? authUser.email ?? null,
		phoneNumber,
		signInProvider: decoded.firebase.sign_in_provider,
	});
	const emails = emailIdentifiersFromProviders(
		linkedAuthProviders,
		decoded.email ?? authUser.email ?? null,
	);
	const emailConflicts = await Promise.all(
		emails.map((email) => findExistingEmailOwner(email, decoded.uid)),
	);
	const emailConflict = emailConflicts.find((conflict) => conflict !== null);

	if (emailConflict) {
		return NextResponse.json(
			{
				error: "We found an ExamPull account with this email. Sign in to that account before linking a new sign-in source.",
				code: "account_provider_conflict",
				existingUid: emailConflict.id,
			},
			{ status: 409 },
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
	const previousProviderKeys = snapshot.exists
		? documentProviderKeys(snapshot)
		: new Set<string>();
	const isTestAccount =
		Boolean(env.TEST_SIGNUP_TOKEN) && input.testSignupToken === env.TEST_SIGNUP_TOKEN;
	const displayName =
		input.displayName?.trim() ||
		decoded.name ||
		(decoded.email ? decoded.email.split("@")[0] : "Student");

	if (!snapshot.exists) {
		await userRef.create({
			email: emails[0] ?? decoded.email ?? null,
			emails,
			displayName,
			phoneNumber,
			phoneVerifiedAt: now,
			linkedAuthProviders,
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
			notificationPreferences: defaultNotificationPreferences(),
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
				email: emails[0] ?? decoded.email ?? snapshot.get("email") ?? null,
				emails,
				displayName,
				phoneNumber,
				phoneVerifiedAt: snapshot.get("phoneVerifiedAt") ?? now,
				linkedAuthProviders,
				lastLoginAt: now,
				updatedAt: now,
			},
			{ merge: true },
		);
		await ensureReferralCode(decoded.uid);
	}

	const newProviderKeys = linkedAuthProviders
		.map(linkedAuthProviderKey)
		.filter((key) => !previousProviderKeys.has(key));

	if (snapshot.exists && newProviderKeys.length > 0) {
		await createUserNotification({
			userId: decoded.uid,
			title: "Sign-in source linked",
			body: "A new sign-in source was added to your ExamPull account.",
			kind: "account",
			href: "/settings",
		});
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
