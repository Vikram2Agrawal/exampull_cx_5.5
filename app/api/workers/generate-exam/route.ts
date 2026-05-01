import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { examConfigSchema } from "@/lib/billing/credits";
import { buildExamLatex } from "@/lib/exams/latex";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { compileLatex } from "@/lib/latex/client";
import type { Tier } from "@/lib/product/constants";
import { requireWorkerRequest } from "@/lib/tasks/auth";
import { createUserNotification } from "@/lib/user/data";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	examId: z.string().min(1),
});

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	const examRef = adminDb
		.collection("users")
		.doc(input.userId)
		.collection("exams")
		.doc(input.examId);
	const snapshot = await examRef.get();

	if (!snapshot.exists) {
		return NextResponse.json({ error: "Exam not found" }, { status: 404 });
	}

	const tier = (snapshot.get("tierAtGen") ?? "free") as Tier;
	const topics = (snapshot.get("topics") ?? []) as string[];
	const title = String(snapshot.get("title") ?? "Practice Exam");
	const questionCount = Number(snapshot.get("questionCount") ?? topics.length);
	const configResult = examConfigSchema.safeParse(snapshot.get("config"));
	const config = configResult.success ? configResult.data : null;
	const powerSlots = config?.mode === "power" ? config.powerSlots : undefined;
	const creditsReserved = Number(snapshot.get("creditsReserved") ?? 0);
	const userRef = adminDb.collection("users").doc(input.userId);

	try {
		await examRef.update({ status: "generating", startedAt: Timestamp.now() });

		const plan = await callLlm({
			stage: "testPlan",
			tier,
			messages: [
				{
					role: "system",
					content:
						"Create a concise professional exam blueprint with topic balance, difficulty, and question forms.",
				},
				{
					role: "user",
					content: powerSlots
						? `Title: ${title}\nMode: Power\nMirror instructor style: ${config?.mirrorInstructorStyle === false ? "no" : "yes"}\nSlots:\n${powerSlots
								.map(
									(slot, index) =>
										`${index + 1}. ${slot.topic} - ${slot.style}, ${slot.difficulty}, ${slot.points} points`,
								)
								.join("\n")}`
						: `Title: ${title}\nTopics: ${topics.join(", ")}`,
				},
			],
		});

		const examLatex = buildExamLatex({
			title,
			topics,
			questionCount,
			answerKey: false,
			powerSlots,
		});
		const answerKeyLatex = buildExamLatex({
			title,
			topics,
			questionCount,
			answerKey: true,
			powerSlots,
		});

		await examRef.update({ status: "qa_in_progress", updatedAt: Timestamp.now() });
		const [examCompiled, answerKeyCompiled] = await Promise.all([
			compileLatex({ latex: examLatex }),
			compileLatex({ latex: answerKeyLatex }),
		]);

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
			transaction.update(examRef, {
				status: "complete",
				examLatex,
				answerKeyLatex,
				examPdfBase64: examCompiled.pdfBase64,
				answerKeyPdfBase64: answerKeyCompiled.pdfBase64,
				examRenderedPages: examCompiled.pages,
				answerKeyRenderedPages: answerKeyCompiled.pages,
				creditsConsumed: creditsReserved,
				creditsReserved: 0,
				qaIterations: { exam: 1, answerKey: 1 },
				generationMetadata: {
					creditsConsumed: creditsReserved,
					stages: [
						{
							stage: "testPlan",
							model: plan.model,
							inputTokens: plan.inputTokens,
							outputTokens: plan.outputTokens,
							latencyMs: plan.latencyMs,
						},
					],
				},
				completedAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});
		});
		await createUserNotification({
			userId: input.userId,
			title: `${title} is ready`,
			body: "The student copy and answer key PDFs have finished visual QA.",
			kind: "exam",
			href: `/exams/${input.examId}`,
		});
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
			transaction.update(examRef, {
				status: "failed",
				failureReason: error instanceof Error ? error.message : "Generation failed.",
				creditsReserved: 0,
				updatedAt: Timestamp.now(),
			});
		});
		await createUserNotification({
			userId: input.userId,
			title: `${title} failed to generate`,
			body: error instanceof Error ? error.message : "Generation failed.",
			kind: "exam",
			href: `/exams/${input.examId}`,
		});

		throw error;
	}

	return NextResponse.json({ ok: true });
}
