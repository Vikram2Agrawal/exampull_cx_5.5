import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { completeAttemptUpload } from "@/lib/exams/attempts";

export const runtime = "nodejs";

type Context = {
	params: Promise<{ examId: string; attemptId: string }>;
};

const updateSchema = z.object({
	status: z.literal("uploaded"),
});

export async function PATCH(request: Request, context: Context) {
	const user = await getCurrentUser();

	if (!user) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}

	try {
		updateSchema.parse(await request.json());
		const { examId, attemptId } = await context.params;
		const result = await completeAttemptUpload(user, examId, attemptId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Attempt update failed.";
		const status = message.includes("Insufficient") ? 402 : 400;

		return NextResponse.json({ error: message }, { status });
	}
}
