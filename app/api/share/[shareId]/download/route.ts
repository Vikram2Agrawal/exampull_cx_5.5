import { NextResponse } from "next/server";
import { getSharedExamPdf } from "@/lib/exams/library";

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

export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
	const { shareId } = await params;
	const searchParams = new URL(request.url).searchParams;
	const type = searchParams.get("type") === "answer" ? "answer" : "exam";
	const exam = await getSharedExamPdf(shareId, type);
	const dispositionParam = searchParams.get("disposition");
	const disposition = dispositionParam === "inline" ? "inline" : "attachment";

	if (!exam) {
		return NextResponse.json(
			{ error: "Shared PDF not found or not available." },
			{ status: 404 },
		);
	}

	return new Response(Buffer.from(exam.pdfBase64, "base64"), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `${disposition}; filename="${downloadName(exam.title, type)}"`,
			"Cache-Control": "public, max-age=300",
		},
	});
}
