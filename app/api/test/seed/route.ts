import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminDb, Timestamp } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
	token: z.string().min(1),
	kind: z.literal("exam"),
	title: z.string().trim().min(1).max(120).default("Seeded exam"),
});

function assertEnabled(token: string) {
	return (
		env.TEST_SESSION_API_ENABLED === "true" &&
		Boolean(env.TEST_SIGNUP_TOKEN) &&
		token === env.TEST_SIGNUP_TOKEN
	);
}

export async function POST(request: Request) {
	const input = requestSchema.parse(await request.json());
	const user = await getCurrentUser();

	if (!assertEnabled(input.token) || !user?.isTestAccount) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const examId = randomUUID();
	const now = Timestamp.now();
	await adminDb
		.collection("users")
		.doc(user.uid)
		.collection("exams")
		.doc(examId)
		.create({
			status: "complete",
			title: input.title,
			className: "Synthetic E2E",
			classId: null,
			topics: ["Derivatives", "Optimization"],
			sourceMaterialIds: [],
			adHocUploadIds: [],
			adHocSources: [],
			questionCount: 2,
			tierAtGen: user.tier,
			config: {
				title: input.title,
				topics: ["Derivatives", "Optimization"],
				questionCount: 2,
				tier: user.tier,
				mode: "standard",
			},
			sourceNotes: "Synthetic test fixture.",
			creditsReserved: 0,
			creditsConsumed: 0,
			boostedScholar: false,
			answerKeyUnlocked: true,
			boostGradingIncluded: false,
			archived: false,
			bookmarked: false,
			rating: null,
			shareCount: 0,
			examPdfBase64: Buffer.from("%PDF-1.4\n% synthetic test pdf\n").toString("base64"),
			answerKeyPdfBase64: Buffer.from("%PDF-1.4\n% synthetic answer key\n").toString(
				"base64",
			),
			createdAt: now,
			completedAt: now,
			updatedAt: now,
			isTestData: true,
		});

	return NextResponse.json({ examId });
}
