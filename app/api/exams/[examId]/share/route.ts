import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createShareForExam, createShareSchema } from "@/lib/exams/library";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { examId } = await params;

	try {
		const body = await request.json().catch(() => ({}));
		const input = createShareSchema.parse(body);
		const result = await createShareForExam(user, examId, input);

		if (!result) {
			return NextResponse.json({ error: "Exam not found." }, { status: 404 });
		}

		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Share link creation failed.";
		const status = message.includes("Scholar") ? 403 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
