import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { examConfigSchema } from "@/lib/billing/credits";
import { buildExamLatex, type GeneratedExamQuestion } from "@/lib/exams/latex";
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

const generatedQuestionSchema = z.object({
	prompt: z.string().trim().min(10).max(1500),
	answer: z.string().trim().min(10).max(2500),
	points: z.number().int().min(1).max(100),
});

function extractJsonArray(value: string) {
	const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
	if (fenced) {
		return fenced;
	}

	const start = value.indexOf("[");
	const end = value.lastIndexOf("]");
	if (start >= 0 && end > start) {
		return value.slice(start, end + 1);
	}

	return value;
}

function parseGeneratedQuestions(value: string, expectedCount: number): GeneratedExamQuestion[] {
	let decoded: unknown;
	try {
		decoded = JSON.parse(extractJsonArray(value));
	} catch {
		return [];
	}

	const parsed = z.array(generatedQuestionSchema).min(1).safeParse(decoded);

	if (!parsed.success) {
		return [];
	}

	return parsed.data.slice(0, expectedCount);
}

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
		const questionGeneration = await callLlm({
			stage: "questionGeneration",
			tier,
			messages: [
				{
					role: "system",
					content:
						"Write professional exam questions and answer-key solutions. Return JSON only: an array of objects with prompt, answer, and points. Prompts must be self-contained and suitable for a formal PDF exam.",
				},
				{
					role: "user",
					content: powerSlots
						? `Title: ${title}\nBlueprint:\n${plan.content}\nPower slots:\n${powerSlots
								.map(
									(slot, index) =>
										`${index + 1}. Topic: ${slot.topic}; style: ${slot.style}; difficulty: ${slot.difficulty}; points: ${slot.points}`,
								)
								.join("\n")}`
						: `Title: ${title}\nBlueprint:\n${plan.content}\nGenerate exactly ${questionCount} questions across these topics: ${topics.join(", ")}. Use 10 points per question.`,
				},
			],
		});
		const generatedQuestions = parseGeneratedQuestions(
			questionGeneration.content,
			powerSlots?.length ?? questionCount,
		);

		const examLatex = buildExamLatex({
			title,
			topics,
			questionCount,
			answerKey: false,
			powerSlots,
			generatedQuestions,
		});
		const answerKeyLatex = buildExamLatex({
			title,
			topics,
			questionCount,
			answerKey: true,
			powerSlots,
			generatedQuestions,
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
						{
							stage: "questionGeneration",
							model: questionGeneration.model,
							inputTokens: questionGeneration.inputTokens,
							outputTokens: questionGeneration.outputTokens,
							latencyMs: questionGeneration.latencyMs,
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
