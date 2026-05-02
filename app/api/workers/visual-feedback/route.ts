import { NextResponse } from "next/server";
import { z } from "zod";
import { completeVisualFeedback } from "@/lib/exams/visual-feedback";
import { requireWorkerRequest } from "@/lib/tasks/auth";

export const runtime = "nodejs";

const requestSchema = z.object({
	userId: z.string().min(1),
	examId: z.string().min(1),
	attemptId: z.string().min(1),
});

export async function POST(request: Request) {
	const authError = await requireWorkerRequest(request);
	if (authError) {
		return authError;
	}

	const input = requestSchema.parse(await request.json());
	try {
		await completeVisualFeedback(input);

		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof Error && error.message === "Attempt not found.") {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}

		throw error;
	}
}
