import { NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/ai/client";
import { adminDb, adminStorage, Timestamp } from "@/lib/firebase/admin";
import { dataUrlFromBuffer, extractTextFromPdf } from "@/lib/materials/extract-text";
import { CREDIT_COSTS } from "@/lib/product/constants";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	classId: z.string().min(1),
	materialId: z.string().min(1),
});

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	const userRef = adminDb.collection("users").doc(input.userId);
	const classRef = userRef.collection("classes").doc(input.classId);
	const materialRef = classRef.collection("materials").doc(input.materialId);
	const material = await materialRef.get();

	if (!material.exists) {
		return NextResponse.json({ error: "Material not found." }, { status: 404 });
	}

	const filename = String(material.get("filename") ?? "instructor example");
	const focus = typeof material.get("focus") === "string" ? String(material.get("focus")) : "";
	const contentType = String(material.get("contentType") ?? "");
	const storagePath = String(material.get("storagePath") ?? "");
	let referenceText = `Uploaded style reference: ${filename}\nFocus: ${focus || "entire exam"}`;
	let imageDataUrl: string | undefined;

	if (storagePath && contentType === "application/pdf") {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		referenceText = `${referenceText}\n\nExtracted PDF text:\n${await extractTextFromPdf(buffer)}`;
	}

	if (storagePath && contentType.startsWith("image/")) {
		const [buffer] = await adminStorage.bucket().file(storagePath).download();
		if (buffer.length <= 8 * 1024 * 1024) {
			imageDataUrl = dataUrlFromBuffer(buffer, contentType);
			referenceText = `${referenceText}\n\nUse the attached instructor sample image to infer layout, wording, rigor, answer-space conventions, and question archetypes.`;
		}
	}

	try {
		await materialRef.update({ status: "style_processing", updatedAt: Timestamp.now() });
		const result = await callLlm({
			stage: "styleGuide",
			tier: "guru",
			messages: [
				{
					role: "system",
					content:
						"Create a concise instructor exam style guide. Cover layout, wording, rigor, solution expectations, and question archetypes. Return a user-readable guide.",
				},
				{
					role: "user",
					content: imageDataUrl
						? [
								{ type: "text", text: referenceText },
								{ type: "image_url", image_url: { url: imageDataUrl } },
							]
						: referenceText,
				},
			],
		});

		await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			transaction.update(userRef, {
				reservedCredits: Math.max(
					0,
					Number(user.get("reservedCredits") ?? 0) - CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
				),
				totalCreditsConsumed:
					Number(user.get("totalCreditsConsumed") ?? 0) + CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
				updatedAt: Timestamp.now(),
			});
			transaction.update(classRef, {
				styleGuide: result.content,
				styleGuideStatus: "ready",
				styleGuideUpdatedAt: Timestamp.now(),
				updatedAt: Timestamp.now(),
			});
			transaction.update(materialRef, {
				status: "style_ready",
				styleGuideContribution: result.content,
				extractionMetadata: {
					model: result.model,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					latencyMs: result.latencyMs,
				},
				updatedAt: Timestamp.now(),
			});
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		await adminDb.runTransaction(async (transaction) => {
			const user = await transaction.get(userRef);
			transaction.update(userRef, {
				credits: Number(user.get("credits") ?? 0) + CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
				reservedCredits: Math.max(
					0,
					Number(user.get("reservedCredits") ?? 0) - CREDIT_COSTS.STYLE_GUIDE_UPLOAD,
				),
				updatedAt: Timestamp.now(),
			});
			transaction.update(classRef, {
				styleGuideStatus: "failed",
				updatedAt: Timestamp.now(),
			});
			transaction.update(materialRef, {
				status: "failed",
				failureReason: error instanceof Error ? error.message : "Style processing failed.",
				updatedAt: Timestamp.now(),
			});
		});

		throw error;
	}
}
