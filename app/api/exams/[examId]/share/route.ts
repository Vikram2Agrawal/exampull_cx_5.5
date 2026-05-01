import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createShareForExam } from "@/lib/exams/library";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ examId: string }> }) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { examId } = await params;
	const result = await createShareForExam(user, examId);

	if (!result) {
		return NextResponse.json({ error: "Exam not found." }, { status: 404 });
	}

	return NextResponse.json(result, { status: 201 });
}
