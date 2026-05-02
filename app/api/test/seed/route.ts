import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminDb, Timestamp } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("kind", [
	z.object({
		token: z.string().min(1),
		kind: z.literal("exam"),
		title: z.string().trim().min(1).max(120).default("Seeded exam"),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("visual_attempt"),
		examId: z.string().min(1),
		filename: z.string().trim().min(1).max(180).default("attempt.pdf"),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("exam_upload_progress"),
		uploadId: z.string().min(1),
		stage: z.string().trim().min(1).max(80),
		detail: z.string().trim().min(1).max(240),
		percent: z.number().int().min(0).max(100),
		pagesRead: z.number().int().min(0).max(10000).nullable().default(null),
		totalPages: z.number().int().min(0).max(10000).nullable().default(null),
	}),
]);

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

	const now = Timestamp.now();

	if (input.kind === "exam") {
		const examId = randomUUID();
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

	if (input.kind === "exam_upload_progress") {
		await adminDb
			.collection("users")
			.doc(user.uid)
			.collection("examUploads")
			.doc(input.uploadId)
			.set(
				{
					status: "extracting_topics",
					extractionProgress: {
						stage: input.stage,
						detail: input.detail,
						percent: input.percent,
						pagesRead: input.pagesRead,
						totalPages: input.totalPages,
					},
					uploadedAt: now,
					updatedAt: now,
				},
				{ merge: true },
			);

		return NextResponse.json({ uploadId: input.uploadId });
	}

	const attemptId = randomUUID();
	const examRef = adminDb.collection("users").doc(user.uid).collection("exams").doc(input.examId);
	const exam = await examRef.get();

	if (!exam.exists) {
		return NextResponse.json({ error: "Exam not found." }, { status: 404 });
	}

	await examRef
		.collection("attempts")
		.doc(attemptId)
		.create({
			filename: input.filename,
			contentType: "application/pdf",
			sizeBytes: 128,
			storagePath: null,
			status: "graded",
			score: 16,
			maxScore: 20,
			feedback: "Review the optimization setup and show derivative sign changes.",
			visualAnnotations: true,
			visualAnnotationStatus: "complete",
			visualFeedbackPdfBase64: Buffer.from(
				"%PDF-1.4\n% synthetic visual feedback\n",
			).toString("base64"),
			visualFeedbackRenderedPages: [],
			creditsReserved: 0,
			creditsConsumed: 0,
			createdAt: now,
			uploadedAt: now,
			gradedAt: now,
			updatedAt: now,
			isTestData: true,
		});

	return NextResponse.json({ attemptId });
}
