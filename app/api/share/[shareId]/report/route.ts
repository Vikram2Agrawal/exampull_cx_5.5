import { NextResponse } from "next/server";
import { reportSharedExam, shareReportSchema } from "@/lib/exams/library";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ shareId: string }> }) {
	const { shareId } = await params;

	try {
		const body = await request.json().catch(() => ({}));
		const input = shareReportSchema.parse(body);
		const result = await reportSharedExam(shareId, input);

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Share report failed.";
		const status = message.includes("not found") ? 404 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
