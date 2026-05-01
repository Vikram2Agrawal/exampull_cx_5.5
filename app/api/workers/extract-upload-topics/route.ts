import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { parseTopicLines, readSourceDocumentContent } from "@/lib/materials/source-reader";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	uploadId: z.string().min(1),
	tier: z.enum(["free", "scholar", "guru"]).default("free"),
});

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	const uploadRef = adminDb
		.collection("users")
		.doc(input.userId)
		.collection("examUploads")
		.doc(input.uploadId);
	const snapshot = await uploadRef.get();

	if (!snapshot.exists) {
		return NextResponse.json({ error: "Source upload not found." }, { status: 404 });
	}

	const filename = String(snapshot.get("filename") ?? "source");
	const focus = typeof snapshot.get("focus") === "string" ? String(snapshot.get("focus")) : "";
	const contentType = String(snapshot.get("contentType") ?? "");
	const storagePath = String(snapshot.get("storagePath") ?? "");

	try {
		const source = await readSourceDocumentContent({
			filename,
			focus,
			contentType,
			storagePath,
		});
		const result = await callLlm({
			stage: "topicExtraction",
			tier: input.tier,
			messages: [
				{
					role: "system",
					content:
						"Extract 5-12 concise, testable academic topics. Return one topic per line, no prose.",
				},
				{
					role: "user",
					content: source.imageDataUrl
						? [
								{ type: "text", text: source.text },
								{ type: "image_url", image_url: { url: source.imageDataUrl } },
							]
						: source.text,
				},
			],
		});
		const topics = parseTopicLines(result.content, source.fallback);

		await uploadRef.update({
			status: "ready",
			extractedTopics: topics,
			extractionMetadata: {
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				latencyMs: result.latencyMs,
			},
			updatedAt: Timestamp.now(),
		});

		return NextResponse.json({ topics, topicsText: result.content, model: result.model });
	} catch (error) {
		const fallbackTopics = parseTopicLines("", `${filename} ${focus}`.trim());
		await uploadRef.update({
			status: "ready_with_warnings",
			extractedTopics: fallbackTopics,
			extractionError: error instanceof Error ? error.message : "Topic extraction failed.",
			updatedAt: Timestamp.now(),
		});

		return NextResponse.json({ topics: fallbackTopics, warning: "best_effort" });
	}
}
