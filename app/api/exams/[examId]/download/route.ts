import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getExamPdfForUser } from "@/lib/exams/library";

export const runtime = "nodejs";

function downloadName(title: string, type: "exam" | "answer") {
	const safeTitle =
		title
			.normalize("NFKD")
			.replace(/[^\w.\- ]+/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.toLowerCase()
			.slice(0, 90) || "practice-exam";

	return `${safeTitle}-${type === "answer" ? "answer-key" : "exam"}.pdf`;
}

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { examId } = await params;
	const typeParam = new URL(request.url).searchParams.get("type");
	const dispositionParam = new URL(request.url).searchParams.get("disposition");
	const type = typeParam === "answer" ? "answer" : "exam";
	const disposition = dispositionParam === "inline" ? "inline" : "attachment";

	try {
		const result = await getExamPdfForUser({ user, examId, type });

		if (!result) {
			return NextResponse.json({ error: "PDF is not ready yet." }, { status: 404 });
		}

		const body = Buffer.from(result.pdfBase64, "base64");

		return new Response(body, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `${disposition}; filename="${downloadName(result.title, type)}"`,
				"Cache-Control": "private, max-age=60",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Download failed.";
		const status = message.includes("Answer keys") ? 403 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
