import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { examUpdateSchema, updateExamForUser } from "@/lib/exams/library";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ examId: string }> }) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	const { examId } = await params;

	try {
		const input = examUpdateSchema.parse(await request.json());
		const result = await updateExamForUser({ user, examId, input });

		if (!result) {
			return NextResponse.json({ error: "Exam not found." }, { status: 404 });
		}

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Exam update failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
