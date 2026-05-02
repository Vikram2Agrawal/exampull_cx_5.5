import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import {
	parseTopicLines,
	readSourceDocumentContent,
	sourceDocumentContentParts,
} from "@/lib/materials/source-reader";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	uploadId: z.string().min(1),
	tier: z.enum(["free", "scholar", "guru"]).default("free"),
});

async function updateExtractionProgress({
	uploadRef,
	stage,
	detail,
	percent,
	pagesRead = null,
	totalPages = null,
}: {
	uploadRef: FirebaseFirestore.DocumentReference;
	stage: string;
	detail: string;
	percent: number;
	pagesRead?: number | null;
	totalPages?: number | null;
}) {
	await uploadRef.update({
		status: "extracting_topics",
		extractionProgress: {
			stage,
			detail,
			percent,
			pagesRead,
			totalPages,
		},
		updatedAt: Timestamp.now(),
	});
}

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
		await updateExtractionProgress({
			uploadRef,
			stage: "reading_toc",
			detail:
				contentType === "application/pdf"
					? "Reading table of contents and document headings"
					: "Reading source headings",
			percent: 25,
		});
		const source = await readSourceDocumentContent({
			filename,
			focus,
			contentType,
			storagePath,
		});
		await updateExtractionProgress({
			uploadRef,
			stage: "scoping_topics",
			detail: focus
				? `Scoping extracted topics to ${focus}`
				: "Selecting testable topics from source content",
			percent: 70,
			pagesRead: source.pagesRead ?? null,
			totalPages: source.pageCount ?? null,
		});
		const result = await callLlm({
			stage: "topicExtraction",
			tier: input.tier,
			messages: [
				{
					role: "system",
					content:
						"Extract 5-12 concise, testable academic topics. If a Focus line is provided, scope the topics to that focus while using the document table of contents and headings for context. Return one topic per line, no prose.",
				},
				{
					role: "user",
					content: sourceDocumentContentParts(source),
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
				pagesRead: source.pagesRead ?? null,
				totalPages: source.pageCount ?? null,
				renderedImagePageCount: source.renderedImagePageCount ?? 0,
			},
			extractionProgress: {
				stage: "complete",
				detail: "Topic extraction complete",
				percent: 100,
				pagesRead: source.pagesRead ?? null,
				totalPages: source.pageCount ?? null,
			},
			updatedAt: Timestamp.now(),
		});

		return NextResponse.json({ topics, topicsText: result.content, model: result.model });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Topic extraction failed.";
		const fallbackTopics = parseTopicLines("", `${filename} ${focus}`.trim());
		await uploadRef.update({
			status: "ready_with_warnings",
			extractedTopics: fallbackTopics,
			extractionError: message,
			extractionProgress: {
				stage: "warning",
				detail: "Best-effort fallback topics ready",
				percent: 100,
				pagesRead: null,
				totalPages: null,
			},
			updatedAt: Timestamp.now(),
		});

		return NextResponse.json({
			topics: fallbackTopics,
			warning: "best_effort",
			error: message,
		});
	}
}
