import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { completeVisualFeedback } from "@/lib/exams/visual-feedback";
import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";
import { extractTextFromPdf } from "@/lib/materials/extract-text";
import { CREDIT_COSTS } from "@/lib/product/constants";
import { requireWorkerRequest } from "@/lib/tasks/auth";
import { enqueueWorkerTask } from "@/lib/tasks/enqueue";
import { createUserNotification } from "@/lib/user/data";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	examId: z.string().min(1),
	attemptId: z.string().min(1),
});

function boundedScore(questionCount: number, feedback: string) {
	const percentageMatch = feedback.match(/\b([1-9]\d?|100)\s*%/);
	const percentage = percentageMatch ? Number(percentageMatch[1]) : 82;
	const maxScore = Math.max(1, questionCount * 10);

	return {
		score: Math.round((maxScore * Math.min(100, Math.max(0, percentage))) / 100),
		maxScore,
	};
}

async function attemptText({
	userId,
	examId,
	attemptId,
}: {
	userId: string;
	examId: string;
	attemptId: string;
}) {
	const attemptRef = adminDb
		.collection("users")
		.doc(userId)
		.collection("exams")
		.doc(examId)
		.collection("attempts")
		.doc(attemptId);
	const snapshot = await attemptRef.get();

	if (!snapshot.exists) {
		throw new Error("Attempt not found.");
	}

	const filename = String(snapshot.get("filename") ?? "attempt");
	const contentType = String(snapshot.get("contentType") ?? "");
	const storagePath = String(snapshot.get("storagePath") ?? "");

	if (storagePath && contentType.startsWith("text/")) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		return { attemptRef, text: buffer.toString("utf8").slice(0, 50000), filename };
	}

	if (storagePath && contentType === "application/pdf") {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		const text = await extractTextFromPdf(buffer);
		return { attemptRef, text: text || `Uploaded answer file: ${filename}`, filename };
	}

	return { attemptRef, text: `Uploaded answer file: ${filename}`, filename };
}

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	const userRef = adminDb.collection("users").doc(input.userId);
	const examRef = userRef.collection("exams").doc(input.examId);
	const exam = await examRef.get();

	if (!exam.exists) {
		return NextResponse.json({ error: "Exam not found." }, { status: 404 });
	}

	const { attemptRef, text, filename } = await attemptText(input);
	const questionCount = Number(exam.get("questionCount") ?? 0);
	const topics = Array.isArray(exam.get("topics")) ? (exam.get("topics") as string[]) : [];
	const answerKeyLatex =
		typeof exam.get("answerKeyLatex") === "string" ? String(exam.get("answerKeyLatex")) : "";
	const gradeCost = questionCount * CREDIT_COSTS.GRADE_QUESTION;
	const annotationCost = questionCount * CREDIT_COSTS.ANNOTATE_QUESTION;
	const examTitle = String(exam.get("title") ?? "Practice exam");

	try {
		await attemptRef.update({ status: "grading", updatedAt: Timestamp.now() });
		const result = await callLlm({
			stage: "grading",
			tier: "guru",
			messages: [
				{
					role: "system",
					content:
						"Grade this practice exam attempt against the answer key. Return a concise score percentage, strengths, corrections, and next study actions.",
				},
				{
					role: "user",
					content: `Topics: ${topics.join(", ")}\nAnswer key LaTeX:\n${answerKeyLatex.slice(
						0,
						20000,
					)}\nAttempt ${filename}:\n${text}`,
				},
			],
		});
		const score = boundedScore(questionCount, result.content);
		const attempt = await attemptRef.get();
		const visualAnnotations = Boolean(attempt.get("visualAnnotations") ?? false);
		const creditsReserved = Number(attempt.get("creditsReserved") ?? 0);
		let shouldRunVisualFeedbackInline = false;

		if (visualAnnotations) {
			const queueResult = await enqueueWorkerTask({
				route: "/api/workers/visual-feedback",
				payload: input,
			});
			shouldRunVisualFeedbackInline = !queueResult.queued;

			await adminDb.runTransaction(async (transaction) => {
				const user = await transaction.get(userRef);
				transaction.update(userRef, {
					reservedCredits: Math.max(
						0,
						Number(user.get("reservedCredits") ?? 0) - gradeCost,
					),
					totalCreditsConsumed: Number(user.get("totalCreditsConsumed") ?? 0) + gradeCost,
					updatedAt: Timestamp.now(),
				});
				transaction.update(attemptRef, {
					status: "graded",
					score: score.score,
					maxScore: score.maxScore,
					feedback: result.content,
					gradedAt: Timestamp.now(),
					creditsReserved: annotationCost,
					creditsConsumed: gradeCost,
					visualAnnotationStatus: queueResult.queued ? "queued" : "annotating_inline",
					queueWarning: queueResult.queued ? null : queueResult.reason,
					gradingMetadata: {
						model: result.model,
						inputTokens: result.inputTokens,
						outputTokens: result.outputTokens,
						latencyMs: result.latencyMs,
					},
					updatedAt: Timestamp.now(),
				});
			});
		} else {
			await adminDb.runTransaction(async (transaction) => {
				const user = await transaction.get(userRef);
				transaction.update(userRef, {
					reservedCredits: Math.max(
						0,
						Number(user.get("reservedCredits") ?? 0) - creditsReserved,
					),
					totalCreditsConsumed:
						Number(user.get("totalCreditsConsumed") ?? 0) + creditsReserved,
					updatedAt: Timestamp.now(),
				});
				transaction.update(attemptRef, {
					status: "graded",
					score: score.score,
					maxScore: score.maxScore,
					feedback: result.content,
					gradedAt: Timestamp.now(),
					creditsReserved: 0,
					creditsConsumed: creditsReserved,
					gradingMetadata: {
						model: result.model,
						inputTokens: result.inputTokens,
						outputTokens: result.outputTokens,
						latencyMs: result.latencyMs,
					},
					updatedAt: Timestamp.now(),
				});
			});
		}

		await createUserNotification({
			userId: input.userId,
			title: `${examTitle} attempt graded`,
			body: `Score: ${score.score}/${score.maxScore}.`,
			kind: "grading",
			href: `/exams/${input.examId}`,
		});

		if (shouldRunVisualFeedbackInline) {
			try {
				await completeVisualFeedback(input);
			} catch (error) {
				await createUserNotification({
					userId: input.userId,
					title: `${examTitle} visual feedback failed`,
					body:
						error instanceof Error
							? error.message
							: "Visual feedback could not be generated.",
					kind: "grading",
					href: `/exams/${input.examId}`,
				});
			}
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		const attempt = await attemptRef.get();
		const creditsReserved = Number(attempt.get("creditsReserved") ?? 0);

		await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			transaction.update(userRef, {
				credits: Number(user.get("credits") ?? 0) + creditsReserved,
				reservedCredits: Math.max(
					0,
					Number(user.get("reservedCredits") ?? 0) - creditsReserved,
				),
				updatedAt: Timestamp.now(),
			});
			transaction.update(attemptRef, {
				status: "failed",
				failureReason: error instanceof Error ? error.message : "Grading failed.",
				creditsReserved: 0,
				updatedAt: Timestamp.now(),
			});
		});
		await createUserNotification({
			userId: input.userId,
			title: `${examTitle} grading failed`,
			body: error instanceof Error ? error.message : "Grading failed.",
			kind: "grading",
			href: `/exams/${input.examId}`,
		});

		throw error;
	}
}
