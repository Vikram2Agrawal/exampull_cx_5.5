import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
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

	const pdf = attempt.get("visualFeedbackPdfBase64");

	if (typeof pdf !== "string") {
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
