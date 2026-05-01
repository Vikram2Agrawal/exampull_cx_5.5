import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	examId: z.string().min(1),
	attemptId: z.string().min(1),
});

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	const userRef = adminDb.collection("users").doc(input.userId);
	const attemptRef = userRef
		.collection("exams")
		.doc(input.examId)
		.collection("attempts")
		.doc(input.attemptId);
	const attempt = await attemptRef.get();

	if (!attempt.exists) {
		return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
	}

	const creditsReserved = Number(attempt.get("creditsReserved") ?? 0);

	try {
		await attemptRef.update({
			visualAnnotationStatus: "annotating",
			updatedAt: Timestamp.now(),
		});

		const feedback = String(attempt.get("feedback") ?? "");
		const annotations = [
			{
				page: 1,
				x: 0.08,
				y: 0.14,
				width: 0.84,
				height: 0.12,
				label: "Review the highest-impact corrections from the grading report.",
				comment: feedback.slice(0, 280) || "Focus on the missed reasoning steps.",
			},
		];

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
				visualAnnotationStatus: "complete",
				visualAnnotationsData: annotations,
				creditsReserved: 0,
				creditsConsumed: Number(attempt.get("creditsConsumed") ?? 0) + creditsReserved,
				updatedAt: Timestamp.now(),
			});
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
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
				visualAnnotationStatus: "failed",
				creditsReserved: 0,
				annotationFailureReason:
					error instanceof Error ? error.message : "Visual annotation failed.",
				updatedAt: Timestamp.now(),
			});
		});

		throw error;
	}
}
