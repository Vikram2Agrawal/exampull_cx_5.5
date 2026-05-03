import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm, type LlmContentPart } from "@/lib/ai/client";
import { examConfigSchema } from "@/lib/billing/credits";
import { storeExamArtifact } from "@/lib/exams/artifacts";
import {
	hasCompleteGeneratedQuestionSet,
	parseGeneratedQuestions,
} from "@/lib/exams/generated-questions";
import { buildExamLatex } from "@/lib/exams/latex";
import { adminDb, FieldValue, Timestamp } from "@/lib/firebase/admin";
import { compileLatex } from "@/lib/latex/client";
import { readSourceDocumentContent } from "@/lib/materials/source-reader";
import type { Tier } from "@/lib/product/constants";
import { requireWorkerRequest } from "@/lib/tasks/auth";
import { createUserNotification } from "@/lib/user/data";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	examId: z.string().min(1),
});

type SourceContext = {
	text: string;
	imageDataUrl?: string;
	imageDataUrls?: string[];
};

function stringList(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((item): item is string => typeof item === "string");
}

async function sourceContextFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot) {
	const filename = String(snapshot.get("filename") ?? "source");
	const focus = typeof snapshot.get("focus") === "string" ? String(snapshot.get("focus")) : "";
	const contentType = String(snapshot.get("contentType") ?? "");
	const storagePath = String(snapshot.get("storagePath") ?? "");
	const extractedContext =
		typeof snapshot.get("extractedContext") === "string"
			? String(snapshot.get("extractedContext")).trim()
			: "";

	if (extractedContext) {
		return {
			text: `Source: ${filename}\nFocus: ${focus || "none"}\nCached extracted context:\n${extractedContext}`.slice(
				0,
				18000,
			),
		};
	}

	try {
		const source = await readSourceDocumentContent({
			filename,
			focus,
			contentType,
			storagePath,
		});

		return {
			text: `Source: ${filename}\n${source.text}`.slice(0, 18000),
			imageDataUrl: source.imageDataUrl,
			imageDataUrls: source.imageDataUrls,
		};
	} catch (error) {
		return {
			text: `Source: ${filename}\nFocus: ${focus || "none"}\nRead warning: ${
				error instanceof Error ? error.message : "Could not read uploaded source."
			}`,
		};
	}
}

async function readClassSourceContexts({
	userId,
	classId,
	materialIds,
}: {
	userId: string;
	classId: string | null;
	materialIds: string[];
}) {
	if (!classId || materialIds.length === 0) {
		return [];
	}

	const materialRefs = materialIds
		.slice(0, 20)
		.map((materialId) =>
			adminDb
				.collection("users")
				.doc(userId)
				.collection("classes")
				.doc(classId)
				.collection("materials")
				.doc(materialId),
		);
	const snapshots = await Promise.all(materialRefs.map((ref) => ref.get()));
	const contexts: SourceContext[] = [];

	for (const snapshot of snapshots) {
		if (snapshot.exists) {
			contexts.push(await sourceContextFromSnapshot(snapshot));
		}
	}

	return contexts;
}

async function readAdHocSourceContexts({
	userId,
	uploadIds,
}: {
	userId: string;
	uploadIds: string[];
}) {
	if (uploadIds.length === 0) {
		return [];
	}

	const uploadRefs = uploadIds
		.slice(0, 20)
		.map((uploadId) =>
			adminDb.collection("users").doc(userId).collection("examUploads").doc(uploadId),
		);
	const snapshots = await Promise.all(uploadRefs.map((ref) => ref.get()));
	const contexts: SourceContext[] = [];

	for (const snapshot of snapshots) {
		if (snapshot.exists) {
			contexts.push(await sourceContextFromSnapshot(snapshot));
		}
	}

	return contexts;
}

function contentWithSourceImages(text: string, contexts: SourceContext[]) {
	const imageParts = contexts
		.flatMap(
			(context) =>
				context.imageDataUrls ?? (context.imageDataUrl ? [context.imageDataUrl] : []),
		)
		.filter((value): value is string => typeof value === "string")
		.slice(0, 3);

	if (imageParts.length === 0) {
		return text;
	}

	const parts: LlmContentPart[] = [{ type: "text", text }];
	for (const imageUrl of imageParts) {
		parts.push({ type: "image_url", image_url: { url: imageUrl } });
	}

	return parts;
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
	const classId =
		typeof snapshot.get("classId") === "string" ? String(snapshot.get("classId")) : null;
	const sourceMaterialIds = stringList(snapshot.get("sourceMaterialIds"));
	const adHocUploadIds = stringList(snapshot.get("adHocUploadIds"));
	const sourceNotes =
		typeof snapshot.get("sourceNotes") === "string" ? String(snapshot.get("sourceNotes")) : "";
	const configResult = examConfigSchema.safeParse(snapshot.get("config"));
	const config = configResult.success ? configResult.data : null;
	const powerSlots = config?.mode === "power" ? config.powerSlots : undefined;
	const creditsReserved = Number(snapshot.get("creditsReserved") ?? 0);
	const priorCreditsConsumed = Number(snapshot.get("creditsConsumed") ?? 0);
	const userRef = adminDb.collection("users").doc(input.userId);

	try {
		await examRef.update({ status: "generating", startedAt: Timestamp.now() });
		const sourceContexts = [
			...(await readClassSourceContexts({
				userId: input.userId,
				classId,
				materialIds: sourceMaterialIds,
			})),
			...(await readAdHocSourceContexts({
				userId: input.userId,
				uploadIds: adHocUploadIds,
			})),
		];
		const sourceContextText = sourceContexts.length
			? `\n\nGrounding source materials:\n${sourceContexts
					.map((context, index) => `--- Source ${index + 1} ---\n${context.text}`)
					.join("\n\n")
					.slice(0, 70000)}`
			: "";
		const sourceNotesText = sourceNotes ? `\nSource notes: ${sourceNotes}` : "";

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
						? `Title: ${title}\nMode: Power\nMirror instructor style: ${config?.mirrorInstructorStyle === false ? "no" : "yes"}${sourceNotesText}\nSlots:\n${powerSlots
								.map(
									(slot, index) =>
										`${index + 1}. ${slot.topic} - ${slot.style}, ${slot.difficulty}, ${slot.points} points`,
								)
								.join("\n")}${sourceContextText}`
						: `Title: ${title}\nTopics: ${topics.join(", ")}${sourceNotesText}${sourceContextText}`,
				},
			],
		});
		const expectedGeneratedQuestionCount = powerSlots?.length ?? questionCount;
		const questionGenerationMessages = [
			{
				role: "system" as const,
				content:
					'Write original, course-grounded practice exam questions and answer-key solutions. Return strict JSON only: {"questions":[{"prompt":"...","answer":"...","points":10}]}. Do not use markdown fences. Do not write generic placeholder prompts; every prompt must name concrete concepts, mechanisms, equations, cases, or terms from the supplied topics and source context.',
			},
			{
				role: "user" as const,
				content: contentWithSourceImages(
					powerSlots
						? `Title: ${title}\nBlueprint:\n${plan.content}${sourceNotesText}\nGenerate exactly ${expectedGeneratedQuestionCount} questions, one per Power slot. Preserve each slot's points exactly.\nPower slots:\n${powerSlots
								.map(
									(slot, index) =>
										`${index + 1}. Topic: ${slot.topic}; style: ${slot.style}; difficulty: ${slot.difficulty}; points: ${slot.points}`,
								)
								.join("\n")}${sourceContextText}`
						: `Title: ${title}\nBlueprint:\n${plan.content}\nGenerate exactly ${expectedGeneratedQuestionCount} questions across these topics: ${topics.join(", ")}. Use 10 points per question. Use varied formats such as interpretation, application, comparison, and short calculation where appropriate.${sourceNotesText}${sourceContextText}`,
					sourceContexts,
				),
			},
		];
		let questionGeneration = await callLlm({
			stage: "questionGeneration",
			tier,
			messages: questionGenerationMessages,
		});
		let generatedQuestions = parseGeneratedQuestions(
			questionGeneration.content,
			expectedGeneratedQuestionCount,
		);

		if (!hasCompleteGeneratedQuestionSet(generatedQuestions, expectedGeneratedQuestionCount)) {
			const repair = await callLlm({
				stage: "questionGeneration",
				tier,
				messages: [
					...questionGenerationMessages,
					{
						role: "assistant",
						content: questionGeneration.content.slice(0, 12000),
					},
					{
						role: "user",
						content: `The previous response did not produce exactly ${expectedGeneratedQuestionCount} valid JSON questions. Return only a valid JSON object with exactly ${expectedGeneratedQuestionCount} items in the questions array. Keep prompts concrete and exam-ready.`,
					},
				],
			});
			const repairedQuestions = parseGeneratedQuestions(
				repair.content,
				expectedGeneratedQuestionCount,
			);

			if (
				hasCompleteGeneratedQuestionSet(repairedQuestions, expectedGeneratedQuestionCount)
			) {
				questionGeneration = {
					...repair,
					latencyMs: questionGeneration.latencyMs + repair.latencyMs,
					inputTokens: questionGeneration.inputTokens + repair.inputTokens,
					outputTokens: questionGeneration.outputTokens + repair.outputTokens,
					model: `${questionGeneration.model},${repair.model}`,
				};
				generatedQuestions = repairedQuestions;
			}
		}

		if (!hasCompleteGeneratedQuestionSet(generatedQuestions, expectedGeneratedQuestionCount)) {
			throw new Error(
				`Question generation returned ${generatedQuestions.length.toString()} of ${expectedGeneratedQuestionCount.toString()} usable questions.`,
			);
		}

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
		const [examArtifact, answerKeyArtifact] = await Promise.all([
			storeExamArtifact({
				userId: input.userId,
				examId: input.examId,
				kind: "exam",
				compiled: examCompiled,
			}),
			storeExamArtifact({
				userId: input.userId,
				examId: input.examId,
				kind: "answer",
				compiled: answerKeyCompiled,
			}),
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
				generatedQuestions,
				examPdfStoragePath: examArtifact.pdfStoragePath,
				answerKeyPdfStoragePath: answerKeyArtifact.pdfStoragePath,
				examRenderedPageStoragePaths: examArtifact.pageStoragePaths,
				answerKeyRenderedPageStoragePaths: answerKeyArtifact.pageStoragePaths,
				examPdfBytes: examArtifact.pdfBytes,
				answerKeyPdfBytes: answerKeyArtifact.pdfBytes,
				examRenderedPageCount: examArtifact.pageStoragePaths.length,
				answerKeyRenderedPageCount: answerKeyArtifact.pageStoragePaths.length,
				examPdfBase64: FieldValue.delete(),
				answerKeyPdfBase64: FieldValue.delete(),
				examRenderedPages: FieldValue.delete(),
				answerKeyRenderedPages: FieldValue.delete(),
				creditsConsumed: priorCreditsConsumed + creditsReserved,
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
