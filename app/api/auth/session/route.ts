import { NextResponse } from "next/server";
import { z } from "zod";
import { userSessionCookieName, userSessionMaxAgeSeconds } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminAuth, adminDb, Timestamp } from "@/lib/firebase/admin";
import { TIER_MONTHLY_CREDITS } from "@/lib/product/constants";

export const runtime = "nodejs";

const requestSchema = z.object({
	idToken: z.string().min(1),
	mode: z.enum(["signup", "signin"]),
	displayName: z.string().trim().max(80).optional(),
	testSignupToken: z.string().optional(),
});

export async function POST(request: Request) {
	const input = requestSchema.parse(await request.json());
	const decoded = await adminAuth.verifyIdToken(input.idToken, true);
	const phoneNumber = decoded.phone_number;

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
		return NextResponse.json(
			{ error: "That phone number is already attached to an ExamPull account." },
			{ status: 409 },
		);
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
			createdAt: Timestamp.now(),
			lastLoginAt: Timestamp.now(),
			monthlyCreditGrant: {
				credits: TIER_MONTHLY_CREDITS.free,
				grantedAt: Timestamp.now(),
				tier: "free",
			},
			notificationPreferences: {
				email: true,
				sms: true,
				inApp: true,
			},
		});
	} else {
		await userRef.set(
			{
				email: decoded.email ?? snapshot.get("email") ?? null,
				displayName,
				phoneNumber,
				lastLoginAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			},
			{ merge: true },
		);
	}

	const sessionCookie = await adminAuth.createSessionCookie(input.idToken, {
		expiresIn: userSessionMaxAgeSeconds * 1000,
	});
	const response = NextResponse.json({ ok: true });
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
