import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import {
	parseTopicExtractionResponse,
	readSourceDocumentContent,
	sourceDocumentContentParts,
} from "@/lib/materials/source-reader";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1).optional(),
	classId: z.string().min(1).optional(),
	materialId: z.string().min(1).optional(),
	tier: z.enum(["free", "scholar", "guru"]).default("free"),
	text: z.string().min(1).optional(),
});

async function readMaterialText({
	userId,
	classId,
	materialId,
}: {
	userId: string;
	classId: string;
	materialId: string;
}) {
	const materialRef = adminDb
		.collection("users")
		.doc(userId)
		.collection("classes")
		.doc(classId)
		.collection("materials")
		.doc(materialId);
	const snapshot = await materialRef.get();

	if (!snapshot.exists) {
		throw new Error("Material not found.");
	}

	const filename = String(snapshot.get("filename") ?? "material");
	const focus = typeof snapshot.get("focus") === "string" ? String(snapshot.get("focus")) : "";
	const contentType = String(snapshot.get("contentType") ?? "");
	const storagePath = String(snapshot.get("storagePath") ?? "");
	const material = await readSourceDocumentContent({
		filename,
		focus,
		contentType,
		storagePath,
	});

	return { materialRef, ...material };
}

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	const materialPayload =
		input.userId && input.classId && input.materialId
			? await readMaterialText({
					userId: input.userId,
					classId: input.classId,
					materialId: input.materialId,
				})
			: null;
	const text = input.text ?? materialPayload?.text;

	if (!text) {
		return NextResponse.json({ error: "No extraction input provided." }, { status: 400 });
	}

	const result = await callLlm({
		stage: "topicExtraction",
		tier: input.tier,
		messages: [
			{
				role: "system",
				content:
					"Extract course material for exam generation. Return strict JSON with keys: topics (5-12 concise, testable academic topics) and extractedContext (a compact factual summary of visible lecture text, notes, diagram labels, formulas, examples, and constraints that should ground later exam generation).",
			},
			{
				role: "user",
				content: materialPayload ? sourceDocumentContentParts(materialPayload) : text,
			},
		],
	});
	const extraction = parseTopicExtractionResponse(
		result.content,
		materialPayload?.fallback ?? text,
	);

	if (materialPayload) {
		await materialPayload.materialRef.update({
			status: "ready",
			extractedTopics: extraction.topics,
			extractedContext: extraction.extractedContext,
			extractionMetadata: {
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				latencyMs: result.latencyMs,
				renderedImagePageCount: materialPayload.renderedImagePageCount ?? 0,
				extractedContextChars: extraction.extractedContext.length,
			},
			updatedAt: Timestamp.now(),
		});
	}

	return NextResponse.json({
		topics: extraction.topics,
		topicsText: result.content,
		extractedContext: extraction.extractedContext,
		model: result.model,
	});
}
