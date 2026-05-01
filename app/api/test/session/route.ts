import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userSessionCookieName, userSessionMaxAgeSeconds } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminAuth, adminDb, Timestamp } from "@/lib/firebase/admin";
import { TIER_MONTHLY_CREDITS } from "@/lib/product/constants";
import { ensureReferralCode } from "@/lib/referrals";

export const runtime = "nodejs";

const createSchema = z.object({
	token: z.string().min(1),
	email: z.string().email().max(180),
	displayName: z.string().trim().min(1).max(80).default("ExamPull Tester"),
	tier: z.enum(["free", "scholar", "guru"]).default("guru"),
	credits: z.number().int().min(0).max(5000).default(500),
});

const exchangeSchema = z.object({
	token: z.string().min(1),
	idToken: z.string().min(1),
});

function assertEnabled(token: string) {
	return (
		env.TEST_SESSION_API_ENABLED === "true" &&
		Boolean(env.TEST_SIGNUP_TOKEN) &&
		token === env.TEST_SIGNUP_TOKEN
	);
}

function uidFromEmail(email: string) {
	return `test_${Buffer.from(email).toString("base64url").slice(0, 64)}`;
}

function phoneFromEmail(email: string) {
	const digits = createHash("sha256")
		.update(email)
		.digest("hex")
		.replace(/[a-f]/g, "")
		.padEnd(10, "0")
		.slice(0, 10);

	return `+1${digits}`;
}

export async function POST(request: Request) {
	const input = createSchema.parse(await request.json());

	if (!assertEnabled(input.token)) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	if (!env.NEXT_PUBLIC_FIREBASE_API_KEY) {
		return NextResponse.json({ error: "Firebase API key unavailable." }, { status: 500 });
	}

	const uid = uidFromEmail(input.email);
	const now = Timestamp.now();

	try {
		await adminAuth.getUser(uid);
	} catch {
		await adminAuth.createUser({
			uid,
			email: input.email,
			emailVerified: true,
			displayName: input.displayName,
			disabled: false,
		});
	}

	await adminDb
		.collection("users")
		.doc(uid)
		.set(
			{
				email: input.email,
				displayName: input.displayName,
				phoneNumber: phoneFromEmail(input.email),
				tier: input.tier,
				credits: input.credits,
				reservedCredits: 0,
				totalCreditsConsumed: 0,
				isTestAccount: true,
				isTestData: true,
				createdAt: now,
				lastLoginAt: now,
				updatedAt: now,
				monthlyCreditGrant: {
					credits: TIER_MONTHLY_CREDITS[input.tier],
					grantedAt: now,
					tier: input.tier,
				},
				notificationPreferences: {
					email: true,
					sms: false,
					inApp: true,
				},
			},
			{ merge: true },
		);
	await ensureReferralCode(uid);

	const customToken = await adminAuth.createCustomToken(uid, {
		isTestAccount: true,
	});

	return NextResponse.json({
		uid,
		customToken,
		apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
	});
}

export async function PUT(request: Request) {
	const input = exchangeSchema.parse(await request.json());

	if (!assertEnabled(input.token)) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const decoded = await adminAuth.verifyIdToken(input.idToken, true);
	await adminDb.collection("users").doc(decoded.uid).set(
		{
			lastLoginAt: Timestamp.now(),
			updatedAt: Timestamp.now(),
			isTestAccount: true,
			isTestData: true,
		},
		{ merge: true },
	);

	const sessionCookie = await adminAuth.createSessionCookie(input.idToken, {
		expiresIn: userSessionMaxAgeSeconds * 1000,
	});
	const response = NextResponse.json({ ok: true, uid: decoded.uid });
	response.cookies.set(userSessionCookieName, sessionCookie, {
		httpOnly: true,
		maxAge: userSessionMaxAgeSeconds,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	return response;
}
