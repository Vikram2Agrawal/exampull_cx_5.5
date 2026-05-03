import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readStorageBase64 } from "@/lib/exams/artifacts";
import { requestVisualFeedback } from "@/lib/exams/attempts";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

function downloadName(filename: string) {
	const safe =
		filename
			.normalize("NFKD")
			.replace(/[^\w.\- ]+/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.toLowerCase()
			.slice(0, 90) || "attempt";

	return `${safe}-visual-feedback.pdf`;
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ examId: string; attemptId: string }> },
) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	if (user.tier !== "guru") {
		return NextResponse.json({ error: "Visual feedback requires Guru." }, { status: 403 });
	}

	const { examId, attemptId } = await params;
	const attempt = await adminDb
		.collection("users")
		.doc(user.uid)
		.collection("exams")
		.doc(examId)
		.collection("attempts")
		.doc(attemptId)
		.get();

	if (!attempt.exists) {
		return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
	}

	const inlinePdf = attempt.get("visualFeedbackPdfBase64");
	const storagePath = attempt.get("visualFeedbackPdfStoragePath");
	const pdf =
		typeof inlinePdf === "string"
			? inlinePdf
			: typeof storagePath === "string"
				? await readStorageBase64(storagePath)
				: null;

	if (!pdf) {
		return NextResponse.json({ error: "Visual feedback is not ready yet." }, { status: 404 });
	}

	const filename = String(attempt.get("filename") ?? "attempt");

	return new Response(Buffer.from(pdf, "base64"), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${downloadName(filename)}"`,
			"Cache-Control": "private, max-age=60",
		},
	});
}

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ examId: string; attemptId: string }> },
) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		const { examId, attemptId } = await params;
		const result = await requestVisualFeedback({ user, examId, attemptId });

		return NextResponse.json(result, { status: 202 });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Visual annotations could not be requested.";
		const status = message.includes("Insufficient")
			? 402
			: message.includes("not found")
				? 404
				: message.includes("require Guru")
					? 403
					: 400;

		return NextResponse.json({ error: message }, { status });
	}
}
