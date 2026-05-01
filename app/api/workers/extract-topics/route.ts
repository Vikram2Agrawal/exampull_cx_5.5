import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";
import { extractTextFromPdf } from "@/lib/materials/extract-text";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1).optional(),
	classId: z.string().min(1).optional(),
	materialId: z.string().min(1).optional(),
	tier: z.enum(["free", "scholar", "guru"]).default("free"),
	text: z.string().min(1).optional(),
});

function parseTopics(content: string, fallback: string) {
	const candidates = content
		.split(/\n|;/)
		.flatMap((line) => line.split(/,(?=\s*[A-Z0-9])/))
		.map((line) => line.replace(/^\s*[-*\u2022\d.)]+/, "").trim())
		.filter((line) => line.length > 2 && line.length <= 120)
		.slice(0, 12);

	if (candidates.length > 0) {
		return Array.from(new Set(candidates));
	}

	return fallback
		.split(/[-_.,\s]+/)
		.map((piece) => piece.trim())
		.filter((piece) => piece.length > 3)
		.slice(0, 8);
}

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
	let text = `Filename: ${filename}\nFocus: ${focus || "none"}`;

	if (!storagePath) {
		return { materialRef, text, fallback: `${filename} ${focus}`.trim() };
	}

	if (
		contentType.startsWith("text/") ||
		contentType.includes("json") ||
		contentType.includes("csv") ||
		contentType.includes("markdown")
	) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		text = `${text}\n\n${buffer.toString("utf8").slice(0, 50000)}`;
	}

	if (contentType === "application/pdf") {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		const extractedText = await extractTextFromPdf(buffer);
		text = `${text}\n\n${extractedText}`;
	}

	return { materialRef, text, fallback: `${filename} ${focus}`.trim() };
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
					"Extract 5-12 concise, testable academic topics. Return one topic per line, no prose.",
			},
			{ role: "user", content: text },
		],
	});
	const topics = parseTopics(result.content, materialPayload?.fallback ?? text);

	if (materialPayload) {
		await materialPayload.materialRef.update({
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
	}

	return NextResponse.json({ topics, topicsText: result.content, model: result.model });
}
