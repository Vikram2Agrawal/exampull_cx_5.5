import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("kind", [
	z.object({
		token: z.string().min(1),
		kind: z.literal("exam"),
		title: z.string().trim().min(1).max(120).default("Seeded exam"),
		classId: z.string().trim().min(1).max(120).optional(),
		className: z.string().trim().min(1).max(120).optional(),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("visual_attempt"),
		examId: z.string().min(1),
		filename: z.string().trim().min(1).max(180).default("attempt.pdf"),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("complete_exam"),
		examId: z.string().min(1),
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
	z.object({
		token: z.string().min(1),
		kind: z.literal("notification"),
		title: z.string().trim().min(1).max(140),
		body: z.string().trim().min(1).max(1000),
		notificationKind: z.string().trim().min(1).max(40),
		href: z.string().trim().max(240).nullable().default(null),
		read: z.boolean().default(false),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("expired_preview"),
		previewId: z.string().trim().min(1).max(120).optional(),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("expire_share_answer_key_grace"),
		shareId: z.string().trim().min(1).max(160),
	}),
	z.object({
		token: z.string().min(1),
		kind: z.literal("expire_payment_failure_grace"),
	}),
]);

function assertEnabled(token: string) {
	return (
		env.TEST_SESSION_API_ENABLED === "true" &&
		Boolean(env.TEST_SIGNUP_TOKEN) &&
		token === env.TEST_SIGNUP_TOKEN
	);
}

function pdfText(value: string) {
	return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function textPdfBase64(lines: string[]) {
	const stream = `BT /F1 12 Tf 72 740 Td 18 TL\n${lines
		.map((line) => `(${pdfText(line)}) Tj T*`)
		.join("\n")}\nET`;
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>`,
		`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
	];
	let pdf = "%PDF-1.4\n";
	const offsets: number[] = [];

	objects.forEach((object, index) => {
		offsets.push(Buffer.byteLength(pdf, "utf8"));
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	});

	const xrefOffset = Buffer.byteLength(pdf, "utf8");
	pdf += "xref\n0 6\n0000000000 65535 f \n";
	for (const offset of offsets) {
		pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

	return Buffer.from(pdf, "utf8").toString("base64");
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
				className: input.className ?? "Synthetic E2E",
				classId: input.classId ?? null,
				topics: ["Derivatives", "Optimization"],
				sourceMaterialIds: [],
				adHocUploadIds: [],
				adHocSources: [],
				questionCount: 2,
				tierAtGen: user.tier,
				config: {
					title: input.title,
					className: input.className ?? "Synthetic E2E",
					...(input.classId ? { classId: input.classId } : {}),
					topics: ["Derivatives", "Optimization"],
					questionCount: 2,
					tier: user.tier,
					mode: "standard",
				},
				sourceNotes: "Synthetic test fixture.",
				generatedQuestions: [
					{
						prompt: "Explain how the derivative test identifies local extrema, including the role of critical points.",
						answer: "Critical points occur where the derivative is zero or undefined; sign changes in the derivative classify local extrema.",
						points: 10,
					},
					{
						prompt: "Apply optimization reasoning to choose the dimensions of a simple container with a fixed perimeter constraint.",
						answer: "Translate the constraint into one variable, maximize the area function, and check the resulting critical point.",
						points: 10,
					},
				],
				creditsReserved: 0,
				creditsConsumed: 0,
				boostedScholar: false,
				answerKeyUnlocked: true,
				boostGradingIncluded: false,
				archived: false,
				bookmarked: false,
				rating: null,
				shareCount: 0,
				examPdfBase64: textPdfBase64([
					input.title,
					"",
					"1. Explain the derivative test for optimization.",
					"2. Apply the method to a realistic course problem.",
				]),
				answerKeyPdfBase64: textPdfBase64([
					`${input.title} answer key`,
					"",
					"1. Check critical points and endpoints.",
					"2. Show reasoning, units, and final answer.",
				]),
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

	if (input.kind === "complete_exam") {
		await adminDb
			.collection("users")
			.doc(user.uid)
			.collection("exams")
			.doc(input.examId)
			.set(
				{
					status: "complete",
					creditsReserved: 0,
					examPdfBase64: textPdfBase64([
						"Synthetic completed exam",
						"",
						"1. Solve the representative course problem.",
					]),
					answerKeyPdfBase64: textPdfBase64([
						"Synthetic completed answer key",
						"",
						"1. Correct answer with reasoning.",
					]),
					completedAt: now,
					updatedAt: now,
				},
				{ merge: true },
			);

		return NextResponse.json({ examId: input.examId });
	}

	if (input.kind === "notification") {
		const notificationRef = await adminDb
			.collection("users")
			.doc(user.uid)
			.collection("notifications")
			.add({
				title: input.title,
				body: input.body,
				kind: input.notificationKind,
				href: input.href,
				read: input.read,
				createdAt: now,
				updatedAt: now,
				isTestData: true,
			});

		if (!input.read) {
			await adminDb
				.collection("users")
				.doc(user.uid)
				.set(
					{
						unreadNotificationCount: FieldValue.increment(1),
						updatedAt: now,
					},
					{ merge: true },
				);
		}

		return NextResponse.json({ notificationId: notificationRef.id });
	}

	if (input.kind === "expired_preview") {
		const previewId = input.previewId ?? randomUUID();
		const expiredAt = Timestamp.fromMillis(Date.now() - 60_000);
		await adminDb
			.collection("anonymous_previews")
			.doc(previewId)
			.set({
				title: "Expired anonymous preview",
				topics: ["Limits", "Derivatives", "Optimization"],
				questionCount: 3,
				examPdfStoragePath: `test/anonymous-previews/${previewId}/exam.pdf`,
				examRenderedPageStoragePaths: [
					`test/anonymous-previews/${previewId}/pages/page-1.png`,
					`test/anonymous-previews/${previewId}/pages/page-2.png`,
				],
				materialStoragePaths: [`test/anonymous-previews/${previewId}/materials/source.pdf`],
				claimedByUid: null,
				createdAt: expiredAt,
				updatedAt: expiredAt,
				expiresAt: expiredAt,
				isTestData: true,
				seededByUid: user.uid,
			});

		await adminDb
			.collection("preview_rate_limits")
			.doc(`expired-${previewId}`)
			.set({
				fingerprint: `expired-${previewId}`,
				count: 1,
				resetAt: expiredAt,
				expiresAt: expiredAt,
				updatedAt: expiredAt,
				isTestData: true,
			});

		return NextResponse.json({ previewId });
	}

	if (input.kind === "expire_share_answer_key_grace") {
		const shareRef = adminDb.collection("share_links").doc(input.shareId);
		const shareSnapshot = await shareRef.get();

		if (!shareSnapshot.exists || shareSnapshot.get("ownerUid") !== user.uid) {
			return NextResponse.json({ error: "Share link not found." }, { status: 404 });
		}

		await shareRef.set(
			{
				answerKeyGraceUntil: Timestamp.fromMillis(Date.now() - 60_000),
				updatedAt: now,
			},
			{ merge: true },
		);

		return NextResponse.json({ shareId: input.shareId });
	}

	if (input.kind === "expire_payment_failure_grace") {
		await adminDb
			.collection("users")
			.doc(user.uid)
			.set(
				{
					paymentFailureGraceUntil: Timestamp.fromMillis(Date.now() - 60_000),
					paymentFailureLastReminderAt: Timestamp.fromMillis(Date.now() - 60_000),
					updatedAt: now,
				},
				{ merge: true },
			);

		return NextResponse.json({ userId: user.uid });
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
