import { NextResponse } from "next/server";
import { getSharedExam } from "@/lib/exams/library";

export const runtime = "nodejs";

function downloadName(title: string) {
	const safeTitle =
		title
			.normalize("NFKD")
			.replace(/[^\w.\- ]+/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.toLowerCase()
			.slice(0, 90) || "practice-exam";

	return `${safeTitle}-exam.pdf`;
}

export async function GET(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
	const { shareId } = await params;
	const exam = await getSharedExam(shareId);
	const dispositionParam = new URL(request.url).searchParams.get("disposition");
	const disposition = dispositionParam === "inline" ? "inline" : "attachment";

	if (!exam?.examPdfBase64) {
		return NextResponse.json(
			{ error: "Shared exam not found or PDF is not ready." },
			{ status: 404 },
		);
	}

	return new Response(Buffer.from(exam.examPdfBase64, "base64"), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `${disposition}; filename="${downloadName(exam.title)}"`,
			"Cache-Control": "public, max-age=300",
		},
	});
}
