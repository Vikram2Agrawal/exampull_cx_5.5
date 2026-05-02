import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { storeAnonymousPreviewArtifact } from "@/lib/exams/artifacts";
import { buildExamLatex } from "@/lib/exams/latex";
import { adminDb, Timestamp } from "@/lib/firebase/admin";
import { compileLatex } from "@/lib/latex/client";

export const runtime = "nodejs";

const requestSchema = z.object({
	title: z.string().trim().min(3).max(120),
	topics: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
	questionCount: z.number().int().min(1).max(5).default(3),
});

function previewFingerprint(request: Request) {
	const rawFingerprint = request.headers.get("x-preview-fingerprint")?.trim() || "unknown";
	const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const realIp = request.headers.get("x-real-ip")?.trim();
	const ipAddress = forwardedFor || realIp || "unknown";

	return createHash("sha256")
		.update(`${rawFingerprint.slice(0, 160)}:${ipAddress}`)
		.digest("hex");
}

async function enforcePreviewRateLimit(request: Request) {
	const fingerprint = previewFingerprint(request);
	const ref = adminDb.collection("preview_rate_limits").doc(fingerprint);
	const now = Date.now();
	const windowMs = 24 * 60 * 60 * 1000;

	await adminDb.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(ref);
		const lastGeneratedAt = snapshot.get("lastGeneratedAt");

		if (lastGeneratedAt instanceof Timestamp) {
			const elapsed = now - lastGeneratedAt.toMillis();
			if (elapsed < windowMs) {
				const hoursRemaining = Math.ceil((windowMs - elapsed) / (60 * 60 * 1000));
				throw new Error(`Preview limit reached. Try again in ${hoursRemaining}h.`);
			}
		}

		transaction.set(
			ref,
			{
				lastGeneratedAt: Timestamp.fromMillis(now),
				expiresAt: Timestamp.fromMillis(now + 31 * 24 * 60 * 60 * 1000),
				updatedAt: Timestamp.fromMillis(now),
			},
			{ merge: true },
		);
	});
}

export async function POST(request: Request) {
	try {
		const input = requestSchema.parse(await request.json());
		const runtimeConfig = await getRuntimeConfig();
		if (runtimeConfig.previewGenerationDisabled) {
			return NextResponse.json(
				{ error: runtimeConfig.previewDisabledMessage },
				{ status: 503 },
			);
		}
		await enforcePreviewRateLimit(request);
		const previewId = randomUUID();
		const latex = buildExamLatex({
			title: input.title,
			topics: input.topics,
			questionCount: input.questionCount,
			answerKey: false,
		});
		const compiled = await compileLatex({ latex });
		const firstPageImageBase64 = compiled.pages[0];

		if (!firstPageImageBase64) {
			throw new Error("Preview image rendering unavailable.");
		}
		const artifact = await storeAnonymousPreviewArtifact({
			previewId,
			compiled,
		});
		const now = Timestamp.now();

		await adminDb
			.collection("anonymous_previews")
			.doc(previewId)
			.create({
				title: input.title,
				topics: input.topics,
				questionCount: input.questionCount,
				examLatex: latex,
				examPdfStoragePath: artifact.pdfStoragePath,
				examRenderedPageStoragePaths: artifact.pageStoragePaths,
				examPdfBytes: artifact.pdfBytes,
				examRenderedPageCount: artifact.pageStoragePaths.length,
				createdAt: now,
				updatedAt: now,
				expiresAt: Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000),
			});

		return NextResponse.json({
			previewId,
			previewImageBase64: firstPageImageBase64,
			imageContentType: "image/png",
			pageCount: compiled.pages.length,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Preview generation failed.";
		const status = message.startsWith("Preview limit reached") ? 429 : 400;
		return NextResponse.json({ error: message }, { status });
	}
}
